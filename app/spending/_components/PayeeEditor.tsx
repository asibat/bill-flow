'use client'

import { useState } from 'react'
import type { SpendingPayee, SpendingCategory } from '@/types'
import { SPENDING_CATEGORIES } from '@/lib/spending/categories'

interface Props {
  payeeRaw: string
  total: number
  count: number
  metadata: SpendingPayee | null
  onSaved: (payee: SpendingPayee) => void
}

export default function PayeeEditor({ payeeRaw, total, count, metadata, onSaved }: Props) {
  const [open, setOpen] = useState(false)
  const [displayName, setDisplayName] = useState(metadata?.display_name ?? '')
  const [category, setCategory] = useState<SpendingCategory | ''>(metadata?.category ?? '')
  const [notes, setNotes] = useState(metadata?.notes ?? '')
  const [offsetsCategory, setOffsetsCategory] = useState<SpendingCategory | ''>(metadata?.offsets_category ?? '')
  const [saving, setSaving] = useState(false)

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

  const fmt = (n: number) =>
    `€${n.toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}`

  return (
    <div className="rounded-xl border border-slate-100 bg-slate-50">
      <button
        type="button"
        onClick={() => setOpen(o => !o)}
        className="w-full flex items-center gap-3 p-3 text-left hover:bg-slate-100 rounded-xl transition-colors"
      >
        <div className="flex-1 min-w-0">
          <p className="truncate text-sm font-medium text-gray-900">
            {metadata?.display_name ?? payeeRaw}
          </p>
          {metadata?.display_name && (
            <p className="text-xs text-gray-400 truncate">{payeeRaw}</p>
          )}
          <p className="text-xs text-gray-400 mt-0.5">
            {count} transaction{count !== 1 ? 's' : ''}
            {metadata?.category && <span className="ml-2 capitalize text-brand-600">{metadata.category}</span>}
            {metadata?.offsets_category && <span className="ml-2 text-amber-600">offsets {metadata.offsets_category}</span>}
            {metadata?.notes && <span className="ml-2 text-gray-400">· {metadata.notes}</span>}
          </p>
        </div>
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-sm font-semibold text-gray-700">{fmt(total)}</span>
          <span className="text-xs text-gray-400">{open ? '▲' : '▼'}</span>
        </div>
      </button>

      {open && (
        <div className="border-t border-slate-200 p-3 space-y-3">
          <div className="grid gap-3 sm:grid-cols-2">
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Display name</label>
              <input
                type="text"
                value={displayName}
                onChange={e => setDisplayName(e.target.value)}
                placeholder={payeeRaw}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none"
              />
            </div>
            <div>
              <label className="text-xs font-medium text-gray-500 block mb-1">Category override</label>
              <select
                value={category}
                onChange={e => setCategory(e.target.value as SpendingCategory | '')}
                className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none"
              >
                <option value="">Use AI category</option>
                {SPENDING_CATEGORIES.map(c => (
                  <option key={c} value={c} className="capitalize">{c}</option>
                ))}
              </select>
            </div>
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">Notes</label>
            <input
              type="text"
              value={notes}
              onChange={e => setNotes(e.target.value)}
              placeholder="e.g. landlord, monthly subscription, shared with partner…"
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-900 placeholder-gray-400 focus:border-brand-400 focus:outline-none"
            />
          </div>
          <div>
            <label className="text-xs font-medium text-gray-500 block mb-1">
              Offsets category
              <span className="ml-1 font-normal text-gray-400">— income from this payee reduces that category's net cost</span>
            </label>
            <select
              value={offsetsCategory}
              onChange={e => setOffsetsCategory(e.target.value as SpendingCategory | '')}
              className="w-full rounded-lg border border-slate-200 bg-white px-3 py-1.5 text-sm text-gray-900 focus:border-brand-400 focus:outline-none"
            >
              <option value="">No offset</option>
              {SPENDING_CATEGORIES.map(c => (
                <option key={c} value={c} className="capitalize">{c}</option>
              ))}
            </select>
            <p className="mt-1 text-[10px] text-gray-400">
              e.g. partner rent contribution → offsets housing · insurance refund → offsets health
            </p>
          </div>
          <div className="flex justify-end gap-2">
            <button type="button" onClick={() => setOpen(false)} className="px-3 py-1.5 text-xs text-gray-500 hover:text-gray-700">Cancel</button>
            <button
              type="button"
              onClick={handleSave}
              disabled={saving}
              className="px-3 py-1.5 text-xs font-medium bg-brand-600 text-white rounded-lg hover:bg-brand-700 disabled:opacity-50"
            >
              {saving ? 'Saving…' : 'Save'}
            </button>
          </div>
        </div>
      )}
    </div>
  )
}
