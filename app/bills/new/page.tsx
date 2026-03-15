import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import { NewBillClient } from './_components/NewBillClient'
import type { PrivacyLevel } from '@/types'

export default async function NewBillPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  const { data: settings } = await supabase
    .from('user_settings')
    .select('default_privacy_level')
    .eq('user_id', user.id)
    .single()

  const defaultPrivacy: PrivacyLevel = settings?.default_privacy_level ?? 'strict'

  return <NewBillClient defaultPrivacyLevel={defaultPrivacy} />
}
