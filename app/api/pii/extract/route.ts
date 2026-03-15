import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient } from '@/lib/supabase/server'
import { extractFromText } from '@/lib/extraction'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'

/**
 * POST /api/pii/extract
 * Accepts user-approved redacted text and runs AI extraction on it.
 * The AI never sees the original document — only the redacted text.
 */
export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { redactedText, storagePath } = await request.json()
  if (!redactedText) return NextResponse.json({ error: 'No redacted text provided' }, { status: 400 })

  const extractionResponse = await extractFromText(redactedText, user.id)
  const extraction = extractionResponse.result

  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
    structuredCommValid = validateStructuredComm(extraction.structured_comm)
  }

  const serviceClient = supabase
  const vendor = await matchOrCreateVendor(serviceClient, user.id, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  return NextResponse.json({
    extraction,
    structured_comm_valid: structuredCommValid,
    storage_path: storagePath || '',
    needs_review: extraction.confidence < 0.8,
    extraction_log_id: extractionResponse.logId,
    vendor: vendor ? {
      payee_id: vendor.payee_id,
      payee_name: vendor.payee_name,
      category: vendor.category,
      is_new: vendor.is_new,
    } : null,
  })
}
