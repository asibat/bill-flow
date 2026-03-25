import { NextResponse } from 'next/server'
import { getEnvHealthSummary } from '@/lib/env'

export async function GET() {
  const summary = getEnvHealthSummary()

  return NextResponse.json(
    {
      status: summary.ready ? 'ok' : 'degraded',
      checks: summary.checks.map(check => ({
        name: check.name,
        ok: check.ok,
        required: check.required,
      })),
      missingRequired: summary.missingRequired,
      missingOptional: summary.missingOptional,
    },
    { status: summary.ready ? 200 : 503 }
  )
}
