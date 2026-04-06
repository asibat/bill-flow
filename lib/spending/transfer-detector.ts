import type { Transaction } from '@/types'

export interface TransferMatch {
  outgoing_id: string
  incoming_id: string
  amount_diff_pct: number
  date_diff_days: number
}

const AMOUNT_TOLERANCE = 0.02 // ±2%
const DATE_WINDOW_DAYS = 3

function daysBetween(a: string, b: string): number {
  const msPerDay = 86_400_000
  return Math.abs(new Date(a).getTime() - new Date(b).getTime()) / msPerDay
}

/**
 * Detect intra-household transfers: outgoing from account A matched to incoming
 * on account B for the same user, same amount (±2%), within ±3 days.
 *
 * Uses greedy matching sorted by smallest combined diff — each transaction
 * can only be part of one pair.
 *
 * @param transactions  All transactions for the user (any date range)
 * @param alreadyMatched  Set of transaction IDs already in existing pairs (skip these)
 */
export function detectIntraHouseholdTransfers(
  transactions: Transaction[],
  alreadyMatched: Set<string> = new Set(),
): TransferMatch[] {
  // Need at least two distinct account names to have intra-household transfers
  const accountNames = new Set(transactions.map(t => t.account_name).filter(Boolean))
  if (accountNames.size < 2) return []

  const outgoing = transactions.filter(
    t => t.amount < 0 && t.account_name && !alreadyMatched.has(t.id),
  )
  const incoming = transactions.filter(
    t => t.amount > 0 && t.account_name && !alreadyMatched.has(t.id),
  )

  // Build candidate pairs
  interface Candidate {
    out: Transaction
    inc: Transaction
    amountDiffPct: number
    dateDiffDays: number
    score: number
  }

  const candidates: Candidate[] = []

  for (const out of outgoing) {
    const outAbs = Math.abs(out.amount)

    for (const inc of incoming) {
      // Must be different accounts
      if (out.account_name === inc.account_name) continue

      // Amount within tolerance
      const amountDiffPct = Math.abs(outAbs - inc.amount) / inc.amount
      if (amountDiffPct > AMOUNT_TOLERANCE) continue

      // Date within window
      const dateDiffDays = daysBetween(out.date, inc.date)
      if (dateDiffDays > DATE_WINDOW_DAYS) continue

      candidates.push({
        out,
        inc,
        amountDiffPct,
        dateDiffDays,
        score: amountDiffPct + dateDiffDays / 10, // normalise date into same scale
      })
    }
  }

  // Sort by best match first
  candidates.sort((a, b) => a.score - b.score)

  // Greedy selection — each tx used at most once
  const usedIds = new Set<string>()
  const matches: TransferMatch[] = []

  for (const c of candidates) {
    if (usedIds.has(c.out.id) || usedIds.has(c.inc.id)) continue

    matches.push({
      outgoing_id: c.out.id,
      incoming_id: c.inc.id,
      amount_diff_pct: parseFloat(c.amountDiffPct.toFixed(4)),
      date_diff_days: Math.round(c.dateDiffDays),
    })

    usedIds.add(c.out.id)
    usedIds.add(c.inc.id)
  }

  return matches
}
