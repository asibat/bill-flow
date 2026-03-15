'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { UploadDropzone } from '@/components/bills/UploadDropzone'
import { ExtractionBanner } from '@/components/bills/ExtractionBanner'
import { VendorMatchBanner } from '@/components/bills/VendorMatchBanner'
import { BillFormFields } from '@/components/bills/BillFormFields'
import { RedactionPreview } from '@/components/bills/RedactionPreview'
import { ExtractionComparison } from '@/components/bills/ExtractionComparison'
import type { ExtractionResult, VendorMatch, BillFormData, UploadResponse } from '@/types'

interface DuplicateInfo {
  id: string
  payee_name: string
  amount: number
  due_date: string
  status: string
}

interface PiiScanResult {
  text: string
  ocrConfidence: number
  piiMatches: Array<{
    type: string
    value: string
    start: number
    end: number
    replacement: string
  }>
  matchCount: number
}

type Step = 'upload' | 'privacy-choice' | 'redaction' | 'comparison' | 'review'

interface UploadFormProps {
  onBack: () => void
}

const OCR_CONFIDENCE_THRESHOLD = 80

export function UploadForm({ onBack }: UploadFormProps) {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [scanning, setScanning] = useState(false)
  const [extracting, setExtracting] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [storagePath, setStoragePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BillFormData>({})
  const [vendor, setVendor] = useState<VendorMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateInfo[] | null>(null)
  const [piiScan, setPiiScan] = useState<PiiScanResult | null>(null)
  // Keep both extractions for comparison
  const [directExtraction, setDirectExtraction] = useState<ExtractionResult | null>(null)
  const [redactedExtraction, setRedactedExtraction] = useState<ExtractionResult | null>(null)
  const [activeExtraction, setActiveExtraction] = useState<ExtractionResult | null>(null)
  const [directVendor, setDirectVendor] = useState<VendorMatch | null>(null)
  const router = useRouter()

  function applyFinalExtraction(extraction: ExtractionResult, v: VendorMatch | null) {
    setActiveExtraction(extraction)
    const formData: BillFormData = {}
    for (const [key, value] of Object.entries(extraction)) {
      formData[key] = value ?? ''
    }
    setForm(formData)
    setVendor(v)
    setStep('review')
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)

    try {
      // Step 1: Store file + direct extraction
      const storeFd = new FormData()
      storeFd.append('file', file)
      const storeRes = await fetch('/api/upload', { method: 'POST', body: storeFd })
      if (!storeRes.ok) {
        const body = await storeRes.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed (${storeRes.status})`)
      }
      const storeData: UploadResponse = await storeRes.json()
      setStoragePath(storeData.storage_path)
      setDirectExtraction(storeData.extraction)
      setDirectVendor(storeData.vendor ?? null)

      // Step 2: PII scan (parallel would be ideal, but sequential for clarity)
      setUploading(false)
      setScanning(true)

      const scanFd = new FormData()
      scanFd.append('file', file)
      const scanRes = await fetch('/api/pii/scan', { method: 'POST', body: scanFd })

      if (scanRes.ok) {
        const scanData: PiiScanResult = await scanRes.json()
        if (scanData.matchCount > 0) {
          setPiiScan(scanData)
          setStep('privacy-choice')
          return
        }
      }

      // No PII found or scan failed — go straight to review with direct extraction
      applyFinalExtraction(storeData.extraction, storeData.vendor ?? null)
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
      setScanning(false)
    }
  }

  function handlePrivacyChoice(choice: 'strict' | 'skip') {
    if (choice === 'skip') {
      // User chose to skip redaction — use direct extraction
      applyFinalExtraction(directExtraction!, directVendor)
    } else {
      // User chose strict privacy — show redaction preview
      setStep('redaction')
    }
  }

  async function handleRedactionApproved(redactedText: string) {
    setExtracting(true)
    setError(null)
    try {
      const res = await fetch('/api/pii/extract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ redactedText, storagePath }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Extraction failed (${res.status})`)
      }
      const data: UploadResponse = await res.json()
      setRedactedExtraction(data.extraction)

      // If OCR confidence is low, show comparison
      if (piiScan && piiScan.ocrConfidence < OCR_CONFIDENCE_THRESHOLD) {
        setStep('comparison')
      } else {
        // OCR confidence is good — use redacted extraction (privacy-first)
        applyFinalExtraction(data.extraction, data.vendor ?? null)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Extraction failed')
      // Fall back to direct extraction on error
      if (directExtraction) {
        applyFinalExtraction(directExtraction, directVendor)
      }
    } finally {
      setExtracting(false)
    }
  }

  function handleComparisonSelect(extraction: ExtractionResult) {
    applyFinalExtraction(extraction, directVendor)
  }

  async function reextract() {
    if (!storagePath) return
    setReextracting(true)
    const res = await fetch('/api/upload/reextract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_path: storagePath }),
    })
    const data: UploadResponse = await res.json()
    setDirectExtraction(data.extraction)
    applyFinalExtraction(data.extraction, data.vendor ?? null)
    setReextracting(false)
  }

  function resetUpload() {
    setStep('upload')
    setDirectExtraction(null)
    setRedactedExtraction(null)
    setActiveExtraction(null)
    setStoragePath('')
    setForm({})
    setVendor(null)
    setDirectVendor(null)
    setPiiScan(null)
    setDuplicates(null)
    setError(null)
  }

  async function save(force = false) {
    setSaving(true)
    setError(null)
    setDuplicates(null)
    const structured = form.structured_comm ? formatStructuredComm(form.structured_comm as string) : null
    try {
      const res = await fetch('/api/bills', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          ...form,
          structured_comm: structured,
          structured_comm_valid: structured ? validateStructuredComm(structured) : null,
          raw_pdf_path: storagePath,
          source: 'upload',
          payee_id: vendor?.payee_id || null,
          ...(force ? { force: true } : {}),
        }),
      })
      if (res.status === 409) {
        const body = await res.json()
        setDuplicates(body.duplicates ?? [])
        return
      }
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Save failed (${res.status})`)
      }
      router.push('/dashboard')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Save failed')
    } finally {
      setSaving(false)
    }
  }

  const confidence = activeExtraction?.confidence ?? 0

  return (
    <div className="space-y-5">
      <button onClick={step === 'upload' ? onBack : resetUpload} className="text-sm text-brand-600 hover:underline">
        &larr; {step === 'upload' ? 'Back' : 'Start Over'}
      </button>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {/* Step 1: Upload */}
      {step === 'upload' && (
        <UploadDropzone uploading={uploading || scanning} onUpload={handleUpload} />
      )}
      {scanning && (
        <div className="card p-4 text-center text-sm text-gray-500">
          Scanning for personal information...
        </div>
      )}

      {/* Step 2: Privacy choice */}
      {step === 'privacy-choice' && piiScan && (
        <div className="space-y-4">
          <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-800">
              Personal information detected ({piiScan.matchCount} item{piiScan.matchCount !== 1 ? 's' : ''})
            </p>
            <p className="text-sm text-amber-700 mt-1">
              We found personal details in this document. Choose how you want to proceed:
            </p>
          </div>

          <div className="grid grid-cols-2 gap-4">
            <button
              onClick={() => handlePrivacyChoice('strict')}
              className="card p-5 text-left hover:shadow-md hover:border-green-300 transition-all group"
            >
              <div className="text-2xl mb-2">🔒</div>
              <p className="font-semibold text-gray-900 group-hover:text-green-700">Strict Privacy</p>
              <p className="text-sm text-gray-500 mt-1">
                Review and redact personal data before sending to AI.
                The AI will only see redacted text.
              </p>
              {piiScan.ocrConfidence < OCR_CONFIDENCE_THRESHOLD && (
                <p className="text-xs text-amber-600 mt-2">
                  OCR confidence is {Math.round(piiScan.ocrConfidence)}% — you'll see a comparison to verify accuracy
                </p>
              )}
            </button>

            <button
              onClick={() => handlePrivacyChoice('skip')}
              className="card p-5 text-left hover:shadow-md hover:border-blue-300 transition-all group"
            >
              <div className="text-2xl mb-2">🎯</div>
              <p className="font-semibold text-gray-900 group-hover:text-blue-700">Maximum Accuracy</p>
              <p className="text-sm text-gray-500 mt-1">
                Send the original document directly to AI. More accurate extraction but the AI sees all content.
              </p>
              <p className="text-xs text-gray-400 mt-2">
                Extraction already completed with {Math.round((directExtraction?.confidence ?? 0) * 100)}% confidence
              </p>
            </button>
          </div>
        </div>
      )}

      {/* Step 3: Redaction preview */}
      {step === 'redaction' && piiScan && (
        <RedactionPreview
          text={piiScan.text}
          piiMatches={piiScan.piiMatches}
          ocrConfidence={piiScan.ocrConfidence}
          onApprove={handleRedactionApproved}
          onSkip={() => applyFinalExtraction(directExtraction!, directVendor)}
          loading={extracting}
        />
      )}

      {/* Step 4: Side-by-side comparison (low OCR confidence) */}
      {step === 'comparison' && directExtraction && redactedExtraction && piiScan && (
        <ExtractionComparison
          directExtraction={directExtraction}
          redactedExtraction={redactedExtraction}
          ocrConfidence={piiScan.ocrConfidence}
          onSelect={handleComparisonSelect}
        />
      )}

      {/* Step 5: Review extraction */}
      {step === 'review' && activeExtraction && (
        <div className="space-y-4">
          <ExtractionBanner
            confidence={confidence}
            reextracting={reextracting}
            onReextract={reextract}
            onReupload={resetUpload}
          />

          {vendor && <VendorMatchBanner vendor={vendor} />}

          {duplicates && duplicates.length > 0 && (
            <div className="p-4 rounded-lg bg-amber-50 border border-amber-300 text-sm">
              <p className="font-semibold text-amber-800">Possible duplicate detected</p>
              <p className="text-amber-700 mt-1">A similar bill already exists:</p>
              <ul className="mt-2 space-y-1">
                {duplicates.map(d => (
                  <li key={d.id} className="flex items-center gap-2 text-amber-700">
                    <span className="font-medium">{d.payee_name}</span>
                    <span>·</span>
                    <span>{d.amount?.toFixed(2)} EUR</span>
                    <span>·</span>
                    <span>Due {d.due_date}</span>
                    <span>·</span>
                    <span className="capitalize">{d.status}</span>
                  </li>
                ))}
              </ul>
              <div className="flex gap-3 mt-3">
                <button onClick={() => save(true)} disabled={saving} className="btn-primary text-sm">
                  {saving ? 'Saving...' : 'Save Anyway'}
                </button>
                <button onClick={() => setDuplicates(null)} className="btn-secondary text-sm">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <BillFormFields form={form} setForm={setForm} />
          {!duplicates && (
            <div className="flex gap-3">
              <button onClick={() => save()} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button onClick={onBack} className="btn-secondary">Cancel</button>
            </div>
          )}
        </div>
      )}
    </div>
  )
}
