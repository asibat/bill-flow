import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { effectiveCategory } from '@/types'
import type { Transaction, SpendingPayee, SpendingCategory } from '@/types'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const [{ data: txData }, { data: payeeData }] = await Promise.all([
    supabase.from('transactions').select('*').eq('user_id', user.id).order('date', { ascending: false }).limit(2000),
    supabase.from('spending_payees').select('*').eq('user_id', user.id),
  ])

  const transactions: Transaction[] = txData ?? []
  const payees: SpendingPayee[] = payeeData ?? []

  const offsetMap = new Map<string, SpendingCategory>()
  for (const p of payees) {
    if (p.offsets_category) offsetMap.set(p.payee_raw, p.offsets_category)
  }

  const expenses = transactions.filter(tx => tx.amount < 0)
  const income = transactions.filter(tx => tx.amount > 0)

  // Per-category gross
  const byCategory: Record<string, { gross: number; count: number; transactions: Array<{ date: string; payee: string; amount: number; category: string; source: string }> }> = {}
  for (const tx of expenses) {
    const cat = effectiveCategory(tx)
    if (!byCategory[cat]) byCategory[cat] = { gross: 0, count: 0, transactions: [] }
    byCategory[cat].gross += Math.abs(tx.amount)
    byCategory[cat].count++
    byCategory[cat].transactions.push({
      date: tx.date,
      payee: tx.payee_raw,
      amount: tx.amount,
      category: cat,
      source: tx.category_user ? 'user' : tx.category_ai ? 'ai' : 'default',
    })
  }

  // Offsets applied
  const offsetsApplied: Array<{ payee: string; amount: number; offsetsCategory: string; source: string }> = []
  for (const tx of income) {
    const offsetCat = tx.offsets_category ?? offsetMap.get(tx.payee_raw)
    if (offsetCat) {
      offsetsApplied.push({
        payee: tx.payee_raw,
        amount: tx.amount,
        offsetsCategory: offsetCat,
        source: tx.offsets_category ? 'transaction' : 'payee',
      })
    }
  }

  // Months covered
  const months = Array.from(new Set(transactions.map(tx => tx.date.slice(0, 7)))).sort()

  // Uncertain transactions (no user annotation, no payee metadata)
  const payeeWithCategory = new Set(payees.filter(p => p.category).map(p => p.payee_raw))
  const uncertain = expenses.filter(tx => !tx.category_user && !payeeWithCategory.has(tx.payee_raw))

  const totalExpenses = expenses.reduce((s, tx) => s + Math.abs(tx.amount), 0)
  const totalIncome = income.reduce((s, tx) => s + tx.amount, 0)
  const totalOffsets = offsetsApplied.reduce((s, o) => s + o.amount, 0)
  const monthCount = months.length

  return NextResponse.json({
    period: { from: months[0], to: months[months.length - 1], months: monthCount },
    totals: {
      expenses: totalExpenses,
      income: totalIncome,
      offsets: totalOffsets,
      netExpenses: totalExpenses - totalOffsets,
      avgMonthlyGross: +(totalExpenses / monthCount).toFixed(2),
      avgMonthlyNet: +((totalExpenses - totalOffsets) / monthCount).toFixed(2),
    },
    byCategory: Object.entries(byCategory)
      .sort(([, a], [, b]) => b.gross - a.gross)
      .map(([cat, { gross, count }]) => ({
        category: cat,
        gross: +gross.toFixed(2),
        count,
        avgPerMonth: +(gross / monthCount).toFixed(2),
      })),
    offsetsApplied: offsetsApplied.map(o => ({ ...o, amount: +o.amount.toFixed(2) })),
    uncertain: {
      count: uncertain.length,
      total: +uncertain.reduce((s, tx) => s + Math.abs(tx.amount), 0).toFixed(2),
      transactions: uncertain.slice(0, 30).map(tx => ({
        date: tx.date,
        payee: tx.payee_raw,
        amount: tx.amount,
        category_ai: tx.category_ai,
      })),
    },
  })
}
