'use client'

import { useState } from 'react'
import { useRouter } from 'next/navigation'

interface Props {
  displayName: string
  preferredLanguage: string
}

const LANGUAGES = [
  { value: 'en', label: 'English' },
  { value: 'fr', label: 'Français' },
  { value: 'nl', label: 'Nederlands' },
]

export function OnboardingForm({ displayName: initialName, preferredLanguage: initialLang }: Props) {
  const [displayName, setDisplayName] = useState(initialName)
  const [language, setLanguage] = useState(initialLang)
  const [saving, setSaving] = useState(false)
  const [error, setError] = useState<string | null>(null)
  const router = useRouter()

  async function save() {
    setSaving(true)
    setError(null)
    try {
      const res = await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({
          display_name: displayName,
          preferred_language: language,
          onboarding_completed: true,
        }),
      })
      if (!res.ok) {
        const body = await res.json().catch(() => ({}))
        throw new Error(body.error || 'Failed to save')
      }
      router.refresh()
      router.push('/dashboard')
    } catch (err) {
      console.error('Onboarding save error:', err)
      setError(err instanceof Error ? err.message : 'Failed to save')
    } finally {
      setSaving(false)
    }
  }

  async function skip() {
    setSaving(true)
    await fetch('/api/settings', {
      method: 'PATCH',
      headers: { 'Content-Type': 'application/json' },
      body: JSON.stringify({ onboarding_completed: true }),
    })
    router.push('/dashboard')
  }

  return (
    <div className="space-y-8">
      {error && (
        <div className="p-4 rounded-lg bg-red-50 border border-red-200 text-sm text-red-700">{error}</div>
      )}

      {/* Display name */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Display name</label>
        <input
          type="text"
          value={displayName}
          onChange={e => setDisplayName(e.target.value)}
          placeholder="How should we call you?"
          className="input w-full max-w-sm"
        />
        <p className="text-xs text-gray-400 mt-1">Optional — used in the app interface</p>
      </div>

      {/* Language */}
      <div>
        <label className="block text-sm font-semibold text-gray-900 mb-2">Primary bill language</label>
        <p className="text-sm text-gray-500 mb-3">
          Most of your bills are in which language? This helps with text extraction accuracy.
        </p>
        <div className="flex gap-3">
          {LANGUAGES.map(l => (
            <button
              key={l.value}
              onClick={() => setLanguage(l.value)}
              className={`px-5 py-2.5 rounded-lg border text-sm font-medium transition-all ${
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

      {/* Actions */}
      <div className="flex items-center gap-4 pt-2">
        <button onClick={save} disabled={saving} className="btn-primary">
          {saving ? 'Saving...' : 'Save & Continue'}
        </button>
        <button onClick={skip} disabled={saving} className="text-sm text-gray-400 hover:text-gray-600">
          Skip for now
        </button>
      </div>
    </div>
  )
}
