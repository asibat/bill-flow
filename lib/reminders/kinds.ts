import type { BillStatus } from '@/types'

export const DUE_REMINDER_KINDS = ['custom_due', 'due_7d', 'due_3d', 'due_today'] as const
export const REMINDER_KINDS = [...DUE_REMINDER_KINDS, 'payment_followup'] as const

export type ReminderKind = typeof REMINDER_KINDS[number]

export function isDueReminderKind(kind: ReminderKind): boolean {
  return (DUE_REMINDER_KINDS as readonly string[]).includes(kind)
}

export function isReminderActiveForBillStatus(kind: ReminderKind, status: BillStatus): boolean {
  if (kind === 'payment_followup') return status === 'payment_sent'
  return !['confirmed', 'payment_sent'].includes(status)
}

export function getReminderKindLabel(kind: ReminderKind): string {
  switch (kind) {
    case 'due_7d':
      return 'Next reminder: due in 7 days'
    case 'due_3d':
      return 'Next reminder: due in 3 days'
    case 'due_today':
      return 'Next reminder: due today'
    case 'payment_followup':
      return 'Follow up on payment'
    case 'custom_due':
    default:
      return 'Next reminder scheduled'
  }
}
