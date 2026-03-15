import { NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { getAnalyticsSummary } from '@/lib/analytics'
import type { Bill } from '@/types'

export async function GET() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { data: bills } = await supabase
    .from('bills')
    .select('*')
    .eq('user_id', user.id)
    .order('due_date', { ascending: true })

  const summary = getAnalyticsSummary((bills ?? []) as Bill[])

  return NextResponse.json(summary)
}
