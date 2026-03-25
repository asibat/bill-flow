import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { REMINDER_SNOOZE_PRESETS, resolveReminderSnooze, type ReminderSnoozePreset } from '@/lib/reminders/snooze'

interface SnoozeRequestBody {
  preset?: ReminderSnoozePreset
}

export async function POST(
  request: NextRequest,
  { params }: { params: { id: string } }
) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const body = await request.json().catch(() => ({} as SnoozeRequestBody))
  const preset = body.preset

  if (!preset || !(REMINDER_SNOOZE_PRESETS as readonly string[]).includes(preset)) {
    return NextResponse.json({ error: 'Invalid snooze preset' }, { status: 400 })
  }

  const { data: reminder, error: reminderError } = await supabase
    .from('reminders')
    .select('id, bill_id, kind, remind_at')
    .eq('id', params.id)
    .eq('user_id', user.id)
    .single()

  if (reminderError || !reminder) {
    console.error('[reminders] failed to load reminder for snooze', {
      reminderId: params.id,
      userId: user.id,
      error: reminderError?.message,
    })
    return NextResponse.json({ error: 'Reminder not found' }, { status: 404 })
  }

  let salaryDay: number | null = null

  if (preset === 'next_payday') {
    const { data: settings, error: settingsError } = await supabase
      .from('user_settings')
      .select('salary_day')
      .eq('user_id', user.id)
      .single()

    if (settingsError) {
      console.error('[reminders] failed to load user settings for snooze', {
        reminderId: params.id,
        userId: user.id,
        error: settingsError.message,
      })
      return NextResponse.json({ error: 'Unable to read reminder settings' }, { status: 500 })
    }

    salaryDay = settings?.salary_day ?? null
  }

  const snoozedUntil = resolveReminderSnooze(preset, { salaryDay })
  if (!snoozedUntil) {
    return NextResponse.json({ error: 'Set a salary day before using payday snooze.' }, { status: 400 })
  }

  const { error: updateError } = await supabase
    .from('reminders')
    .update({
      remind_at: snoozedUntil.toISOString(),
      sent_at: null,
      dismissed_at: null,
    })
    .eq('id', params.id)
    .eq('user_id', user.id)

  if (updateError) {
    console.error('[reminders] failed to snooze reminder', {
      reminderId: params.id,
      userId: user.id,
      preset,
      error: updateError.message,
    })
    return NextResponse.json({ error: 'Failed to snooze reminder' }, { status: 500 })
  }

  console.log('[reminders] reminder snoozed', {
    reminderId: params.id,
    userId: user.id,
    preset,
    snoozedUntil: snoozedUntil.toISOString(),
  })

  return NextResponse.json({ ok: true, remind_at: snoozedUntil.toISOString() })
}
