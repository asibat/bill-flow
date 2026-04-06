import { createServerSupabaseClient } from '@/lib/supabase/server'
import { effectiveCategory } from '@/types'
import type { Transaction, TransactionSummary, SpendingCategory, SpendingPayee, CategorySummary } from '@/types'
import { format } from 'date-fns'
import SpendingDashboard from './_components/SpendingDashboard'

export const dynamic = 'force-dynamic'

function buildSummary(
  transactions: Transaction[],
  payeeMetadata: SpendingPayee[],
  excludedIds: Set<string> = new Set(),
  intraHouseholdCount = 0,
): TransactionSummary {
  const offsetMap = new Map<string, SpendingCategory>()
  for (const p of payeeMetadata) {
    if (p.offsets_category) offsetMap.set(p.payee_raw, p.offsets_category)
  }

  const filtered = excludedIds.size > 0
    ? transactions.filter(tx => !excludedIds.has(tx.id))
    : transactions

  const expenses = filtered.filter(tx => tx.amount < 0)
  const income = filtered.filter(tx => tx.amount > 0)

  const totalExpenses = expenses.reduce((sum, tx) => sum + Math.abs(tx.amount), 0)
  const totalIncome = income.reduce((sum, tx) => sum + tx.amount, 0)

  // Gross expenses per category
  const grossMap = new Map<SpendingCategory, { total: number; count: number }>()
  for (const tx of expenses) {
    const cat = effectiveCategory(tx)
    const existing = grossMap.get(cat) ?? { total: 0, count: 0 }
    grossMap.set(cat, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
  }

  // Offsets: transaction-level takes precedence over payee-level
  const offsetsPerCategory = new Map<SpendingCategory, number>()
  for (const tx of income) {
    const offsetCat = tx.offsets_category ?? offsetMap.get(tx.payee_raw)
    if (offsetCat) {
      offsetsPerCategory.set(offsetCat, (offsetsPerCategory.get(offsetCat) ?? 0) + tx.amount)
    }
  }

  const byCategory: CategorySummary[] = Array.from(grossMap.entries())
    .map(([category, { total, count }]) => {
      const offsets = offsetsPerCategory.get(category) ?? 0
      return {
        category,
        gross: total,
        offsets,
        net: Math.max(0, total - offsets),
        count,
        percentage: totalExpenses > 0 ? Math.round((total / totalExpenses) * 100) : 0,
      }
    })
    .sort((a, b) => b.gross - a.gross)

  // Cost of living = net expenses excluding transfer (savings/investments)
  const costOfLiving = byCategory
    .filter(c => c.category !== 'transfer')
    .reduce((sum, c) => sum + c.net, 0)

  // Savings rate based on observed income vs actual cost of living
  const savingsRate = totalIncome > 0
    ? Math.round(((totalIncome - costOfLiving) / totalIncome) * 100)
    : null

  const monthMap = new Map<string, { expenses: number; income: number }>()
  for (const tx of filtered) {
    const month = tx.date.slice(0, 7)
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

  const payeeMap = new Map<string, { total: number; count: number }>()
  for (const tx of expenses) {
    const existing = payeeMap.get(tx.payee_raw) ?? { total: 0, count: 0 }
    payeeMap.set(tx.payee_raw, { total: existing.total + Math.abs(tx.amount), count: existing.count + 1 })
  }
  const topPayees = Array.from(payeeMap.entries())
    .map(([payee, { total, count }]) => ({ payee, total, count }))
    .sort((a, b) => b.total - a.total)
    .slice(0, 10)

  // Distinct account names present in this dataset (use unfiltered to keep all accounts visible)
  const accountNames = Array.from(
    new Set(transactions.map(tx => tx.account_name).filter((n): n is string => n !== null))
  ).sort()

  return {
    totalExpenses,
    totalIncome,
    net: totalIncome - totalExpenses,
    currency: 'EUR',
    byCategory,
    byMonth,
    topPayees,
    savingsRate,
    costOfLiving,
    accountNames,
    intraHouseholdCount,
  }
}

interface PageProps {
  searchParams: { account?: string; from?: string }
}

export default async function SpendingPage({ searchParams }: PageProps) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()

  const [{ data: settings }, { data: payeeData }, { data: confirmedPairs }, { data: pendingPairs }] = await Promise.all([
    supabase
      .from('user_settings')
      .select('household_size, monthly_income, income_currency, spending_date_from')
      .eq('user_id', user!.id)
      .single(),
    supabase.from('spending_payees').select('*').eq('user_id', user!.id),
    supabase
      .from('household_transfer_pairs')
      .select('outgoing_transaction_id, incoming_transaction_id')
      .eq('user_id', user!.id)
      .eq('status', 'confirmed'),
    supabase
      .from('household_transfer_pairs')
      .select('id', { count: 'exact', head: false })
      .eq('user_id', user!.id)
      .eq('status', 'pending'),
  ])

  // Date filter: URL param > DB setting > no filter
  const dateFrom = searchParams.from ?? settings?.spending_date_from ?? null

  // Account filter
  const accountFilter = searchParams.account && searchParams.account !== 'all'
    ? searchParams.account
    : null

  let query = supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user!.id)
    .order('date', { ascending: false })
    .limit(2000)

  if (dateFrom) query = query.gte('date', dateFrom)
  if (accountFilter) query = query.eq('account_name', accountFilter)

  const { data: txData } = await query

  // Fetch all account names (unfiltered) for the filter pills
  const { data: allTxAccounts } = await supabase
    .from('transactions')
    .select('account_name')
    .eq('user_id', user!.id)
    .not('account_name', 'is', null)

  const allAccountNames = Array.from(
    new Set((allTxAccounts ?? []).map(r => r.account_name).filter((n): n is string => n !== null))
  ).sort()

  const transactions: Transaction[] = txData ?? []
  const payeeMetadata = payeeData ?? []

  // Exclude confirmed intra-household pairs only when viewing all accounts combined
  const excludedIds = new Set<string>()
  if (!accountFilter && confirmedPairs) {
    for (const pair of confirmedPairs) {
      excludedIds.add(pair.outgoing_transaction_id)
      excludedIds.add(pair.incoming_transaction_id)
    }
  }

  const pendingTransferCount = pendingPairs?.length ?? 0
  const confirmedTransferCount = confirmedPairs?.length ?? 0

  const summary = transactions.length > 0
    ? buildSummary(transactions, payeeMetadata, excludedIds, confirmedTransferCount)
    : null

  return (
    <SpendingDashboard
      summary={summary}
      hasTransactions={transactions.length > 0}
      householdSize={settings?.household_size ?? null}
      monthlyIncome={settings?.monthly_income ?? null}
      incomeCurrency={settings?.income_currency ?? 'EUR'}
      payeeMetadata={payeeMetadata}
      transactions={transactions}
      allAccountNames={allAccountNames}
      activeAccount={accountFilter ?? 'all'}
      activeDateFrom={dateFrom}
      defaultDateFrom={settings?.spending_date_from ?? null}
      pendingTransferCount={pendingTransferCount}
      confirmedTransferCount={confirmedTransferCount}
    />
  )
}
