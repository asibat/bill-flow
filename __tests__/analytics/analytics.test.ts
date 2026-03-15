/**
 * Tests for dashboard analytics utilities.
 */

import { getMonthlySpending, getTopVendors, getSpendingTrend, getAnalyticsSummary } from '@/lib/analytics'
import { format, subMonths, startOfMonth } from 'date-fns'
import type { Bill } from '@/types'

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'test-id',
    user_id: 'user-1',
    source: 'upload',
    payee_name: 'VIVAQUA',
    payee_id: null,
    amount: 45,
    currency: 'EUR',
    due_date: format(new Date(), 'yyyy-MM-dd'),
    structured_comm: null,
    structured_comm_valid: null,
    iban: null,
    bic: null,
    status: 'received',
    extraction_confidence: null,
    language_detected: null,
    explanation: null,
    raw_pdf_path: null,
    doccle_url: null,
    wire_reference: null,
    paid_at: null,
    notes: null,
    needs_review: false,
    created_at: '2026-01-01T00:00:00Z',
    updated_at: '2026-01-01T00:00:00Z',
    ...overrides,
  }
}

function monthDate(monthsAgo: number): string {
  return format(startOfMonth(subMonths(new Date(), monthsAgo)), 'yyyy-MM') + '-15'
}

describe('getMonthlySpending()', () => {
  it('returns empty months for no bills', () => {
    const result = getMonthlySpending([], 3)
    expect(result).toHaveLength(3)
    result.forEach(m => {
      expect(m.total).toBe(0)
      expect(m.count).toBe(0)
    })
  })

  it('groups bills into correct months', () => {
    const bills = [
      makeBill({ due_date: monthDate(0), amount: 50 }),
      makeBill({ due_date: monthDate(0), amount: 30 }),
      makeBill({ due_date: monthDate(1), amount: 100 }),
    ]
    const result = getMonthlySpending(bills, 3)

    // Current month should have 2 bills totaling 80
    const currentMonth = result[result.length - 1]
    expect(currentMonth.total).toBe(80)
    expect(currentMonth.count).toBe(2)

    // Previous month should have 1 bill totaling 100
    const prevMonth = result[result.length - 2]
    expect(prevMonth.total).toBe(100)
    expect(prevMonth.count).toBe(1)
  })

  it('returns months in chronological order', () => {
    const result = getMonthlySpending([], 4)
    for (let i = 1; i < result.length; i++) {
      expect(result[i].month > result[i - 1].month).toBe(true)
    }
  })

  it('includes month label in readable format', () => {
    const result = getMonthlySpending([], 1)
    // Should match format like "Mar 2026"
    expect(result[0].label).toMatch(/\w{3} \d{4}/)
  })
})

describe('getTopVendors()', () => {
  it('returns empty for no bills', () => {
    expect(getTopVendors([])).toEqual([])
  })

  it('ranks vendors by total spending', () => {
    const bills = [
      makeBill({ payee_name: 'Proximus', amount: 55 }),
      makeBill({ payee_name: 'Proximus', amount: 55 }),
      makeBill({ payee_name: 'VIVAQUA', amount: 45 }),
      makeBill({ payee_name: 'Engie', amount: 200 }),
    ]
    const result = getTopVendors(bills)
    expect(result[0].payee_name).toBe('Engie')
    expect(result[0].total).toBe(200)
    expect(result[1].payee_name).toBe('Proximus')
    expect(result[1].total).toBe(110)
    expect(result[1].count).toBe(2)
  })

  it('limits results to specified count', () => {
    const bills = Array.from({ length: 10 }, (_, i) =>
      makeBill({ payee_name: `Vendor-${i}`, amount: (i + 1) * 10 })
    )
    const result = getTopVendors(bills, 3)
    expect(result).toHaveLength(3)
  })

  it('calculates percentage of total spending', () => {
    const bills = [
      makeBill({ payee_name: 'A', amount: 75 }),
      makeBill({ payee_name: 'B', amount: 25 }),
    ]
    const result = getTopVendors(bills)
    expect(result[0].percentage).toBe(75)
    expect(result[1].percentage).toBe(25)
  })
})

