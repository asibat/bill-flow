/**
 * Tests for PII detection and redaction.
 */

import { detectPii, applyRedactions } from '@/lib/pii/detect'
import type { PiiMatch } from '@/lib/pii/detect'

describe('detectPii()', () => {
  describe('national numbers', () => {
    it('detects Belgian NN format XX.XX.XX-XXX.XX', () => {
      const matches = detectPii('Client NN: 85.07.15-123.45 est enregistré')
      expect(matches.some(m => m.type === 'national_number')).toBe(true)
      expect(matches.find(m => m.type === 'national_number')!.value).toBe('85.07.15-123.45')
    })

    it('detects NN format XXXXXX-XXX-XX', () => {
      const matches = detectPii('Rijksregisternummer: 850715-123-45')
      expect(matches.some(m => m.type === 'national_number')).toBe(true)
    })
  })

  describe('phone numbers', () => {
    it('detects +32 format', () => {
      const matches = detectPii('Bel ons op +32 2 123 45 67')
      expect(matches.some(m => m.type === 'phone')).toBe(true)
    })

    it('detects Belgian mobile 04XX', () => {
      const matches = detectPii('GSM: 0478 12 34 56')
      expect(matches.some(m => m.type === 'phone')).toBe(true)
    })

    it('detects landline with dots', () => {
      const matches = detectPii('Tel: 02.123.45.67')
      expect(matches.some(m => m.type === 'phone')).toBe(true)
    })
  })

  describe('email addresses', () => {
    it('detects standard email', () => {
      const matches = detectPii('Contact: jan.peeters@example.be')
      expect(matches.some(m => m.type === 'email')).toBe(true)
      expect(matches.find(m => m.type === 'email')!.value).toBe('jan.peeters@example.be')
    })

    it('detects email with plus addressing', () => {
      const matches = detectPii('jan+bills@gmail.com')
      expect(matches.some(m => m.type === 'email')).toBe(true)
    })
  })

  describe('addresses', () => {
    it('detects French street address', () => {
      const matches = detectPii('Rue de la Loi 16')
      expect(matches.some(m => m.type === 'address')).toBe(true)
    })

    it('detects Dutch street address', () => {
      const matches = detectPii('Wetstraat 16')
      expect(matches.some(m => m.type === 'address')).toBe(true)
    })

    it('detects Belgian postal code + city', () => {
      const matches = detectPii('1000 Bruxelles')
      expect(matches.some(m => m.type === 'address')).toBe(true)
    })

    it('detects Avenue pattern', () => {
      const matches = detectPii('Avenue Louise 123')
      expect(matches.some(m => m.type === 'address')).toBe(true)
    })
  })

  describe('name headers', () => {
    it('detects Dutch name header', () => {
      const matches = detectPii('Naam: Jan Peeters')
      expect(matches.some(m => m.type === 'name_header')).toBe(true)
    })

    it('detects French name header', () => {
      const matches = detectPii('Nom: Jean Dupont')
      expect(matches.some(m => m.type === 'name_header')).toBe(true)
    })

    it('detects Destinataire header', () => {
      const matches = detectPii('Destinataire: Marie Lambert')
      expect(matches.some(m => m.type === 'name_header')).toBe(true)
    })
  })

  describe('preserves payment-critical fields', () => {
    it('does not flag IBAN as PII', () => {
      const matches = detectPii('IBAN: BE40310083000663')
      expect(matches.some(m => m.value.includes('BE40310083000663'))).toBe(false)
    })

    it('does not flag structured comm as PII', () => {
      const matches = detectPii('Communication: +++260/2754/48343+++')
      expect(matches.some(m => m.value.includes('260/2754/48343'))).toBe(false)
    })

    it('does not flag amounts as PII', () => {
      const matches = detectPii('Montant: 44,25 EUR')
      expect(matches).toHaveLength(0)
    })
  })

  describe('mixed content', () => {
    it('detects multiple PII types in one text', () => {
      const text = `
        Facture pour Jan Peeters
        Nom: Jan Peeters
        Adresse: Rue de la Loi 16
        1000 Bruxelles
        Email: jan@example.be
        Tel: +32 2 123 45 67
        NN: 85.07.15-123.45

        Montant: 44,25 EUR
        IBAN: BE40310083000663
        Communication: +++260/2754/48343+++
      `
      const matches = detectPii(text)
      const types = new Set(matches.map(m => m.type))
      expect(types.has('national_number')).toBe(true)
      expect(types.has('phone')).toBe(true)
      expect(types.has('email')).toBe(true)
      expect(types.has('address')).toBe(true)
      expect(types.has('name_header')).toBe(true)
    })

    it('returns empty array for text with no PII', () => {
      const matches = detectPii('TOTAL: 44,25 EUR - IBAN BE40310083000663')
      expect(matches).toHaveLength(0)
    })
  })

  describe('deduplication', () => {
    it('removes overlapping matches keeping the longer one', () => {
      // A phone that might also partially match an NN pattern
      const matches = detectPii('Contact: +32 478 12 34 56')
      const phoneMatches = matches.filter(m => m.type === 'phone')
      // Should not have duplicates for the same region of text
      for (let i = 1; i < phoneMatches.length; i++) {
        expect(phoneMatches[i].start).toBeGreaterThanOrEqual(phoneMatches[i - 1].end)
      }
    })
  })
})

describe('applyRedactions()', () => {
  it('redacts all matches when no approved indices specified', () => {
    const text = 'Email: jan@example.be, Tel: +32 2 123 45 67'
    const matches = detectPii(text)
    const redacted = applyRedactions(text, matches)
    expect(redacted).toContain('[REDACTED_EMAIL]')
    expect(redacted).toContain('[REDACTED_PHONE]')
    expect(redacted).not.toContain('jan@example.be')
  })

  it('only redacts approved indices', () => {
    const text = 'Email: jan@example.be, Tel: +32 2 123 45 67'
    const matches = detectPii(text)
    const emailIdx = matches.findIndex(m => m.type === 'email')
    const redacted = applyRedactions(text, matches, [emailIdx])
    expect(redacted).toContain('[REDACTED_EMAIL]')
    // Phone should remain unredacted
    expect(redacted).not.toContain('[REDACTED_PHONE]')
  })

  it('returns original text when no matches', () => {
    const text = 'TOTAL: 44,25 EUR'
    const redacted = applyRedactions(text, [])
    expect(redacted).toBe(text)
  })

  it('preserves text around redactions', () => {
    const text = 'Facture - Email: jan@example.be - Merci'
    const matches = detectPii(text)
    const redacted = applyRedactions(text, matches)
    expect(redacted).toContain('Facture - Email:')
    expect(redacted).toContain('- Merci')
  })
})
