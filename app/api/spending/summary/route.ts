import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { effectiveCategory } from '@/types'
import type { Transaction, TransactionSummary, SpendingCategory } from '@/types'
import { format } from 'date-fns'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const from = searchParams.get('from')
  const to = searchParams.get('to')

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)
    .order('date', { ascending: true })

  if (from) query = query.gte('date', from)
  if (to) query = query.lte('date', to)

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const transactions: Transaction[] = data ?? []

  const expenses = transactions.filter(tx => tx.amount < 0)
  const income = transactions.filter(tx => tx.amount > 0)

  const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0)

  // By category
  const categoryMap = new Map<SpendingCategory, { total: number; count: number }>()
  for (const tx of expenses) {
    const cat = effectiveCategory(tx)
    const existing = categoryMap.get(cat) ?? { total: 0, count: 0 }
    categoryMap.set(cat, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
  }
  const byCategory = Array.from(categoryMap.entries())
    .map(([category, { total, count }]) => ({
      category,
      gross: total,
      offsets: 0,
      net: total,
      count,
      percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
    }))
    .sort((a, b) => b.gross - a.gross)

  // By month
  const monthMap = new Map<string, { expenses: number; income: number }>()
  for (const tx of transactions) {
    const month = tx.date.slice(0, 7) // YYYY-MM
    const existing = monthMap.get(month) ?? { expenses: 0, income: 0 }
    if (tx.amount < 0) {
      monthMap.set(month, { ...existing, expenses: existing.expenses + Math.abs(tx.amount) })
    } else {
      monthMap.set(month, { ...existing, income: existing.income + tx.amount })
    }
  }
  const byMonth = Array.from(monthMap.entries())
    .sort(([a], [b]) => a.localeCompare(b))
    .map(([month, { expenses, income: inc }]) => ({
      month,
      label: format(new Date(`${month}-01`), 'MMM yyyy'),
      expenses,
      income: inc,
    }))

  // Top payees (expenses only)
  const payeeMap = new Map<string, { total: number; count: number }>()
  for (const tx of expenses) {
    const key = tx.payee_raw
    const existing = payeeMap.get(key) ?? { total: 0, count: 0 }
    payeeMap.set(key, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
  }
  const topPayees = Array.from(payeeMap.entries())
    .map(([payee, { total, count }]) => ({ payee, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  const costOfLiving = byCategory
    .filter(c => c.category !== 'transfer')
    .reduce((sum, c) => sum + c.net, 0)

  const summary: TransactionSummary = {
    totalExpenses,
    totalIncome,
    net: totalIncome - totalExpenses,
    currency: 'EUR',
    byCategory,
    byMonth,
    topPayees,
    savingsRate: totalIncome > 0 ? Math.round(((totalIncome - costOfLiving) / totalIncome) * 100) : null,
    costOfLiving,
    accountNames: [],
    intraHouseholdCount: 0,
  }

  return NextResponse.json({ summary })
}
