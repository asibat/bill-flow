/**
 * HTTP client for the PII microservice (Python/FastAPI).
 * Replaces local tesseract.js OCR + regex PII detection.
 */

const PII_SERVICE_URL = process.env.PII_SERVICE_URL ?? 'http://localhost:8000'

export interface PiiMatch {
  type: string
  value: string
  start: number
  end: number
  replacement: string
}

export interface ScanResult {
  text: string
  ocr_confidence: number
  language: string
  pii_matches: PiiMatch[]
  match_count: number
}

/**
 * Send a file to the PII service for OCR + PII detection.
 */
export async function scanFile(buffer: Buffer, filename: string): Promise<ScanResult> {
  const form = new FormData()
  form.append('file', new Blob([new Uint8Array(buffer)]), filename)

  const res = await fetch(`${PII_SERVICE_URL}/scan`, {
    method: 'POST',
    body: form,
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `PII service error (${res.status})`)
  }

  return res.json()
}

/**
 * Send text + PII matches to the service for redaction.
 */
export async function redactText(
  text: string,
  piiMatches: PiiMatch[],
  approvedIndices?: number[]
): Promise<string> {
  const res = await fetch(`${PII_SERVICE_URL}/redact`, {
    method: 'POST',
    headers: { 'Content-Type': 'application/json' },
    body: JSON.stringify({
      text,
      pii_matches: piiMatches,
      approved_indices: approvedIndices ?? null,
    }),
  })

  if (!res.ok) {
    const body = await res.json().catch(() => ({}))
    throw new Error(body.detail ?? `PII service error (${res.status})`)
  }

  const data = await res.json()
  return data.redacted_text
}
