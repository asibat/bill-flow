type EnvCheck = {
  name: string
  ok: boolean
  required: boolean
}

function isTruthy(value: string | undefined) {
  return typeof value === 'string' && value.trim().length > 0
}

function getExtractionKeyStatus(provider: string | undefined): EnvCheck[] {
  if (provider === 'claude') {
    return [{ name: 'ANTHROPIC_API_KEY', ok: isTruthy(process.env.ANTHROPIC_API_KEY), required: true }]
  }

  return [{ name: 'GEMINI_API_KEY', ok: isTruthy(process.env.GEMINI_API_KEY), required: true }]
}

export function getEnvChecks() {
  const provider = process.env.EXTRACTION_PROVIDER ?? 'gemini'

  const checks: EnvCheck[] = [
    { name: 'NEXT_PUBLIC_SUPABASE_URL', ok: isTruthy(process.env.NEXT_PUBLIC_SUPABASE_URL), required: true },
    { name: 'NEXT_PUBLIC_SUPABASE_ANON_KEY', ok: isTruthy(process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY), required: true },
    { name: 'SUPABASE_SERVICE_ROLE_KEY', ok: isTruthy(process.env.SUPABASE_SERVICE_ROLE_KEY), required: true },
    { name: 'EXTRACTION_PROVIDER', ok: provider === 'gemini' || provider === 'claude', required: true },
    ...getExtractionKeyStatus(provider),
    { name: 'NEXT_PUBLIC_APP_URL', ok: isTruthy(process.env.NEXT_PUBLIC_APP_URL), required: true },
    { name: 'CRON_SECRET', ok: isTruthy(process.env.CRON_SECRET), required: true },
    { name: 'RESEND_API_KEY', ok: isTruthy(process.env.RESEND_API_KEY), required: false },
    { name: 'RESEND_WEBHOOK_SECRET', ok: isTruthy(process.env.RESEND_WEBHOOK_SECRET), required: false },
    { name: 'EMAIL_FROM_ADDRESS', ok: isTruthy(process.env.EMAIL_FROM_ADDRESS), required: false },
    { name: 'NEXT_PUBLIC_VAPID_PUBLIC_KEY', ok: isTruthy(process.env.NEXT_PUBLIC_VAPID_PUBLIC_KEY), required: false },
    { name: 'VAPID_PRIVATE_KEY', ok: isTruthy(process.env.VAPID_PRIVATE_KEY), required: false },
  ]

  return checks
}

export function getEnvHealthSummary() {
  const checks = getEnvChecks()
  const missingRequired = checks.filter(check => check.required && !check.ok).map(check => check.name)
  const missingOptional = checks.filter(check => !check.required && !check.ok).map(check => check.name)

  return {
    ready: missingRequired.length === 0,
    missingRequired,
    missingOptional,
    checks,
  }
}

export function assertProductionEnv() {
  if (process.env.NODE_ENV !== 'production') return

  const summary = getEnvHealthSummary()
  if (summary.ready) return

  throw new Error(`Missing required environment variables: ${summary.missingRequired.join(', ')}`)
}
