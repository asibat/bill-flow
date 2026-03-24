import { NextResponse } from 'next/server'
import { getPublicVapidKey, isPushConfigured } from '@/lib/push/server'

export async function GET() {
  if (!isPushConfigured()) {
    return NextResponse.json({ error: 'Push is not configured' }, { status: 503 })
  }

  return NextResponse.json({ publicKey: getPublicVapidKey() })
}
