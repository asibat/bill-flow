/**
 * AI-powered transaction categorization using Claude.
 *
 * N26's built-in categories are unreliable and inconsistent. This module
 * sends batches of transactions to Claude and returns a proper category for
 * each one, along with a confidence score and reasoning.
 *
 * Batching: 50 transactions per API call to keep costs manageable.
 * A 3-month N26 export (~300 rows) = 6 Claude calls.
 */

import Anthropic from '@anthropic-ai/sdk'
import type { SpendingCategory } from '@/types'
import type { RawTransaction } from './csv-parser'
import { SPENDING_CATEGORIES } from './categories'

export { SPENDING_CATEGORIES }

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const BATCH_SIZE = 50

const CATEGORY_DESCRIPTIONS = `
- housing: Rent, mortgage payments, property-related costs
- utilities: Gas, electricity, water, internet, phone bills
- groceries: Supermarkets, food shops, bakeries, market stalls
- transport: Daily local transport in Belgium only — STIB, SNCB, De Lijn, Uber, Bolt, Poppy, Cambio, Donkey Republic, taxis, parking in Belgium, local car-sharing
- travel: Anything travel/holiday related — flights (Ryanair, TUI, Brussels Airlines, Air Serbia, Eurostar), hotels (Booking.com, Airbnb), holiday packages, international trains, highway tolls outside Belgium (SANEF, Italian/French autoroutes), fuel outside Belgium (user has no car in Belgium so any fuel = travel), airport shuttles (Flibco), foreign parking, travel SIM cards (Airalo), tourist attractions
- health: Pharmacy, doctor, dentist, hospital, health insurance, sports/gym
- dining: Restaurants, cafes, bars, takeaway, fast food, food delivery
- subscriptions: Netflix, Spotify, Disney+, software tools, news, cloud storage
- shopping: Amazon, clothing, electronics, furniture, household goods
- cash: ATM withdrawals, cash machine transactions — money taken out in cash regardless of what it was spent on
- income: Salary deposits, freelance payments, refunds, cashback
- transfer: Bank transfers between own accounts, Revolut/Wise top-ups, peer-to-peer payments
- other: Anything that doesn't clearly fit another category
`

const CATEGORIZE_TOOL = {
  name: 'categorize_transactions',
  description: 'Assign a spending category to each transaction',
  input_schema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            index: { type: 'number', description: 'The transaction index from the input' },
            category: {
              type: 'string',
              enum: SPENDING_CATEGORIES,
              description: 'The best-fit spending category',
            },
          },
          required: ['index', 'category'],
        },
      },
    },
    required: ['results'],
  },
}

interface CategorizationResult {
  index: number
  category: SpendingCategory
}

export interface ReanalyzedTransaction {
  id: string
  category: SpendingCategory
}

function buildSystemPrompt(metadataContext = ''): string {
  return `You are a personal finance categorization expert. Assign the most accurate spending category to each bank transaction. The transactions are from a Belgian bank account (N26). Ignore N26's own categories — they are unreliable.

Categories and their meanings:${CATEGORY_DESCRIPTIONS}

Rules:
- Positive amounts are income or transfers in
- Negative amounts are expenses
- When in doubt between two categories, pick the more specific one
- "transfer" is only for moving money between own accounts or peer-to-peer (Revolut, Wise, Payconiq)
- Salary = income, not transfer
- ATM withdrawals and cash machine transactions are always "cash" regardless of payee name
- The user lives in Belgium and does NOT own a car — any fuel purchase or highway toll is travel, not transport
- Flights are always travel, never transport
- SANEF, SANEF AUTOROUTE, Italian/French autoroutes = travel (road trip tolls abroad)
- STIB, SNCB, Uber, Bolt, Poppy, Cambio = transport (local Belgian transit)${metadataContext}`
}

async function categorizeBatch(
  transactions: Array<{ index: number; tx: RawTransaction }>,
  metadataContext = '',
): Promise<CategorizationResult[]> {
  const lines = transactions
    .map(({ index, tx }) =>
      `[${index}] ${tx.date} | ${tx.payee} | ${tx.amount > 0 ? '+' : ''}${tx.amount} ${tx.currency}${tx.reference ? ` | "${tx.reference}"` : ''}${tx.type ? ` | N26: ${tx.type}` : ''}`
    )
    .join('\n')

  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-6',
    max_tokens: 1024,
    system: buildSystemPrompt(metadataContext),
    tools: [CATEGORIZE_TOOL],
    tool_choice: { type: 'tool', name: 'categorize_transactions' },
    messages: [{
      role: 'user',
      content: `Categorize these transactions:\n\n${lines}`,
    }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    console.error('[spending:categorize] No tool_use block in response')
    return transactions.map(({ index }) => ({ index, category: 'other' as SpendingCategory }))
  }

  const raw = toolUse.input as { results: CategorizationResult[] }
  return raw.results ?? []
}

/** Re-analyze a specific set of DB transactions using payee metadata as context.
 *  Returns { id, category } pairs for updating the DB. */
