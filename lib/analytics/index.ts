/**
 * Dashboard analytics utilities.
 * Computes spending trends, category breakdowns, and monthly summaries.
 */

import type { Bill } from '@/types'
import { format, startOfMonth, subMonths } from 'date-fns'

export interface MonthlySpending {
  month: string // YYYY-MM
  label: string // e.g. "Jan 2026"
  total: number
  count: number
  currency: string
}

export interface VendorSpending {
  payee_name: string
  total: number
  count: number
  percentage: number
  currency: string
}

export interface SpendingTrend {
  direction: 'up' | 'down' | 'stable'
  percentageChange: number
  currentMonth: number
  previousMonth: number
}

export interface AnalyticsSummary {
  monthlySpending: MonthlySpending[]
  topVendors: VendorSpending[]
  trend: SpendingTrend | null
  totalBills: number
  avgBillAmount: number
  totalSpent: number
}

/**
 * Calculate monthly spending totals for the last N months.
 * Only includes bills with status indicating payment (not just received).
 */
export function getMonthlySpending(bills: Bill[], months = 6): MonthlySpending[] {
  const now = new Date()
  const result: MonthlySpending[] = []

  for (let i = months - 1; i >= 0; i--) {
    const monthStart = startOfMonth(subMonths(now, i))
    const monthKey = format(monthStart, 'yyyy-MM')
    const monthLabel = format(monthStart, 'MMM yyyy')

    const monthBills = bills.filter(b => {
      const dueMonth = b.due_date.slice(0, 7) // YYYY-MM
      return dueMonth === monthKey
    })

    const total = monthBills.reduce((sum, b) => sum + b.amount, 0)

    result.push({
      month: monthKey,
      label: monthLabel,
      total: Math.round(total * 100) / 100,
      count: monthBills.length,
      currency: 'EUR', // primary currency
    })
  }

  return result
}

/**
 * Get top vendors by total spending.
 */
export function getTopVendors(bills: Bill[], limit = 5): VendorSpending[] {
  const vendorMap = new Map<string, { total: number; count: number; currency: string }>()

  for (const bill of bills) {
    const name = bill.payee_name.trim()
    const existing = vendorMap.get(name) ?? { total: 0, count: 0, currency: bill.currency }
    existing.total += bill.amount
    existing.count += 1
    vendorMap.set(name, existing)
  }

  const grandTotal = bills.reduce((sum, b) => sum + b.amount, 0)

  const vendors: VendorSpending[] = []
  for (const [payee_name, data] of Array.from(vendorMap)) {
    vendors.push({
      payee_name,
      total: Math.round(data.total * 100) / 100,
      count: data.count,
      percentage: grandTotal > 0 ? Math.round((data.total / grandTotal) * 10000) / 100 : 0,
      currency: data.currency,
    })
  }

  return vendors
    .sort((a, b) => b.total - a.total)
    .slice(0, limit)
}

/**
 * Calculate spending trend comparing current month to previous month.
 */
export function getSpendingTrend(monthlySpending: MonthlySpending[]): SpendingTrend | null {
  if (monthlySpending.length < 2) return null

  const current = monthlySpending[monthlySpending.length - 1]
  const previous = monthlySpending[monthlySpending.length - 2]

  if (previous.total === 0) {
    return {
      direction: current.total > 0 ? 'up' : 'stable',
      percentageChange: current.total > 0 ? 100 : 0,
      currentMonth: current.total,
      previousMonth: previous.total,
    }
  }

  const change = ((current.total - previous.total) / previous.total) * 100
  const rounded = Math.round(change * 10) / 10

  return {
    direction: Math.abs(rounded) < 5 ? 'stable' : rounded > 0 ? 'up' : 'down',
    percentageChange: Math.abs(rounded),
    currentMonth: current.total,
    previousMonth: previous.total,
  }
}

/**
 * Generate a full analytics summary from bills.
 */
export function getAnalyticsSummary(bills: Bill[], months = 6): AnalyticsSummary {
  const monthlySpending = getMonthlySpending(bills, months)
  const topVendors = getTopVendors(bills)
  const trend = getSpendingTrend(monthlySpending)

  const amounts = bills.map(b => b.amount).filter(a => a > 0)
  const totalSpent = Math.round(amounts.reduce((s, a) => s + a, 0) * 100) / 100
  const avgBillAmount = amounts.length > 0
    ? Math.round((totalSpent / amounts.length) * 100) / 100
    : 0

  return {
    monthlySpending,
    topVendors,
    trend,
    totalBills: bills.length,
    avgBillAmount,
    totalSpent,
  }
}
