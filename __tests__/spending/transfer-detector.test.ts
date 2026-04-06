import { detectIntraHouseholdTransfers } from '@/lib/spending/transfer-detector'
import type { Transaction } from '@/types'

function makeTx(overrides: Partial<Transaction> & { id: string }): Transaction {
  return {
    user_id: 'user-1',
    date: '2026-01-10',
    amount: -100,
    currency: 'EUR',
    payee_raw: 'Test Payee',
    category_n26: null,
    category_ai: null,
    category_user: null,
    offsets_category: null,
    description: null,
    account: null,
    account_name: 'Amir - N26',
    source_file: null,
    created_at: '2026-01-10T00:00:00Z',
    ...overrides,
  }
}

describe('detectIntraHouseholdTransfers()', () => {
  describe('basic matching', () => {
    it('matches exact amount on same day from different accounts', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({
        outgoing_id: 'out-1',
        incoming_id: 'in-1',
        amount_diff_pct: 0,
        date_diff_days: 0,
      })
    })

    it('returns empty array when fewer than 2 distinct account names', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Amir - N26', date: '2026-01-10' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })

    it('returns empty array with no transactions', () => {
      expect(detectIntraHouseholdTransfers([])).toHaveLength(0)
    })
  })

  describe('amount tolerance (±2%)', () => {
    it('matches amount within 2% tolerance', () => {
      // 740 * 1.019 = 754.06 — within 2%
      const txs = [
        makeTx({ id: 'out-1', amount: -754, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(1)
      expect(result[0].amount_diff_pct).toBeCloseTo(0.0189, 3)
    })

    it('does not match amount exactly at 2% boundary (exclusive)', () => {
      // 740 * 1.021 = 755.54 — just over 2%
      const txs = [
        makeTx({ id: 'out-1', amount: -755.54, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })

    it('does not match when amounts differ significantly', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -500, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })
  })

  describe('date window (±3 days)', () => {
    it('matches transactions exactly 3 days apart', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-13' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(1)
    })

    it('matches when incoming is before outgoing within window', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-08' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(1)
    })

    it('does not match transactions 4 days apart', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-14' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })
  })

  describe('same account rejection', () => {
    it('does not match outgoing and incoming on the same account', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Amir - N26', date: '2026-01-10' }),
        // second account present so we don't short-circuit on accountNames.size < 2
        makeTx({ id: 'other', amount: -50, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })

    it('skips transactions with null account_name', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: null, date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      expect(detectIntraHouseholdTransfers(txs)).toHaveLength(0)
    })
  })

  describe('alreadyMatched exclusion', () => {
    it('skips transactions already in existing pairs', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const alreadyMatched = new Set(['out-1'])
      expect(detectIntraHouseholdTransfers(txs, alreadyMatched)).toHaveLength(0)
    })

    it('matches remaining transactions when some are already matched', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'out-2', amount: -500, account_name: 'Amir - N26', date: '2026-01-15' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-2', amount: 500, account_name: 'Nevena - N26', date: '2026-01-15' }),
      ]
      const alreadyMatched = new Set(['out-1', 'in-1'])
      const result = detectIntraHouseholdTransfers(txs, alreadyMatched)
      expect(result).toHaveLength(1)
      expect(result[0]).toMatchObject({ outgoing_id: 'out-2', incoming_id: 'in-2' })
    })
  })

  describe('greedy matching', () => {
    it('each transaction is matched at most once', () => {
      // One outgoing, two valid incoming — should only produce one pair
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-2', amount: 740, account_name: 'Nevena - N26', date: '2026-01-11' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(1)
      // Should prefer in-1 (same day = smaller diff)
      expect(result[0]).toMatchObject({ outgoing_id: 'out-1', incoming_id: 'in-1' })
    })

    it('prefers closest date when amounts are equal', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-far', amount: 740, account_name: 'Nevena - N26', date: '2026-01-13' }),
        makeTx({ id: 'in-near', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(1)
      expect(result[0].incoming_id).toBe('in-near')
    })

    it('matches multiple independent pairs', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'out-2', amount: -300, account_name: 'Amir - N26', date: '2026-02-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-2', amount: 300, account_name: 'Nevena - N26', date: '2026-02-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(2)
      const outIds = result.map(r => r.outgoing_id).sort()
      expect(outIds).toEqual(['out-1', 'out-2'])
    })

    it('does not cross-match when amounts differ enough to prevent confusion', () => {
      const txs = [
        makeTx({ id: 'out-740', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'out-300', amount: -300, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-740', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-300', amount: 300, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result).toHaveLength(2)
      const pairs = result.map(r => `${r.outgoing_id}:${r.incoming_id}`).sort()
      expect(pairs).toEqual(['out-300:in-300', 'out-740:in-740'])
    })
  })

  describe('output shape', () => {
    it('returns amount_diff_pct rounded to 4 decimal places', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -741, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-10' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result[0].amount_diff_pct).toBe(0.0014) // 1/740 ≈ 0.00135 → 0.0014
    })

    it('returns date_diff_days as integer', () => {
      const txs = [
        makeTx({ id: 'out-1', amount: -740, account_name: 'Amir - N26', date: '2026-01-10' }),
        makeTx({ id: 'in-1', amount: 740, account_name: 'Nevena - N26', date: '2026-01-12' }),
      ]
      const result = detectIntraHouseholdTransfers(txs)
      expect(result[0].date_diff_days).toBe(2)
      expect(Number.isInteger(result[0].date_diff_days)).toBe(true)
    })
  })
})
