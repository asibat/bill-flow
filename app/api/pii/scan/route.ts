import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractText } from '@/lib/pii/ocr'
import { detectPii } from '@/lib/pii/detect'

/**
 * POST /api/pii/scan
 * Accepts a file upload, runs OCR locally, detects PII,
 * and returns the text + PII matches for user review.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)

  try {
    // OCR: extract text locally (no external API)
    const ocrResult = await extractText(buffer)

    // Detect PII in extracted text
    const piiMatches = detectPii(ocrResult.text)

    return NextResponse.json({
      text: ocrResult.text,
      ocrConfidence: ocrResult.confidence,
      piiMatches,
      matchCount: piiMatches.length,
    })
  } catch (err) {
    console.error('PII scan failed:', err)
    return NextResponse.json({ error: 'OCR/PII scan failed' }, { status: 500 })
  }
}
