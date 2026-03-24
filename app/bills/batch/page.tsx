import { createServerSupabaseClient } from '@/lib/supabase/server'
import { redirect } from 'next/navigation'
import type { Bill } from '@/types'
import BatchClient from './_components/BatchClient'

export default async function BatchPage() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) redirect('/auth/login')

  // Fetch unpaid bills eligible for batching
  const { data: bills } = await supabase
    .from('bills')
    .select('id, payee_name, amount, currency, due_date, structured_comm, structured_comm_valid, iban, bic, status')
    .eq('user_id', user.id)
    .in('status', ['received', 'scheduled', 'overdue'])
    .order('due_date', { ascending: true })

  return <BatchClient bills={(bills as Bill[]) ?? []} />
}
