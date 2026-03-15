'use client'
import { useState } from 'react'
import { useRouter } from 'next/navigation'
import type { Bill } from '@/types'

export default function BillActions({ bill }: { bill: Bill }) {
  const [loading, setLoading] = useState(false)
  const [showPaidForm, setShowPaidForm] = useState(false)
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
    await updateStatus('payment_sent', { wire_reference: wireRef, notes })
    setShowPaidForm(false)
  }

  async function deleteBill() {
    if (!confirm('Delete this bill?')) return
    setLoading(true)
    await fetch(`/api/bills/${bill.id}`, { method: 'DELETE' })
    router.push('/dashboard')
  }

  const isPaid = ['payment_sent', 'confirmed'].includes(bill.status)

  return (
    <div className="card p-5">
      <h2 className="text-base font-semibold text-gray-900 mb-4">Actions</h2>

      {!isPaid && (
        <>
          {!showPaidForm ? (
            <div className="flex flex-wrap gap-3">
              <button
                onClick={() => setShowPaidForm(true)}
                className="btn-primary"
                disabled={loading}
              >
                ✅ Mark as Payment Sent
              </button>
              {bill.status === 'received' && (
                <button
                  onClick={() => updateStatus('scheduled')}
                  className="btn-secondary"
                  disabled={loading}
                >
                  📅 Mark as Scheduled
                </button>
              )}
              <button onClick={deleteBill} className="btn-danger" disabled={loading}>
                🗑 Delete
              </button>
            </div>
          ) : (
            <div className="space-y-4">
              <div>
                <label className="label">Wire Transfer Reference (optional)</label>
                <input
                  type="text"
                  className="input"
                  placeholder="e.g. your bank's transaction ID"
                  value={wireRef}
                  onChange={e => setWireRef(e.target.value)}
                />
              </div>
              <div>
                <label className="label">Notes (optional)</label>
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
                  {loading ? 'Saving…' : 'Confirm Payment Sent'}
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
        <div className="flex gap-3">
          <button
            onClick={() => updateStatus('confirmed')}
            className="btn-primary"
            disabled={loading}
          >
            ✅ Confirm Payment Received
          </button>
          <button onClick={deleteBill} className="btn-danger" disabled={loading}>
            🗑 Delete
          </button>
        </div>
      )}

      {bill.status === 'confirmed' && (
        <div className="flex items-center gap-2">
          <span className="text-green-600 font-medium">✅ Payment confirmed</span>
          <button onClick={deleteBill} className="btn-secondary text-xs ml-4" disabled={loading}>
            Delete
          </button>
        </div>
      )}
    </div>
  )
}
