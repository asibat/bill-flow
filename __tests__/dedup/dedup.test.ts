/**
 * Tests for bill deduplication logic.
 */

import { buildFingerprint } from '@/lib/dedup'

describe('buildFingerprint()', () => {
  it('builds fingerprint from payee, amount, due_date', () => {
    const fp = buildFingerprint({
      payee_name: 'VIVAQUA',
      amount: 45.25,
      due_date: '2026-03-15',
      structured_comm: null,
    })
    expect(fp).toBe('vivaqua|45.25|2026-03-15')
  })

  it('normalizes payee name to lowercase and trims', () => {
    const fp1 = buildFingerprint({ payee_name: '  VIVAQUA  ', amount: 45, due_date: '2026-03-15', structured_comm: null })
    const fp2 = buildFingerprint({ payee_name: 'vivaqua', amount: 45, due_date: '2026-03-15', structured_comm: null })
    expect(fp1).toBe(fp2)
  })

  it('includes stripped structured comm in fingerprint', () => {
    const fp = buildFingerprint({
      payee_name: 'Proximus',
      amount: 55,
      due_date: '2026-03-01',
      structured_comm: '+++260/2754/48343+++',
    })
    expect(fp).toBe('proximus|55.00|2026-03-01|260275448343')
  })

  it('handles null amount and due_date', () => {
    const fp = buildFingerprint({
      payee_name: 'Engie',
      amount: null,
      due_date: null,
      structured_comm: null,
    })
    expect(fp).toBe('engie||')
  })

  it('produces different fingerprints for different amounts', () => {
    const base = { payee_name: 'Test', due_date: '2026-01-01', structured_comm: null }
    const fp1 = buildFingerprint({ ...base, amount: 45 })
    const fp2 = buildFingerprint({ ...base, amount: 46 })
    expect(fp1).not.toBe(fp2)
  })

  it('produces different fingerprints for different due dates', () => {
    const base = { payee_name: 'Test', amount: 45, structured_comm: null }
    const fp1 = buildFingerprint({ ...base, due_date: '2026-01-01' })
    const fp2 = buildFingerprint({ ...base, due_date: '2026-02-01' })
    expect(fp1).not.toBe(fp2)
  })

  it('same structured comm produces same fingerprint regardless of formatting', () => {
    const base = { payee_name: 'Test', amount: 45, due_date: '2026-01-01' }
    const fp1 = buildFingerprint({ ...base, structured_comm: '+++260/2754/48343+++' })
    const fp2 = buildFingerprint({ ...base, structured_comm: '260275448343' })
    expect(fp1).toBe(fp2)
  })
})
