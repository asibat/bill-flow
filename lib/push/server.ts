import webpush, { type PushSubscription } from 'web-push'
import type { SupabaseClient } from '@supabase/supabase-js'

let vapidConfigured = false

function ensureVapidConfigured() {
  if (vapidConfigured) return

  const publicKey = process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
  const privateKey = process.env.VAPID_PRIVATE_KEY
  const subject = process.env.VAPID_SUBJECT ?? 'mailto:hello@billflow.app'

  if (!publicKey || !privateKey) {
    throw new Error('Web push is not configured. Set NEXT_PUBLIC_VAPID_PUBLIC_KEY and VAPID_PRIVATE_KEY.')
  }

  webpush.setVapidDetails(subject, publicKey, privateKey)
  vapidConfigured = true
}

export function isPushConfigured(): boolean {
  return !!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY && !!process.env.VAPID_PRIVATE_KEY
}

export function getPublicVapidKey(): string {
  if (!process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY) {
    throw new Error('NEXT_PUBLIC_VAPID_PUBLIC_KEY is not configured')
  }
  return process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY
}

interface StoredPushSubscription {
  id: string
  endpoint: string
  p256dh: string
  auth: string
}

export async function sendPushToUserSubscriptions(
  supabase: SupabaseClient,
  userId: string,
  payload: { title: string; body: string; url?: string; tag?: string }
): Promise<number> {
  if (!isPushConfigured()) return 0

  ensureVapidConfigured()

  const { data: subscriptions } = await supabase
    .from('push_subscriptions')
    .select('id, endpoint, p256dh, auth')
    .eq('user_id', userId)

  if (!subscriptions || subscriptions.length === 0) return 0

  let sent = 0

  for (const subscription of subscriptions as StoredPushSubscription[]) {
    const pushSubscription: PushSubscription = {
      endpoint: subscription.endpoint,
      keys: {
        p256dh: subscription.p256dh,
        auth: subscription.auth,
      },
    }

    try {
      await webpush.sendNotification(pushSubscription, JSON.stringify(payload))
      sent++
    } catch (error) {
      const statusCode = typeof error === 'object' && error !== null && 'statusCode' in error
        ? Number((error as { statusCode?: number }).statusCode)
        : null

      if (statusCode === 404 || statusCode === 410) {
        await supabase
          .from('push_subscriptions')
          .delete()
          .eq('id', subscription.id)
          .eq('user_id', userId)
      } else {
        console.error('[push] Send failed:', error)
      }
    }
  }

  return sent
}
