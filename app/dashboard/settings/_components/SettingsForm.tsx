'use client'

import { useState } from 'react'
import PushNotificationSettings from '@/components/pwa/PushNotificationSettings'

interface Props {
  displayName: string
  preferredLanguage: string
  salaryDay: number | null
  reminderDaysBefore: number
  emailNotifications: boolean
  pushNotifications: boolean
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
]

export function SettingsForm({
  displayName: initName,
  preferredLanguage: initLang,
  salaryDay: initSalary,
  reminderDaysBefore: initReminder,
  emailNotifications: initEmailNotifications,
  pushNotifications: initPushNotifications,
}: Props) {
  const [displayName, setDisplayName] = useState(initName)
  const [language, setLanguage] = useState(initLang)
  const [salaryDay, setSalaryDay] = useState(initSalary?.toString() ?? '')
  const [reminderDays, setReminderDays] = useState(initReminder.toString())
  const [emailNotifications, setEmailNotifications] = useState(initEmailNotifications)
  const [pushNotifications, setPushNotifications] = useState(initPushNotifications)
  const [saving, setSaving] = useState(false)
  const [saved, setSaved] = useState(false)
  const [error, setError] = useState<string | null>(null)

  async function save() {
    setSaving(true)
    setError(null)
    setSaved(false)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          preferred_language: language,
          salary_day: salaryDay ? Number(salaryDay) : null,
          reminder_days_before: Number(reminderDays) || 3,
          email_notifications: emailNotifications,
          push_notifications: pushNotifications,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save')
      }
      setSaved(true)
      setTimeout(() => setSaved(false), 3000)
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  return (
    <div className="space-y-6">
      {error && (
        <div className="p-3 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Profile</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Personal defaults</h2>
        </div>

        <div className="space-y-5">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Display name</label>
            <input
              type="text"
              value={displayName}
              onChange={e => setDisplayName(e.target.value)}
              className="input w-full max-w-sm"
            />
          </div>

          <div>
            <label className="block text-sm font-medium text-gray-700 mb-2">Primary bill language</label>
            <div className="grid gap-3 sm:grid-cols-3">
              {LANGUAGES.map(l => (
                <button
                  key={l.value}
                  onClick={() => setLanguage(l.value)}
                  className={`rounded-2xl border px-4 py-4 text-left text-sm font-medium transition-all ${
                    language === l.value
                      ? 'border-brand-500 bg-brand-50 text-brand-700'
                      : 'border-gray-200 text-gray-600 hover:border-gray-300 hover:bg-slate-50'
                  }`}
                >
                  <span className="block">{l.label}</span>
                </button>
              ))}
            </div>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Planning</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Reminder timing and payday context</h2>
        </div>

        <div className="grid gap-4 md:grid-cols-2">
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Salary day</label>
            <input
              type="number"
              min={1}
              max={31}
              value={salaryDay}
              onChange={e => setSalaryDay(e.target.value)}
              placeholder="e.g. 25"
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">Used on the dashboard to show what lands before or after payday.</p>
          </div>
          <div>
            <label className="block text-sm font-medium text-gray-700 mb-1">Extra reminder days before due</label>
            <input
              type="number"
              min={0}
              max={30}
              value={reminderDays}
              onChange={e => setReminderDays(e.target.value)}
              className="input w-full"
            />
            <p className="text-xs text-gray-400 mt-1">BillFlow already sends standard reminders at 7 days, 3 days, and on the due date.</p>
          </div>
        </div>
      </section>

      <section className="rounded-[24px] border border-slate-200 bg-white p-5 shadow-sm md:p-6">
        <div className="mb-5">
          <p className="text-xs font-semibold uppercase tracking-[0.18em] text-slate-400">Notifications</p>
          <h2 className="mt-2 text-xl font-semibold tracking-tight text-slate-900">Email and phone delivery</h2>
        </div>

        <div className="space-y-4">
          <label className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Email notifications</p>
              <p className="text-xs text-gray-500 mt-1">Receive reminders and overdue alerts by email.</p>
            </div>
            <input
              type="checkbox"
              checked={emailNotifications}
              onChange={e => setEmailNotifications(e.target.checked)}
              className="h-4 w-4"
            />
          </label>

          <PushNotificationSettings pushEnabled={pushNotifications} />

          <label className="flex items-center justify-between rounded-2xl border border-gray-200 p-4">
            <div>
              <p className="text-sm font-medium text-gray-900">Push notifications enabled</p>
              <p className="text-xs text-gray-500 mt-1">Turn this on after finishing push setup on the current device.</p>
            </div>
            <input
              type="checkbox"
              checked={pushNotifications}
              onChange={e => setPushNotifications(e.target.checked)}
              className="h-4 w-4"
            />
          </label>
        </div>
      </section>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  )
}
