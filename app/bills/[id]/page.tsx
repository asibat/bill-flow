import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatAmount, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import { format } from 'date-fns'
import WireTransferCard from '@/components/bills/WireTransferCard'
import BillActions from '@/components/bills/BillActions'
import { BillDocumentPreview } from '@/components/bills/BillDocumentPreview'
import { BillEditableDetails } from '@/components/bills/BillEditableDetails'
import type { Bill } from '@/types'

export default async function BillDetailPage({ params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const { data: bill } = await supabase
    .from('bills')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user!.id)
    .single()

  if (!bill) notFound()

  const b = bill as Bill

  // Generate signed URL for the original document (valid 1 hour)
  let documentUrl: string | null = null
  if (b.raw_pdf_path) {
    const serviceClient = createServiceClient()
    const { data: signedUrlData } = await serviceClient.storage
      .from('bill-documents')
      .createSignedUrl(b.raw_pdf_path, 3600)
    documentUrl = signedUrlData?.signedUrl ?? null
  }

  return (
    <div className="p-8 max-w-3xl">
      <div className="flex items-start justify-between mb-6">
        <div>
          <div className="flex items-center gap-3 mb-1">
            <h1 className="text-2xl font-bold text-gray-900">{b.payee_name}</h1>
            <span className={`text-xs px-2 py-1 rounded-full font-medium ${getBillStatusColor(b.status)}`}>
              {getBillStatusLabel(b.status)}
            </span>
          </div>
          <p className="text-gray-500 text-sm">
            {b.source === 'doccle' ? '🟦 Via Doccle' : b.source === 'email' ? '📧 Email forward' : b.source === 'upload' ? '📎 Uploaded' : '✏️ Manual entry'}
            {' · '}Added {format(new Date(b.created_at), 'd MMM yyyy')}
          </p>
        </div>
        <div className="text-right">
          <p className="text-3xl font-bold text-gray-900">{formatAmount(b.amount, b.currency)}</p>
          <p className="text-sm text-gray-500">Due {format(new Date(b.due_date), 'd MMMM yyyy')}</p>
        </div>
      </div>

      {/* Needs review banner */}
      {b.needs_review && (
        <div className="bg-amber-50 border border-amber-300 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-amber-700">This bill needs your review</p>
          <p className="text-sm text-amber-600 mt-1">
            Some details could not be extracted automatically. Please review and edit the details below, then save to confirm.
          </p>
        </div>
      )}

      {/* AI explanation */}
      {b.explanation && (
        <div className="bg-blue-50 border border-blue-200 rounded-xl p-4 mb-6">
          <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">What is this bill?</p>
          <p className="text-sm text-blue-900">{b.explanation}</p>
          {b.extraction_confidence !== null && (
            <p className="text-xs text-blue-500 mt-2">
              Extraction confidence: {Math.round((b.extraction_confidence ?? 0) * 100)}%
              {(b.extraction_confidence ?? 0) < 0.7 && ' · ⚠️ Please verify the details below'}
            </p>
          )}
        </div>
      )}

      {/* Structured comm warning */}
      {b.structured_comm && b.structured_comm_valid === false && (
        <div className="bg-red-50 border border-red-300 rounded-xl p-4 mb-6">
          <p className="text-sm font-semibold text-red-700">⚠️ Structured communication may be incorrect</p>
          <p className="text-sm text-red-600 mt-1">
            The extracted reference <code className="font-mono">{b.structured_comm}</code> failed Modulo 97 validation. 
            Please verify it against your original document before paying.
          </p>
        </div>
      )}

      {/* Original document link */}
      {documentUrl && (
        <div className="mb-6">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Original Document</h2>
          <BillDocumentPreview url={documentUrl} filePath={b.raw_pdf_path!} />
        </div>
      )}

      {/* Wire Transfer Details */}
      {(b.iban || b.structured_comm) && (
        <div className="mb-6 max-w-3xl">
          <h2 className="text-base font-semibold text-gray-900 mb-3">Wire Transfer Details</h2>
          <WireTransferCard
            beneficiary={b.payee_name}
            iban={b.iban || ''}
            bic={b.bic || ''}
            amount={b.amount}
            currency={b.currency}
            structuredComm={b.structured_comm || ''}
            dueDate={b.due_date}
            structuredCommValid={b.structured_comm_valid}
          />
        </div>
      )}

      {/* Bill metadata — editable */}
      <BillEditableDetails bill={b} defaultEditing={b.needs_review} />

      {/* Actions */}
      <BillActions bill={b} />
    </div>
  )
}
