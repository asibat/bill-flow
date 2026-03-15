/**
 * Bill deduplication.
 *
 * Generates a fingerprint from payment-critical fields and checks for
 * existing bills with the same fingerprint before insertion.
 */

import type { SupabaseClient } from '@supabase/supabase-js'

export interface DedupCandidate {
  payee_name: string
  amount: number | null
  due_date: string | null
  structured_comm: string | null
}

export interface DuplicateMatch {
  id: string
  payee_name: string
  amount: number
  due_date: string
  status: string
  created_at: string
}

/**
 * Build a dedup fingerprint from bill fields.
 * Normalizes payee name (lowercase, trimmed), rounds amount,
 * and includes structured comm if available.
 */
export function buildFingerprint(bill: DedupCandidate): string {
  const parts = [
    bill.payee_name.toLowerCase().trim(),
    bill.amount != null ? bill.amount.toFixed(2) : '',
    bill.due_date ?? '',
  ]
  // Structured comm is the strongest dedup signal for Belgian bills
  if (bill.structured_comm) {
    parts.push(bill.structured_comm.replace(/[+/\s]/g, ''))
  }
  return parts.join('|')
}

/**
 * Check if a bill already exists for this user.
 *
 * Strategy:
 * 1. If structured_comm is present → exact match on (user_id, structured_comm, amount)
 * 2. Otherwise → match on (user_id, payee_name ~ilike, amount, due_date)
 *
 * Returns matching bills if found, empty array if no duplicates.
 */
export async function findDuplicates(
  supabase: SupabaseClient,
  userId: string,
  bill: DedupCandidate,
): Promise<DuplicateMatch[]> {
  // Strategy 1: structured comm match (strongest signal)
  if (bill.structured_comm) {
    const cleanComm = bill.structured_comm.replace(/[+/\s]/g, '')
    const { data } = await supabase
      .from('bills')
      .select('id, payee_name, amount, due_date, status, created_at, structured_comm')
      .eq('user_id', userId)
      .filter('structured_comm', 'neq', null)
      .limit(20)

    if (data && data.length > 0) {
      const matches = data.filter(b => {
        const existingClean = (b.structured_comm ?? '').replace(/[+/\s]/g, '')
        return existingClean === cleanComm
      })
      if (matches.length > 0) return matches as DuplicateMatch[]
    }
  }

  // Strategy 2: payee + amount + due_date match
  if (bill.amount != null && bill.due_date) {
    const { data } = await supabase
      .from('bills')
      .select('id, payee_name, amount, due_date, status, created_at')
      .eq('user_id', userId)
      .eq('amount', bill.amount)
      .eq('due_date', bill.due_date)
      .ilike('payee_name', bill.payee_name.trim())
      .limit(5)

    if (data && data.length > 0) return data as DuplicateMatch[]
  }

  return []
}
