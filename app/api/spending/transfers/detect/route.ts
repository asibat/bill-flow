import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { detectIntraHouseholdTransfers } from '@/lib/spending/transfer-detector'
import type { Transaction } from '@/types'

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: transactions, error: txError } = await supabase
    .from('transactions')
    .select('*')
    .eq('user_id', user.id)

  if (txError) return NextResponse.json({ error: txError.message }, { status: 500 })

  const { data: existingPairs, error: pairsError } = await supabase
    .from('household_transfer_pairs')
    .select('outgoing_transaction_id, incoming_transaction_id')
    .eq('user_id', user.id)

  if (pairsError) return NextResponse.json({ error: pairsError.message }, { status: 500 })

  const alreadyMatched = new Set<string>([
    ...(existingPairs ?? []).map(p => p.outgoing_transaction_id),
    ...(existingPairs ?? []).map(p => p.incoming_transaction_id),
  ])

  const matches = detectIntraHouseholdTransfers(transactions as Transaction[], alreadyMatched)

  let detected = 0
  if (matches.length > 0) {
    const rows = matches.map(m => ({
      user_id: user.id,
      outgoing_transaction_id: m.outgoing_id,
      incoming_transaction_id: m.incoming_id,
      amount_diff_pct: m.amount_diff_pct,
      date_diff_days: m.date_diff_days,
      status: 'pending',
    }))

    const { data: inserted, error: insertError } = await supabase
      .from('household_transfer_pairs')
      .upsert(rows, { onConflict: 'outgoing_transaction_id,incoming_transaction_id' })
      .select('id')

    if (insertError) return NextResponse.json({ error: insertError.message }, { status: 500 })
    detected = inserted?.length ?? 0
  }

  const { count: totalPending } = await supabase
    .from('household_transfer_pairs')
    .select('*', { count: 'exact', head: true })
    .eq('user_id', user.id)
    .eq('status', 'pending')

  return NextResponse.json({ detected, total_pending: totalPending ?? 0 })
}
