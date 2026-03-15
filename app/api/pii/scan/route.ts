import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { scanFile } from '@/lib/pii/client'

export const runtime = 'nodejs'
export const maxDuration = 30

/**
 * POST /api/pii/scan
 * Accepts a file upload, proxies to the PII microservice for OCR + PII detection.
 * Auth boundary stays here — the Python service trusts the caller.
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
    const result = await scanFile(buffer, file.name)

    return NextResponse.json({
      text: result.text,
      ocrConfidence: result.ocr_confidence,
      piiMatches: result.pii_matches,
      matchCount: result.match_count,
    })
  } catch (err) {
    console.error('PII scan failed:', err)
    return NextResponse.json({ error: 'OCR/PII scan failed' }, { status: 500 })
  }
}
