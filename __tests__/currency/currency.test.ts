/**
 * Tests for multi-currency support utilities.
 */

import {
  convertAmount,
  formatCurrencyAmount,
  aggregateByCurrency,
  isSupportedCurrency,
  normalizeCurrency,
} from '@/lib/currency'

describe('convertAmount()', () => {
  const rates = { EUR: 1, USD: 1.08, GBP: 0.86, CHF: 0.97 }

  it('returns same amount for same currency', () => {
    expect(convertAmount(100, 'EUR', 'EUR', rates)).toBe(100)
    expect(convertAmount(50, 'USD', 'USD', rates)).toBe(50)
  })

  it('converts EUR to USD', () => {
    const result = convertAmount(100, 'EUR', 'USD', rates)
    expect(result).toBe(108)
  })

  it('converts USD to EUR', () => {
    const result = convertAmount(108, 'USD', 'EUR', rates)
    expect(result).toBe(100)
  })

  it('converts between non-EUR currencies via EUR base', () => {
    // 100 GBP → EUR → CHF: 100 / 0.86 * 0.97 ≈ 112.79
    const result = convertAmount(100, 'GBP', 'CHF', rates)
    expect(result).toBeCloseTo(112.79, 1)
  })

  it('returns original amount for unknown currency', () => {
    expect(convertAmount(100, 'XYZ', 'EUR', rates)).toBe(100)
    expect(convertAmount(100, 'EUR', 'XYZ', rates)).toBe(100)
  })

  it('uses fallback rates when none provided', () => {
    // Should not throw, uses built-in fallback rates
    const result = convertAmount(100, 'EUR', 'USD')
    expect(result).toBeGreaterThan(0)
  })
})

describe('formatCurrencyAmount()', () => {
  it('formats EUR amount', () => {
    const result = formatCurrencyAmount(45.50, 'EUR')
    expect(result).toContain('45')
    expect(result).toContain('50')
  })

  it('formats USD amount', () => {
    const result = formatCurrencyAmount(100, 'USD')
    expect(result).toContain('100')
    expect(result).toContain('$')
  })

  it('formats GBP amount', () => {
    const result = formatCurrencyAmount(75.25, 'GBP')
    expect(result).toContain('75')
    expect(result).toContain('25')
  })

  it('handles zero amount', () => {
    const result = formatCurrencyAmount(0, 'EUR')
    expect(result).toContain('0')
  })
})

describe('aggregateByCurrency()', () => {
  it('groups single-currency items', () => {
    const items = [
      { amount: 45, currency: 'EUR' },
      { amount: 55, currency: 'EUR' },
      { amount: 30, currency: 'EUR' },
    ]
    const { breakdown, totalInEur } = aggregateByCurrency(items)
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0].currency).toBe('EUR')
    expect(breakdown[0].total).toBe(130)
    expect(breakdown[0].count).toBe(3)
    expect(totalInEur).toBe(130)
  })

  it('groups multi-currency items separately', () => {
    const items = [
      { amount: 100, currency: 'EUR' },
      { amount: 50, currency: 'USD' },
      { amount: 75, currency: 'GBP' },
    ]
    const rates = { EUR: 1, USD: 1.08, GBP: 0.86 }
    const { breakdown, totalInEur } = aggregateByCurrency(items, rates)
    expect(breakdown).toHaveLength(3)
    // EUR always first
    expect(breakdown[0].currency).toBe('EUR')
    // totalInEur should include conversions
    const expectedTotal = 100 + (50 / 1.08) + (75 / 0.86)
    expect(totalInEur).toBeCloseTo(expectedTotal, 0)
  })

  it('handles empty array', () => {
    const { breakdown, totalInEur } = aggregateByCurrency([])
    expect(breakdown).toHaveLength(0)
    expect(totalInEur).toBe(0)
  })

  it('normalizes currency codes to uppercase', () => {
    const items = [
      { amount: 50, currency: 'eur' },
      { amount: 50, currency: 'EUR' },
    ]
    const { breakdown } = aggregateByCurrency(items)
    expect(breakdown).toHaveLength(1)
    expect(breakdown[0].total).toBe(100)
  })

  it('includes formatted string in breakdown', () => {
    const items = [{ amount: 42.50, currency: 'EUR' }]
    const { breakdown } = aggregateByCurrency(items)
    expect(breakdown[0].formatted).toBeTruthy()
    expect(breakdown[0].formatted).toContain('42')
  })
})

describe('isSupportedCurrency()', () => {
  it('returns true for supported currencies', () => {
    expect(isSupportedCurrency('EUR')).toBe(true)
    expect(isSupportedCurrency('USD')).toBe(true)
    expect(isSupportedCurrency('GBP')).toBe(true)
    expect(isSupportedCurrency('CHF')).toBe(true)
  })

  it('returns false for unsupported currencies', () => {
    expect(isSupportedCurrency('JPY')).toBe(false)
    expect(isSupportedCurrency('XYZ')).toBe(false)
    expect(isSupportedCurrency('')).toBe(false)
  })
})

describe('normalizeCurrency()', () => {
  it('uppercases valid currency codes', () => {
    expect(normalizeCurrency('eur')).toBe('EUR')
    expect(normalizeCurrency('usd')).toBe('USD')
  })

  it('trims whitespace', () => {
    expect(normalizeCurrency(' EUR ')).toBe('EUR')
  })

  it('returns EUR for null/undefined/empty', () => {
    expect(normalizeCurrency(null)).toBe('EUR')
    expect(normalizeCurrency(undefined)).toBe('EUR')
    expect(normalizeCurrency('')).toBe('EUR')
  })

  it('returns EUR for invalid length codes', () => {
    expect(normalizeCurrency('EU')).toBe('EUR')
    expect(normalizeCurrency('EURO')).toBe('EUR')
  })
})
