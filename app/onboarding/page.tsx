import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './_components/OnboardingForm'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('display_name, preferred_language, default_privacy_level, onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (settings?.onboarding_completed) redirect('/dashboard')

  // Pre-fill display name from email
  const emailName = user.email?.split('@')[0]?.replace(/[._+]/g, ' ') ?? ''

  return (
    <div className="min-h-screen bg-gray-50 flex items-start justify-center pt-20">
      <div className="w-full max-w-lg">
        <div className="mb-8">
          <span className="text-2xl font-bold tracking-tight text-brand-700">BillFlow</span>
        </div>
        <div className="bg-white rounded-2xl shadow-sm border border-gray-100 p-8">
          <h1 className="text-xl font-bold text-gray-900 mb-1">Welcome to BillFlow</h1>
          <p className="text-sm text-gray-500 mb-8">
            Let&apos;s set up a few preferences before you start. You can change these anytime in settings.
          </p>
          <OnboardingForm
            displayName={settings?.display_name ?? emailName}
            preferredLanguage={settings?.preferred_language ?? 'en'}
            defaultPrivacyLevel={settings?.default_privacy_level ?? 'strict'}
          />
        </div>
      </div>
    </div>
  )
}
