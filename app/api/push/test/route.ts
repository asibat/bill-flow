import { NextResponse } from 'next/server'
import { sendPushToUserSubscriptions } from '@/lib/push/server'
import { createServiceClient, createServerSupabaseClient } from '@/lib/supabase/server'

export async function POST() {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const serviceSupabase = createServiceClient()
  const sent = await sendPushToUserSubscriptions(serviceSupabase, user.id, {
    title: 'BillFlow test notification',
    body: 'Push notifications are working on this device.',
    url: '/dashboard',
    tag: 'push-test',
  })

  if (sent === 0) {
    return NextResponse.json({ error: 'No active push subscription found for this user' }, { status: 400 })
  }

  return NextResponse.json({ ok: true, sent })
}
