/**
 * Multi-currency support for BillFlow.
 * Handles formatting, conversion, and aggregation of amounts across currencies.
 */

export const SUPPORTED_CURRENCIES = ['EUR', 'USD', 'GBP', 'CHF', 'SEK', 'DKK', 'NOK', 'PLN', 'CZK'] as const
export type SupportedCurrency = (typeof SUPPORTED_CURRENCIES)[number]

/** Static fallback rates relative to EUR (1 EUR = X units) */
const FALLBACK_RATES: Record<string, number> = {
  EUR: 1,
  USD: 1.08,
  GBP: 0.86,
  CHF: 0.97,
  SEK: 11.2,
  DKK: 7.46,
  NOK: 11.5,
  PLN: 4.32,
  CZK: 25.1,
}

export interface ExchangeRates {
  base: string
  rates: Record<string, number>
  fetchedAt: string
}

/**
 * Convert an amount from one currency to another.
 * Uses provided rates or falls back to static rates.
 */
export function convertAmount(
  amount: number,
  from: string,
  to: string,
  rates: Record<string, number> = FALLBACK_RATES
): number {
  if (from === to) return amount
  const fromRate = rates[from]
  const toRate = rates[to]
  if (!fromRate || !toRate) return amount // can't convert, return as-is
  // Convert via base currency (EUR): amount / fromRate * toRate
  const inBase = amount / fromRate
  return Math.round(inBase * toRate * 100) / 100
}

/**
 * Format an amount with currency symbol using Intl.
 */
export function formatCurrencyAmount(amount: number, currency: string, locale = 'en-BE'): string {
  return new Intl.NumberFormat(locale, { style: 'currency', currency }).format(amount)
}

export interface CurrencyBreakdown {
  currency: string
  total: number
  count: number
  formatted: string
}

/**
 * Aggregate amounts grouped by currency.
 * Returns a breakdown per currency and an optional EUR-equivalent total.
 */
export function aggregateByCurrency(
  items: Array<{ amount: number; currency: string }>,
  rates?: Record<string, number>
): { breakdown: CurrencyBreakdown[]; totalInEur: number } {
  const groups = new Map<string, { total: number; count: number }>()

  for (const item of items) {
    const curr = item.currency.toUpperCase()
    const existing = groups.get(curr) ?? { total: 0, count: 0 }
    existing.total += item.amount
    existing.count += 1
    groups.set(curr, existing)
  }

  const effectiveRates = rates ?? FALLBACK_RATES
  let totalInEur = 0
  const breakdown: CurrencyBreakdown[] = []

  for (const [currency, { total, count }] of groups) {
    const rounded = Math.round(total * 100) / 100
    breakdown.push({
      currency,
      total: rounded,
      count,
      formatted: formatCurrencyAmount(rounded, currency),
    })
    totalInEur += convertAmount(rounded, currency, 'EUR', effectiveRates)
  }

  // Sort: EUR first, then by total descending
  breakdown.sort((a, b) => {
    if (a.currency === 'EUR') return -1
    if (b.currency === 'EUR') return 1
    return b.total - a.total
  })

  return { breakdown, totalInEur: Math.round(totalInEur * 100) / 100 }
}

/**
 * Check if a currency code is valid/supported.
 */
export function isSupportedCurrency(code: string): code is SupportedCurrency {
  return SUPPORTED_CURRENCIES.includes(code.toUpperCase() as SupportedCurrency)
}

/**
 * Normalize a currency code (uppercase, trim).
 * Returns 'EUR' for empty/invalid codes.
 */
export function normalizeCurrency(code: string | null | undefined): string {
  if (!code) return 'EUR'
  const upper = code.trim().toUpperCase()
  return upper.length === 3 ? upper : 'EUR'
}
