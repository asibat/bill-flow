'use client'
import { useState } from 'react'
import { createClient } from '@/lib/supabase/client'
import { getAuthCallbackUrl, getAuthRedirectUrl } from '@/lib/supabase/auth-redirect'
import { useRouter } from 'next/navigation'
import Link from 'next/link'

export default function LoginPage() {
  const [email, setEmail] = useState('')
  const [password, setPassword] = useState('')
  const [showPassword, setShowPassword] = useState(false)
  const [error, setError] = useState('')
  const [notice, setNotice] = useState('')
  const [loading, setLoading] = useState(false)
  const router = useRouter()
  const supabase = createClient()

  async function handleLogin(e: React.FormEvent) {
    e.preventDefault()
    setLoading(true)
    setError('')
    setNotice('')
    const { error } = await supabase.auth.signInWithPassword({ email, password })
    if (error) { setError(error.message); setLoading(false) }
    else router.push('/dashboard')
  }

  async function handleGoogle() {
    setLoading(true)
    setError('')
    setNotice('')

    const { error } = await supabase.auth.signInWithOAuth({
      provider: 'google',
      options: { redirectTo: getAuthCallbackUrl() },
    })

    if (error) {
      setError(error.message)
      setLoading(false)
    }
  }

  async function handleForgotPassword() {
    if (!email) {
      setError('Enter your email first so we know where to send the reset link.')
      return
    }

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
      <h2 className="text-xl font-semibold text-gray-900 mb-6">Sign in</h2>
      <form onSubmit={handleLogin} className="space-y-4">
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
          />
        </div>
        {error && <p className="text-red-600 text-sm">{error}</p>}
        {notice && <p className="text-green-600 text-sm">{notice}</p>}
        <div className="flex justify-end">
          <button
            type="button"
            onClick={handleForgotPassword}
            className="text-sm text-brand-600 hover:underline"
          >
            Forgot password?
          </button>
        </div>
        <button type="submit" disabled={loading} className="btn-primary w-full justify-center">
          {loading ? 'Signing in…' : 'Sign in'}
        </button>
      </form>
      <div className="relative my-4">
        <div className="absolute inset-0 flex items-center"><div className="w-full border-t border-gray-200" /></div>
        <div className="relative flex justify-center"><span className="bg-white px-2 text-xs text-gray-500">or</span></div>
      </div>
      <button onClick={handleGoogle} disabled={loading} className="btn-secondary w-full justify-center">
        {loading ? 'Opening Google…' : 'Continue with Google'}
      </button>
      <p className="text-center text-sm text-gray-500 mt-4">
        No account? <Link href="/auth/signup" className="text-brand-600 hover:underline">Sign up</Link>
      </p>
    </div>
  )
}
