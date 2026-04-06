import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { inferOffsetCategory } from '@/lib/spending/categorize'
import type { SpendingCategory } from '@/types'

/** Minimum occurrences to consider a pattern recurring */
const MIN_OCCURRENCES = 2
/** Amount variance tolerance (2%) */
const AMOUNT_TOLERANCE = 0.02

interface RecurringPattern {
  payee_raw: string
  amount: number
  occurrences: number
}

function detectRecurringPatterns(
  incomeTransactions: Array<{ payee_raw: string; amount: number }>,
  alreadyConfigured: Set<string>,
): RecurringPattern[] {
  const byPayee = new Map<string, number[]>()
  for (const tx of incomeTransactions) {
    if (alreadyConfigured.has(tx.payee_raw)) continue
    const existing = byPayee.get(tx.payee_raw) ?? []
    byPayee.set(tx.payee_raw, [...existing, tx.amount])
  }

  const patterns: RecurringPattern[] = []

  for (const [payee_raw, amounts] of Array.from(byPayee)) {
    if (amounts.length < MIN_OCCURRENCES) continue

    // Find the most frequent amount cluster (dominant recurring value)
    // Sort amounts and find the largest cluster where all values are within ±2% of each other
    const sorted = [...amounts].sort((a: number, b: number) => a - b)
    let bestCluster: { amount: number; count: number } | null = null

    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i]
      const clusterMembers = sorted.filter(
        (a: number) => Math.abs(a - anchor) / anchor <= AMOUNT_TOLERANCE
      )
      if (clusterMembers.length >= MIN_OCCURRENCES && (!bestCluster || clusterMembers.length > bestCluster.count)) {
        bestCluster = { amount: anchor, count: clusterMembers.length }
      }
    }

    // Skip large amounts — likely salary/freelance, not cost-sharing (threshold: €2000)
    if (bestCluster && bestCluster.amount <= 2000) {
      patterns.push({ payee_raw, amount: bestCluster.amount, occurrences: bestCluster.count })
    }
  }

  return patterns
}

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  // Fetch all income transactions and existing payee configs in parallel
  const [{ data: incomeTx }, { data: payeeData }] = await Promise.all([
    supabase
      .from('transactions')
      .select('payee_raw, amount')
      .eq('user_id', user.id)
      .gt('amount', 0),
    supabase
      .from('spending_payees')
      .select('payee_raw, category, offsets_category')
      .eq('user_id', user.id),
  ])

  // Skip payees that already have offsets_category set, or are explicitly marked as income sources
  // (salary, freelance) — but NOT just because their transactions happen to be positive amounts
  const alreadyConfigured = new Set(
    (payeeData ?? [])
      .filter(p => p.offsets_category || p.category === 'income')
      .map(p => p.payee_raw)
  )

  const patterns = detectRecurringPatterns(incomeTx ?? [], alreadyConfigured)

  if (patterns.length === 0) {
    return NextResponse.json({ detected: 0, applied: [] })
  }

  // Ask Claude to infer the offset category for each detected pattern
  const inferred = await inferOffsetCategory(patterns)

  // Upsert payee records with the inferred offsets_category
  const applied: Array<{ payee_raw: string; offsets_category: SpendingCategory; occurrences: number }> = []
  for (const { payee_raw, offsets_category, occurrences } of inferred) {
    // income/transfer can't offset an expense category — skip
    if (!offsets_category || offsets_category === 'income' || offsets_category === 'transfer') continue
    const { error } = await supabase
      .from('spending_payees')
      .upsert(
        { user_id: user.id, payee_raw, offsets_category },
        { onConflict: 'user_id,payee_raw' },
      )
    if (!error) applied.push({ payee_raw, offsets_category, occurrences })
  }

  return NextResponse.json({ detected: patterns.length, applied })
}
