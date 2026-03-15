import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { extractFromImage, extractFromDocument } from '@/lib/extraction'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const { storage_path } = await request.json()
  if (!storage_path) return NextResponse.json({ error: 'No storage_path provided' }, { status: 400 })

  // Verify the file belongs to this user
  if (!storage_path.startsWith(user.id + '/')) {
    return NextResponse.json({ error: 'Unauthorized' }, { status: 403 })
  }

  const serviceClient = createServiceClient()

  // Download the file from storage
  const { data: fileData, error: downloadError } = await serviceClient.storage
    .from('bill-documents')
    .download(storage_path)

  if (downloadError || !fileData) {
    console.error('[reextract] Download error:', downloadError)
    return NextResponse.json({ error: 'File not found in storage' }, { status: 404 })
  }

  const buffer = Buffer.from(await fileData.arrayBuffer())
  const isPdf = storage_path.endsWith('.pdf')
  const mimeType = isPdf ? 'application/pdf'
    : storage_path.endsWith('.png') ? 'image/png'
    : storage_path.endsWith('.webp') ? 'image/webp'
    : 'image/jpeg'

  console.log('[reextract] Re-extracting from storage:', storage_path, 'mimeType:', mimeType)

  const base64 = buffer.toString('base64')
  const extractionResponse = isPdf
    ? await extractFromDocument(base64, mimeType, user.id)
    : await extractFromImage(base64, mimeType, user.id)
  const extraction = extractionResponse.result

  // Validate structured comm
  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
    structuredCommValid = validateStructuredComm(extraction.structured_comm)
  }

  // Match or create vendor
  const vendor = await matchOrCreateVendor(serviceClient, user.id, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  return NextResponse.json({
    extraction,
    structured_comm_valid: structuredCommValid,
    storage_path,
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
