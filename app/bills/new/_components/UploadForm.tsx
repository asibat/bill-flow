'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { UploadDropzone } from '@/components/bills/UploadDropzone'
import { ExtractionBanner } from '@/components/bills/ExtractionBanner'
import { VendorMatchBanner } from '@/components/bills/VendorMatchBanner'
import { BillFormFields } from '@/components/bills/BillFormFields'
import type { ExtractionResult, VendorMatch, BillFormData, UploadResponse } from '@/types'

interface UploadFormProps {
  onBack: () => void
}

export function UploadForm({ onBack }: UploadFormProps) {
  const [uploading, setUploading] = useState(false)
  const [reextracting, setReextracting] = useState(false)
  const [extraction, setExtraction] = useState<ExtractionResult | null>(null)
  const [storagePath, setStoragePath] = useState('')
  const [saving, setSaving] = useState(false)
  const [form, setForm] = useState<BillFormData>({})
  const [vendor, setVendor] = useState<VendorMatch | null>(null)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  function applyExtraction(data: UploadResponse) {
    setExtraction(data.extraction)
    setStoragePath(data.storage_path)
    const formData: BillFormData = {}
    for (const [key, value] of Object.entries(data.extraction)) {
      formData[key] = value ?? ''
    }
    setForm(formData)
    setVendor(data.vendor ?? null)
  }

  async function handleUpload(file: File) {
    setUploading(true)
    setError(null)
    try {
      const fd = new FormData()
      fd.append('file', file)
      const res = await fetch('/api/upload', { method: 'POST', body: fd })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || `Upload failed (${res.status})`)
      }
      const data: UploadResponse = await res.json()
      applyExtraction(data)
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
    const res = await fetch('/api/upload/reextract', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ storage_path: storagePath }),
    })
    const data: UploadResponse = await res.json()
    applyExtraction(data)
    setReextracting(false)
  }

  function resetUpload() {
    setExtraction(null)
    setStoragePath('')
    setForm({})
    setVendor(null)
  }

  async function save() {
    setSaving(true)
    const structured = form.structured_comm ? formatStructuredComm(form.structured_comm as string) : null
    await fetch('/api/bills', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({
        ...form,
        structured_comm: structured,
        structured_comm_valid: structured ? validateStructuredComm(structured) : null,
        raw_pdf_path: storagePath,
        source: 'upload',
        payee_id: vendor?.payee_id || null,
      }),
    })
    router.push('/dashboard')
  }

  const confidence = extraction?.confidence ?? 0

  return (
    <div className="space-y-5">
      <button onClick={onBack} className="text-sm text-brand-600 hover:underline">&larr; Back</button>

      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">
          <p className="font-medium">Upload failed</p>
          <p className="mt-1">{error}</p>
        </div>
      )}

      {!extraction ? (
        <UploadDropzone uploading={uploading} onUpload={handleUpload} />
      ) : (
        <div className="space-y-4">
          <ExtractionBanner
            confidence={confidence}
            reextracting={reextracting}
            onReextract={reextract}
            onReupload={resetUpload}
          />

          {vendor && <VendorMatchBanner vendor={vendor} />}

          <BillFormFields form={form} setForm={setForm} />
          <div className="flex gap-3">
            <button onClick={save} disabled={saving} className="btn-primary">
              {saving ? 'Saving…' : 'Save Bill'}
            </button>
            <button onClick={onBack} className="btn-secondary">Cancel</button>
          </div>
        </div>
      )}
    </div>
  )
}
