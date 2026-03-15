import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './_components/SettingsForm'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('display_name, preferred_language, default_privacy_level, salary_day, reminder_days_before')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="card p-6">
        <SettingsForm
          displayName={settings?.display_name ?? ''}
          preferredLanguage={settings?.preferred_language ?? 'en'}
          defaultPrivacyLevel={settings?.default_privacy_level ?? 'strict'}
          salaryDay={settings?.salary_day ?? null}
          reminderDaysBefore={settings?.reminder_days_before ?? 3}
        />
      </div>
    </div>
  )
}