describe('getSpendingTrend()', () => {
  it('returns null for less than 2 months', () => {
    expect(getSpendingTrend([])).toBeNull()
    expect(getSpendingTrend([{ month: '2026-01', label: 'Jan 2026', total: 100, count: 2, currency: 'EUR' }])).toBeNull()
  })

  it('detects upward trend', () => {
    const months = [
      { month: '2026-01', label: 'Jan 2026', total: 100, count: 2, currency: 'EUR' },
      { month: '2026-02', label: 'Feb 2026', total: 150, count: 3, currency: 'EUR' },
    ]
    const trend = getSpendingTrend(months)!
    expect(trend.direction).toBe('up')
    expect(trend.percentageChange).toBe(50)
    expect(trend.currentMonth).toBe(150)
    expect(trend.previousMonth).toBe(100)
  })

  it('detects downward trend', () => {
    const months = [
      { month: '2026-01', label: 'Jan 2026', total: 200, count: 4, currency: 'EUR' },
      { month: '2026-02', label: 'Feb 2026', total: 100, count: 2, currency: 'EUR' },
    ]
    const trend = getSpendingTrend(months)!
    expect(trend.direction).toBe('down')
    expect(trend.percentageChange).toBe(50)
  })

  it('detects stable trend for small changes (<5%)', () => {
    const months = [
      { month: '2026-01', label: 'Jan 2026', total: 100, count: 2, currency: 'EUR' },
      { month: '2026-02', label: 'Feb 2026', total: 103, count: 2, currency: 'EUR' },
    ]
    const trend = getSpendingTrend(months)!
    expect(trend.direction).toBe('stable')
  })

  it('handles zero previous month', () => {
    const months = [
      { month: '2026-01', label: 'Jan 2026', total: 0, count: 0, currency: 'EUR' },
      { month: '2026-02', label: 'Feb 2026', total: 100, count: 2, currency: 'EUR' },
    ]
    const trend = getSpendingTrend(months)!
    expect(trend.direction).toBe('up')
    expect(trend.percentageChange).toBe(100)
  })
})

describe('getAnalyticsSummary()', () => {
  it('returns complete summary for empty bills', () => {
    const summary = getAnalyticsSummary([])
    expect(summary.totalBills).toBe(0)
    expect(summary.avgBillAmount).toBe(0)
    expect(summary.totalSpent).toBe(0)
    expect(summary.monthlySpending.length).toBeGreaterThan(0)
    expect(summary.topVendors).toEqual([])
  })

  it('calculates correct averages and totals', () => {
    const bills = [
      makeBill({ amount: 40, due_date: monthDate(0) }),
      makeBill({ amount: 60, due_date: monthDate(0) }),
      makeBill({ amount: 100, due_date: monthDate(1) }),
    ]
    const summary = getAnalyticsSummary(bills)
    expect(summary.totalBills).toBe(3)
    expect(summary.totalSpent).toBe(200)
    expect(summary.avgBillAmount).toBeCloseTo(66.67, 1)
  })

  it('excludes zero amounts from average calculation', () => {
    const bills = [
      makeBill({ amount: 0, due_date: monthDate(0) }),
      makeBill({ amount: 100, due_date: monthDate(0) }),
    ]
    const summary = getAnalyticsSummary(bills)
    expect(summary.avgBillAmount).toBe(100)
  })

  it('includes trend data', () => {
    const bills = [
      makeBill({ amount: 100, due_date: monthDate(1) }),
      makeBill({ amount: 200, due_date: monthDate(0) }),
    ]
    const summary = getAnalyticsSummary(bills)
    expect(summary.trend).not.toBeNull()
    expect(summary.trend!.direction).toBe('up')
  })
})
