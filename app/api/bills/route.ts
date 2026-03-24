import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { findDuplicates } from '@/lib/dedup'
import { createBillReminder } from '@/lib/reminders/create'
import { z } from 'zod'

const CreateBillSchema = z.object({
  payee_name: z.string().min(1),
  payee_id: z.string().uuid().optional().nullable(),
  amount: z.number().positive(),
  currency: z.string().default('EUR'),
  due_date: z.string(),
  structured_comm: z.string().optional().nullable(),
  iban: z.string().optional().nullable(),
  bic: z.string().optional().nullable(),
  notes: z.string().optional().nullable(),
  source: z.enum(['doccle', 'email', 'upload', 'manual']).default('manual'),
  raw_pdf_path: z.string().optional().nullable(),
  extraction_confidence: z.number().optional().nullable(),
  structured_comm_valid: z.boolean().optional().nullable(),
  language_detected: z.string().optional().nullable(),
  explanation: z.string().optional().nullable(),
})

export async function GET(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { searchParams } = new URL(request.url)
  const status = searchParams.get('status')
  const limit = parseInt(searchParams.get('limit') || '50')

  let query = supabase
    .from('bills')
    .select('*, payees(name, category)')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })
    .limit(limit)

  if (status && status !== 'all') {
    query = query.eq('status', status)
  }

  const { data, error } = await query
  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  return NextResponse.json({ bills: data })
}

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()
  const parsed = CreateBillSchema.safeParse(body)
  if (!parsed.success) {
    return NextResponse.json({ error: parsed.error.flatten() }, { status: 400 })
  }

  // Check for duplicates
  const duplicates = await findDuplicates(supabase, user.id, {
    payee_name: parsed.data.payee_name,
    amount: parsed.data.amount,
    due_date: parsed.data.due_date,
    structured_comm: parsed.data.structured_comm ?? null,
  })

  if (duplicates.length > 0) {
    const skipDedup = body.force === true
    if (!skipDedup) {
      return NextResponse.json({
        error: 'Potential duplicate bill detected',
        duplicates,
      }, { status: 409 })
    }
  }

  const { data, error } = await supabase
    .from('bills')
    .insert({ ...parsed.data, user_id: user.id })
    .select()
    .single()

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  // Auto-create reminder based on user's preferred days-before setting
  if (parsed.data.due_date) {
    await createBillReminder(supabase, {
      billId: data.id,
      userId: user.id,
      dueDate: parsed.data.due_date,
    })
  }

  return NextResponse.json({ bill: data }, { status: 201 })
}
