import { NextRequest, NextResponse } from 'next/server'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromText, linkExtractionLogToBill } from '@/lib/extraction'
import { extractDoccleUrl, parseDoccleHtml, validateStructuredComm, formatStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'
import { addDays, differenceInDays, format as formatDate } from 'date-fns'

// Resend sends inbound emails as multipart/form-data
// https://resend.com/docs/dashboard/emails/inbound-emails
export async function POST(request: NextRequest) {
  try {
    // Verify webhook signature
    const signature = request.headers.get('svix-signature') || request.headers.get('x-resend-signature')
    // In production, verify this against RESEND_WEBHOOK_SECRET
    // For MVP we skip strict verification but log it
    
    const contentType = request.headers.get('content-type') || ''
    let emailData: Record<string, string> = {}

    if (contentType.includes('application/json')) {
      emailData = await request.json()
    } else {
      const formData = await request.formData()
      formData.forEach((value, key) => {
        emailData[key] = value.toString()
      })
    }

    const toAddress = emailData.to || emailData.envelope_to || ''
    const fromAddress = emailData.from || ''
    const subject = emailData.subject || ''
    const textBody = emailData.text || emailData.plain || ''
    const htmlBody = emailData.html || ''

    // Identify user from their unique inbox address
    // Format: bills.{userId_first8}@billflow.app
    const inboxMatch = toAddress.match(/bills\.([a-f0-9]{8})@/)
    if (!inboxMatch) {
      return NextResponse.json({ error: 'Unknown inbox address' }, { status: 400 })
    }

    const supabase = createServiceClient()
    const { data: settings } = await supabase
      .from('user_settings')
      .select('user_id, preferred_language')
      .like('email_inbox_address', `bills.${inboxMatch[1]}%`)
      .single()

    if (!settings) {
      return NextResponse.json({ error: 'User not found' }, { status: 404 })
    }

    const userId = settings.user_id
    const fullText = `${subject}\n${textBody}\n${htmlBody}`

    // Check if this is a Doccle notification
    const doccleUrl = extractDoccleUrl(fullText)
    
    if (doccleUrl) {
      return await handleDoccleEmail(userId, doccleUrl, fullText, supabase)
    } else {
      return await handleGenericEmail(userId, fullText, subject, fromAddress, supabase)
    }

  } catch (err) {
    console.error('Ingest email error:', err)
    return NextResponse.json({ error: 'Internal error' }, { status: 500 })
  }
}

async function handleDoccleEmail(
  userId: string,
  doccleUrl: string,
  originalText: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  // Fetch the Doccle direct URL (no auth required)
  let doccleHtml = ''
  let pdfBuffer: Buffer | null = null

  try {
    const pageResponse = await fetch(doccleUrl, {
      headers: { 'User-Agent': 'Mozilla/5.0 (compatible; BillFlow/1.0)' },
      signal: AbortSignal.timeout(10000),
    })

    if (pageResponse.ok) {
      doccleHtml = await pageResponse.text()
    }
  } catch (e) {
    console.warn('Could not fetch Doccle URL:', e)
  }

  // Parse structured metadata from Doccle HTML, falling back to the email HTML
  const pageMeta = parseDoccleHtml(doccleHtml)
  const emailMeta = parseDoccleHtml(originalText)
  const htmlMeta = {
    amount: pageMeta.amount ?? emailMeta.amount,
    dueDate: pageMeta.dueDate ?? emailMeta.dueDate,
    payee: pageMeta.payee ?? emailMeta.payee,
    status: pageMeta.status ?? emailMeta.status,
  }
  console.log('[ingest:doccle] pageMeta:', pageMeta)
  console.log('[ingest:doccle] emailMeta:', emailMeta)
  console.log('[ingest:doccle] merged htmlMeta:', htmlMeta)

  // Try to find and download the PDF
  let pdfPath: string | null = null
  try {
    const pdfLinkMatch = doccleHtml.match(/href="([^"]+\.pdf[^"]*)"/)
    const printLinkMatch = doccleHtml.match(/(?:open\/print|newWindow)[^"]*"([^"]+)"/)
    const pdfUrl = pdfLinkMatch?.[1] || printLinkMatch?.[1]
    
    if (pdfUrl) {
      const fullPdfUrl = pdfUrl.startsWith('http') ? pdfUrl : `https://secure.doccle.be${pdfUrl}`
      const pdfResponse = await fetch(fullPdfUrl, { signal: AbortSignal.timeout(15000) })
      if (pdfResponse.ok) {
        const arrayBuffer = await pdfResponse.arrayBuffer()
        pdfBuffer = Buffer.from(arrayBuffer)
        
        // Store PDF in Supabase Storage
        const pdfFilename = `${userId}/${Date.now()}-doccle.pdf`
        const { error: storageError } = await supabase.storage
          .from('bill-documents')
          .upload(pdfFilename, pdfBuffer, { contentType: 'application/pdf' })
        
        if (!storageError) pdfPath = pdfFilename
      }
    }
  } catch (e) {
    console.warn('Could not download Doccle PDF:', e)
  }

  // Extract with Claude from the full text + HTML metadata
  const combinedText = `
DOCCLE BILL NOTIFICATION
From: ${originalText.slice(0, 1000)}
---
Doccle page content: ${doccleHtml.slice(0, 4000)}
  `.trim()

  const extractionResponse = await extractFromText(combinedText, userId)
  const extraction = extractionResponse.result

  // Validate structured communication
  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    const formatted = formatStructuredComm(extraction.structured_comm)
    extraction.structured_comm = formatted
    structuredCommValid = validateStructuredComm(formatted)
  }

  // Match or create vendor by IBAN
  const vendor = await matchOrCreateVendor(supabase, userId, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  // Cross-check amount with HTML metadata — flag if disagreement
  const needsReview = !!htmlMeta.amount && !!extraction.amount &&
    Math.abs(htmlMeta.amount - (extraction.amount ?? 0)) > 0.01

  const { data: bill, error } = await supabase.from('bills').insert({
    user_id: userId,
    source: 'doccle',
    payee_name: vendor?.payee_name || extraction.payee_name || htmlMeta.payee || 'Unknown (Doccle)',
    payee_id: vendor?.payee_id || null,
    amount: extraction.amount ?? htmlMeta.amount ?? 0,
    currency: extraction.currency ?? 'EUR',
    due_date: extraction.due_date || htmlMeta.dueDate || formatDate(addDays(new Date(), 30), 'yyyy-MM-dd'),
    structured_comm: extraction.structured_comm,
    structured_comm_valid: structuredCommValid,
    iban: extraction.iban,
    bic: extraction.bic,
    status: 'received',
    extraction_confidence: extraction.confidence,
    language_detected: extraction.language_detected,
    explanation: extraction.explanation,
    raw_pdf_path: pdfPath,
    doccle_url: doccleUrl,
    needs_review: needsReview || extraction.confidence < 0.7,
  }).select().single()

  if (error) {
    console.error('Failed to insert Doccle bill:', error)
    return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })
  }

  // Link extraction log to the created bill
  if (extractionResponse.logId && bill?.id) {
    await linkExtractionLogToBill(extractionResponse.logId, bill.id)
  }

  // Auto-create reminder
  if (bill?.due_date) {
    const dueDate = new Date(bill.due_date)
    const reminderDate = new Date(dueDate)
    reminderDate.setDate(reminderDate.getDate() - 3)
    
    if (differenceInDays(reminderDate, new Date()) > 0) {
      await supabase.from('reminders').insert({
        bill_id: bill.id,
        user_id: userId,
        remind_at: reminderDate.toISOString(),
        channel: 'email',
      })
    }
  }

  return NextResponse.json({ success: true, bill_id: bill?.id, source: 'doccle' })
}

async function handleGenericEmail(
  userId: string,
  fullText: string,
  subject: string,
  fromAddress: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const extractionResponse = await extractFromText(fullText, userId)
  const extraction = extractionResponse.result

  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
    structuredCommValid = validateStructuredComm(extraction.structured_comm)
  }

  // Match or create vendor by IBAN
  const vendor = await matchOrCreateVendor(supabase, userId, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  const { data: bill, error } = await supabase.from('bills').insert({
    user_id: userId,
    source: 'email',
    payee_name: vendor?.payee_name || extraction.payee_name || subject || fromAddress || 'Unknown',
    payee_id: vendor?.payee_id || null,
    amount: extraction.amount ?? 0,
    currency: extraction.currency ?? 'EUR',
    due_date: extraction.due_date,
    structured_comm: extraction.structured_comm,
    structured_comm_valid: structuredCommValid,
    iban: extraction.iban,
    bic: extraction.bic,
    status: 'received',
    extraction_confidence: extraction.confidence,
    language_detected: extraction.language_detected,
    explanation: extraction.explanation,
    needs_review: !extraction.due_date || !extraction.amount || extraction.confidence < 0.7,
  }).select().single()

  if (error) return NextResponse.json({ error: 'DB insert failed' }, { status: 500 })

  // Link extraction log to the created bill
  if (extractionResponse.logId && bill?.id) {
    await linkExtractionLogToBill(extractionResponse.logId, bill.id)
  }

  return NextResponse.json({ success: true, bill_id: bill?.id, source: 'email' })
}
