'use client'

import { useState } from 'react'
import type { ExtractionResult } from '@/types'

interface ExtractionComparisonProps {
  directExtraction: ExtractionResult
  redactedExtraction: ExtractionResult
  ocrConfidence: number
  onSelect: (extraction: ExtractionResult, source: 'direct' | 'redacted' | 'merged') => void
}

const FIELD_LABELS: Record<string, string> = {
  payee_name: 'Payee',
  amount: 'Amount',
  currency: 'Currency',
  due_date: 'Due Date',
  structured_comm: 'Structured Comm',
  iban: 'IBAN',
  bic: 'BIC',
  explanation: 'Explanation',
}

const COMPARABLE_FIELDS = ['payee_name', 'amount', 'currency', 'due_date', 'structured_comm', 'iban', 'bic'] as const

export function ExtractionComparison({
  directExtraction,
  redactedExtraction,
  ocrConfidence,
  onSelect,
}: ExtractionComparisonProps) {
  const [mergedFields, setMergedFields] = useState<Record<string, 'direct' | 'redacted'>>(() => {
    // Default: prefer redacted (privacy-first) unless field is empty
    const defaults: Record<string, 'direct' | 'redacted'> = {}
    for (const field of COMPARABLE_FIELDS) {
      const redactedVal = redactedExtraction[field]
      const directVal = directExtraction[field]
      // Use redacted if it has a value, otherwise fall back to direct
      defaults[field] = (redactedVal != null && redactedVal !== '') ? 'redacted' : (directVal != null && directVal !== '') ? 'direct' : 'redacted'
    }
    return defaults
  })

  function toggleField(field: string) {
    setMergedFields(prev => ({
      ...prev,
      [field]: prev[field] === 'direct' ? 'redacted' : 'direct',
    }))
  }

  function selectAll(source: 'direct' | 'redacted') {
    const updated: Record<string, 'direct' | 'redacted'> = {}
    for (const field of COMPARABLE_FIELDS) {
      updated[field] = source
    }
    setMergedFields(updated)
  }

  function handleMergedSelect() {
    const merged: Record<string, unknown> = { ...redactedExtraction }
    for (const field of COMPARABLE_FIELDS) {
      if (mergedFields[field] === 'direct') {
        merged[field] = directExtraction[field]
      } else {
        merged[field] = redactedExtraction[field]
      }
    }
    // Use the higher confidence
    merged.confidence = Math.max(directExtraction.confidence, redactedExtraction.confidence)
    onSelect(merged as ExtractionResult, 'merged')
  }

  const confidenceDelta = directExtraction.confidence - redactedExtraction.confidence

  function formatValue(val: unknown): string {
    if (val == null || val === '') return '—'
    if (typeof val === 'number') return val.toString()
    return String(val)
  }

  function fieldsDiffer(field: string): boolean {
    const a = formatValue(directExtraction[field as keyof ExtractionResult])
    const b = formatValue(redactedExtraction[field as keyof ExtractionResult])
    return a !== b
  }

  return (
    <div className="space-y-4">
      {/* Warning banner */}
      <div className="bg-amber-50 border border-amber-200 rounded-xl p-4">
        <p className="text-sm font-semibold text-amber-800">Accuracy Comparison</p>
        <p className="text-sm text-amber-700 mt-1">
          OCR confidence was <strong>{Math.round(ocrConfidence)}%</strong> (below 80% threshold).
          The redacted extraction may be less accurate. Compare both results below and pick the best fields.
        </p>
        {confidenceDelta > 0.1 && (
          <p className="text-xs text-amber-600 mt-2">
            Direct extraction confidence: {Math.round(directExtraction.confidence * 100)}% vs
            Redacted: {Math.round(redactedExtraction.confidence * 100)}%
            (delta: {Math.round(confidenceDelta * 100)}%)
          </p>
        )}
      </div>

      {/* Comparison table */}
      <div className="card overflow-hidden">
        <div className="grid grid-cols-[140px_1fr_40px_1fr] gap-0 text-sm">
          {/* Header */}
          <div className="p-3 bg-gray-50 font-semibold text-gray-600 text-xs uppercase tracking-wide">Field</div>
          <div className="p-3 bg-green-50 font-semibold text-green-700 text-xs uppercase tracking-wide flex items-center justify-between">
            <span>Privacy-First (Redacted)</span>
            <button onClick={() => selectAll('redacted')} className="text-green-600 hover:underline normal-case font-normal">Use all</button>
          </div>
          <div className="p-3 bg-gray-50" />
          <div className="p-3 bg-blue-50 font-semibold text-blue-700 text-xs uppercase tracking-wide flex items-center justify-between">
            <span>Direct (Full Image)</span>
            <button onClick={() => selectAll('direct')} className="text-blue-600 hover:underline normal-case font-normal">Use all</button>
          </div>

          {/* Rows */}
          {COMPARABLE_FIELDS.map(field => {
            const directVal = formatValue(directExtraction[field])
            const redactedVal = formatValue(redactedExtraction[field])
            const differs = fieldsDiffer(field)
            const selected = mergedFields[field]

            return (
              <div key={field} className="contents" onClick={() => toggleField(field)}>
                <div className={`p-3 border-t text-xs font-medium text-gray-600 flex items-center ${differs ? 'bg-amber-50' : ''}`}>
                  {FIELD_LABELS[field] || field}
                  {differs && <span className="ml-1 text-amber-500">*</span>}
                </div>
                <div
                  className={`p-3 border-t cursor-pointer transition-colors ${
                    selected === 'redacted'
                      ? 'bg-green-50 ring-2 ring-inset ring-green-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-mono text-xs ${redactedVal === '—' ? 'text-gray-300' : 'text-gray-800'}`}>
                    {redactedVal}
                  </span>
                </div>
                <div className="p-3 border-t flex items-center justify-center text-gray-300">
                  {differs ? 'vs' : '='}
                </div>
                <div
                  className={`p-3 border-t cursor-pointer transition-colors ${
                    selected === 'direct'
                      ? 'bg-blue-50 ring-2 ring-inset ring-blue-400'
                      : 'hover:bg-gray-50'
                  }`}
                >
                  <span className={`font-mono text-xs ${directVal === '—' ? 'text-gray-300' : 'text-gray-800'}`}>
                    {directVal}
                  </span>
                </div>
              </div>
            )
          })}
        </div>
      </div>

      <p className="text-xs text-gray-400">Click a cell to select that value. Fields marked with * differ between the two extractions.</p>

      {/* Actions */}
      <div className="flex gap-3">
        <button onClick={handleMergedSelect} className="btn-primary">
          Use Selected Fields
        </button>
        <button onClick={() => onSelect(redactedExtraction, 'redacted')} className="btn-secondary">
          Use All Redacted
        </button>
        <button onClick={() => onSelect(directExtraction, 'direct')} className="btn-secondary">
          Use All Direct
        </button>
      </div>
    </div>
  )
}
