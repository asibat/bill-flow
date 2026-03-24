'use client'

import { useEffect, useState } from 'react'
import { urlBase64ToUint8Array } from '@/lib/push/client'

type SupportState = 'checking' | 'unsupported' | 'ready'
type SubscriptionState = 'checking' | 'inactive' | 'active'

export default function PushNotificationSettings({
  pushEnabled,
}: {
  pushEnabled: boolean
}) {
  const [supportState, setSupportState] = useState<SupportState>('checking')
  const [subscriptionState, setSubscriptionState] = useState<SubscriptionState>('checking')
  const [permission, setPermission] = useState<NotificationPermission | 'unsupported'>('default')
  const [busy, setBusy] = useState(false)
  const [message, setMessage] = useState<string | null>(null)
  const [error, setError] = useState<string | null>(null)

  useEffect(() => {
    async function check() {
      if (
        typeof window === 'undefined' ||
        !window.isSecureContext ||
        !('serviceWorker' in navigator) ||
        !('PushManager' in window) ||
        !('Notification' in window)
      ) {
        setSupportState('unsupported')
        setPermission('unsupported')
        setSubscriptionState('inactive')
        return
      }

      setSupportState('ready')
      setPermission(Notification.permission)
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      setSubscriptionState(subscription ? 'active' : 'inactive')
    }

    void check()
  }, [])

  async function enablePush() {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const permissionResult = await Notification.requestPermission()
      setPermission(permissionResult)

      if (permissionResult !== 'granted') {
        throw new Error('Browser notification permission was not granted.')
      }

      const keyRes = await fetch('/api/push/public-key')
      const keyBody = await keyRes.json()
      if (!keyRes.ok) throw new Error(keyBody.error || 'Failed to fetch public key')

      const existing = await registration.pushManager.getSubscription()
      const subscription = existing ?? await registration.pushManager.subscribe({
        userVisibleOnly: true,
        applicationServerKey: urlBase64ToUint8Array(keyBody.publicKey) as BufferSource,
      })

      const subscribeRes = await fetch('/api/push/subscribe', {
        method: 'POST',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ subscription }),
      })
      const subscribeBody = await subscribeRes.json().catch(() => ({}))
      if (!subscribeRes.ok) throw new Error(subscribeBody.error || 'Failed to save subscription')

      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_notifications: true }),
      })

      setSubscriptionState('active')
      setMessage(pushEnabled ? 'Push notifications updated.' : 'Push notifications enabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to enable push notifications')
    } finally {
      setBusy(false)
    }
  }

  async function disablePush() {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      const registration = await navigator.serviceWorker.register('/sw.js')
      const subscription = await registration.pushManager.getSubscription()
      const endpoint = subscription?.endpoint ?? null

      if (subscription) await subscription.unsubscribe()

      await fetch('/api/push/subscribe', {
        method: 'DELETE',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ endpoint }),
      })
      await fetch('/api/settings', {
        method: 'PATCH',
        headers: { 'Content-Type': 'application/json' },
        body: JSON.stringify({ push_notifications: false }),
      })

      setSubscriptionState('inactive')
      setMessage('Push notifications disabled.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to disable push notifications')
    } finally {
      setBusy(false)
    }
  }

  async function sendTest() {
    setBusy(true)
    setMessage(null)
    setError(null)

    try {
      const res = await fetch('/api/push/test', { method: 'POST' })
      const body = await res.json().catch(() => ({}))
      if (!res.ok) throw new Error(body.error || 'Failed to send test notification')
      setMessage('Test push sent. Check this device.')
    } catch (err) {
      setError(err instanceof Error ? err.message : 'Failed to send test push')
    } finally {
      setBusy(false)
    }
  }

  if (supportState === 'unsupported') {
    return (
      <div className="rounded-lg border border-amber-200 bg-amber-50 p-4 text-sm text-amber-800">
        Push notifications are not available in this browser. Use email reminders as fallback.
      </div>
    )
  }

  return (
    <div className="space-y-3 rounded-lg border border-gray-200 p-4">
      <div>
        <p className="text-sm font-medium text-gray-900">Phone notifications</p>
        <p className="text-xs text-gray-500 mt-1">
          Enable browser push after installing BillFlow to your home screen.
        </p>
      </div>

      <div className="text-xs text-gray-500 space-y-1">
        <p>Permission: {permission}</p>
        <p>Subscription: {subscriptionState === 'active' ? 'connected' : subscriptionState === 'inactive' ? 'not connected' : 'checking'}</p>
      </div>

      {error && <div className="rounded-lg border border-red-200 bg-red-50 p-3 text-sm text-red-700">{error}</div>}
      {message && <div className="rounded-lg border border-green-200 bg-green-50 p-3 text-sm text-green-700">{message}</div>}

      <div className="flex flex-wrap gap-3">
        <button onClick={enablePush} disabled={busy} className="btn-primary">
          {busy ? 'Working...' : subscriptionState === 'active' ? 'Refresh Push Setup' : 'Enable Push'}
        </button>
        <button onClick={sendTest} disabled={busy || subscriptionState !== 'active'} className="btn-secondary">
          Send Test Push
        </button>
        <button onClick={disablePush} disabled={busy || subscriptionState !== 'active'} className="btn-secondary">
          Disable Push
        </button>
      </div>
    </div>
  )
}
