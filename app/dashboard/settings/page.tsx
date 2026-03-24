import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { SettingsForm } from './_components/SettingsForm'

export default async function SettingsPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('display_name, preferred_language, salary_day, reminder_days_before, email_notifications, push_notifications')
    .eq('user_id', user.id)
    .single()

  return (
    <div className="p-8 max-w-2xl">
      <h1 className="text-2xl font-bold text-gray-900 mb-6">Settings</h1>
      <div className="card p-6">
        <SettingsForm
          displayName={settings?.display_name ?? ''}
          preferredLanguage={settings?.preferred_language ?? 'en'}
          salaryDay={settings?.salary_day ?? null}
          reminderDaysBefore={settings?.reminder_days_before ?? 3}
          emailNotifications={settings?.email_notifications ?? true}
          pushNotifications={settings?.push_notifications ?? false}
        />
      </div>
    </div>
  )
}
