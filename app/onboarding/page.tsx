import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { OnboardingForm } from './_components/OnboardingForm'

export default async function OnboardingPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('display_name, preferred_language, onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (settings?.onboarding_completed) redirect('/dashboard')

  // Pre-fill display name from email
  const emailName = user.email?.split('@')[0]?.replace(/[._+]/g, ' ') ?? ''

  return (
    <div className="min-h-screen bg-[radial-gradient(circle_at_top_left,_rgba(29,78,216,0.08),_transparent_35%),linear-gradient(to_bottom,_#f8fafc,_#f3f4f6)] px-4 py-10 md:px-8 md:py-16">
      <div className="mx-auto max-w-5xl">
        <div className="grid gap-6 lg:grid-cols-[1.1fr_0.9fr]">
          <section className="rounded-[32px] border border-slate-200 bg-white/90 p-6 shadow-sm md:p-8">
            <div className="inline-flex items-center rounded-full bg-brand-50 px-3 py-1 text-xs font-semibold uppercase tracking-[0.18em] text-brand-700">
              Welcome
            </div>
            <h1 className="mt-4 text-3xl font-bold tracking-tight text-slate-900 md:text-4xl">Set BillFlow up for your bills and reminders.</h1>
            <p className="mt-4 text-sm leading-7 text-slate-600 md:text-base">
              A couple of preferences help extraction quality and reminder timing from day one. You can change everything later in settings.
            </p>

            <div className="mt-8 space-y-4">
              <FeatureBlurb title="Language-aware extraction" desc="BillFlow tailors explanations and extraction prompts to the language your bills usually use." />
              <FeatureBlurb title="Fewer corrections later" desc="Starting with the right defaults means less cleanup once bills begin arriving by upload or email." />
              <FeatureBlurb title="Still fully editable" desc="Nothing here locks you in. It just makes the first week smoother." />
            </div>
          </section>

          <section className="rounded-[32px] border border-slate-200 bg-white/95 p-6 shadow-sm md:p-8">
            <div className="mb-6">
              <span className="text-2xl font-bold tracking-tight text-brand-700">BillFlow</span>
              <p className="mt-3 text-sm text-slate-500">
                Finish your setup and head straight into the dashboard.
              </p>
            </div>
            <OnboardingForm
              displayName={settings?.display_name ?? emailName}
              preferredLanguage={settings?.preferred_language ?? 'en'}
            />
          </section>
        </div>
      </div>
    </div>
  )
}

function FeatureBlurb({ title, desc }: { title: string; desc: string }) {
  return (
    <div className="rounded-2xl border border-slate-200 bg-slate-50 p-4">
      <p className="text-sm font-semibold text-slate-900">{title}</p>
      <p className="mt-2 text-sm leading-6 text-slate-500">{desc}</p>
    </div>
  )
}
