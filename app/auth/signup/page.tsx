'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl } from '@/lib/supabase/auth-redirect'
import Link from 'next/link'

export default function SignupPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [loading, setLoading] = useState(false)
  const [confirmationEmail, setConfirmationEmail] = useState<string | null>(null)
  const supabase = createClient()

  async function handleSignup(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')

    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        emailRedirectTo: getAuthCallbackUrl(),
      },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    if (data.user && !data.session) {
      setConfirmationEmail(email)
      setLoading(false)
      return
    }

    window.location.href = '/dashboard'
  }

  if (confirmationEmail) {
    return (
      <div className="card p-8">
        <h2 className="text-xl font-semibold text-gray-900 mb-3">Check your email</h2>
        <p className="text-sm leading-6 text-gray-600">
          We sent a confirmation link to <span className="font-medium text-gray-900">{confirmationEmail}</span>.
          Open that link on this device to finish your signup and return to BillFlow.
        </p>
        <div className="mt-6 rounded-2xl border border-slate-200 bg-slate-50 p-4 text-sm text-slate-600">
          If the link still opens on localhost, update your Supabase Auth site URL and redirect URLs to your deployed BillFlow URL.
        </div>
        <p className="text-center text-sm text-gray-500 mt-6">
          Already confirmed? <Link href="/auth/login" className="text-brand-600 hover:underline">Sign in</Link>
        </p>
      </div>
    )
  }

  return (
    <div className="card p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Create account</h2>
      <form onSubmit={handleSignup} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input type="email" className="input" value={email} onChange={e => setEmail(e.target.value)} required />
        </div>
        <div>
          <div className="mb-1 flex items-center justify-between">
            <label className="label mb-0">Password</label>
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
        {error && <p className="text-red-600 text-sm">{error}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Creating account…' : 'Create account'}
        </button>
      </form>
      <p className="text-center text-sm text-gray-500 mt-4">
        Already have an account? <Link href="/auth/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
