'use client'

import { useState } from 'react'
import { formatDistanceToNow, format, isPast } from 'date-fns'
import Link from 'next/link'
import { getReminderKindLabel, type ReminderKind } from '@/lib/reminders/kinds'
import { getReminderSnoozeLabel, type ReminderSnoozePreset } from '@/lib/reminders/snooze'

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

const SNOOZE_PRESETS: ReminderSnoozePreset[] = ['tomorrow', 'next_week']

function sortByRemindAt(items: ReminderItem[]) {
  return [...items].sort((a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime())
}

function getReminderActionLabel(isDue: boolean) {
  return isDue ? 'Snooze' : 'Reschedule'
}

export default function RemindersList({
  reminders,
  salaryDay,
}: {
  reminders: ReminderItem[]
  salaryDay: number | null
}) {
  const [items, setItems] = useState(reminders)
  const [dismissing, setDismissing] = useState<string | null>(null)
  const [snoozing, setSnoozing] = useState<string | null>(null)
  const [expandedActions, setExpandedActions] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  async function handleDismiss(id: string) {
    setError(null)
    setDismissing(id)
    try {
      const res = await fetch(`/api/reminders/${id}/dismiss`, { method: 'POST' })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to dismiss reminder')
      }
      setItems(prev => prev.filter(r => r.id !== id))
      setExpandedActions(prev => prev === id ? null : prev)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to dismiss reminder')
    } finally {
      setDismissing(null)
    }
  }

  async function handleSnooze(id: string, preset: ReminderSnoozePreset) {
    setError(null)
    setSnoozing(id)

    try {
      const res = await fetch(`/api/reminders/${id}/snooze`, {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ preset }),
      })

      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to snooze reminder')
      }

      const body = await res.json()
      setItems(prev => sortByRemindAt(prev.map(item => (
        item.id === id ? { ...item, remind_at: body.remind_at, sent_at: null, dismissed_at: null } : item
      ))))
      setExpandedActions(null)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to snooze reminder')
    } finally {
      setSnoozing(null)
    }
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
      {error && (
        <div className="mb-3 rounded-2xl border border-red-200 bg-red-50 px-3 py-2 text-xs text-red-700">
          {error}
        </div>
      )}
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
              <div className="flex flex-1 min-w-0 flex-col gap-3">
                <Link href={`/bills/${r.bill_id}`} className="min-w-0">
                  <div className="flex items-center gap-3">
                    <span className="text-lg">{isDue && !isPaid ? '🔔' : '⏰'}</span>
                    <div className="min-w-0">
                      <p className="text-sm font-medium text-gray-900 truncate">{bill.payee_name}</p>
                      <p className="text-xs text-gray-500">{subtitle}</p>
                      <p className="text-xs text-gray-400">{getReminderKindLabel(r.kind)}</p>
                    </div>
                  </div>
                </Link>

                {expandedActions === r.id && (
                  <div className="flex flex-wrap gap-2 pl-9">
                    {SNOOZE_PRESETS.map(preset => (
                      <button
                        key={preset}
                        onClick={() => handleSnooze(r.id, preset)}
                        disabled={snoozing === r.id}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {getReminderSnoozeLabel(preset)}
                      </button>
                    ))}
                    {salaryDay ? (
                      <button
                        onClick={() => handleSnooze(r.id, 'next_payday')}
                        disabled={snoozing === r.id}
                        className="rounded-full border border-slate-200 bg-white px-2.5 py-1 text-[11px] font-medium text-slate-600 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                      >
                        {getReminderSnoozeLabel('next_payday')}
                      </button>
                    ) : null}
                  </div>
                )}
              </div>
              <div className="ml-3 flex shrink-0 flex-col items-end gap-2">
                <span className="text-xs text-gray-400">
                  {isDue ? 'now' : formatDistanceToNow(new Date(r.remind_at), { addSuffix: true })}
                </span>
                <div className="flex items-center gap-2">
                  {r.sent_at && <span className="text-xs text-green-600">sent</span>}
                  <button
                    onClick={() => setExpandedActions(prev => prev === r.id ? null : r.id)}
                    disabled={snoozing === r.id}
                    className="rounded-full border border-slate-200 bg-white px-3 py-1.5 text-[11px] font-medium text-slate-700 transition-colors hover:border-slate-300 hover:bg-slate-100 disabled:cursor-wait disabled:opacity-60"
                  >
                    {snoozing === r.id ? 'Saving...' : expandedActions === r.id ? 'Hide options' : getReminderActionLabel(isDue)}
                  </button>
                  <button
                    onClick={() => handleDismiss(r.id)}
                    disabled={dismissing === r.id}
                    className="rounded-full px-2 py-1 text-[11px] font-medium text-gray-400 transition-colors hover:bg-gray-200 hover:text-gray-600"
                    title="Dismiss reminder"
                  >
                    {dismissing === r.id ? '...' : 'Dismiss'}
                  </button>
                </div>
              </div>
            </div>
          )
        })}
      </div>
    </div>
  )
}
