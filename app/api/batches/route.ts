import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { z } from 'zod'

const CreateBatchSchema = z.object({
  bill_ids: z.array(z.string().uuid()).min(1),
})

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('payment_batches')
    .select('*')
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batches: data })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateBatchSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Fetch the bills to calculate total
  const { data: bills, error: billsError } = await supabase
    .from('bills')
    .select('id, amount, currency, status')
    .eq('user_id', user.id)
    .in('id', parsed.data.bill_ids)
    .not('status', 'in', '("confirmed","payment_sent")')

  if (billsError) return NextResponse.json({ error: billsError.message }, { status: 500 })
  if (!bills || bills.length === 0) {
    return NextResponse.json({ error: 'No eligible bills found' }, { status: 400 })
  }

  const totalAmount = bills.reduce((sum: number, b: { amount: number }) => sum + b.amount, 0)
  const currency = (bills[0] as { currency: string }).currency

  const { data, error } = await supabase
    .from('payment_batches')
    .insert({
      user_id: user.id,
      bill_ids: bills.map((b: { id: string }) => b.id),
      total_amount: Math.round(totalAmount * 100) / 100,
      currency,
    })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ batch: data }, { status: 201 })
}
