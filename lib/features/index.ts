/**
 * Feature flags.
 *
 * Server-side: reads from env vars (FEATURE_<NAME>=true|false).
 * Per-user overrides can be added later via a `user_features` table.
 */

const FEATURE_DEFAULTS: Record<string, boolean> = {
  DASHBOARD_ANALYTICS: false,
  SPENDING_ANALYSIS: false,
}

/**
 * Check if a feature is enabled globally (env var).
 * Env var format: FEATURE_DASHBOARD_ANALYTICS=true
 */
export function isFeatureEnabled(feature: string): boolean {
  const envKey = `FEATURE_${feature}`
  const envVal = process.env[envKey]
  if (envVal !== undefined) return envVal === 'true' || envVal === '1'
  return FEATURE_DEFAULTS[feature] ?? false
}

/** Convenience: check multiple flags at once */
export function getFeatureFlags(features: string[]): Record<string, boolean> {
  const result: Record<string, boolean> = {}
  for (const f of features) {
    result[f] = isFeatureEnabled(f)
  }
  return result
}
