import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'

const VALID_LANGUAGES = ['en', 'fr', 'nl']

export async function PATCH(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json()

  const updates: Record<string, unknown> = {}

  if ('display_name' in body) {
    const name = typeof body.display_name === 'string' ? body.display_name.trim().slice(0, 100) : null
    updates.display_name = name || null
  }
  if ('preferred_language' in body && VALID_LANGUAGES.includes(body.preferred_language)) {
    updates.preferred_language = body.preferred_language
  }
  if ('salary_day' in body) {
    const day = Number(body.salary_day)
    updates.salary_day = day >= 1 && day <= 31 ? day : null
  }
  if ('reminder_days_before' in body) {
    const days = Number(body.reminder_days_before)
    updates.reminder_days_before = days >= 0 && days <= 30 ? days : 3
  }
  if ('email_notifications' in body) {
    updates.email_notifications = body.email_notifications === true
  }
  if ('push_notifications' in body) {
    updates.push_notifications = body.push_notifications === true
  }
  if (body.onboarding_completed === true) {
    updates.onboarding_completed = true
  }

  if (Object.keys(updates).length === 0) {
    return NextResponse.json({ error: 'No valid fields to update' }, { status: 400 })
  }

  // Upsert — handles the case where user_settings row doesn't exist yet
  // (e.g. after a DB reset with an existing auth session)
  const { error } = await supabase
    .from('user_settings')
    .upsert({ user_id: user.id, ...updates }, { onConflict: 'user_id' })

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json({ ok: true })
}

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data, error } = await supabase
    .from('user_settings')
    .select('*')
    .eq('user_id', user.id)
    .single()

  if (error) {
    return NextResponse.json({ error: error.message }, { status: 500 })
  }

  return NextResponse.json(data)
}
