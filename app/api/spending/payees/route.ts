import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'
import { SPENDING_CATEGORIES } from '@/lib/spending/categories'

const UpsertSchema = z.object({
  payee_raw: z.string().min(1),
  display_name: z.string().nullable().optional(),
  category: z.enum(SPENDING_CATEGORIES as [string, ...string[]]).nullable().optional(),
  notes: z.string().nullable().optional(),
  offsets_category: z.enum(SPENDING_CATEGORIES as [string, ...string[]]).nullable().optional(),
})

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('spending_payees')
    .select('*')
    .eq('user_id', user.id)
    .order('payee_raw')

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payees: data })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpsertSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  const { data, error } = await supabase
    .from('spending_payees')
    .upsert({ ...parsed.data, user_id: user.id }, { onConflict: 'user_id,payee_raw' })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ payee: data }, { status: 201 })
}
