import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { isFeatureEnabled } from '@/lib/features'
import AppShell from '@/components/layout/AppShell'

export default async function BillsLayout({ children }: { children: React.ReactNode }) {
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
    <AppShell
      userEmail={user.email!}
      inboxAddress={settings?.email_inbox_address}
      showSpending={isFeatureEnabled('SPENDING_ANALYSIS')}
    >
      {children}
    </AppShell>
  )
}
