'use client'

interface ExtractionBannerProps {
  confidence: number
  reextracting: boolean
  onReextract: () => void
  onReupload: () => void
}

export function ExtractionBanner({ confidence, reextracting, onReextract, onReupload }: ExtractionBannerProps) {
  const isLowConfidence = confidence < 0.7

  return (
    <div className={`border rounded-xl p-4 ${isLowConfidence ? 'bg-amber-50 border-amber-200' : 'bg-green-50 border-green-200'}`}>
      <div className="flex items-center justify-between">
        <div>
          <p className={`text-sm font-semibold ${isLowConfidence ? 'text-amber-700' : 'text-green-700'}`}>
            {isLowConfidence ? '⚠️ Low confidence extraction' : '✅ Extracted — please review and confirm'}
          </p>
          <p className={`text-xs mt-1 ${isLowConfidence ? 'text-amber-600' : 'text-green-600'}`}>
            Confidence: {Math.round(confidence * 100)}%
            {isLowConfidence && ' · Please double-check the fields below'}
          </p>
        </div>
        <div className="flex gap-2">
          <button
            onClick={onReextract}
            disabled={reextracting}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            {reextracting ? 'Re-extracting…' : '🔄 Re-extract'}
          </button>
          <button
            onClick={onReupload}
            className="text-xs px-3 py-1.5 rounded-lg border border-gray-300 bg-white hover:bg-gray-50 text-gray-700 font-medium"
          >
            📎 Re-upload
          </button>
        </div>
      </div>
    </div>
  )
}
