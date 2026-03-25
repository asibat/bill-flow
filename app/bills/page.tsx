import { createServerSupabaseClient } from '@/lib/supabase/server'
import { formatAmount, formatDueDate, getBillStatusColor, getBillStatusLabel } from '@/lib/utils'
import Link from 'next/link'
import type { Bill } from '@/types'

export default async function BillsPage({ searchParams }: { searchParams: { status?: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const status = searchParams.status || 'all'

  let query = supabase
    .from('bills')
    .select('*')
    .eq('user_id', user!.id)
    .order('due_date', { ascending: true })

  if (status !== 'all') query = query.eq('status', status)

  const { data } = await query
  const bills: Bill[] = data || []

  const tabs = [
    { key: 'all', label: 'All' },
    { key: 'received', label: 'To Pay' },
    { key: 'overdue', label: 'Overdue' },
    { key: 'payment_sent', label: 'Sent' },
    { key: 'confirmed', label: 'Confirmed' },
  ]

  const unpaidBills = bills.filter(bill => !['payment_sent', 'confirmed'].includes(bill.status))
  const overdueBills = bills.filter(bill => bill.status === 'overdue')
  const reviewBills = bills.filter(bill => bill.needs_review)
  const paidBills = bills.filter(bill => ['payment_sent', 'confirmed'].includes(bill.status))

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-6xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.2fr_0.8fr]">
            <div>
              <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                Bills Workspace
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Track what is open, urgent, and already settled.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600 md:text-base">
                Use this view to review the whole queue, jump into a specific bill, or start the next payment session.
              </p>
              <div className="mt-5 flex flex-wrap gap-3">
                <Link href="/bills/new" className="btn-primary">Add Bill</Link>
                <Link href="/bills/batch" className="btn-secondary">Start Payment Session</Link>
              </div>
            </div>

            <div className="grid gap-3 sm:grid-cols-2 lg:grid-cols-2">
              <BillsMetric label="Open bills" value={String(unpaidBills.length)} sub={unpaidBills.length ? 'Still need action' : 'Nothing open'} tone="blue" />
              <BillsMetric label="Overdue" value={String(overdueBills.length)} sub={overdueBills.length ? 'Needs attention now' : 'All caught up'} tone={overdueBills.length ? 'red' : 'green'} />
              <BillsMetric label="Needs review" value={String(reviewBills.length)} sub={reviewBills.length ? 'Extracted details to confirm' : 'Queue is clear'} tone={reviewBills.length ? 'amber' : 'green'} />
              <BillsMetric label="Settled" value={String(paidBills.length)} sub={paidBills.length ? 'Sent or confirmed' : 'Nothing settled yet'} tone="green" />
            </div>
          </div>
        </section>

        <div className="flex gap-2 overflow-x-auto rounded-2xl bg-slate-100 p-1.5">
          {tabs.map(t => (
            <Link
              key={t.key}
              href={`/bills?status=${t.key}`}
              className={`whitespace-nowrap rounded-xl px-4 py-2 text-sm font-medium transition-colors ${status === t.key ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'}`}
            >
              {t.label}
            </Link>
          ))}
        </div>

        {bills.length === 0 ? (
          <div className="card p-12 text-center">
            <div className="text-4xl mb-3">📭</div>
            <p className="text-gray-500">No bills found</p>
            <Link href="/bills/new" className="btn-primary mt-4 inline-flex">Add a bill</Link>
          </div>
        ) : (
          <div className="overflow-hidden rounded-[24px] border border-slate-200 bg-white shadow-sm">
            <div className="hidden grid-cols-[minmax(0,1.5fr)_170px_130px_120px] gap-4 border-b border-slate-200 bg-slate-50 px-5 py-3 text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-400 md:grid">
              <span>Bill</span>
              <span>Due</span>
              <span>Status</span>
              <span className="text-right">Amount</span>
            </div>
            {bills.map(bill => (
              <Link
                key={bill.id}
                href={`/bills/${bill.id}`}
                className={`block border-b border-slate-100 px-4 py-4 transition-colors last:border-b-0 hover:bg-slate-50 md:px-5 ${bill.needs_review ? 'bg-amber-50/30' : ''}`}
              >
                <div className="grid gap-3 md:grid-cols-[minmax(0,1.5fr)_170px_130px_120px] md:items-center">
                  <div className="min-w-0">
                    <div className="flex min-w-0 items-start gap-3">
                      <div className="flex h-10 w-10 shrink-0 items-center justify-center rounded-xl bg-slate-50 text-lg">
                        {bill.source === 'doccle' ? '🟦' : bill.source === 'email' ? '📧' : bill.source === 'upload' ? '📎' : '✏️'}
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <p className="truncate text-sm font-semibold text-slate-900">{bill.payee_name}</p>
                          {bill.needs_review && (
                            <span className="rounded-full bg-amber-100 px-2 py-0.5 text-[11px] font-medium text-amber-700">
                              Review
                            </span>
                          )}
                        </div>
                        <div className="mt-1 flex flex-wrap gap-2 text-xs text-slate-500">
                          <span className="capitalize">{bill.source}</span>
                          {bill.structured_comm && (
                            <span className={bill.structured_comm_valid ? 'text-green-700' : 'text-red-700'}>
                              {bill.structured_comm_valid ? 'Reference valid' : 'Reference needs check'}
                            </span>
                          )}
                        </div>
                      </div>
                    </div>
                  </div>

                  <div className="text-sm text-slate-600">
                    {formatDueDate(bill.due_date)}
                  </div>

                  <div>
                    <span className={`inline-flex text-xs px-2 py-1 rounded-full font-medium ${getBillStatusColor(bill.status)}`}>
                      {getBillStatusLabel(bill.status)}
                    </span>
                  </div>

                  <div className="text-left md:text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatAmount(bill.amount, bill.currency)}</p>
                  </div>
                </div>
              </Link>
            ))}
          </div>
        )}
      </div>
    </div>
  )
}

function BillsMetric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'blue' | 'red' | 'amber' | 'green' }) {
  const tones = {
    blue: 'border-brand-200 bg-brand-50/80',
    red: 'border-red-200 bg-red-50/80',
    amber: 'border-amber-200 bg-amber-50/80',
    green: 'border-green-200 bg-green-50/80',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  )
}
