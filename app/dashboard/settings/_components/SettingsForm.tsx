'use client'

import { useState } from 'react'
import type { PrivacyLevel } from '@/types'

interface Props {
  displayName: string
  preferredLanguage: string
  defaultPrivacyLevel: PrivacyLevel
  salaryDay: number | null
  reminderDaysBefore: number
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
]

export function SettingsForm({ displayName: initName, preferredLanguage: initLang, defaultPrivacyLevel: initPrivacy, salaryDay: initSalary, reminderDaysBefore: initReminder }: Props) {
  const [displayName, setDisplayName] = useState(initName)
  const [language, setLanguage] = useState(initLang)
  const [privacy, setPrivacy] = useState<PrivacyLevel>(initPrivacy)
  const [salaryDay, setSalaryDay] = useState(initSalary?.toString() ?? '')
  const [reminderDays, setReminderDays] = useState(initReminder.toString())
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
          default_privacy_level: privacy,
          salary_day: salaryDay ? Number(salaryDay) : null,
          reminder_days_before: Number(reminderDays) || 3,
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
        <label className="block text-sm font-medium text-gray-700 mb-1">Primary bill language</label>
        <div className="flex gap-3">
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              onClick={() => setLanguage(l.value)}
              className={`px-4 py-2 rounded-lg border text-sm font-medium transition-all ${
                language === l.value
                  ? 'border-brand-500 bg-brand-50 text-brand-700'
                  : 'border-gray-200 text-gray-600 hover:border-gray-300'
              }`}
            >
              {l.label}
            </button>
          ))}
        </div>
      </div>

      <div>
        <label className="block text-sm font-medium text-gray-700 mb-2">Default privacy level</label>
        <div className="grid grid-cols-2 gap-3">
          <button
            onClick={() => setPrivacy('strict')}
            className={`p-4 rounded-xl border text-left transition-all ${
              privacy === 'strict'
                ? 'border-green-400 bg-green-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">🔒 Strict Privacy</p>
            <p className="text-xs text-gray-500 mt-1">Redact PII before AI extraction</p>
          </button>
          <button
            onClick={() => setPrivacy('accuracy')}
            className={`p-4 rounded-xl border text-left transition-all ${
              privacy === 'accuracy'
                ? 'border-blue-400 bg-blue-50'
                : 'border-gray-200 hover:border-gray-300'
            }`}
          >
            <p className="font-semibold text-gray-900 text-sm">🎯 Maximum Accuracy</p>
            <p className="text-xs text-gray-500 mt-1">Send original to AI</p>
          </button>
        </div>
      </div>

      <hr className="border-gray-100" />

      <div className="grid grid-cols-2 gap-4">
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
          <p className="text-xs text-gray-400 mt-1">Day of month you get paid</p>
        </div>
        <div>
          <label className="block text-sm font-medium text-gray-700 mb-1">Reminder days before due</label>
          <input
            type="number"
            min={0}
            max={30}
            value={reminderDays}
            onChange={e => setReminderDays(e.target.value)}
            className="input w-full"
          />
        </div>
      </div>

      <div className="flex items-center gap-3 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save Changes'}
        </button>
        {saved && <span className="text-sm text-green-600">Saved!</span>}
      </div>
    </div>
  )
}
