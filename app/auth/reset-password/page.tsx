'use client'

import { useEffect, useState } from 'react'
import Link from 'next/link'
import { useRouter } from 'next/navigation'
import { createClient } from '@/lib/supabase/client'

export default function ResetPasswordPage() {
  const [password, setPassword] = useState('')
  const [confirmPassword, setConfirmPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [loading, setLoading] = useState(false)
  const [checking, setChecking] = useState(true)
  const [error, setError] = useState('')
  const supabase = createClient()
  const router = useRouter()

  useEffect(() => {
    let active = true

    async function checkSession() {
      const { data, error } = await supabase.auth.getSession()
      if (!active) return

      if (error || !data.session) {
        setError('This password reset link is invalid or has expired. Request a new one.')
      }

      setChecking(false)
    }

    checkSession()

    return () => {
      active = false
    }
  }, [supabase])

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setError('')

    if (password.length < 8) {
      setError('Use at least 8 characters for your new password.')
      return
    }

    if (password !== confirmPassword) {
      setError('Passwords do not match.')
      return
    }

    setLoading(true)
    const { error } = await supabase.auth.updateUser({ password })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    router.push('/dashboard')
  }

  if (checking) {
    return (
      <div className="card p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Checking your reset link</h2>
        <p className="text-sm text-gray-500">One moment while we verify your session.</p>
      </div>
    )
  }

  return (
    <div className="card p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Choose a new password</h2>
      <p className="mb-6 text-sm leading-6 text-gray-500">
        Set a new password for your BillFlow account.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">New password</label>
            <button
              type="button"
              onClick={() => setShowPassword(prev => !prev)}
              className="text-xs font-medium text-brand-600 hover:text-brand-700"
            >
              {showPassword ? 'Hide' : 'Show'}
            </button>
          </div>
          <input
            type={showPassword ? 'text' : 'password'}
            className="input"
            value={password}
            onChange={e => setPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        <div>
          <label className="label">Confirm password</label>
          <input
            type={showPassword ? 'text' : 'password'}
            className="input"
            value={confirmPassword}
            onChange={e => setConfirmPassword(e.target.value)}
            required
            minLength={8}
          />
        </div>

        {error && <p className="text-red-600 text-sm">{error}</p>}

        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Updating…' : 'Update password'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        Back to <Link href="/auth/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
