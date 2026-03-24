import { NextRequest, NextResponse } from 'next/server'
import { createPaymentFollowupReminder, dismissBillReminders } from '@/lib/reminders/create'
import { DUE_REMINDER_KINDS } from '@/lib/reminders/kinds'
import { createServerSupabaseClient } from '@/lib/supabase/server'

export async function GET(
  _request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: batch, error } = await supabase
    .from('payment_batches')
    .select('*')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !batch) {
    return NextResponse.json({ error: 'Batch not found' }, { status: 404 })
  }

  // Fetch the bills in this batch
  const { data: bills } = await supabase
    .from('bills')
    .select('id, payee_name, amount, currency, due_date, structured_comm, structured_comm_valid, iban, bic, status')
    .in('id', batch.bill_ids)

  return NextResponse.json({ batch, bills: bills ?? [] })
}

export async function PATCH(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const { status } = body

  if (!['pending', 'in_progress', 'completed'].includes(status)) {
    return NextResponse.json({ error: 'Invalid status' }, { status: 400 })
  }

  const { data, error } = await supabase
    .from('payment_batches')
    .update({ status })
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // If batch is completed, mark bills as payment_sent
  if (status === 'completed' && data) {
    const paidAt = new Date().toISOString()
    await supabase
      .from('bills')
      .update({ status: 'payment_sent', paid_at: paidAt })
      .in('id', data.bill_ids)
      .eq('user_id', user.id)

    for (const billId of data.bill_ids) {
      await dismissBillReminders(supabase, {
        billId,
        kinds: [...DUE_REMINDER_KINDS],
      })
      await createPaymentFollowupReminder(supabase, {
        billId,
        userId: user.id,
        paidAt,
      })
    }
  }

  return NextResponse.json({ batch: data })
}
