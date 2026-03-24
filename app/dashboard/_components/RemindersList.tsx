'use client'

import { useState } from 'react'
import { formatDistanceToNow, format, isPast } from 'date-fns'
import Link from 'next/link'
import { getReminderKindLabel, type ReminderKind } from '@/lib/reminders/kinds'

interface ReminderBill {
  payee_name: string
  amount: number
  currency: string
  due_date: string
  paid_at?: string | null
  status: string
}

interface ReminderItem {
  id: string
  bill_id: string
  remind_at: string
  kind: ReminderKind
  sent_at: string | null
  dismissed_at: string | null
  bills: ReminderBill | ReminderBill[] | null
}

export default function RemindersList({ reminders }: { reminders: ReminderItem[] }) {
  const [items, setItems] = useState(reminders)
  const [dismissing, setDismissing] = useState<string | null>(null)

  async function handleDismiss(id: string) {
    setDismissing(id)
    const res = await fetch(`/api/reminders/${id}/dismiss`, { method: 'POST' })
    if (res.ok) {
      setItems(prev => prev.filter(r => r.id !== id))
    }
    setDismissing(null)
  }

  if (items.length === 0) {
    return (
      <div className="card p-5">
        <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Reminders</h2>
        <p className="text-sm text-gray-400">No upcoming reminders</p>
      </div>
    )
  }

  return (
    <div className="card p-5">
      <h2 className="text-sm font-semibold text-gray-700 mb-3 uppercase tracking-wide">Reminders</h2>
      <div className="space-y-2">
        {items.map(r => {
          const bill = Array.isArray(r.bills) ? r.bills[0] : r.bills
          if (!bill) return null
          const isDue = isPast(new Date(r.remind_at))
          const isFollowup = r.kind === 'payment_followup'
          const isPaid = !isFollowup && ['confirmed', 'payment_sent'].includes(bill.status)
          const subtitle = isFollowup
            ? `${bill.amount.toFixed(2)} ${bill.currency} — paid ${bill.paid_at ? format(new Date(bill.paid_at), 'd MMM yyyy') : 'recently'}`
            : `${bill.amount.toFixed(2)} ${bill.currency} — due ${format(new Date(bill.due_date), 'd MMM yyyy')}`

          return (
            <div
              key={r.id}
              className={`flex items-center justify-between p-3 rounded-lg border ${
                isDue && !isPaid ? 'border-amber-200 bg-amber-50' : 'border-gray-100 bg-gray-50'
              }`}
            >
              <Link href={`/bills/${r.bill_id}`} className="flex-1 min-w-0">
                <div className="flex items-center gap-3">
                  <span className="text-lg">{isDue && !isPaid ? '🔔' : '⏰'}</span>
                  <div className="min-w-0">
                    <p className="text-sm font-medium text-gray-900 truncate">{bill.payee_name}</p>
                    <p className="text-xs text-gray-500">{subtitle}</p>
                    <p className="text-xs text-gray-400">{getReminderKindLabel(r.kind)}</p>
                  </div>
                </div>
              </Link>
              <div className="flex items-center gap-2 ml-3 shrink-0">
                <span className="text-xs text-gray-400">
                  {isDue ? 'now' : formatDistanceToNow(new Date(r.remind_at), { addSuffix: true })}
                </span>
                {r.sent_at && <span className="text-xs text-green-600">sent</span>}
                <button
                  onClick={() => handleDismiss(r.id)}
                  disabled={dismissing === r.id}
                  className="text-xs text-gray-400 hover:text-gray-600 px-2 py-1 rounded hover:bg-gray-200 transition-colors"
                  title="Dismiss reminder"
                >
                  {dismissing === r.id ? '...' : '✕'}
                </button>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
