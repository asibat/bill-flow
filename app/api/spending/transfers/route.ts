import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import type { TransferPairStatus } from '@/types'

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const status = request.nextUrl.searchParams.get('status')

  let query = supabase
    .from('household_transfer_pairs')
    .select(`
      *,
      outgoing:transactions!outgoing_transaction_id (
        id, date, amount, currency, payee_raw, account_name, category_ai, category_user
      ),
      incoming:transactions!incoming_transaction_id (
        id, date, amount, currency, payee_raw, account_name, category_ai, category_user
      )
    `)
    .eq('user_id', user.id)
    .order('created_at', { ascending: false })

  if (status) {
    query = query.eq('status', status)
  }

  const { data: pairs, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pairs })
}

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json() as { id: string; status: TransferPairStatus }
  const { id, status } = body

  if (!id || !['confirmed', 'rejected'].includes(status)) {
    return NextResponse.json({ error: 'id and status (confirmed|rejected) required' }, { status: 400 })
  }

  const { data: pair, error } = await supabase
    .from('household_transfer_pairs')
    .update({ status, updated_at: new Date().toISOString() })
    .eq('id', id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ pair })
}
