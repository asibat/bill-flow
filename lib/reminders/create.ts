import type { SupabaseClient } from '@supabase/supabase-js'
import { DUE_REMINDER_KINDS, type ReminderKind } from './kinds'

interface CreateReminderInput {
  billId: string
  userId: string
  dueDate: string
  reminderDaysBefore?: number
}

/**
 * Create a reminder for a bill based on user's preferred reminder_days_before setting.
 * If reminderDaysBefore is not provided, it fetches from user_settings.
 * Skips creation if the reminder date is already in the past.
 */
export async function createBillReminder(
  supabase: SupabaseClient,
  { billId, userId, dueDate, reminderDaysBefore }: CreateReminderInput
): Promise<void> {
  await syncBillDueReminders(supabase, { billId, userId, dueDate, reminderDaysBefore })
}

function buildReminderDate(dateOnly: string): Date {
  const [year, month, day] = dateOnly.split('-').map(Number)
  return new Date(Date.UTC(year, month - 1, day, 8, 0, 0, 0))
}

function addBusinessDays(date: Date, days: number): Date {
  const result = new Date(date)
  let remaining = days

  while (remaining > 0) {
    result.setUTCDate(result.getUTCDate() + 1)
    const day = result.getUTCDay()
    if (day !== 0 && day !== 6) remaining--
  }

  return result
}

function buildDueReminderSchedule(dueDate: string, customDaysBefore: number): Array<{ kind: ReminderKind; remindAt: string }> {
  const due = buildReminderDate(dueDate)
  const schedule = new Map<ReminderKind, string>()
  const defaultOffsets: Array<{ kind: ReminderKind; daysBefore: number }> = [
    { kind: 'due_7d', daysBefore: 7 },
    { kind: 'due_3d', daysBefore: 3 },
    { kind: 'due_today', daysBefore: 0 },
  ]

  for (const item of defaultOffsets) {
    const remindAt = new Date(due)
    remindAt.setUTCDate(remindAt.getUTCDate() - item.daysBefore)
    schedule.set(item.kind, remindAt.toISOString())
  }

  if (customDaysBefore > 0 && !defaultOffsets.some(item => item.daysBefore === customDaysBefore)) {
    const remindAt = new Date(due)
    remindAt.setUTCDate(remindAt.getUTCDate() - customDaysBefore)
    schedule.set('custom_due', remindAt.toISOString())
  }

  return Array.from(schedule.entries()).map(([kind, remindAt]) => ({ kind, remindAt }))
}

async function getReminderDaysBefore(
  supabase: SupabaseClient,
  userId: string,
  explicitDaysBefore?: number
): Promise<number> {
  if (typeof explicitDaysBefore === 'number' && explicitDaysBefore >= 0) {
    return explicitDaysBefore
  }

  const { data: settings } = await supabase
    .from('user_settings')
    .select('reminder_days_before')
    .eq('user_id', userId)
    .single()

  return (settings?.reminder_days_before as number) ?? 3
}

export async function syncBillDueReminders(
  supabase: SupabaseClient,
  { billId, userId, dueDate, reminderDaysBefore }: CreateReminderInput
): Promise<void> {
  const daysBefore = await getReminderDaysBefore(supabase, userId, reminderDaysBefore)
  const now = new Date()
  const schedule = buildDueReminderSchedule(dueDate, daysBefore)

  await supabase
    .from('reminders')
    .delete()
    .eq('bill_id', billId)
    .in('kind', [...DUE_REMINDER_KINDS])

  const inserts = schedule
    .filter(item => new Date(item.remindAt) > now)
    .map(item => ({
      bill_id: billId,
      user_id: userId,
      remind_at: item.remindAt,
      channel: 'email' as const,
      kind: item.kind,
    }))

  if (inserts.length === 0) return

  await supabase.from('reminders').insert(inserts)
}

export async function createPaymentFollowupReminder(
  supabase: SupabaseClient,
  { billId, userId, paidAt }: { billId: string; userId: string; paidAt: string }
): Promise<void> {
  const paymentDate = new Date(paidAt)
  const remindAt = addBusinessDays(paymentDate, 3)
  remindAt.setUTCHours(8, 0, 0, 0)

  const now = new Date()
  const scheduledAt = remindAt <= now ? now.toISOString() : remindAt.toISOString()

  await supabase.from('reminders').upsert({
    bill_id: billId,
    user_id: userId,
    remind_at: scheduledAt,
    channel: 'email',
    kind: 'payment_followup',
    dismissed_at: null,
    sent_at: null,
  }, {
    onConflict: 'bill_id,kind,channel',
  })
}

export async function dismissBillReminders(
  supabase: SupabaseClient,
  { billId, kinds }: { billId: string; kinds?: ReminderKind[] }
): Promise<void> {
  let query = supabase
    .from('reminders')
    .update({ dismissed_at: new Date().toISOString() })
    .eq('bill_id', billId)
    .is('dismissed_at', null)

  if (kinds && kinds.length > 0) {
    query = query.in('kind', kinds)
  }

  await query
}
