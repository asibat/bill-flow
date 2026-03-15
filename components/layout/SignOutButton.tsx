'use client'
import { createClient } from '@/lib/supabase/client'
import { useRouter } from 'next/navigation'

export default function SignOutButton() {
  const router = useRouter()
  const supabase = createClient()
  async function signOut() {
    await supabase.auth.signOut()
    router.push('/auth/login')
  }
  return (
    <button onClick={signOut} className="text-xs text-brand-300 hover:text-white transition-colors">
      Sign out
    </button>
  )
}
