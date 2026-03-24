'use client'

import { useState } from 'react'
import { formatAmount } from '@/lib/utils'
import WireTransferCard from '@/components/bills/WireTransferCard'
import type { Bill } from '@/types'
import Link from 'next/link'

type Step = 'select' | 'review'

export default function BatchClient({ bills }: { bills: Bill[] }) {
  const [selected, setSelected] = useState<Set<string>>(new Set())
  const [step, setStep] = useState<Step>('select')
  const [batchId, setBatchId] = useState<string | null>(null)
  const [creating, setCreating] = useState(false)
  const [marking, setMarking] = useState(false)

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

  const selectedBills = bills.filter(b => selected.has(b.id))
  const total = selectedBills.reduce((sum, b) => sum + b.amount, 0)

  async function createBatch() {
    setCreating(true)
    const res = await fetch('/api/batches', {
      method: 'POST',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ bill_ids: Array.from(selected) }),
    })
    if (res.ok) {
      const { batch } = await res.json()
      setBatchId(batch.id)
      setStep('review')
    }
    setCreating(false)
  }

  async function markCompleted() {
    if (!batchId) return
    setMarking(true)
    await fetch(`/api/batches/${batchId}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status: 'completed' }),
    })
    setMarking(false)
    window.location.href = '/bills'
  }

  if (bills.length === 0) {
    return (
      <div className="p-8">
        <h1 className="text-2xl font-bold text-gray-900 mb-4">Payment Batch</h1>
        <div className="card p-12 text-center">
          <p className="text-gray-500">No unpaid bills to batch.</p>
          <Link href="/bills" className="text-brand-600 hover:underline text-sm mt-2 inline-block">
            Back to bills
          </Link>
        </div>
      </div>
    )
  }

  if (step === 'review') {
    return (
      <div className="p-8 max-w-2xl mx-auto">
        <div className="flex items-center justify-between mb-6">
          <div>
            <h1 className="text-2xl font-bold text-gray-900">Payment Batch</h1>
            <p className="text-gray-500 text-sm mt-1">
              {selectedBills.length} bill{selectedBills.length !== 1 ? 's' : ''} — Total: {formatAmount(total)}
            </p>
          </div>
          <button
            onClick={() => setStep('select')}
            className="text-sm text-gray-500 hover:text-gray-700"
          >
            Back to selection
          </button>
        </div>

        <p className="text-sm text-gray-600 mb-6 bg-blue-50 border border-blue-200 rounded-lg p-3">
          Copy each wire transfer into your bank app in sequence. When all payments are sent, mark the batch as completed.
        </p>

        <div className="space-y-6">
          {selectedBills.map((bill, index) => (
            <div key={bill.id}>
              <div className="flex items-center gap-2 mb-2">
                <span className="text-xs font-medium text-gray-400 bg-gray-100 rounded-full w-6 h-6 flex items-center justify-center">
                  {index + 1}
                </span>
                <span className="text-sm font-medium text-gray-700">{bill.payee_name}</span>
              </div>
              <WireTransferCard
                beneficiary={bill.payee_name}
                iban={bill.iban ?? ''}
                bic={bill.bic ?? ''}
                amount={bill.amount}
                currency={bill.currency}
                structuredComm={bill.structured_comm ?? ''}
                dueDate={bill.due_date}
                structuredCommValid={bill.structured_comm_valid}
              />
            </div>
          ))}
        </div>

        <div className="mt-8 flex gap-3">
          <button
            onClick={markCompleted}
            disabled={marking}
            className="btn-primary flex-1"
          >
            {marking ? 'Saving...' : 'Mark All as Paid'}
          </button>
        </div>
      </div>
    )
  }

  return (
    <div className="p-8">
      <div className="flex items-center justify-between mb-6">
        <div>
          <h1 className="text-2xl font-bold text-gray-900">Payment Batch</h1>
          <p className="text-gray-500 text-sm mt-1">Select bills to pay in one session</p>
        </div>
        <Link href="/bills" className="text-sm text-gray-500 hover:text-gray-700">
          Cancel
        </Link>
      </div>

      <div className="mb-4 flex items-center justify-between">
        <button onClick={selectAll} className="text-sm text-brand-600 hover:underline">
          {selected.size === bills.length ? 'Deselect all' : 'Select all'}
        </button>
        {selected.size > 0 && (
          <span className="text-sm text-gray-500">
            {selected.size} selected — {formatAmount(total)}
          </span>
        )}
      </div>

      <div className="space-y-2 mb-6">
        {bills.map(bill => {
          const isSelected = selected.has(bill.id)
          return (
            <button
              key={bill.id}
              onClick={() => toggleBill(bill.id)}
              className={`w-full card p-4 flex items-center gap-4 text-left transition-all ${
                isSelected ? 'border-brand-500 bg-brand-50 ring-1 ring-brand-500' : 'hover:border-gray-300'
              }`}
            >
              <div className={`w-5 h-5 rounded border-2 flex items-center justify-center shrink-0 transition-colors ${
                isSelected ? 'bg-brand-600 border-brand-600' : 'border-gray-300'
              }`}>
                {isSelected && <span className="text-white text-xs">✓</span>}
              </div>
              <div className="flex-1 min-w-0">
                <p className="text-sm font-medium text-gray-900 truncate">{bill.payee_name}</p>
                <p className="text-xs text-gray-500">
                  Due {new Date(bill.due_date).toLocaleDateString('en-BE', { day: 'numeric', month: 'short', year: 'numeric' })}
                  {bill.structured_comm && <span className="ml-2 font-mono">{bill.structured_comm}</span>}
                </p>
              </div>
              <div className="text-right shrink-0">
                <p className="text-sm font-semibold text-gray-900">{formatAmount(bill.amount, bill.currency)}</p>
                <p className={`text-xs ${bill.status === 'overdue' ? 'text-red-600 font-medium' : 'text-gray-400'}`}>
                  {bill.status}
                </p>
              </div>
            </button>
          )
        })}
      </div>

      {selected.size > 0 && (
        <div className="sticky bottom-4">
          <button
            onClick={createBatch}
            disabled={creating}
            className="btn-primary w-full py-3 text-base"
          >
            {creating ? 'Creating batch...' : `Generate Batch (${selected.size} bills — ${formatAmount(total)})`}
          </button>
        </div>
      )}
    </div>
  )
}
