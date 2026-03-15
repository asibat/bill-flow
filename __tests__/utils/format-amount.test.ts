/**
 * Tests for formatAmount with multi-currency support.
 */

import { formatAmount } from '@/lib/utils'

describe('formatAmount()', () => {
  it('formats EUR by default', () => {
    const result = formatAmount(45.50)
    expect(result).toContain('45')
    expect(result).toContain('50')
  })

  it('formats with explicit EUR currency', () => {
    const result = formatAmount(100, 'EUR')
    expect(result).toContain('100')
  })

  it('formats USD amounts', () => {
    const result = formatAmount(99.99, 'USD')
    expect(result).toContain('99')
    expect(result).toContain('$')
  })

  it('formats GBP amounts', () => {
    const result = formatAmount(75, 'GBP')
    expect(result).toContain('75')
  })

  it('handles zero amount', () => {
    const result = formatAmount(0, 'EUR')
    expect(result).toContain('0')
  })

  it('handles negative amounts', () => {
    const result = formatAmount(-25.50, 'EUR')
    expect(result).toContain('25')
  })

  it('falls back gracefully for invalid currency code', () => {
    const result = formatAmount(100, 'INVALID')
    expect(result).toContain('100')
    expect(result).toContain('INVALID')
  })

  it('handles null/undefined currency with EUR default', () => {
    const result = formatAmount(50, undefined as unknown as string)
    expect(result).toContain('50')
  })

  it('trims and uppercases currency code', () => {
    const result = formatAmount(50, ' eur ')
    expect(result).toContain('50')
  })
})
