'use client'

import { useMemo, useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import { formatAmount } from '@/lib/utils'
import WireTransferCard from '@/components/bills/WireTransferCard'
import type { Bill } from '@/types'
import Link from 'next/link'

type Step = 'select' | 'pay' | 'done'

export default function BatchClient({ bills }: { bills: Bill[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('select')
  const [currentIndex, setCurrentIndex] = useState(0)
  const [sentBillIds, setSentBillIds] = useState<Set<string>>(new Set())
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  const selectedBills = useMemo(() => bills.filter(b => selected.has(b.id)), [bills, selected])
  const total = selectedBills.reduce((sum, b) => sum + b.amount, 0)
  const sentBills = selectedBills.filter(b => sentBillIds.has(b.id))
  const remainingBills = selectedBills.filter(b => !sentBillIds.has(b.id))
  const currentBill = selectedBills[currentIndex] ?? null

  function toggleBill(id: string) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(id)) next.delete(id)
      else next.add(id)
      return next
    })
  }

  function selectAll() {
    if (selected.size === bills.length) {
      setSelected(new Set())
    } else {
      setSelected(new Set(bills.map(b => b.id)))
    }
  }

  function startSession() {
    setStep('pay')
    setCurrentIndex(0)
    setSentBillIds(new Set())
    setError(null)
  }

  async function markCurrentBillSent() {
    if (!currentBill) return

    setSaving(true)
    setError(null)

    try {
      const response = await fetch(`/api/bills/${currentBill.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          status: 'payment_sent',
          paid_at: new Date().toISOString(),
        }),
      })

      const body = await response.json().catch(() => ({}))
      if (!response.ok) {
        throw new Error(body.error || 'Could not update the bill status')
      }

      setSentBillIds(prev => new Set(prev).add(currentBill.id))

      if (currentIndex >= selectedBills.length - 1) {
        setStep('done')
      } else {
        setCurrentIndex(prev => prev + 1)
      }
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Could not mark the bill as sent')
    } finally {
      setSaving(false)
    }
  }

  function skipCurrentBill() {
    if (currentIndex >= selectedBills.length - 1) {
      setStep('done')
      return
    }
    setCurrentIndex(prev => prev + 1)
    setError(null)
  }

  function goToPrevious() {
    setCurrentIndex(prev => Math.max(0, prev - 1))
    setError(null)
  }

  function finishSession() {
    router.refresh()
    router.replace('/bills')
  }

  if (bills.length === 0) {
    return (
      <div className="px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <div className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
            <h1 className="text-3xl font-bold tracking-tight text-slate-900">Payment Session</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">No unpaid bills are currently ready for a payment session.</p>
          </div>
          <div className="card p-12 text-center">
            <p className="text-gray-500">No unpaid bills to pay right now.</p>
            <Link href="/bills" className="text-brand-600 hover:underline text-sm mt-2 inline-block">
              Back to bills
            </Link>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'done') {
    return (
      <div className="px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
            <div className="inline-flex items-center rounded-full bg-green-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-green-700">
              Session Complete
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Your payment session is finished.</h1>
            <p className="mt-3 text-sm leading-6 text-slate-600">
              BillFlow marked each completed transfer as <span className="font-medium text-slate-900">payment sent</span>. Skipped bills remain open in your queue.
            </p>
          </section>

          <div className="grid gap-4 md:grid-cols-2">
            <SummaryPanel
              title="Marked as sent"
              empty="No bills were marked as sent in this session."
              items={sentBills}
              tone="green"
            />
            <SummaryPanel
              title="Still open"
              empty="No bills left open from this session."
              items={remainingBills}
              tone="amber"
            />
          </div>

          <div className="flex flex-wrap gap-3">
            <button onClick={finishSession} className="btn-primary">Back to Bills</button>
            <button onClick={() => setStep('select')} className="btn-secondary">Start another session</button>
          </div>
        </div>
      </div>
    )
  }

  if (step === 'pay' && currentBill) {
    return (
      <div className="px-4 py-5 md:px-8 md:py-8">
        <div className="mx-auto max-w-4xl space-y-6">
          <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
            <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
              <div>
                <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                  Payment Session
                </div>
                <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Pay one bill at a time.</h1>
                <p className="mt-3 text-sm leading-6 text-slate-600">
                  Open your bank app, copy the transfer details below, send the payment, then mark this bill as sent and move to the next one.
                </p>
              </div>
              <button onClick={() => setStep('select')} className="text-sm text-gray-500 hover:text-gray-700">
                Back to selection
              </button>
            </div>

            <div className="mt-6 grid gap-3 md:grid-cols-3">
              <SessionMetric label="Progress" value={`${currentIndex + 1} / ${selectedBills.length}`} sub={`${sentBills.length} marked as sent`} tone="blue" />
              <SessionMetric label="Session total" value={formatAmount(total)} sub="Across all selected bills" tone="green" />
              <SessionMetric label="Current bill" value={formatAmount(currentBill.amount, currentBill.currency)} sub={currentBill.payee_name} tone={currentBill.status === 'overdue' ? 'red' : 'amber'} />
            </div>
          </section>

          {error && (
            <div className="rounded-xl border border-red-200 bg-red-50 p-4 text-sm text-red-700">
              {error}
            </div>
          )}

          <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
            <div className="mb-5 flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
              <div>
                <p className="text-base font-semibold tracking-tight text-slate-900">{currentBill.payee_name}</p>
                <p className="mt-1 text-sm text-slate-500">
                  Due {format(new Date(currentBill.due_date), 'd MMM yyyy')}
                  {currentBill.status === 'overdue' && ' · overdue'}
                </p>
              </div>
              <div className="text-left sm:text-right">
                <p className="text-xl font-bold tracking-tight text-slate-900">{formatAmount(currentBill.amount, currentBill.currency)}</p>
                <p className="text-xs text-slate-400">{currentBill.status}</p>
              </div>
            </div>

            <WireTransferCard
              beneficiary={currentBill.payee_name}
              iban={currentBill.iban ?? ''}
              bic={currentBill.bic ?? ''}
              amount={currentBill.amount}
              currency={currentBill.currency}
              structuredComm={currentBill.structured_comm ?? ''}
              dueDate={currentBill.due_date}
              structuredCommValid={currentBill.structured_comm_valid}
            />
          </div>

          <div className="grid gap-4 lg:grid-cols-[1.1fr_0.9fr]">
            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Up next</p>
              <div className="mt-4 space-y-2">
                {selectedBills.slice(currentIndex + 1, currentIndex + 4).map((bill, idx) => (
                  <div key={bill.id} className="flex items-center justify-between rounded-xl border border-slate-100 bg-slate-50 px-3 py-3">
                    <div className="min-w-0">
                      <p className="truncate text-sm font-medium text-slate-900">{currentIndex + idx + 2}. {bill.payee_name}</p>
                      <p className="text-xs text-slate-500">Due {format(new Date(bill.due_date), 'd MMM')}</p>
                    </div>
                    <span className="shrink-0 text-sm font-semibold text-slate-700">{formatAmount(bill.amount, bill.currency)}</span>
                  </div>
                ))}
                {selectedBills.slice(currentIndex + 1, currentIndex + 4).length === 0 && (
                  <p className="text-sm text-slate-400">This is the last bill in the session.</p>
                )}
              </div>
            </div>

            <div className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm">
              <p className="text-sm font-semibold text-slate-900">Actions</p>
              <div className="mt-4 flex flex-col gap-3">
                <button onClick={markCurrentBillSent} disabled={saving} className="btn-primary w-full justify-center py-3">
                  {saving ? 'Saving...' : 'Mark Sent and Continue'}
                </button>
                <button onClick={skipCurrentBill} disabled={saving} className="btn-secondary w-full justify-center">
                  Skip for now
                </button>
                <button onClick={goToPrevious} disabled={saving || currentIndex === 0} className="btn-secondary w-full justify-center">
                  Previous bill
                </button>
              </div>
            </div>
          </div>
        </div>
      </div>
    )
  }

  return (
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="flex flex-col gap-4 md:flex-row md:items-start md:justify-between">
            <div>
              <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                Payment Session
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900">Choose the bills you want to pay now.</h1>
              <p className="mt-3 max-w-2xl text-sm leading-6 text-slate-600">
                BillFlow will guide you through each transfer one by one. Nothing is combined or sent automatically. It is a focused manual wire-transfer session.
              </p>
            </div>
            <Link href="/bills" className="text-sm text-gray-500 hover:text-gray-700">
              Cancel
            </Link>
          </div>

          <div className="mt-6 grid gap-3 md:grid-cols-3">
            <SessionMetric label="Eligible bills" value={String(bills.length)} sub="Open bills you can pay now" tone="blue" />
            <SessionMetric label="Selected" value={String(selected.size)} sub={selected.size ? formatAmount(total) : 'Nothing selected yet'} tone={selected.size ? 'green' : 'amber'} />
            <SessionMetric label="Overdue available" value={String(bills.filter(b => b.status === 'overdue').length)} sub="Prioritize these first" tone={bills.some(b => b.status === 'overdue') ? 'red' : 'green'} />
          </div>
        </section>

        <div className="flex items-center justify-between">
          <button onClick={selectAll} className="text-sm text-brand-600 hover:underline">
            {selected.size === bills.length ? 'Deselect all' : 'Select all'}
          </button>
          {selected.size > 0 && (
            <span className="text-sm text-gray-500">
              {selected.size} selected — {formatAmount(total)}
            </span>
          )}
        </div>

        <div className="rounded-[24px] border border-slate-200 bg-white shadow-sm overflow-hidden">
          {bills.map((bill, index) => {
            const isSelected = selected.has(bill.id)
            return (
              <button
                key={bill.id}
                onClick={() => toggleBill(bill.id)}
                className={`w-full border-b border-slate-100 px-4 py-4 text-left transition-colors last:border-b-0 md:px-5 ${
                  isSelected ? 'bg-brand-50' : 'hover:bg-slate-50'
                }`}
              >
                <div className="grid grid-cols-[auto_minmax(0,1fr)_auto] items-start gap-4">
                  <div className={`mt-1 flex h-6 w-6 items-center justify-center rounded-full border-2 transition-colors ${
                    isSelected ? 'border-brand-600 bg-brand-600' : 'border-slate-300'
                  }`}>
                    {isSelected && <span className="text-xs text-white">✓</span>}
                  </div>

                  <div className="min-w-0">
                    <div className="flex flex-wrap items-center gap-2">
                      <p className="truncate text-sm font-semibold text-slate-900">{bill.payee_name}</p>
                      {bill.status === 'overdue' && (
                        <span className="rounded-full bg-red-100 px-2 py-0.5 text-xs font-medium text-red-700">Overdue</span>
                      )}
                      {bill.needs_review && (
                        <span className="rounded-full bg-amber-100 px-2 py-0.5 text-xs font-medium text-amber-700">Review</span>
                      )}
                    </div>
                    <p className="mt-1 text-xs text-slate-500">
                      Due {format(new Date(bill.due_date), 'd MMM yyyy')}
                    </p>
                  </div>

                  <div className="text-right">
                    <p className="text-sm font-semibold text-slate-900">{formatAmount(bill.amount, bill.currency)}</p>
                  </div>
                </div>

                {bill.structured_comm && (
                  <div className="mt-3 pl-10 text-xs font-mono text-slate-400">
                    {bill.structured_comm}
                  </div>
                )}
              </button>
            )
          })}
        </div>

        {selected.size > 0 && (
          <div className="sticky bottom-20 md:bottom-6">
            <button onClick={startSession} className="btn-primary w-full py-3 text-base shadow-lg">
              Start Payment Session ({selected.size} bill{selected.size === 1 ? '' : 's'})
            </button>
          </div>
        )}
      </div>
    </div>
  )
}

function SessionMetric({ label, value, sub, tone }: { label: string; value: string; sub: string; tone: 'blue' | 'green' | 'amber' | 'red' }) {
  const tones = {
    blue: 'border-brand-200 bg-brand-50/80',
    green: 'border-green-200 bg-green-50/80',
    amber: 'border-amber-200 bg-amber-50/80',
    red: 'border-red-200 bg-red-50/80',
  }

  return (
    <div className={`rounded-2xl border p-4 ${tones[tone]}`}>
      <p className="text-[11px] font-semibold uppercase tracking-[0.18em] text-slate-500">{label}</p>
      <p className="mt-2 text-2xl font-bold tracking-tight text-slate-900">{value}</p>
      <p className="mt-2 text-xs text-slate-500">{sub}</p>
    </div>
  )
}

function SummaryPanel({ title, empty, items, tone }: { title: string; empty: string; items: Bill[]; tone: 'green' | 'amber' }) {
  const toneClass = tone === 'green' ? 'bg-green-50 border-green-200' : 'bg-amber-50 border-amber-200'

  return (
    <div className={`rounded-[24px] border p-5 ${toneClass}`}>
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      {items.length === 0 ? (
        <p className="mt-3 text-sm text-slate-500">{empty}</p>
      ) : (
        <div className="mt-4 space-y-2">
          {items.map(item => (
            <div key={item.id} className="flex items-center justify-between rounded-xl bg-white/80 px-3 py-3">
              <div className="min-w-0">
                <p className="truncate text-sm font-medium text-slate-900">{item.payee_name}</p>
                <p className="text-xs text-slate-500">Due {format(new Date(item.due_date), 'd MMM yyyy')}</p>
              </div>
              <span className="shrink-0 text-sm font-semibold text-slate-700">{formatAmount(item.amount, item.currency)}</span>
            </div>
          ))}
        </div>
      )}
    </div>
  )
}
