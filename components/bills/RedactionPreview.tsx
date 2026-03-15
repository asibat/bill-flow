'use client'

import { useState } from 'react'

interface PiiMatch {
  type: string
  value: string
  start: number
  end: number
  replacement: string
}

interface RedactionPreviewProps {
  text: string
  piiMatches: PiiMatch[]
  ocrConfidence: number
  onApprove: (redactedText: string) => void
  onSkip: () => void
  loading?: boolean
}

const TYPE_LABELS: Record<string, string> = {
  national_number: 'National Number',
  phone: 'Phone',
  email: 'Email',
  address: 'Address',
  name_header: 'Name',
}

const TYPE_COLORS: Record<string, string> = {
  national_number: 'bg-red-200 text-red-900',
  phone: 'bg-orange-200 text-orange-900',
  email: 'bg-purple-200 text-purple-900',
  address: 'bg-blue-200 text-blue-900',
  name_header: 'bg-pink-200 text-pink-900',
}

export function RedactionPreview({
  text,
  piiMatches,
  ocrConfidence,
  onApprove,
  onSkip,
  loading,
}: RedactionPreviewProps) {
  const [selected, setSelected] = useState<Set<number>>(() => new Set(piiMatches.map((_, i) => i)))

  function toggleMatch(index: number) {
    setSelected(prev => {
      const next = new Set(prev)
      if (next.has(index)) next.delete(index)
      else next.add(index)
      return next
    })
  }

  function selectAll() {
    setSelected(new Set(piiMatches.map((_, i) => i)))
  }

  function selectNone() {
    setSelected(new Set())
  }

  function handleApprove() {
    // Apply redactions from end to start
    let result = text
    const toRedact = piiMatches
      .map((m, i) => ({ ...m, index: i }))
      .filter(m => selected.has(m.index))
      .sort((a, b) => b.start - a.start)

    for (const m of toRedact) {
      result = result.slice(0, m.start) + m.replacement + result.slice(m.end)
    }
    onApprove(result)
  }

  // Build highlighted text preview
  function renderHighlightedText() {
    const parts: Array<{ text: string; matchIndex?: number }> = []
    let lastEnd = 0

    for (let i = 0; i < piiMatches.length; i++) {
      const m = piiMatches[i]
      if (m.start > lastEnd) {
        parts.push({ text: text.slice(lastEnd, m.start) })
      }
      parts.push({ text: m.value, matchIndex: i })
      lastEnd = m.end
    }
    if (lastEnd < text.length) {
      parts.push({ text: text.slice(lastEnd) })
    }

    return parts.map((part, i) => {
      if (part.matchIndex === undefined) {
        return <span key={i}>{part.text}</span>
      }
      const match = piiMatches[part.matchIndex]
      const isSelected = selected.has(part.matchIndex)
      return (
        <span
          key={i}
          onClick={() => toggleMatch(part.matchIndex!)}
          className={`cursor-pointer rounded px-0.5 transition-all ${
            isSelected
              ? `${TYPE_COLORS[match.type] || 'bg-gray-200'} line-through opacity-80`
              : 'bg-yellow-100 underline'
          }`}
          title={`${TYPE_LABELS[match.type] || match.type}: click to ${isSelected ? 'keep' : 'redact'}`}
        >
          {isSelected ? match.replacement : part.text}
        </span>
      )
    })
  }

  return (
    <div className="space-y-4">
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800">Privacy Review</p>
        <p className="text-sm text-amber-700 mt-1">
          We found <strong>{piiMatches.length}</strong> potential personal detail{piiMatches.length !== 1 ? 's' : ''} in this document.
          Review what gets redacted before sending to AI for extraction.
        </p>
        <p className="text-xs text-amber-500 mt-1">OCR confidence: {Math.round(ocrConfidence)}%</p>
      </div>

      {/* PII match list */}
      {piiMatches.length > 0 && (
        <div className="card p-4">
          <div className="flex items-center justify-between mb-3">
            <h3 className="text-sm font-semibold text-gray-700">Detected Personal Information</h3>
            <div className="flex gap-2">
              <button onClick={selectAll} className="text-xs text-brand-600 hover:underline">Redact all</button>
              <button onClick={selectNone} className="text-xs text-gray-500 hover:underline">Keep all</button>
            </div>
          </div>
          <div className="space-y-2">
            {piiMatches.map((match, i) => (
              <label key={i} className="flex items-center gap-3 p-2 rounded hover:bg-gray-50 cursor-pointer">
                <input
                  type="checkbox"
                  checked={selected.has(i)}
                  onChange={() => toggleMatch(i)}
                  className="rounded border-gray-300"
                />
                <span className={`text-xs px-2 py-0.5 rounded-full font-medium ${TYPE_COLORS[match.type] || 'bg-gray-100'}`}>
                  {TYPE_LABELS[match.type] || match.type}
                </span>
                <span className="text-sm font-mono text-gray-700 truncate">{match.value}</span>
              </label>
            ))}
          </div>
        </div>
      )}

      {/* Text preview with highlights */}
      <div className="card p-4">
        <h3 className="text-sm font-semibold text-gray-700 mb-2">Text Preview</h3>
        <p className="text-xs text-gray-400 mb-2">Click highlighted items to toggle redaction</p>
        <div className="bg-gray-50 rounded-lg p-4 text-sm font-mono whitespace-pre-wrap leading-relaxed max-h-64 overflow-y-auto">
          {renderHighlightedText()}
        </div>
      </div>

      {/* Actions */}
      <div className="flex gap-3">
        <button
          onClick={handleApprove}
          disabled={loading}
          className="btn-primary"
        >
          {loading ? 'Extracting...' : `Approve & Extract (${selected.size} redacted)`}
        </button>
        <button onClick={onSkip} className="btn-secondary">
          Skip Redaction
        </button>
      </div>
    </div>
  )
}
