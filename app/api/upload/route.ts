import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { extractFromImage, extractFromDocument } from '@/lib/extraction'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'

export async function POST(request: NextRequest) {
  const supabase = createServerSupabaseClient()
  const { data: { user } } = await supabase.auth.getUser()
  if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })

  const formData = await request.formData()
  const file = formData.get('file') as File | null
  if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

  const bytes = await file.arrayBuffer()
  const buffer = Buffer.from(bytes)
  const mimeType = file.type

  // Store the file in Supabase Storage
  const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg'
  const storagePath = `${user.id}/${Date.now()}-upload.${ext}`
  const serviceClient = createServiceClient()
  
  const { error: storageError } = await serviceClient.storage
    .from('bill-documents')
    .upload(storagePath, buffer, { contentType: mimeType })

  if (storageError) {
    console.error('Storage error:', storageError)
    return NextResponse.json({ error: 'File storage failed' }, { status: 500 })
  }

  // Extract bill details from document
  const base64 = buffer.toString('base64')
  let extractionResponse
  if (mimeType.includes('pdf')) {
    extractionResponse = await extractFromDocument(base64, 'application/pdf', user.id)
  } else {
    const validMime = mimeType.includes('png') ? 'image/png' :
                      mimeType.includes('webp') ? 'image/webp' : 'image/jpeg'
    extractionResponse = await extractFromImage(base64, validMime, user.id)
  }

  const extraction = extractionResponse.result

  // Validate structured comm
  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
    structuredCommValid = validateStructuredComm(extraction.structured_comm)
  }

  // Match or create vendor by IBAN
  const vendor = await matchOrCreateVendor(serviceClient, user.id, extraction)

  // If vendor matched, backfill BIC from vendor if extraction missed it
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  // Return extraction for user review — don't auto-save uploads
  return NextResponse.json({
    extraction,
    structured_comm_valid: structuredCommValid,
    storage_path: storagePath,
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
