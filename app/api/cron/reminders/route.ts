import { NextRequest, NextResponse } from 'next/server'
import { sendPushToUserSubscriptions } from '@/lib/push/server'
import { createServiceClient } from '@/lib/supabase/server'
import { sendEmail, buildPaymentFollowupEmail, buildReminderEmail, buildOverdueEmail } from '@/lib/email/send'
import { isDueReminderKind, isReminderActiveForBillStatus, type ReminderKind } from '@/lib/reminders/kinds'
import { format } from 'date-fns'

interface ReminderRow {
  id: string
  bill_id: string
  user_id: string
  remind_at: string
  kind: ReminderKind
}

interface BillRow {
  id: string
  user_id: string
  payee_name: string
  amount: number
  currency: string
  due_date: string
  status: 'received' | 'scheduled' | 'payment_sent' | 'confirmed' | 'overdue'
  paid_at?: string | null
}

interface UserNotificationSettings {
  email_notifications: boolean
  push_notifications: boolean
}

function groupBy<T>(items: T[], keyFn: (item: T) => string): Record<string, T[]> {
  const result: Record<string, T[]> = {}
  for (const item of items) {
    const key = keyFn(item)
    if (!result[key]) result[key] = []
    result[key].push(item)
  }
  return result
}

/**
 * Cron job: runs daily at 8 AM UTC (configured in vercel.json).
 * 1. Send pending reminder emails (remind_at <= now, not sent, not dismissed)
 * 2. Mark unpaid bills past due_date as overdue and notify
 */
