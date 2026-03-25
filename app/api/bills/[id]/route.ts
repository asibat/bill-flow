import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { createPaymentFollowupReminder, dismissBillReminders, syncBillDueReminders } from '@/lib/reminders/create'
import { DUE_REMINDER_KINDS } from '@/lib/reminders/kinds'
import { z } from 'zod'

const UpdateBillSchema = z.object({
  status: z.enum(['received', 'scheduled', 'payment_sent', 'confirmed', 'overdue']).optional(),
  wire_reference: z.string().optional().nullable(),
  paid_at: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  payee_name: z.string().optional(),
  amount: z.number().optional(),
  due_date: z.string().optional(),
  structured_comm: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  bic: z.string().optional().nullable(),
  needs_review: z.boolean().optional(),
  remove_document: z.boolean().optional(),
})

export async function GET(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('bills')
    .select('*, payees(name, iban, bic, category)')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (error || !data) return NextResponse.json({ error: 'Not found' }, { status: 404 })
  return NextResponse.json({ bill: data })
}

export async function PATCH(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = UpdateBillSchema.safeParse(body)
  if (!parsed.success) return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })

  // If marking as payment_sent, auto-set paid_at
  const updates: Record<string, unknown> = { ...parsed.data }
  if (parsed.data.status === 'payment_sent' && !parsed.data.paid_at) {
    updates.paid_at = new Date().toISOString()
  }

  const { data: existingBill, error: existingError } = await supabase
    .from('bills')
    .select('id, due_date, status, paid_at, raw_pdf_path')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (existingError || !existingBill) {
    return NextResponse.json({ error: 'Not found' }, { status: 404 })
  }

  if (parsed.data.remove_document && existingBill.raw_pdf_path) {
    const serviceClient = createServiceClient()
    const { error: storageError } = await serviceClient.storage
      .from('bill-documents')
      .remove([existingBill.raw_pdf_path])

    if (storageError) {
      console.error('[bills] failed to remove document', {
        billId: params.id,
        userId: user.id,
        path: existingBill.raw_pdf_path,
        message: storageError.message,
      })
      return NextResponse.json({ error: 'Failed to remove stored document' }, { status: 500 })
    }

    updates.raw_pdf_path = null
  }

  delete updates.remove_document

  const { data, error } = await supabase
    .from('bills')
    .update(updates)
    .eq('id', params.id)
    .eq('user_id', user.id)
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const effectiveDueDate = parsed.data.due_date ?? existingBill.due_date
  const statusChangedTo = parsed.data.status

  if (parsed.data.due_date && !['payment_sent', 'confirmed'].includes(data.status)) {
    await syncBillDueReminders(supabase, {
      billId: data.id,
      userId: user.id,
      dueDate: effectiveDueDate,
    })
  }

  if (statusChangedTo === 'payment_sent') {
    await dismissBillReminders(supabase, {
      billId: data.id,
      kinds: [...DUE_REMINDER_KINDS],
    })
    await createPaymentFollowupReminder(supabase, {
      billId: data.id,
      userId: user.id,
      paidAt: (updates.paid_at as string) ?? existingBill.paid_at ?? new Date().toISOString(),
    })
  }

  if (statusChangedTo === 'confirmed') {
    await dismissBillReminders(supabase, { billId: data.id })
  }

  return NextResponse.json({ bill: data })
}

export async function DELETE(request: NextRequest, { params }: { params: { id: string } }) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: existingBill } = await supabase
    .from('bills')
    .select('raw_pdf_path')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (existingBill?.raw_pdf_path) {
    const serviceClient = createServiceClient()
    const { error: storageError } = await serviceClient.storage
      .from('bill-documents')
      .remove([existingBill.raw_pdf_path])

    if (storageError) {
      console.error('[bills] failed to remove document during bill delete', {
        billId: params.id,
        userId: user.id,
        path: existingBill.raw_pdf_path,
        message: storageError.message,
      })
      return NextResponse.json({ error: 'Failed to delete bill document' }, { status: 500 })
    }
  }

  const { error } = await supabase
    .from('bills')
    .delete()
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })
  return NextResponse.json({ success: true })
}
