import { NextRequest, NextResponse } from 'next/server'
import { createServerSupabaseClient, createServiceClient } from '@/lib/supabase/server'
import { extractFromImage, extractFromDocument } from '@/lib/extraction'
import { validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'

export async function POST(request: NextRequest) {
  try {
    const supabase = createServerSupabaseClient()
    const { data: { user } } = await supabase.auth.getUser()
    if (!user) return NextResponse.json({ error: 'Unauthorized' }, { status: 401 })
    const { data: settings } = await supabase
      .from('user_settings')
      .select('preferred_language')
      .eq('user_id', user.id)
      .single()
    const explanationLanguage = settings?.preferred_language ?? 'en'

    const formData = await request.formData()
    const file = formData.get('file') as File | null
    if (!file) return NextResponse.json({ error: 'No file provided' }, { status: 400 })

    const bytes = await file.arrayBuffer()
    const buffer = Buffer.from(bytes)
    const mimeType = file.type

    console.info('[upload] received file', {
      userId: user.id,
      mimeType,
      size: buffer.length,
    })

    const ext = mimeType.includes('pdf') ? 'pdf' : mimeType.includes('png') ? 'png' : 'jpg'
    const storagePath = `${user.id}/${Date.now()}-upload.${ext}`
    const serviceClient = createServiceClient()

    const { error: storageError } = await serviceClient.storage
      .from('bill-documents')
      .upload(storagePath, buffer, { contentType: mimeType })

    if (storageError) {
      console.error('[upload] storage failed', {
        userId: user.id,
        storagePath,
        message: storageError.message,
      })
      return NextResponse.json({ error: 'File storage failed' }, { status: 500 })
    }

    const base64 = buffer.toString('base64')
    const extractionResponse = mimeType.includes('pdf')
      ? await extractFromDocument(base64, 'application/pdf', user.id, { explanationLanguage })
      : await extractFromImage(
          base64,
          mimeType.includes('png') ? 'image/png' : mimeType.includes('webp') ? 'image/webp' : 'image/jpeg',
          user.id,
          { explanationLanguage }
        )

    const extraction = extractionResponse.result

    let structuredCommValid: boolean | null = null
    if (extraction.structured_comm) {
      extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
      structuredCommValid = validateStructuredComm(extraction.structured_comm)
    }

    const vendor = await matchOrCreateVendor(serviceClient, user.id, extraction)
    if (vendor && !extraction.bic && vendor.bic) {
      extraction.bic = vendor.bic
    }

    console.info('[upload] extraction complete', {
      userId: user.id,
      storagePath,
      confidence: extraction.confidence,
      needsReview: extraction.confidence < 0.8,
      ingestionMethod: mimeType.includes('pdf') ? 'upload_pdf' : 'upload_image',
    })

    return NextResponse.json({
      extraction,
      structured_comm_valid: structuredCommValid,
      storage_path: storagePath,
      ingestion_method: mimeType.includes('pdf') ? 'upload_pdf' : 'upload_image',
      needs_review: extraction.confidence < 0.8,
      extraction_log_id: extractionResponse.logId,
      vendor: vendor ? {
        payee_id: vendor.payee_id,
        payee_name: vendor.payee_name,
        category: vendor.category,
        is_new: vendor.is_new,
      } : null,
    })
  } catch (err) {
    console.error('[upload] unexpected failure', err)
    return NextResponse.json({ error: 'Upload failed' }, { status: 500 })
  }
}
