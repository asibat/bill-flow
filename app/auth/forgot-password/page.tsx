'use client'

import { useState } from 'react'
import Link from 'next/link'
import { createClient } from '@/lib/supabase/client'
import { getAuthRedirectUrl } from '@/lib/supabase/auth-redirect'

export default function ForgotPasswordPage() {
  const [email, setEmail] = useState('')
  const [loading, setLoading] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const supabase = createClient()

  async function handleSubmit(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')

    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: getAuthRedirectUrl('/auth/reset-password'),
    })

    if (error) {
      setError(error.message)
      setLoading(false)
      return
    }

    setNotice(`Password reset instructions sent to ${email}.`)
    setLoading(false)
  }

  return (
    <div className="card p-8">
      <h2 className="text-xl font-semibold text-gray-900 mb-3">Reset your password</h2>
      <p className="mb-6 text-sm leading-6 text-gray-500">
        Enter the email address on your BillFlow account and we&apos;ll send you a secure reset link.
      </p>

      <form onSubmit={handleSubmit} className="space-y-4">
        <div>
          <label className="label">Email</label>
          <input
            type="email"
            className="input"
            value={email}
            onChange={e => setEmail(e.target.value)}
            required
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {notice && <p className="text-green-600 text-sm">{notice}</p>}
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Sending…' : 'Send reset link'}
        </button>
      </form>

      <p className="text-center text-sm text-gray-500 mt-4">
        Back to <Link href="/auth/login" className="text-brand-600 hover:underline">Sign in</Link>
      </p>
    </div>
  )
}
