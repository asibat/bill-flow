import type { Bill } from '@/types'

export interface RecurringPattern {
  payee_name: string
  payee_id: string | null
  frequency_days: number
  frequency_label: string
  avg_amount: number
  currency: string
  bill_count: number
  last_bill_date: string
  next_expected_date: string
  confidence: number
}

/** Known billing frequencies and their approximate day intervals */
const FREQUENCY_THRESHOLDS = [
  { label: 'monthly', min: 25, max: 35, days: 30 },
  { label: 'bi-monthly', min: 55, max: 65, days: 60 },
  { label: 'quarterly', min: 80, max: 100, days: 90 },
  { label: 'semi-annual', min: 165, max: 195, days: 180 },
  { label: 'annual', min: 350, max: 380, days: 365 },
]

/**
 * Calculate the average interval between sorted dates in days.
 */
export function averageInterval(dates: string[]): number | null {
  if (dates.length < 2) return null
  const sorted = [...dates].sort()
  let totalDays = 0
  for (let i = 1; i < sorted.length; i++) {
    const diff = new Date(sorted[i]).getTime() - new Date(sorted[i - 1]).getTime()
    totalDays += diff / (1000 * 60 * 60 * 24)
  }
  return totalDays / (sorted.length - 1)
}

/**
 * Match an average interval to a known billing frequency.
 */
export function matchFrequency(avgDays: number): { label: string; days: number; confidence: number } | null {
  for (const freq of FREQUENCY_THRESHOLDS) {
    if (avgDays >= freq.min && avgDays <= freq.max) {
      // Confidence based on how close to the ideal interval
      const deviation = Math.abs(avgDays - freq.days) / freq.days
      const confidence = Math.max(0, 1 - deviation * 2)
      return { label: freq.label, days: freq.days, confidence: Math.round(confidence * 100) / 100 }
    }
  }
  return null
}

/**
 * Detect recurring billing patterns from a list of bills.
 * Groups by payee, analyzes intervals, and predicts next expected date.
 */
export function detectRecurringPatterns(bills: Bill[]): RecurringPattern[] {
  // Group bills by payee_name (normalized lowercase)
  const groups = new Map<string, Bill[]>()
  for (const bill of bills) {
    const key = bill.payee_name.toLowerCase().trim()
    const existing = groups.get(key) ?? []
    existing.push(bill)
    groups.set(key, existing)
  }

  const patterns: RecurringPattern[] = []

  for (const [, groupBills] of groups) {
    if (groupBills.length < 2) continue

    const dueDates = groupBills
      .map(b => b.due_date)
      .filter(Boolean)
      .sort()

    const avgDays = averageInterval(dueDates)
    if (!avgDays) continue

    const freq = matchFrequency(avgDays)
    if (!freq) continue

    const amounts = groupBills.map(b => b.amount).filter(a => a > 0)
    const avgAmount = amounts.length > 0
      ? Math.round((amounts.reduce((s, a) => s + a, 0) / amounts.length) * 100) / 100
      : 0

    const lastDate = dueDates[dueDates.length - 1]
    const nextExpected = new Date(lastDate)
    nextExpected.setDate(nextExpected.getDate() + freq.days)

    patterns.push({
      payee_name: groupBills[0].payee_name,
      payee_id: groupBills[0].payee_id,
      frequency_days: freq.days,
      frequency_label: freq.label,
      avg_amount: avgAmount,
      currency: groupBills[0].currency,
      bill_count: groupBills.length,
      last_bill_date: lastDate,
      next_expected_date: nextExpected.toISOString().split('T')[0],
      confidence: freq.confidence,
    })
  }

  // Sort by confidence descending, then by next expected date
  return patterns.sort((a, b) => b.confidence - a.confidence || a.next_expected_date.localeCompare(b.next_expected_date))
}
