export const REMINDER_SNOOZE_PRESETS = ['tomorrow', 'next_week', 'next_payday'] as const

export type ReminderSnoozePreset = typeof REMINDER_SNOOZE_PRESETS[number]

const REMINDER_HOUR_UTC = 8

function buildReminderTimestamp(date: Date): Date {
  const result = new Date(date)
  result.setUTCHours(REMINDER_HOUR_UTC, 0, 0, 0)
  return result
}

function addDays(date: Date, days: number): Date {
  const result = new Date(date)
  result.setUTCDate(result.getUTCDate() + days)
  return result
}

function clampDayOfMonth(year: number, monthIndex: number, requestedDay: number): number {
  return Math.min(requestedDay, new Date(Date.UTC(year, monthIndex + 1, 0)).getUTCDate())
}

function getNextPayday(baseDate: Date, salaryDay: number): Date {
  const year = baseDate.getUTCFullYear()
  const monthIndex = baseDate.getUTCMonth()
  const currentMonthDay = clampDayOfMonth(year, monthIndex, salaryDay)
  const currentMonthCandidate = buildReminderTimestamp(new Date(Date.UTC(year, monthIndex, currentMonthDay)))

  if (currentMonthCandidate > baseDate) {
    return currentMonthCandidate
  }

  const nextMonthIndex = monthIndex === 11 ? 0 : monthIndex + 1
  const nextMonthYear = monthIndex === 11 ? year + 1 : year
  const nextMonthDay = clampDayOfMonth(nextMonthYear, nextMonthIndex, salaryDay)

  return buildReminderTimestamp(new Date(Date.UTC(nextMonthYear, nextMonthIndex, nextMonthDay)))
}

export function getReminderSnoozeLabel(preset: ReminderSnoozePreset): string {
  switch (preset) {
    case 'tomorrow':
      return 'Tomorrow'
    case 'next_week':
      return 'Next week'
    case 'next_payday':
      return 'Payday'
    default:
      return 'Snooze'
  }
}

export function resolveReminderSnooze(
  preset: ReminderSnoozePreset,
  options: { salaryDay?: number | null; now?: Date } = {}
): Date | null {
  const now = options.now ?? new Date()

  switch (preset) {
    case 'tomorrow':
      return buildReminderTimestamp(addDays(now, 1))
    case 'next_week':
      return buildReminderTimestamp(addDays(now, 7))
    case 'next_payday':
      if (!options.salaryDay || options.salaryDay < 1 || options.salaryDay > 31) return null
      return getNextPayday(now, options.salaryDay)
    default:
      return null
  }
}
