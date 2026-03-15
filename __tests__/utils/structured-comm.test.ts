/**
 * Tests for structured communication validation and formatting.
 * Belgian structured communication uses Modulo 97 validation.
 */

import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'

describe('formatStructuredComm()', () => {
  it('formats raw digits into +++XXX/XXXX/XXXXX+++ format', () => {
    expect(formatStructuredComm('810733173653')).toBe('+++810/7331/73653+++')
  })

  it('strips existing delimiters and reformats', () => {
    expect(formatStructuredComm('+++810/7331/73653+++')).toBe('+++810/7331/73653+++')
  })

  it('returns input unchanged if not 12 digits after stripping +/', () => {
    // formatStructuredComm only strips + and /, not spaces or dashes
    expect(formatStructuredComm('810 7331 73653')).toBe('810 7331 73653')
    expect(formatStructuredComm('810-7331-73653')).toBe('810-7331-73653')
  })

  it('returns input if not 12 digits after stripping', () => {
    const short = formatStructuredComm('12345')
    // Should still return something, but not in the +++/+++ format
    expect(short).not.toContain('+++')
  })
})

describe('validateStructuredComm()', () => {
  it('validates correct Modulo 97 structured communication', () => {
    // +++090/9337/55493+++ → 0909337554 mod 97 = 93 → last 2 digits = 93 ✓
    expect(validateStructuredComm('+++090/9337/55493+++')).toBe(true)
  })

  it('rejects invalid structured communication', () => {
    expect(validateStructuredComm('+++000/0000/00001+++')).toBe(false)
    expect(validateStructuredComm('+++123/4567/89000+++')).toBe(false)
  })

  it('returns false for empty/null input', () => {
    expect(validateStructuredComm('')).toBe(false)
    expect(validateStructuredComm(null as unknown as string)).toBe(false)
  })

  it('handles input without +++ delimiters', () => {
    // Should still validate if given raw digits
    expect(validateStructuredComm('090933755493')).toBe(true)
  })
})
