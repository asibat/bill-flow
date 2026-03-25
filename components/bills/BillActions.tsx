'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { Bill } from '@/types'

export default function BillActions({ bill }: { bill: Bill }) {
  const [loading, setLoading] = useState(false)
  const [showPaidForm, setShowPaidForm] = useState(false)
  const [paidAt, setPaidAt] = useState(format(new Date(), 'yyyy-MM-dd'))
  const [wireRef, setWireRef] = useState(bill.wire_reference || '')
  const [notes, setNotes] = useState(bill.notes || '')
  const router = useRouter()

  async function updateStatus(status: string, extra: Record<string, unknown> = {}) {
    setLoading(true)
    await fetch(`/api/bills/${bill.id}`, {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ status, ...extra }),
    })
    setLoading(false)
    router.refresh()
  }

  async function markSent() {
    await updateStatus('payment_sent', {
      paid_at: new Date(paidAt).toISOString(),
      wire_reference: wireRef || null,
      notes: notes || null,
    })
    setShowPaidForm(false)
  }

  async function deleteBill() {
    if (!confirm('Delete this bill?')) return
    setLoading(true)
    await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' })
    router.refresh()
    router.replace('/dashboard')
  }

  const isPaid = ['payment_sent', 'confirmed'].includes(bill.status)

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Actions</h2>

      {!isPaid && (
        <>
          {!showPaidForm ? (
            <div className="space-y-3">
              <p className="text-sm text-gray-600">
                Once you send the transfer from your bank, mark it as paid so BillFlow can stop due reminders and schedule a follow-up confirmation.
              </p>
              <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowPaidForm(true)}
                className="btn-primary"
                disabled={loading}
              >
                I Sent the Transfer
              </button>
              {bill.status === 'received' && (
                <button
                  onClick={() => updateStatus('scheduled')}
                  className="btn-secondary"
                  disabled={loading}
                >
                  Mark as Scheduled
                </button>
              )}
              <button onClick={deleteBill} className="btn-danger" disabled={loading}>
                Delete
              </button>
              </div>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Payment Date</label>
                <input
                  type="date"
                  className="input"
                  value={paidAt}
                  onChange={e => setPaidAt(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">Defaults to today. Change if you paid on a different date.</p>
              </div>
              <div>
                <label className="label">Transaction ID <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. your bank's transaction reference"
                  value={wireRef}
                  onChange={e => setWireRef(e.target.value)}
                />
                <p className="text-xs text-gray-400 mt-1">You can add this later from the bill details.</p>
              </div>
              <div>
                <label className="label">Notes <span className="text-gray-400 font-normal">(optional)</span></label>
                <input
                  type="text"
                  className="input"
                  placeholder="Any notes about this payment"
                  value={notes}
                  onChange={e => setNotes(e.target.value)}
                />
              </div>
              <div className="flex gap-3">
                <button onClick={markSent} className="btn-primary" disabled={loading}>
                  {loading ? 'Saving...' : 'Save Payment Sent'}
                </button>
                <button onClick={() => setShowPaidForm(false)} className="btn-secondary">
                  Cancel
                </button>
              </div>
            </div>
          )}
        </>
      )}

      {bill.status === 'payment_sent' && (
        <div className="space-y-4">
          <div className="rounded-lg border border-blue-200 bg-blue-50 p-3 text-sm text-blue-900">
            Transfer recorded. Leave this as-is until the payment settles, then confirm it here.
          </div>
          <div className="flex items-center gap-2 text-sm text-gray-600">
            {bill.paid_at && <span>Paid on {format(new Date(bill.paid_at), 'd MMM yyyy')}</span>}
            {bill.wire_reference && <span className="text-gray-400">·</span>}
            {bill.wire_reference && <span className="font-mono text-xs">{bill.wire_reference}</span>}
          </div>

          {!bill.wire_reference && (
            <div>
              <label className="label">Add Transaction ID</label>
              <div className="flex gap-2">
                <input
                  type="text"
                  className="input flex-1"
                  placeholder="e.g. bank transaction reference"
                  value={wireRef}
                  onChange={e => setWireRef(e.target.value)}
                />
                <button
                  onClick={() => updateStatus('payment_sent', { wire_reference: wireRef })}
                  className="btn-secondary"
                  disabled={loading || !wireRef}
                >
                  Save
                </button>
              </div>
            </div>
          )}

          <div className="flex gap-3">
            <button
              onClick={() => updateStatus('confirmed')}
              className="btn-primary"
              disabled={loading}
            >
              Mark as Confirmed
            </button>
            <button onClick={deleteBill} className="btn-danger" disabled={loading}>
              Delete
            </button>
          </div>
        </div>
      )}

      {bill.status === 'confirmed' && (
        <div className="space-y-3">
          <div className="flex items-center gap-2 text-sm text-green-700">
            <span className="font-medium">Payment confirmed</span>
            {bill.paid_at && <span className="text-gray-400">·</span>}
            {bill.paid_at && <span className="text-gray-500">{format(new Date(bill.paid_at), 'd MMM yyyy')}</span>}
            {bill.wire_reference && <span className="text-gray-400">·</span>}
            {bill.wire_reference && <span className="font-mono text-xs text-gray-500">{bill.wire_reference}</span>}
          </div>
          <button onClick={deleteBill} className="btn-secondary text-xs" disabled={loading}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
