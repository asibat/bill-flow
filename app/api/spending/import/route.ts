import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { parseN26Csv } from '@/lib/spending/csv-parser'
import { categorizeTransactions, inferOffsetCategory } from '@/lib/spending/categorize'
import { detectIntraHouseholdTransfers } from '@/lib/spending/transfer-detector'
import type { SpendingCategory, Transaction } from '@/types'

const MIN_OCCURRENCES = 2
const AMOUNT_TOLERANCE = 0.02

function detectAndInferOffsets(
  incomeRows: Array<{ payee_raw: string; amount: number }>,
): Array<{ payee_raw: string; amount: number; occurrences: number }> {
  const byPayee = new Map<string, number[]>()
  for (const tx of incomeRows) {
    const existing = byPayee.get(tx.payee_raw) ?? []
    byPayee.set(tx.payee_raw, [...existing, tx.amount])
  }
  const patterns: Array<{ payee_raw: string; amount: number; occurrences: number }> = []
  for (const [payee_raw, amounts] of Array.from(byPayee)) {
    if (amounts.length < MIN_OCCURRENCES) continue
    const sorted = [...amounts].sort((a: number, b: number) => a - b)
    let bestCluster: { amount: number; count: number } | null = null
    for (let i = 0; i < sorted.length; i++) {
      const anchor = sorted[i]
      const clusterMembers = sorted.filter((a: number) => Math.abs(a - anchor) / anchor <= AMOUNT_TOLERANCE)
      if (clusterMembers.length >= MIN_OCCURRENCES && (!bestCluster || clusterMembers.length > bestCluster.count)) {
        bestCluster = { amount: anchor, count: clusterMembers.length }
      }
    }
    if (bestCluster && bestCluster.amount <= 2000) {
      patterns.push({ payee_raw, amount: bestCluster.amount, occurrences: bestCluster.count })
    }
  }
  return patterns
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file')
  const accountName = formData.get('account_name')
  const accountNameStr = typeof accountName === 'string' && accountName.trim() ? accountName.trim() : null

  if (!file || !(file instanceof File)) {
    return NextResponse.json({ error: 'No file provided' }, { status: 400 })
  }

  if (!file.name.endsWith('.csv')) {
    return NextResponse.json({ error: 'Only CSV files are supported' }, { status: 400 })
  }

  const text = await file.text()
  const firstLines = text.split('\n').slice(0, 3).join('\n')
  console.log('[spending:import] CSV preview (first 3 lines):', firstLines)

  const { transactions: raw, errors: parseErrors, filename } = parseN26Csv(text, file.name)
  console.log('[spending:import] Parsed:', raw.length, 'transactions,', parseErrors.length, 'errors')
  if (parseErrors.length > 0) console.log('[spending:import] Parse errors:', parseErrors.slice(0, 5))

  if (raw.length === 0) {
    return NextResponse.json(
      { error: 'No valid transactions found', parseErrors, csvPreview: firstLines },
      { status: 422 },
    )
  }

  // AI categorization
  const categorized = await categorizeTransactions(raw)

  // Upsert — skip duplicates via unique index on (user_id, date, amount, payee_raw, source_file)
  const rows = categorized.map(tx => ({
    user_id: user.id,
    date: tx.date,
    amount: tx.amount,
    currency: tx.currency,
    payee_raw: tx.payee,
    category_n26: tx.type ?? null,
    category_ai: tx.category_ai,
    description: tx.reference ?? null,
    account: tx.account ?? null,
    account_name: accountNameStr,
    source_file: filename,
  }))

  // Find which rows already exist (duplicates)
  const { data: existing } = await supabase
    .from('transactions')
    .select('date, amount, payee_raw, source_file')
    .eq('user_id', user.id)

  const existingSet = new Set(
    (existing ?? []).map(r => `${r.date}|${r.amount}|${r.payee_raw}|${r.source_file}`)
  )

  const duplicates = rows
    .filter(r => existingSet.has(`${r.date}|${r.amount}|${r.payee_raw}|${r.source_file}`))
    .map(r => ({ date: r.date, amount: r.amount, payee: r.payee_raw }))

  const newRows = rows.filter(
    r => !existingSet.has(`${r.date}|${r.amount}|${r.payee_raw}|${r.source_file}`)
  )

  let imported = 0
  if (newRows.length > 0) {
    const { data: inserted, error } = await supabase
      .from('transactions')
      .insert(newRows)
      .select('id')

    if (error) {
      console.error('[spending:import] DB error:', error)
      return NextResponse.json({ error: error.message }, { status: 500 })
    }
    imported = inserted?.length ?? 0
  }

  // Auto-detect recurring income patterns and infer offset categories
  // Run across all user income transactions (not just this import)
  const { data: allIncome } = await supabase
    .from('transactions')
    .select('payee_raw, amount')
    .eq('user_id', user.id)
    .gt('amount', 0)

  const { data: existingPayees } = await supabase
    .from('spending_payees')
    .select('payee_raw, offsets_category')
    .eq('user_id', user.id)

  const alreadyConfigured = new Set(
    (existingPayees ?? []).filter(p => p.offsets_category).map(p => p.payee_raw)
  )

  const patterns = detectAndInferOffsets(
    (allIncome ?? []).filter(tx => !alreadyConfigured.has(tx.payee_raw))
  )

  const autoOffsets: Array<{ payee_raw: string; offsets_category: SpendingCategory }> = []
  if (patterns.length > 0) {
    const inferred = await inferOffsetCategory(patterns)
    for (const { payee_raw, offsets_category } of inferred) {
      if (!offsets_category || offsets_category === 'income' || offsets_category === 'transfer') continue
      await supabase
        .from('spending_payees')
        .upsert({ user_id: user.id, payee_raw, offsets_category }, { onConflict: 'user_id,payee_raw' })
      autoOffsets.push({ payee_raw, offsets_category })
    }
  }

  // Detect intra-household transfers across all accounts
  let detectedTransfers = 0
  if (imported > 0) {
    const { data: allTransactions } = await supabase
      .from('transactions')
      .select('*')
      .eq('user_id', user.id)

    const { data: existingPairs } = await supabase
      .from('household_transfer_pairs')
      .select('outgoing_transaction_id, incoming_transaction_id')
      .eq('user_id', user.id)

    const alreadyMatched = new Set<string>([
      ...(existingPairs ?? []).map(p => p.outgoing_transaction_id),
      ...(existingPairs ?? []).map(p => p.incoming_transaction_id),
    ])

    const matches = detectIntraHouseholdTransfers(allTransactions as Transaction[], alreadyMatched)

    if (matches.length > 0) {
      const pairRows = matches.map(m => ({
        user_id: user.id,
        outgoing_transaction_id: m.outgoing_id,
        incoming_transaction_id: m.incoming_id,
        amount_diff_pct: m.amount_diff_pct,
        date_diff_days: m.date_diff_days,
        status: 'pending',
      }))

      const { data: inserted } = await supabase
        .from('household_transfer_pairs')
        .upsert(pairRows, { onConflict: 'outgoing_transaction_id,incoming_transaction_id' })
        .select('id')

      detectedTransfers = inserted?.length ?? 0
    }
  }

  return NextResponse.json({
    imported,
    total: rows.length,
    skippedDuplicates: duplicates.length,
    duplicates,
    parseErrors,
    autoOffsets,
    accountName: accountNameStr,
    detectedTransfers,
  }, { status: 201 })
}
