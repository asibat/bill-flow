'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { UploadDropzone } from '@/components/bills/UploadDropzone'
import { ExtractionBanner } from '@/components/bills/ExtractionBanner'
import { VendorMatchBanner } from '@/components/bills/VendorMatchBanner'
import { BillFormFields } from '@/components/bills/BillFormFields'
import type { ExtractionResult, VendorMatch, BillFormData, UploadResponse } from '@/types'

interface DuplicateInfo {
  id: string
  payee_name: string
  amount: number
  due_date: string
  status: string
}

type Step = 'upload' | 'review'

interface UploadFormProps {
  onBack: () => void
}

export function UploadForm({ onBack }: UploadFormProps) {
  const [step, setStep] = useState<Step>('upload')
  const [uploading, setUploading] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [storagePath, setStoragePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BillFormData>({})
  const [vendor, setVendor] = useState<VendorMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const [duplicates, setDuplicates] = useState<DuplicateInfo[] | null>(null)
  const [activeExtraction, setActiveExtraction] = useState<ExtractionResult | null>(null)
  const router = useRouter()

  function applyExtraction(extraction: ExtractionResult, nextVendor: VendorMatch | null) {
    setActiveExtraction(extraction)
    const formData: BillFormData = {}
    for (const [key, value] of Object.entries(extraction)) {
      formData[key] = value ?? ''
    }
    setForm(formData)
    setVendor(nextVendor)
    setStep('review')
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)

    try {
      const storeFd = new FormData()
      storeFd.append('file', file)
      const storeRes = await fetch('/api/upload', { method: 'POST', body: storeFd })
      if (!storeRes.ok) {
        const body = await storeRes.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed (${storeRes.status})`)
      }

      const storeData: UploadResponse = await storeRes.json()
      setStoragePath(storeData.storage_path)
      applyExtraction(storeData.extraction, storeData.vendor ?? null)
    } catch (err) {
      console.error('Upload failed:', err)
      setError(err instanceof Error ? err.message : 'Upload failed')
    } finally {
      setUploading(false)
    }
  }

  async function reextract() {
    if (!storagePath) return

    setReextracting(true)
    try {
      const res = await fetch('/api/upload/reextract', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ storage_path: storagePath }),
      })
      const data: UploadResponse = await res.json()
      applyExtraction(data.extraction, data.vendor ?? null)
    } finally {
      setReextracting(false)
    }
  }

  function resetUpload() {
    setStep('upload')
    setActiveExtraction(null)
    setStoragePath('')
    setForm({})
    setVendor(null)
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
          ingestion_method: storagePath.endsWith('.pdf') ? 'upload_pdf' : 'upload_image',
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
      router.refresh()
      router.replace('/dashboard')
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

      <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">
          {step === 'upload' ? 'Document Upload' : 'Review Extraction'}
        </p>
        <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">
          {step === 'upload' ? 'Upload the bill and let BillFlow extract the details.' : 'Check the extracted payment details before saving.'}
        </h2>
        <p className="mt-2 text-sm leading-6 text-slate-500">
          {step === 'upload'
            ? 'PDFs and screenshots work best. You can still correct any field before the bill is saved.'
            : 'Save once the payee, amount, due date, and transfer reference all look correct.'}
        </p>
      </div>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <p className="font-medium">Error</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {step === 'upload' && (
        <UploadDropzone uploading={uploading} onUpload={handleUpload} />
      )}

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
              <div className="mt-3 flex gap-2">
                <button onClick={() => save(true)} className="btn-secondary" disabled={saving}>
                  Save Anyway
                </button>
                <button onClick={() => setDuplicates(null)} className="btn-ghost">
                  Cancel
                </button>
              </div>
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
            <BillFormFields form={form} setForm={setForm} />
            <div className="mt-6 flex flex-wrap gap-3">
              <button onClick={() => save(false)} disabled={saving} className="btn-primary">
                {saving ? 'Saving...' : 'Save Bill'}
              </button>
              <button onClick={resetUpload} className="btn-secondary">
                Upload Different File
              </button>
            </div>
          </div>
        </div>
      )}
    </div>
  )
}
