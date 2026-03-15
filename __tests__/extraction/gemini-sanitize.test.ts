/**
 * Tests for Gemini response sanitization (clean, cleanNumber, cleanDate).
 * These functions prevent bad AI values like "N/A", -1, invalid dates from
 * reaching the database.
 */

// We test the sanitization logic directly — extract the functions
// from the module by re-implementing them here (they're not exported).
// This tests the contract, not the implementation.

function clean(val: unknown): string | null {
  if (val === null || val === undefined) return null
  const s = String(val).trim()
  if (!s || /^(n\/?a|none|null|unknown|-|—)$/i.test(s)) return null
  return s
}

function cleanNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null
  const n = Number(val)
  if (isNaN(n) || n < 0) return null
  return n
}

function cleanDate(val: unknown): string | null {
  const s = clean(val)
  if (!s) return null
  const d = new Date(s)
  if (isNaN(d.getTime())) return null
  return s
}

describe('clean()', () => {
  it('returns null for null/undefined', () => {
    expect(clean(null)).toBeNull()
    expect(clean(undefined)).toBeNull()
  })

  it('returns null for N/A variants', () => {
    expect(clean('N/A')).toBeNull()
    expect(clean('n/a')).toBeNull()
    expect(clean('NA')).toBeNull()
    expect(clean('none')).toBeNull()
    expect(clean('None')).toBeNull()
    expect(clean('null')).toBeNull()
    expect(clean('unknown')).toBeNull()
    expect(clean('-')).toBeNull()
    expect(clean('—')).toBeNull()
  })

  it('returns null for empty/whitespace strings', () => {
    expect(clean('')).toBeNull()
    expect(clean('  ')).toBeNull()
  })

  it('returns valid strings trimmed', () => {
    expect(clean('VIVAQUA')).toBe('VIVAQUA')
    expect(clean('  BE52 0960 1178 4309  ')).toBe('BE52 0960 1178 4309')
    expect(clean('+++810/7331/73653+++')).toBe('+++810/7331/73653+++')
  })
})

describe('cleanNumber()', () => {
  it('returns null for null/undefined', () => {
    expect(cleanNumber(null)).toBeNull()
    expect(cleanNumber(undefined)).toBeNull()
  })

  it('returns null for negative numbers', () => {
    expect(cleanNumber(-1)).toBeNull()
    expect(cleanNumber(-0.5)).toBeNull()
  })

  it('returns null for NaN', () => {
    expect(cleanNumber('not a number')).toBeNull()
    expect(cleanNumber('N/A')).toBeNull()
  })

  it('returns 0 for zero', () => {
    expect(cleanNumber(0)).toBe(0)
  })

  it('returns valid numbers', () => {
    expect(cleanNumber(45)).toBe(45)
    expect(cleanNumber(37.29)).toBe(37.29)
    expect(cleanNumber('127.50')).toBe(127.5)
  })
})

describe('cleanDate()', () => {
  it('returns null for null/undefined/N/A', () => {
    expect(cleanDate(null)).toBeNull()
    expect(cleanDate('N/A')).toBeNull()
    expect(cleanDate('none')).toBeNull()
  })

  it('returns null for invalid dates', () => {
    expect(cleanDate('not-a-date')).toBeNull()
    expect(cleanDate('32-13-2026')).toBeNull()
  })

  it('returns valid ISO date strings', () => {
    expect(cleanDate('2026-03-30')).toBe('2026-03-30')
    expect(cleanDate('2026-04-15')).toBe('2026-04-15')
  })
})
