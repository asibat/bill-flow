'use client'

import { useState } from 'react'
import type { Transaction, SpendingCategory } from '@/types'
import { effectiveCategory } from '@/types'
import { SPENDING_CATEGORIES } from '@/lib/spending/categories'
import { format } from 'date-fns'

const CATEGORY_COLORS: Record<SpendingCategory, string> = {
  housing: 'bg-blue-100 text-blue-700',
  utilities: 'bg-purple-100 text-purple-700',
  groceries: 'bg-emerald-100 text-emerald-700',
  transport: 'bg-amber-100 text-amber-700',
  travel: 'bg-sky-100 text-sky-700',
  health: 'bg-red-100 text-red-700',
  dining: 'bg-orange-100 text-orange-700',
  subscriptions: 'bg-cyan-100 text-cyan-700',
  shopping: 'bg-pink-100 text-pink-700',
  cash: 'bg-amber-100 text-amber-800',
  income: 'bg-green-100 text-green-700',
  transfer: 'bg-slate-100 text-slate-600',
  other: 'bg-gray-100 text-gray-500',
}

interface Props {
  transactions: Transaction[]
}

export default function TransactionTable({ transactions }: Props) {
  const [overrides, setOverrides] = useState<Record<string, SpendingCategory>>({})
  const [saving, setSaving] = useState<string | null>(null)

  async function handleCategoryChange(id: string, category: SpendingCategory | '') {
    const value = category === '' ? null : category
    setSaving(id)
    try {
      const res = await fetch(`/api/spending/transactions/${id}`, {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ category_user: value }),
      })
      if (res.ok) {
        if (value) {
          setOverrides(prev => ({ ...prev, [id]: value }))
        } else {
          setOverrides(prev => { const next = { ...prev }; delete next[id]; return next })
        }
      }
    } finally {
      setSaving(null)
    }
  }

  if (transactions.length === 0) {
    return <p className="text-sm text-gray-400 text-center py-8">No transactions</p>
  }

  return (
    <div className="overflow-x-auto">
      <table className="w-full text-sm">
        <thead>
          <tr className="border-b border-slate-100">
            <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Date</th>
            <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide">Payee</th>
            <th className="pb-2 text-right text-xs font-semibold text-gray-500 uppercase tracking-wide">Amount</th>
            <th className="pb-2 text-left text-xs font-semibold text-gray-500 uppercase tracking-wide pl-3">Category</th>
          </tr>
        </thead>
        <tbody className="divide-y divide-slate-50">
          {transactions.map(tx => {
            const cat = overrides[tx.id] ?? effectiveCategory({ ...tx, category_user: tx.category_user })
            const isExpense = tx.amount < 0
            return (
              <tr key={tx.id} className="hover:bg-slate-50/60 transition-colors">
                <td className="py-2.5 pr-4 text-gray-500 whitespace-nowrap">
                  {format(new Date(tx.date), 'd MMM yyyy')}
                </td>
                <td className="py-2.5 pr-4 font-medium text-gray-900 max-w-[200px] truncate">
                  {tx.payee_raw}
                </td>
                <td className={`py-2.5 pr-3 text-right font-semibold whitespace-nowrap ${isExpense ? 'text-gray-900' : 'text-green-600'}`}>
                  {isExpense ? '-' : '+'}€{Math.abs(tx.amount).toLocaleString('en-BE', { minimumFractionDigits: 2, maximumFractionDigits: 2 })}
                </td>
                <td className="py-2.5 pl-3">
                  <div className="flex items-center gap-2">
                    <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${CATEGORY_COLORS[cat]}`}>
                      {cat}
                    </span>
                    {tx.category_user && (
                      <span className="text-[10px] text-brand-500 font-medium">edited</span>
                    )}
                    <select
                      className="text-xs text-gray-400 hover:text-gray-700 bg-transparent border-none cursor-pointer outline-none"
                      value={overrides[tx.id] ?? tx.category_user ?? ''}
                      onChange={e => handleCategoryChange(tx.id, e.target.value as SpendingCategory | '')}
                      disabled={saving === tx.id}
                      aria-label="Override category"
                    >
                      <option value="">AI: {tx.category_ai ?? 'other'}</option>
                      {SPENDING_CATEGORIES.map(c => (
                        <option key={c} value={c}>{c}</option>
                      ))}
                    </select>
                  </div>
                </td>
              </tr>
            )
          })}
        </tbody>
      </table>
    </div>
  )
}
