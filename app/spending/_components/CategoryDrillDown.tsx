'use client'

import { useEffect, useState } from 'react'
import type { Transaction, SpendingPayee, SpendingCategory } from '@/types'
import { effectiveCategory } from '@/types'
import { SPENDING_CATEGORIES } from '@/lib/spending/categories'
import { format } from 'date-fns'

interface Props {
  category: SpendingCategory
  transactions: Transaction[]
  metadataMap: Record<string, SpendingPayee>
  onClose: () => void
  onPayeeSaved: (payee: SpendingPayee) => void
  onReanalyzed: () => void
}

function fmt(n: number) {
  return `€${Math.abs(n).toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`
}

interface InlinePayeeEditorProps {
  payeeRaw: string
  metadata: SpendingPayee | null
  onSaved: (payee: SpendingPayee) => void
}

function InlinePayeeEditor({ payeeRaw, metadata, onSaved }: InlinePayeeEditorProps) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(metadata?.display_name ?? '')
  const [category, setCategory] = useState<SpendingCategory | ''>(metadata?.category ?? '')
  const [notes, setNotes] = useState(metadata?.notes ?? '')
  const [offsetsCategory, setOffsetsCategory] = useState<SpendingCategory | ''>(metadata?.offsets_category ?? '')
  const [saving, setSaving] = useState(false)

  useEffect(() => {
    if (!open) {
      setDisplayName(metadata?.display_name ?? '')
      setCategory(metadata?.category ?? '')
      setNotes(metadata?.notes ?? '')
      setOffsetsCategory(metadata?.offsets_category ?? '')
    }
  }, [metadata, open])

  async function handleSave() {
    setSaving(true)
    try {
      const res = await fetch('/api/spending/payees', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          payee_raw: payeeRaw,
          display_name: displayName || null,
          category: category || null,
          notes: notes || null,
          offsets_category: offsetsCategory || null,
        }),
      })
      if (res.ok) {
        const { payee } = await res.json()
        onSaved(payee)
        setOpen(false)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div>
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="group flex items-center gap-1 text-left"
      >
        <span className="text-xs font-medium text-gray-700 group-hover:text-brand-600">
          {metadata?.display_name ?? payeeRaw}
        </span>
        {metadata?.display_name && (
          <span className="text-[10px] text-gray-400">({payeeRaw})</span>
        )}
        <span className="text-[10px] text-gray-400 group-hover:text-brand-500 ml-1">
          {open ? '▲' : '✎'}
        </span>
      </button>
      {metadata?.notes && !open && (
        <p className="text-[10px] text-gray-400 mt-0.5">{metadata.notes}</p>
      )}
      {metadata?.category && !open && (
        <span className="text-[10px] text-brand-500 capitalize">{metadata.category}</span>
      )}

      {open && (
        <div className="mt-2 rounded-xl border border-slate-200 bg-white p-3 space-y-2 shadow-sm">
          <div className="grid gap-2 sm:grid-cols-2">
            <div>
              <label className="text-[10px] font-medium text-gray-400 block mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={payeeRaw}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-[10px] font-medium text-gray-400 block mb-1">Category override</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as SpendingCategory | '')}
                className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
              >
                <option value="">Use AI</option>
                {SPENDING_CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. landlord, STIB monthly pass, Ryanair to Barcelona..."
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-[10px] font-medium text-gray-400 block mb-1">
              Offsets category <span className="font-normal text-gray-300">— income from this payee reduces that category net</span>
            </label>
            <select
              value={offsetsCategory}
              onChange={e => setOffsetsCategory(e.target.value as SpendingCategory | '')}
              className="w-full rounded-lg border border-slate-200 px-2 py-1 text-xs focus:border-brand-400 focus:outline-none"
            >
              <option value="">No offset</option>
              {SPENDING_CATEGORIES.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="text-[10px] text-gray-400 hover:text-gray-600 px-2 py-1">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="text-[10px] font-medium bg-brand-600 text-white rounded-lg px-2.5 py-1 hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}

function TransactionCategorySelector({
  tx,
  onUpdated,
}: {
  tx: Transaction
  onUpdated: (updated: Transaction) => void
}) {
  const [value, setValue] = useState<SpendingCategory | ''>(tx.category_user ?? '')
  const [saving, setSaving] = useState(false)

  async function handleChange(next: SpendingCategory | '') {
    setValue(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/spending/transactions/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_user: next || null }),
      })
      if (res.ok) {
        const { transaction } = await res.json()
        onUpdated(transaction)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-[10px] text-gray-400">Category:</span>
      <select
        value={value}
        onChange={e => handleChange(e.target.value as SpendingCategory | '')}
        disabled={saving}
        className="text-[10px] rounded border border-slate-200 px-1 py-0.5 text-gray-600 bg-white focus:border-brand-400 focus:outline-none disabled:opacity-50"
      >
        <option value="">AI ({tx.category_ai ?? 'other'})</option>
        {SPENDING_CATEGORIES.map(c => (
          <option key={c} value={c} className="capitalize">{c}</option>
        ))}
      </select>
      {saving && <span className="text-[10px] text-gray-300">saving…</span>}
    </div>
  )
}

function TransactionOffsetSelector({
  tx,
  onUpdated,
}: {
  tx: Transaction
  onUpdated: (updated: Transaction) => void
}) {
  const [value, setValue] = useState<SpendingCategory | ''>(tx.offsets_category ?? '')
  const [saving, setSaving] = useState(false)

  async function handleChange(next: SpendingCategory | '') {
    setValue(next)
    setSaving(true)
    try {
      const res = await fetch(`/api/spending/transactions/${tx.id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ offsets_category: next || null }),
      })
      if (res.ok) {
        const { transaction } = await res.json()
        onUpdated(transaction)
      }
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="flex items-center gap-1 mt-1">
      <span className="text-[10px] text-gray-400">Offsets:</span>
      <select
        value={value}
        onChange={e => handleChange(e.target.value as SpendingCategory | '')}
        disabled={saving}
        className="text-[10px] rounded border border-slate-200 px-1 py-0.5 text-gray-600 bg-white focus:border-brand-400 focus:outline-none disabled:opacity-50"
      >
        <option value="">None</option>
        {SPENDING_CATEGORIES.filter(c => c !== 'income' && c !== 'transfer').map(c => (
          <option key={c} value={c} className="capitalize">{c}</option>
        ))}
      </select>
      {saving && <span className="text-[10px] text-gray-300">saving…</span>}
    </div>
  )
}

export default function CategoryDrillDown({
  category,
  transactions,
  metadataMap,
  onClose,
  onPayeeSaved,
  onReanalyzed,
}: Props) {
  const [txOverrides, setTxOverrides] = useState<Record<string, Transaction>>({})

  function handleTxUpdated(updated: Transaction) {
    setTxOverrides(prev => ({ ...prev, [updated.id]: updated }))
  }
  const [reanalyzing, setReanalyzing] = useState(false)
  const [reanalyzedMsg, setReanalyzedMsg] = useState<string | null>(null)

  const categoryTx = transactions
    .map(tx => txOverrides[tx.id] ?? tx)
    .filter(tx => effectiveCategory(tx) === category)
    .sort((a, b) => b.date.localeCompare(a.date))

  const total = categoryTx.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const uncertain = categoryTx.filter(tx =>
    !tx.category_user && !metadataMap[tx.payee_raw]?.category && !tx.offsets_category
  )

  async function handleReanalyze() {
    setReanalyzing(true)
    setReanalyzedMsg(null)
    try {
      const res = await fetch('/api/spending/reanalyze', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category }),
      })
      const json = await res.json()
      setReanalyzedMsg(
        json.updated > 0
          ? `Re-analyzed ${json.updated} transaction${json.updated !== 1 ? 's' : ''} — refresh to see updates`
          : json.message ?? 'Nothing to re-analyze'
      )
      if (json.updated > 0) onReanalyzed()
    } finally {
      setReanalyzing(false)
    }
  }

  return (
    <>
      {/* Backdrop */}
      <div className="fixed inset-0 z-40 bg-black/20 backdrop-blur-sm" onClick={onClose} />

      {/* Panel */}
      <div className="fixed inset-y-0 right-0 z-50 w-full max-w-xl bg-white shadow-2xl flex flex-col">
        {/* Header */}
        <div className="flex items-center justify-between border-b border-slate-100 px-5 py-4">
          <div>
            <h2 className="text-base font-semibold capitalize text-gray-900">{category}</h2>
            <p className="text-sm text-gray-500">{fmt(total)} · {categoryTx.length} transactions</p>
          </div>
          <button type="button" onClick={onClose} className="text-gray-400 hover:text-gray-600 text-xl leading-none">✕</button>
        </div>

        {/* Re-analyze bar */}
        <div className="flex items-center justify-between gap-3 border-b border-slate-100 bg-slate-50 px-5 py-3">
          <div className="text-xs text-gray-500">
            {uncertain.length > 0
              ? <><span className="font-medium text-amber-600">{uncertain.length} uncertain</span> — no annotation yet</>
              : <span className="text-green-600">All transactions annotated</span>
            }
          </div>
          <button
            type="button"
            onClick={handleReanalyze}
            disabled={reanalyzing || categoryTx.length === 0}
            className="shrink-0 rounded-lg bg-brand-600 px-3 py-1.5 text-xs font-medium text-white hover:bg-brand-700 disabled:opacity-40"
          >
            {reanalyzing ? 'Re-analyzing…' : 'Re-analyze with my notes'}
          </button>
        </div>
        {reanalyzedMsg && (
          <div className="border-b border-green-100 bg-green-50 px-5 py-2 text-xs text-green-700">
            {reanalyzedMsg}
          </div>
        )}

        {/* Transaction list */}
        <div className="flex-1 overflow-y-auto">
          {categoryTx.length === 0 ? (
            <p className="p-8 text-center text-sm text-gray-400">No transactions in this category</p>
          ) : (
            <div className="divide-y divide-slate-50">
              {categoryTx.map(tx => {
                const meta = metadataMap[tx.payee_raw] ?? null
                const hasOverride = !!tx.category_user || !!meta?.category
                return (
                  <div key={tx.id} className="px-5 py-3 hover:bg-slate-50/60 transition-colors">
                    <div className="flex items-start justify-between gap-3">
                      <div className="flex-1 min-w-0">
                        <InlinePayeeEditor
                          payeeRaw={tx.payee_raw}
                          metadata={meta}
                          onSaved={onPayeeSaved}
                        />
                        {/* Always show raw value as ground truth */}
                        <p className="mt-0.5 font-mono text-[10px] text-gray-300 select-all">{tx.payee_raw}</p>
                        <p className="text-[10px] text-gray-400 mt-0.5">
                          {format(new Date(tx.date), 'd MMM yyyy')}
                          {tx.description && <span className="ml-2 text-gray-300">· {tx.description}</span>}
                        </p>
                        <TransactionCategorySelector tx={tx} onUpdated={handleTxUpdated} />
                        {tx.amount > 0 && (
                          <TransactionOffsetSelector tx={tx} onUpdated={handleTxUpdated} />
                        )}
                      </div>
                      <div className="shrink-0 text-right">
                        <p className={`text-sm font-semibold ${tx.amount > 0 ? 'text-green-600' : 'text-gray-900'}`}>{fmt(tx.amount)}</p>
                        {hasOverride ? (
                          <span className="text-[10px] text-brand-500">✓ annotated</span>
                        ) : (
                          <span className="text-[10px] text-amber-500">ai guess</span>
                        )}
                      </div>
                    </div>
                  </div>
                )
              })}
            </div>
          )}
        </div>
      </div>
    </>
  )
}
