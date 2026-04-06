import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect, notFound } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/features'
import AppShell from '@/components/layout/AppShell'

export default async function SpendingLayout({ children }: { children: React.ReactNode }) {
  if (!isFeatureEnabled('SPENDING_ANALYSIS')) notFound()

  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('email_inbox_address, onboarding_completed')
    .eq('user_id', user.id)
    .single()

  if (settings && !settings.onboarding_completed) redirect('/onboarding')

  return (
    <AppShell userEmail={user.email!} inboxAddress={settings?.email_inbox_address} showSpending>
      {children}
    </AppShell>
  )
}
