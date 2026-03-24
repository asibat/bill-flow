import { isReminderActiveForBillStatus, type ReminderKind } from './kinds'
import type { BillStatus } from '@/types'

type ReminderWithBill<TBill> = {
  bill_id: string
  remind_at: string
  kind: ReminderKind
  bills: TBill | TBill[] | null
}

function getBill<TBill>(reminder: ReminderWithBill<TBill>): TBill | null {
  return Array.isArray(reminder.bills) ? (reminder.bills[0] ?? null) : reminder.bills
}

export function getVisibleReminders<TBill extends { status: BillStatus }, TReminder extends ReminderWithBill<TBill>>(
  reminders: TReminder[]
): TReminder[] {
  const visibleByBill = new Map<string, TReminder>()

  for (const reminder of reminders) {
    const bill = getBill(reminder)
    if (!bill || !isReminderActiveForBillStatus(reminder.kind, bill.status)) continue

    const current = visibleByBill.get(reminder.bill_id)
    if (!current) {
      visibleByBill.set(reminder.bill_id, reminder)
      continue
    }

    if (new Date(reminder.remind_at) > new Date(current.remind_at)) {
      visibleByBill.set(reminder.bill_id, reminder)
    }
  }

  return Array.from(visibleByBill.values()).sort(
    (a, b) => new Date(a.remind_at).getTime() - new Date(b.remind_at).getTime()
  )
}