export async function GET(request: NextRequest) {
  const authHeader = request.headers.get('authorization')
  if (authHeader !== `Bearer ${process.env.CRON_SECRET}`) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
  }

  const supabase = createServiceClient()
  const now = new Date().toISOString()
  const results = { remindersSent: 0, overdueMarked: 0, errors: 0 }

  // --- Step 1: Send pending reminders ---
  const { data: pendingReminders } = await supabase
    .from('reminders')
    .select('id, bill_id, user_id, remind_at, kind')
    .lte('remind_at', now)
    .is('sent_at', null)
    .is('dismissed_at', null)
    .limit(500)

  if (pendingReminders && pendingReminders.length > 0) {
    const byUser = groupBy(pendingReminders as ReminderRow[], r => r.user_id)

    for (const userId of Object.keys(byUser)) {
      const reminders = byUser[userId]
      const { data: { user } } = await supabase.auth.admin.getUserById(userId)
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('email_notifications, push_notifications')
        .eq('user_id', userId)
        .single()

      const emailEnabled = (userSettings as UserNotificationSettings | null)?.email_notifications !== false
      const pushEnabled = (userSettings as UserNotificationSettings | null)?.push_notifications === true
      if (!user?.email && !pushEnabled) {
        results.errors++
        continue
      }

      const billIds = reminders.map(r => r.bill_id)
      const { data: bills } = await supabase
        .from('bills')
        .select('id, user_id, payee_name, amount, currency, due_date, status, paid_at')
        .in('id', billIds)

      if (!bills || bills.length === 0) {
        await supabase
          .from('reminders')
          .update({ sent_at: now })
          .in('id', reminders.map(r => r.id))
        continue
      }

      const billById = new Map((bills as BillRow[]).map(bill => [bill.id, bill]))
      const dueReminderIdsToMark = new Set<string>()
      const followupReminderIdsToMark = new Set<string>()
      const latestDueReminderByBill = new Map<string, ReminderRow>()
      const followupBills = new Map<string, BillRow>()

      for (const reminder of reminders) {
        const bill = billById.get(reminder.bill_id)
        if (!bill) {
          dueReminderIdsToMark.add(reminder.id)
          continue
        }
        if (!isReminderActiveForBillStatus(reminder.kind, bill.status)) {
          dueReminderIdsToMark.add(reminder.id)
          continue
        }

        if (isDueReminderKind(reminder.kind)) {
          dueReminderIdsToMark.add(reminder.id)
          const current = latestDueReminderByBill.get(reminder.bill_id)
          if (!current || new Date(reminder.remind_at) > new Date(current.remind_at)) {
            latestDueReminderByBill.set(reminder.bill_id, reminder)
          }
          continue
        }

        followupReminderIdsToMark.add(reminder.id)
        followupBills.set(bill.id, bill)
      }

      const dueBills = Array.from(latestDueReminderByBill.values())
        .map(reminder => billById.get(reminder.bill_id))
        .filter((bill): bill is BillRow => !!bill)

      if (dueBills.length > 0) {
        let delivered = false
        const { subject, html } = buildReminderEmail(dueBills.map(b => ({
          payee_name: b.payee_name,
          amount: b.amount,
          currency: b.currency,
          due_date: format(new Date(b.due_date), 'd MMM yyyy'),
        })))

        if (emailEnabled && user?.email) {
          const sent = await sendEmail({ to: user.email, subject, html })
          delivered = !!sent || delivered
          if (!sent) results.errors++
        }

        if (pushEnabled) {
          const sentPush = await sendPushToUserSubscriptions(supabase, userId, {
            title: dueBills.length === 1 ? `Bill due soon: ${dueBills[0].payee_name}` : `${dueBills.length} bills due soon`,
            body: dueBills.length === 1
              ? `${dueBills[0].amount.toFixed(2)} ${dueBills[0].currency} due ${format(new Date(dueBills[0].due_date), 'd MMM')}`
              : 'Open BillFlow to review your upcoming bills.',
            url: '/dashboard',
            tag: 'billflow-due-reminders',
          })
          delivered = sentPush > 0 || delivered
        }

        if (delivered || (!emailEnabled && !pushEnabled)) {
          await supabase
            .from('reminders')
            .update({ sent_at: now })
            .in('id', Array.from(dueReminderIdsToMark))
          results.remindersSent += dueBills.length
        }
      }

      const followupList = Array.from(followupBills.values())
      if (followupList.length > 0) {
        let delivered = false
        const { subject, html } = buildPaymentFollowupEmail(followupList.map(b => ({
          payee_name: b.payee_name,
          amount: b.amount,
          currency: b.currency,
          paid_at: b.paid_at ? format(new Date(b.paid_at), 'd MMM yyyy') : 'Recently',
        })))

        if (emailEnabled && user?.email) {
          const sent = await sendEmail({ to: user.email, subject, html })
          delivered = !!sent || delivered
          if (!sent) results.errors++
        }

        if (pushEnabled) {
          const sentPush = await sendPushToUserSubscriptions(supabase, userId, {
            title: followupList.length === 1 ? `Confirm payment: ${followupList[0].payee_name}` : 'Confirm recent bill payments',
            body: followupList.length === 1
              ? `Check whether ${followupList[0].amount.toFixed(2)} ${followupList[0].currency} was received.`
              : 'Open BillFlow to confirm your recent payments.',
            url: '/dashboard',
            tag: 'billflow-payment-followup',
          })
          delivered = sentPush > 0 || delivered
        }

        if (delivered || (!emailEnabled && !pushEnabled)) {
          await supabase
            .from('reminders')
            .update({ sent_at: now })
            .in('id', Array.from(followupReminderIdsToMark))
          results.remindersSent += followupList.length
        }
      }

      const staleReminderIds = reminders
        .filter(reminder => {
          const bill = billById.get(reminder.bill_id)
          return !bill || !isReminderActiveForBillStatus(reminder.kind, bill.status)
        })
        .map(reminder => reminder.id)

      if (staleReminderIds.length > 0) {
        await supabase
          .from('reminders')
          .update({ sent_at: now })
          .in('id', staleReminderIds)
      }
    }
  }

  // --- Step 2: Mark overdue bills and notify ---
  const today = format(new Date(), 'yyyy-MM-dd')
  const { data: overdueBills } = await supabase
    .from('bills')
    .select('id, user_id, payee_name, amount, currency, due_date')
    .lt('due_date', today)
    .in('status', ['received', 'scheduled'])
    .limit(200)

  if (overdueBills && overdueBills.length > 0) {
    const overdueIds = (overdueBills as BillRow[]).map(b => b.id)
    await supabase
      .from('bills')
      .update({ status: 'overdue' })
      .in('id', overdueIds)
    results.overdueMarked = overdueIds.length

    const byUser = groupBy(overdueBills as BillRow[], b => b.user_id)

    for (const userId of Object.keys(byUser)) {
      const bills = byUser[userId]
      const { data: { user } } = await supabase.auth.admin.getUserById(userId)
      const { data: userSettings } = await supabase
        .from('user_settings')
        .select('email_notifications, push_notifications')
        .eq('user_id', userId)
        .single()

      const emailEnabled = (userSettings as UserNotificationSettings | null)?.email_notifications !== false
      const pushEnabled = (userSettings as UserNotificationSettings | null)?.push_notifications === true

      const { subject, html } = buildOverdueEmail(
        bills.map(b => ({
          payee_name: b.payee_name,
          amount: b.amount,
          currency: b.currency,
          due_date: format(new Date(b.due_date), 'd MMM yyyy'),
        }))
      )

      if (emailEnabled && user?.email) {
        await sendEmail({ to: user.email, subject, html })
      }
      if (pushEnabled) {
        await sendPushToUserSubscriptions(supabase, userId, {
          title: bills.length === 1 ? `Overdue: ${bills[0].payee_name}` : `${bills.length} overdue bills`,
          body: bills.length === 1
            ? `${bills[0].amount.toFixed(2)} ${bills[0].currency} is now overdue.`
            : 'Open BillFlow to review overdue bills.',
          url: '/dashboard',
          tag: 'billflow-overdue',
        })
      }
    }
  }

  console.log('[cron:reminders]', results)
  return NextResponse.json({ ok: true, ...results })
}
