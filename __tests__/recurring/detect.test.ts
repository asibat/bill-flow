/**
 * Tests for recurring bill detection logic.
 */

import { averageInterval, matchFrequency, detectRecurringPatterns } from '@/lib/recurring/detect'
import type { Bill } from '@/types'

function makeBill(overrides: Partial<Bill> = {}): Bill {
  return {
    id: 'test-id',
    user_id: 'user-1',
    source: 'upload',
    payee_name: 'VIVAQUA',
    payee_id: 'payee-1',
    amount: 45,
    currency: 'EUR',
    due_date: '2026-01-15',
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

describe('averageInterval()', () => {
  it('returns null for less than 2 dates', () => {
    expect(averageInterval([])).toBeNull()
    expect(averageInterval(['2026-01-01'])).toBeNull()
  })

  it('calculates average interval between two dates', () => {
    const result = averageInterval(['2026-01-01', '2026-01-31'])
    expect(result).toBe(30)
  })

  it('calculates average interval for monthly bills', () => {
    const dates = ['2025-10-15', '2025-11-15', '2025-12-15', '2026-01-15']
    const result = averageInterval(dates)
    // ~30.33 days average (Oct-Nov=31, Nov-Dec=30, Dec-Jan=31)
    expect(result).toBeGreaterThan(29)
    expect(result).toBeLessThan(32)
  })

  it('calculates average interval for quarterly bills', () => {
    const dates = ['2025-04-15', '2025-07-15', '2025-10-15', '2026-01-15']
    const result = averageInterval(dates)
    expect(result).toBeGreaterThan(88)
    expect(result).toBeLessThan(93)
  })

  it('handles unsorted dates', () => {
    const dates = ['2026-01-15', '2025-10-15', '2025-11-15', '2025-12-15']
    const result = averageInterval(dates)
    expect(result).toBeGreaterThan(29)
    expect(result).toBeLessThan(32)
  })
})

describe('matchFrequency()', () => {
  it('matches monthly frequency (~30 days)', () => {
    const result = matchFrequency(30)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('monthly')
    expect(result!.days).toBe(30)
    expect(result!.confidence).toBeGreaterThan(0.9)
  })

  it('matches quarterly frequency (~90 days)', () => {
    const result = matchFrequency(91)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('quarterly')
  })

  it('matches annual frequency (~365 days)', () => {
    const result = matchFrequency(365)
    expect(result).not.toBeNull()
    expect(result!.label).toBe('annual')
  })

  it('returns null for unrecognized intervals', () => {
    expect(matchFrequency(15)).toBeNull()  // too short for monthly
    expect(matchFrequency(45)).toBeNull()  // between monthly and bi-monthly
    expect(matchFrequency(250)).toBeNull() // between semi-annual and annual
  })

  it('has lower confidence for edge-of-range intervals', () => {
    const center = matchFrequency(30)!
    const edge = matchFrequency(34)!
    expect(center.confidence).toBeGreaterThan(edge.confidence)
  })
})

describe('detectRecurringPatterns()', () => {
  it('returns empty array for no bills', () => {
    expect(detectRecurringPatterns([])).toEqual([])
  })

  it('returns empty array for single bill per vendor', () => {
    const bills = [makeBill()]
    expect(detectRecurringPatterns(bills)).toEqual([])
  })

  it('detects monthly recurring pattern', () => {
    const bills = [
      makeBill({ due_date: '2025-10-15', amount: 42 }),
      makeBill({ due_date: '2025-11-15', amount: 45 }),
      makeBill({ due_date: '2025-12-15', amount: 48 }),
      makeBill({ due_date: '2026-01-15', amount: 45 }),
    ]
    const patterns = detectRecurringPatterns(bills)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].payee_name).toBe('VIVAQUA')
    expect(patterns[0].frequency_label).toBe('monthly')
    expect(patterns[0].bill_count).toBe(4)
    expect(patterns[0].avg_amount).toBe(45)
    expect(patterns[0].next_expected_date).toBe('2026-02-14')
  })

  it('detects quarterly recurring pattern', () => {
    const bills = [
      makeBill({ due_date: '2025-04-15', amount: 45 }),
      makeBill({ due_date: '2025-07-15', amount: 45 }),
      makeBill({ due_date: '2025-10-15', amount: 45 }),
    ]
    const patterns = detectRecurringPatterns(bills)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].frequency_label).toBe('quarterly')
    expect(patterns[0].next_expected_date).toBe('2026-01-13')
  })

  it('groups by payee_name case-insensitively', () => {
    const bills = [
      makeBill({ payee_name: 'VIVAQUA', due_date: '2025-10-15' }),
      makeBill({ payee_name: 'vivaqua', due_date: '2025-11-15' }),
      makeBill({ payee_name: 'Vivaqua', due_date: '2025-12-15' }),
    ]
    const patterns = detectRecurringPatterns(bills)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].bill_count).toBe(3)
  })

  it('handles multiple vendors independently', () => {
    const bills = [
      makeBill({ payee_name: 'VIVAQUA', due_date: '2025-10-15', amount: 45 }),
      makeBill({ payee_name: 'VIVAQUA', due_date: '2025-11-15', amount: 45 }),
      makeBill({ payee_name: 'VIVAQUA', due_date: '2025-12-15', amount: 45 }),
      makeBill({ payee_name: 'Proximus', due_date: '2025-10-01', amount: 55 }),
      makeBill({ payee_name: 'Proximus', due_date: '2025-11-01', amount: 55 }),
      makeBill({ payee_name: 'Proximus', due_date: '2025-12-01', amount: 55 }),
    ]
    const patterns = detectRecurringPatterns(bills)
    expect(patterns).toHaveLength(2)
    const names = patterns.map(p => p.payee_name)
    expect(names).toContain('VIVAQUA')
    expect(names).toContain('Proximus')
  })

  it('ignores vendors with irregular intervals', () => {
    const bills = [
      makeBill({ due_date: '2025-01-15' }),
      makeBill({ due_date: '2025-03-20' }), // 64 days — between monthly and quarterly
    ]
    // 64 days falls in bi-monthly range (55-65)
    const patterns = detectRecurringPatterns(bills)
    expect(patterns).toHaveLength(1)
    expect(patterns[0].frequency_label).toBe('bi-monthly')
  })

  it('calculates correct average amount excluding zero amounts', () => {
    const bills = [
      makeBill({ due_date: '2025-10-15', amount: 0 }),
      makeBill({ due_date: '2025-11-15', amount: 45 }),
      makeBill({ due_date: '2025-12-15', amount: 55 }),
    ]
    const patterns = detectRecurringPatterns(bills)
    expect(patterns[0].avg_amount).toBe(50)
  })
})
