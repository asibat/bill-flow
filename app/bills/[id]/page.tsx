import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { notFound } from 'next/navigation'
import { formatAmount, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import { format } from 'date-fns'
import WireTransferCard from '@/components/bills/WireTransferCard'
import BillActions from '@/components/bills/BillActions'
import { BillDocumentPreview } from '@/components/bills/BillDocumentPreview'
import { BillEditableDetails } from '@/components/bills/BillEditableDetails'
import type { Bill } from '@/types'

function getIngestionMethodSummary(method: Bill['ingestion_method']): string | null {
  switch (method) {
    case 'doccle_html_pdf':
      return 'Doccle HTML + PDF'
    case 'email_attachment':
      return 'Email attachment'
    case 'email_body_text':
      return 'Email body'
    case 'upload_pdf':
      return 'Uploaded PDF'
    case 'upload_image':
      return 'Uploaded image'
    case 'manual_entry':
      return 'Manual entry'
    default:
      return null
  }
}

function getReviewReasons(bill: Bill) {
  const reasons: string[] = []

  if ((bill.extraction_confidence ?? 1) < 0.8) {
    reasons.push(`Low extraction confidence (${Math.round((bill.extraction_confidence ?? 0) * 100)}%)`)
  }
  if (bill.structured_comm && bill.structured_comm_valid === false) {
    reasons.push('Structured communication failed Modulo 97 validation')
  }
  if (!bill.iban) {
    reasons.push('IBAN is missing')
  }
  if (!bill.structured_comm && bill.source !== 'manual') {
    reasons.push('Payment reference is missing')
  }

  return reasons
}

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
  const reviewReasons = getReviewReasons(b)

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
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="flex flex-wrap items-center gap-3 mb-2">
                <span className={`text-xs px-2.5 py-1 rounded-full font-medium ${getBillStatusColor(b.status)}`}>
                  {getBillStatusLabel(b.status)}
                </span>
                <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                  {b.source === 'doccle' ? 'Via Doccle' : b.source === 'email' ? 'Email forward' : b.source === 'upload' ? 'Uploaded' : 'Manual entry'}
                </span>
                {getIngestionMethodSummary(b.ingestion_method) && (
                  <span className="rounded-full bg-slate-100 px-2.5 py-1 text-xs font-medium text-slate-600">
                    {getIngestionMethodSummary(b.ingestion_method)}
                  </span>
                )}
              </div>
              <h1 className="text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">{b.payee_name}</h1>
              <p className="mt-3 text-sm leading-6 text-slate-500">
                Added {format(new Date(b.created_at), 'd MMM yyyy')}. Keep the payment details below aligned with the original bill before you send the transfer.
              </p>
            </div>

            <div className="rounded-[24px] border border-brand-200 bg-gradient-to-br from-brand-50 to-white p-5">
              <p className="text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">Payment Snapshot</p>
              <p className="mt-3 text-4xl font-bold tracking-tight text-slate-900">{formatAmount(b.amount, b.currency)}</p>
              <p className="mt-2 text-sm text-slate-600">Due {format(new Date(b.due_date), 'd MMMM yyyy')}</p>
              <div className="mt-5 grid grid-cols-2 gap-3 text-sm">
                <SnapshotMetric label="Reference" value={b.structured_comm ? (b.structured_comm_valid ? 'Validated' : 'Needs check') : 'Missing'} />
                <SnapshotMetric label="Review" value={b.needs_review ? 'Pending' : 'Confirmed'} />
              </div>
            </div>
          </div>
        </section>

        {b.needs_review && (
          <div className="bg-amber-50 border border-amber-300 rounded-xl p-4">
            <p className="text-sm font-semibold text-amber-700">This bill needs your review</p>
            <p className="text-sm text-amber-600 mt-1">
              Some details could not be extracted automatically. Please review and edit the details below, then save to confirm.
            </p>
            {reviewReasons.length > 0 && (
              <div className="mt-3 space-y-1">
                {reviewReasons.map(reason => (
                  <p key={reason} className="text-xs text-amber-700">• {reason}</p>
                ))}
              </div>
            )}
          </div>
        )}

        {b.explanation && (
          <div className="bg-blue-50 border border-blue-200 rounded-xl p-4">
            <p className="text-xs font-semibold text-blue-600 mb-1 uppercase tracking-wide">What is this bill?</p>
            <p className="text-sm text-blue-900">{b.explanation}</p>
            {b.extraction_confidence !== null && (
              <p className="text-xs text-blue-500 mt-2">
                Extraction confidence: {Math.round((b.extraction_confidence ?? 0) * 100)}%
                {(b.extraction_confidence ?? 0) < 0.7 && ' · Please verify the details below'}
              </p>
            )}
          </div>
        )}

        {b.structured_comm && b.structured_comm_valid === false && (
          <div className="bg-red-50 border border-red-300 rounded-xl p-4">
            <p className="text-sm font-semibold text-red-700">Structured communication may be incorrect</p>
            <p className="text-sm text-red-600 mt-1">
              The extracted reference <code className="font-mono">{b.structured_comm}</code> failed Modulo 97 validation.
              Please verify it against your original document before paying.
            </p>
          </div>
        )}

        <div className="grid gap-6 xl:grid-cols-[1.2fr_0.8fr]">
          <div className="space-y-6">
            {(b.iban || b.structured_comm) && (
              <div>
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

            <BillEditableDetails bill={b} defaultEditing={b.needs_review} />
          </div>

          <div className="space-y-6">
            {documentUrl && (
              <div>
                <h2 className="text-base font-semibold text-gray-900 mb-3">Original Document</h2>
                <BillDocumentPreview billId={b.id} url={documentUrl} filePath={b.raw_pdf_path!} />
              </div>
            )}

            <div className="card p-5">
              <h2 className="text-base font-semibold text-gray-900 mb-4">Bill Activity</h2>
              <div className="space-y-3 text-sm">
                <ActivityRow
                  label="Imported"
                  value={`${format(new Date(b.created_at), 'd MMM yyyy HH:mm')} · ${getIngestionMethodSummary(b.ingestion_method) ?? b.source}`}
                />
                {b.needs_review ? (
                  <ActivityRow label="Review status" value="Awaiting your confirmation of extracted details" tone="amber" />
                ) : (
                  <ActivityRow label="Review status" value="Details confirmed" tone="green" />
                )}
                {b.paid_at && (
                  <ActivityRow
                    label={b.status === 'confirmed' ? 'Payment confirmed' : 'Payment sent'}
                    value={format(new Date(b.paid_at), 'd MMM yyyy HH:mm')}
                    tone={b.status === 'confirmed' ? 'green' : 'blue'}
                  />
                )}
                {b.raw_pdf_path ? (
                  <ActivityRow label="Document" value="Original file stored in BillFlow" />
                ) : (
                  <ActivityRow label="Document" value="Original file removed or not available" />
                )}
              </div>
            </div>
            <BillActions bill={b} />
          </div>
        </div>
      </div>
    </div>
  )
}

function SnapshotMetric({ label, value }: { label: string; value: string }) {
  return (
    <div className="rounded-2xl bg-white/80 p-3">
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400">{label}</p>
      <p className="mt-2 text-sm font-medium text-slate-800">{value}</p>
    </div>
  )
}

function ActivityRow({ label, value, tone = 'gray' }: { label: string; value: string; tone?: 'gray' | 'blue' | 'green' | 'amber' }) {
  const toneClass = {
    gray: 'text-gray-600',
    blue: 'text-blue-700',
    green: 'text-green-700',
    amber: 'text-amber-700',
  }[tone]

  return (
    <div className="flex items-start justify-between gap-4 border-b border-gray-100 pb-3 last:border-b-0 last:pb-0">
      <span className="text-gray-500">{label}</span>
      <span className={`text-right ${toneClass}`}>{value}</span>
    </div>
  )
}
