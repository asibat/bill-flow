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
    <div className="px-4 py-5 md:px-8 md:py-8">
      <div className="mx-auto max-w-5xl space-y-6">
        <section className="rounded-[28px] border border-slate-200 bg-white/90 p-5 shadow-sm md:p-7">
          <div className="grid gap-6 lg:grid-cols-[1.15fr_0.85fr]">
            <div>
              <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
                Settings
              </div>
              <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Tune reminders, language, and phone behavior.</h1>
              <p className="mt-3 text-sm leading-6 text-slate-600 md:text-base">
                These settings control how BillFlow explains your bills, when it reminds you, and how it behaves on this device.
              </p>
            </div>

            <div className="grid gap-3 sm:grid-cols-3 lg:grid-cols-1">
              <SettingsTip title="Language" desc="Used for extraction explanations and bill review copy." />
              <SettingsTip title="Reminders" desc="Standard reminders run automatically. Your custom reminder adds an extra nudge." />
              <SettingsTip title="Phone setup" desc="Push notifications are configured per device, not just per account." />
            </div>
          </div>
        </section>

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

function SettingsTip({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  )
}