export async function reanalyzeBatchWithContext(
  transactions: Array<{ id: string; date: string; payee_raw: string; amount: number; currency: string; description: string | null; category_n26: string | null }>,
  metadataContext: string,
): Promise<ReanalyzedTransaction[]> {
  const results: ReanalyzedTransaction[] = transactions.map(tx => ({ id: tx.id, category: 'other' as SpendingCategory }))

  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions.slice(i, i + BATCH_SIZE).map((tx, batchIdx) => ({
      index: i + batchIdx,
      tx: {
        date: tx.date,
        payee: tx.payee_raw,
        account: null,
        type: tx.category_n26,
        reference: tx.description,
        amount: tx.amount,
        currency: tx.currency,
      } as RawTransaction,
    }))

    try {
      const batchResults = await categorizeBatch(batch, metadataContext)
      for (const { index, category } of batchResults) {
        if (index >= 0 && index < results.length) {
          results[index].category = category
        }
      }
    } catch (err) {
      console.error(`[spending:reanalyze] Batch ${i}–${i + BATCH_SIZE} failed:`, err)
    }
  }

  return results
}

export interface InferredOffset {
  payee_raw: string
  offsets_category: SpendingCategory | null
  occurrences: number
}

const INFER_OFFSET_TOOL = {
  name: 'infer_offset_categories',
  description: 'For each recurring income payee, infer which expense category their transfers offset',
  input_schema: {
    type: 'object' as const,
    properties: {
      results: {
        type: 'array',
        items: {
          type: 'object',
          properties: {
            payee_raw: { type: 'string' },
            offsets_category: {
              type: ['string', 'null'],
              enum: [...SPENDING_CATEGORIES, null],
              description: 'The expense category this income offsets, or null if unclear',
            },
          },
          required: ['payee_raw', 'offsets_category'],
        },
      },
    },
    required: ['results'],
  },
}

/** Given recurring income patterns, ask Claude which expense category each one offsets. */
export async function inferOffsetCategory(
  patterns: Array<{ payee_raw: string; amount: number; occurrences: number }>,
): Promise<InferredOffset[]> {
  const lines = patterns
    .map(p => `- "${p.payee_raw}" sends €${Math.abs(p.amount).toFixed(2)} recurring (${p.occurrences}x)`)
    .join('\n')

  const system = `You are analyzing recurring income transfers for a Belgian household to determine what expense category each transfer is meant to offset.

Context:
- These are income transactions that repeat with the same amount, suggesting they are cost-sharing or reimbursement arrangements
- Common patterns: partner paying their share of rent/utilities, insurance reimbursements for healthcare, employer expense refunds
- Return the expense category this income offsets, or null if you genuinely cannot tell

Categories:${CATEGORY_DESCRIPTIONS}`

  try {
    const response = await anthropic.messages.create({
      model: 'claude-sonnet-4-6',
      max_tokens: 512,
      system,
      tools: [INFER_OFFSET_TOOL],
      tool_choice: { type: 'tool', name: 'infer_offset_categories' },
      messages: [{
        role: 'user',
        content: `These payees send recurring transfers. For each, infer which expense category their transfers offset:\n\n${lines}`,
      }],
    })

    const toolUse = response.content.find(b => b.type === 'tool_use')
    if (!toolUse || toolUse.type !== 'tool_use') return patterns.map(p => ({ ...p, offsets_category: null }))

    const raw = toolUse.input as { results: Array<{ payee_raw: string; offsets_category: string | null }> }
    const resultMap = new Map(raw.results.map(r => [r.payee_raw, r.offsets_category as SpendingCategory | null]))

    return patterns.map(p => ({
      payee_raw: p.payee_raw,
      offsets_category: resultMap.get(p.payee_raw) ?? null,
      occurrences: p.occurrences,
    }))
  } catch (err) {
    console.error('[spending:inferOffsets] Claude call failed:', err)
    return patterns.map(p => ({ ...p, offsets_category: null }))
  }
}

export interface CategorizedTransaction extends RawTransaction {
  category_ai: SpendingCategory
}

export async function categorizeTransactions(
  transactions: RawTransaction[],
): Promise<CategorizedTransaction[]> {
  const results: CategorizedTransaction[] = transactions.map(tx => ({
    ...tx,
    category_ai: 'other' as SpendingCategory,
  }))

  // Process in batches
  for (let i = 0; i < transactions.length; i += BATCH_SIZE) {
    const batch = transactions
      .slice(i, i + BATCH_SIZE)
      .map((tx, batchIdx) => ({ index: i + batchIdx, tx }))

    try {
      const batchResults = await categorizeBatch(batch)
      for (const { index, category } of batchResults) {
        if (index >= 0 && index < results.length) {
          results[index].category_ai = category
        }
      }
    } catch (err) {
      console.error(`[spending:categorize] Batch ${i}–${i + BATCH_SIZE} failed:`, err)
      // Leave category_ai as 'other' for this batch — don't fail the whole import
    }
  }

  return results
}
