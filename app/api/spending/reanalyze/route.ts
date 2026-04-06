import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { reanalyzeBatchWithContext } from '@/lib/spending/categorize'
import { SPENDING_CATEGORIES } from '@/lib/spending/categories'
import { z } from 'zod'

const BodySchema = z.object({
  category: z.enum(SPENDING_CATEGORIES as [string, ...string[]]),
})

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = BodySchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { category } = parsed.data

  // Fetch user's payee metadata and user-tagged travel examples in parallel
  const [{ data: payeeMetadata }, { data: travelExamples }] = await Promise.all([
    supabase
      .from('spending_payees')
      .select('payee_raw, display_name, category, notes')
      .eq('user_id', user.id),
    supabase
      .from('transactions')
      .select('payee_raw, description')
      .eq('user_id', user.id)
      .eq('category_user', 'travel')
      .limit(20),
  ])

  // Build metadata context string for Claude
  const payeeContext = (payeeMetadata ?? []).length > 0
    ? '\n\nUser-defined payee knowledge (apply these consistently):\n' +
      (payeeMetadata ?? []).map(p =>
        `- "${p.payee_raw}"${p.display_name ? ` (known as "${p.display_name}")` : ''}: category=${p.category ?? 'unknown'}${p.notes ? `, notes="${p.notes}"` : ''}`
      ).join('\n')
    : ''

  // Inject user-confirmed travel examples so Claude learns the pattern
  const uniqueTravelPayees = Array.from(new Set((travelExamples ?? []).map(tx => tx.payee_raw)))
  const travelContext = uniqueTravelPayees.length > 0
    ? '\n\nUser-confirmed travel transactions (these payees = travel):\n' +
      uniqueTravelPayees.map(p => `- "${p}"`).join('\n')
    : ''

  const metadataContext = payeeContext + travelContext

  // Fetch uncertain transactions in this category:
  // no user override + assigned (or defaulted) to this category
  const knownPayees = new Set(
    (payeeMetadata ?? []).filter(p => p.category).map(p => p.payee_raw)
  )

  const { data: txData, error } = await supabase
    .from('transactions')
    .select('id, date, payee_raw, amount, currency, description, category_n26, category_ai')
    .eq('user_id', user.id)
    .is('category_user', null)
    .eq('category_ai', category)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Re-analyze all transactions without a user override in this category
  // Don't skip payees with metadata — the rules may have changed (e.g. SANEF now = travel)
  const uncertain = txData ?? []

  if (uncertain.length === 0) {
    return NextResponse.json({ updated: 0, message: 'No uncertain transactions to re-analyze' })
  }

  const results = await reanalyzeBatchWithContext(uncertain, metadataContext)

  // Update category_ai in DB
  let updated = 0
  for (const { id, category: newCategory } of results) {
    const { error: updateError } = await supabase
      .from('transactions')
      .update({ category_ai: newCategory })
      .eq('id', id)
      .eq('user_id', user.id)
    if (!updateError) updated++
  }

  return NextResponse.json({ updated, total: uncertain.length })
}
