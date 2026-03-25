'use client'

import { useRouter } from 'next/navigation'
import { useState } from 'react'

interface BillDocumentPreviewProps {
  billId: string
  url: string
  filePath: string
}

export function BillDocumentPreview({ billId, url, filePath }: BillDocumentPreviewProps) {
  const [deleting, setDeleting] = useState(false)
  const router = useRouter()
  const isPdf = filePath.endsWith('.pdf')

  async function removeDocument() {
    if (!confirm('Delete the stored document from BillFlow? Bill details will stay, but the original file will be removed.')) return

    setDeleting(true)
    const response = await fetch(`/api/bills/${billId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ remove_document: true }),
    })
    setDeleting(false)

    if (!response.ok) {
      alert('Could not delete the stored document.')
      return
    }

    router.refresh()
  }

  return (
    <div className="card p-4 flex items-center gap-3">
      <a
        href={url}
        target="_blank"
        rel="noopener noreferrer"
        className="flex items-center gap-3 min-w-0 flex-1 hover:bg-gray-50 transition-colors group rounded-lg"
      >
        <div className="w-10 h-10 rounded-lg bg-gray-100 flex items-center justify-center text-lg shrink-0">
          {isPdf ? '📄' : '🖼️'}
        </div>
        <div className="flex-1 min-w-0">
          <p className="text-sm font-medium text-gray-900">
            {isPdf ? 'PDF Document' : 'Bill Image'}
          </p>
          <p className="text-xs text-gray-500">Stored in BillFlow</p>
        </div>
        <span className="text-sm text-gray-400 group-hover:text-brand-600 transition-colors">
          Open ↗
        </span>
      </a>

      <button
        type="button"
        onClick={removeDocument}
        disabled={deleting}
        className="text-xs px-3 py-2 rounded-lg border border-red-200 text-red-700 hover:bg-red-50 disabled:opacity-60"
      >
        {deleting ? 'Deleting...' : 'Delete file'}
      </button>
    </div>
  )
}
