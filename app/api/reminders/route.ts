import { NextResponse } from 'next/server'
import { getVisibleReminders } from '@/lib/reminders/view'
import { createServerSupabaseClient } from '@/lib/supabase/server'

/**
 * GET /api/reminders — fetch upcoming reminders for the current user.
 * Returns reminders that haven't been sent or dismissed, joined with bill info.
 */
export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('reminders')
    .select('id, bill_id, remind_at, kind, channel, sent_at, dismissed_at, bills!inner(payee_name, amount, currency, due_date, paid_at, status)')
    .eq('user_id', user.id)
    .is('dismissed_at', null)
    .order('remind_at', { ascending: true })
    .limit(20)

  if (error) return NextResponse.json({ error: error.message }, { status: 500 })

  const reminders = getVisibleReminders(data ?? [])

  return NextResponse.json({ reminders })
}
