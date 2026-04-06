'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'
import { format } from 'date-fns'
import type { HouseholdTransferPair, TransferPairStatus } from '@/types'

interface Props {
  pairs: HouseholdTransferPair[]
}

function fmt(n: number) {
  return `€${Math.abs(n).toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

const STATUS_TABS: { label: string; value: TransferPairStatus | 'all' }[] = [
  { label: 'Pending', value: 'pending' },
  { label: 'Confirmed', value: 'confirmed' },
  { label: 'Rejected', value: 'rejected' },
  { label: 'All', value: 'all' },
]

export default function TransferReview({ pairs: initialPairs }: Props) {
  const router = useRouter()
  const [pairs, setPairs] = useState(initialPairs)
  const [saving, setSaving] = useState<Set<string>>(new Set())
  const [tab, setTab] = useState<TransferPairStatus | 'all'>('pending')

  async function updatePair(id: string, status: TransferPairStatus) {
    setSaving(prev => new Set(prev).add(id))
    try {
      const res = await fetch('/api/spending/transfers', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ id, status }),
      })
      if (res.ok) {
        setPairs(prev => prev.map(p => p.id === id ? { ...p, status } : p))
        router.refresh()
      }
    } finally {
      setSaving(prev => { const next = new Set(prev); next.delete(id); return next })
    }
  }

  async function updateAll(ids: string[], status: TransferPairStatus) {
    await Promise.all(ids.map(id => updatePair(id, status)))
  }

  const filtered = tab === 'all' ? pairs : pairs.filter(p => p.status === tab)
  const pendingIds = filtered.filter(p => p.status === 'pending').map(p => p.id)

  const counts = {
    pending: pairs.filter(p => p.status === 'pending').length,
    confirmed: pairs.filter(p => p.status === 'confirmed').length,
    rejected: pairs.filter(p => p.status === 'rejected').length,
  }

  if (pairs.length === 0) {
    return (
      <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
        <p className="text-sm text-gray-400">No intra-household transfers detected yet.</p>
        <p className="text-xs text-gray-300 mt-1">Import a second account CSV to detect matching transfers.</p>
      </div>
    )
  }

  return (
    <div className="space-y-4">
      {/* Tabs */}
      <div className="flex gap-1 rounded-xl bg-slate-100 p-1 w-fit">
        {STATUS_TABS.map(t => (
          <button
            key={t.value}
            type="button"
            onClick={() => setTab(t.value)}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-colors ${
              tab === t.value ? 'bg-white text-gray-900 shadow-sm' : 'text-gray-500 hover:text-gray-700'
            }`}
          >
            {t.label}
            {t.value !== 'all' && counts[t.value] > 0 && (
              <span className={`ml-1.5 rounded-full px-1.5 py-0.5 text-[10px] ${
                t.value === 'pending' ? 'bg-amber-100 text-amber-700' :
                t.value === 'confirmed' ? 'bg-green-100 text-green-700' :
                'bg-slate-200 text-slate-500'
              }`}>
                {counts[t.value]}
              </span>
            )}
          </button>
        ))}
      </div>

      {/* Batch actions for pending */}
      {pendingIds.length > 1 && (
        <div className="flex items-center gap-2 rounded-xl border border-slate-200 bg-slate-50 px-4 py-2.5">
          <span className="text-xs text-gray-500">{pendingIds.length} pending</span>
          <div className="ml-auto flex gap-2">
            <button
              type="button"
              onClick={() => updateAll(pendingIds, 'confirmed')}
              className="rounded-lg bg-green-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-green-700"
            >
              Confirm all
            </button>
            <button
              type="button"
              onClick={() => updateAll(pendingIds, 'rejected')}
              className="rounded-lg bg-slate-200 px-3 py-1.5 text-xs font-medium text-gray-700 hover:bg-slate-300"
            >
              Reject all
            </button>
          </div>
        </div>
      )}

      {/* Pair list */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-slate-200 bg-white p-8 text-center">
          <p className="text-sm text-gray-400">No {tab} transfers.</p>
        </div>
      ) : (
        <div className="divide-y divide-slate-100 rounded-2xl border border-slate-200 bg-white overflow-hidden">
          {filtered.map(pair => {
            const out = pair.outgoing
            const inc = pair.incoming
            const isSaving = saving.has(pair.id)

            return (
              <div key={pair.id} className="px-5 py-4">
                <div className="flex items-start gap-4">
                  {/* Transfer detail */}
                  <div className="flex-1 min-w-0">
                    <div className="flex items-center gap-3 flex-wrap">
                      {/* Outgoing side */}
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{out?.account_name ?? '—'}</span>
                        <span className="text-red-600 font-semibold ml-2">{out ? fmt(out.amount) : '—'}</span>
                        {out?.date && (
                          <span className="text-xs text-gray-400 ml-2">
                            {format(new Date(out.date), 'd MMM yyyy')}
                          </span>
                        )}
                      </div>

                      <span className="text-gray-300">→</span>

                      {/* Incoming side */}
                      <div className="text-sm">
                        <span className="font-medium text-gray-900">{inc?.account_name ?? '—'}</span>
                        <span className="text-green-600 font-semibold ml-2">{inc ? fmt(inc.amount) : '—'}</span>
                        {inc?.date && (
                          <span className="text-xs text-gray-400 ml-2">
                            {format(new Date(inc.date), 'd MMM yyyy')}
                          </span>
                        )}
                      </div>
                    </div>

                    {/* Match metadata */}
                    <div className="mt-1 flex items-center gap-3 text-[11px] text-gray-400">
                      <span>{pair.date_diff_days === 0 ? 'same day' : `${pair.date_diff_days}d apart`}</span>
                      {pair.amount_diff_pct > 0 && (
                        <span>{(pair.amount_diff_pct * 100).toFixed(2)}% amount diff</span>
                      )}
                      {out?.payee_raw && (
                        <span className="font-mono truncate max-w-[200px]">{out.payee_raw}</span>
                      )}
                    </div>
                  </div>

                  {/* Status badge + actions */}
                  <div className="shrink-0 flex items-center gap-2">
                    {pair.status === 'confirmed' && (
                      <span className="text-[11px] font-medium text-green-600 bg-green-50 rounded-full px-2 py-0.5">confirmed</span>
                    )}
                    {pair.status === 'rejected' && (
                      <span className="text-[11px] font-medium text-gray-400 bg-slate-100 rounded-full px-2 py-0.5">rejected</span>
                    )}

                    {pair.status !== 'confirmed' && (
                      <button
                        type="button"
                        onClick={() => updatePair(pair.id, 'confirmed')}
                        disabled={isSaving}
                        className="rounded-lg bg-green-600 px-2.5 py-1.5 text-xs font-medium text-white hover:bg-green-700 disabled:opacity-40"
                      >
                        {isSaving ? '…' : 'Confirm'}
                      </button>
                    )}
                    {pair.status !== 'rejected' && (
                      <button
                        type="button"
                        onClick={() => updatePair(pair.id, 'rejected')}
                        disabled={isSaving}
                        className="rounded-lg bg-slate-100 px-2.5 py-1.5 text-xs font-medium text-gray-600 hover:bg-slate-200 disabled:opacity-40"
                      >
                        {isSaving ? '…' : 'Reject'}
                      </button>
                    )}
                  </div>
                </div>
              </div>
            )
          })}
        </div>
      )}
    </div>
  )
}
