'use client'

import type { VendorMatch } from '@/types'

interface VendorMatchBannerProps {
  vendor: VendorMatch
}

export function VendorMatchBanner({ vendor }: VendorMatchBannerProps) {
  if (vendor.is_new) return null

  return (
    <div className="bg-blue-50 border border-blue-200 rounded-xl p-3">
      <p className="text-xs text-blue-700">
        🏢 Matched vendor: <span className="font-semibold">{vendor.payee_name}</span>
        <span className="text-blue-500 ml-1">({vendor.category})</span>
      </p>
    </div>
  )
}
