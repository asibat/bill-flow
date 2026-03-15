/**
 * Tests for feature flag system.
 */

import { isFeatureEnabled, getFeatureFlags } from '@/lib/features'

describe('isFeatureEnabled()', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns false for unknown flags with no env var', () => {
    expect(isFeatureEnabled('NONEXISTENT_FLAG')).toBe(false)
  })

  it('returns default value for DASHBOARD_ANALYTICS (false)', () => {
    delete process.env.FEATURE_DASHBOARD_ANALYTICS
    expect(isFeatureEnabled('DASHBOARD_ANALYTICS')).toBe(false)
  })

  it('returns true when env var is "true"', () => {
    process.env.FEATURE_DASHBOARD_ANALYTICS = 'true'
    expect(isFeatureEnabled('DASHBOARD_ANALYTICS')).toBe(true)
  })

  it('returns true when env var is "1"', () => {
    process.env.FEATURE_DASHBOARD_ANALYTICS = '1'
    expect(isFeatureEnabled('DASHBOARD_ANALYTICS')).toBe(true)
  })

  it('returns false when env var is "false"', () => {
    process.env.FEATURE_DASHBOARD_ANALYTICS = 'false'
    expect(isFeatureEnabled('DASHBOARD_ANALYTICS')).toBe(false)
  })

  it('returns false when env var is empty string', () => {
    process.env.FEATURE_DASHBOARD_ANALYTICS = ''
    expect(isFeatureEnabled('DASHBOARD_ANALYTICS')).toBe(false)
  })
})

describe('getFeatureFlags()', () => {
  const originalEnv = process.env

  beforeEach(() => {
    process.env = { ...originalEnv }
  })

  afterAll(() => {
    process.env = originalEnv
  })

  it('returns multiple flags at once', () => {
    process.env.FEATURE_DASHBOARD_ANALYTICS = 'true'
    const flags = getFeatureFlags(['DASHBOARD_ANALYTICS', 'NONEXISTENT'])
    expect(flags.DASHBOARD_ANALYTICS).toBe(true)
    expect(flags.NONEXISTENT).toBe(false)
  })

  it('returns empty object for empty array', () => {
    expect(getFeatureFlags([])).toEqual({})
  })
})
