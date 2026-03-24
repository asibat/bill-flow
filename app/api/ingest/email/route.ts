import { NextRequest, NextResponse } from 'next/server'
import { addDays, format as formatDate } from 'date-fns'
import { createServiceClient } from '@/lib/supabase/server'
import { extractFromText, linkExtractionLogToBill } from '@/lib/extraction'
import { findDuplicates } from '@/lib/dedup'
import { createBillReminder } from '@/lib/reminders/create'
import { fetchReceivedEmail, type ReceivedEmail, type ResendWebhookEvent, verifyResendWebhookSignature } from '@/lib/resend/receiving'
import { extractDoccleUrl, formatStructuredComm, parseDoccleHtml, validateStructuredComm } from '@/lib/utils'
import { matchOrCreateVendor } from '@/lib/vendors/match'

type LocalSimulationPayload = {
  to?: string
  from?: string
  subject?: string
  text?: string
  html?: string
}

function isLocalSimulationPayload(value: unknown): value is LocalSimulationPayload {
  if (!value || typeof value !== 'object') return false
  return 'to' in value || 'subject' in value || 'text' in value || 'html' in value
}

function shouldSkipVerification(): boolean {
  return process.env.RESEND_WEBHOOK_SKIP_VERIFICATION === 'true'
}

function normalizeEmailAddress(value: string | string[] | undefined | null): string {
  if (!value) return ''
  return Array.isArray(value) ? (value[0] ?? '') : value
}

export async function POST(request: NextRequest) {
  try {
    const rawBody = await request.text()
    const payload = rawBody ? JSON.parse(rawBody) : {}

    let receivedEmail: ReceivedEmail | null = null

    if (isLocalSimulationPayload(payload)) {
      if (!shouldSkipVerification()) {
        return NextResponse.json({ error: 'Local simulation payloads require RESEND_WEBHOOK_SKIP_VERIFICATION=true' }, { status: 401 })
      }

      receivedEmail = {
        id: `local-${Date.now()}`,
        to: payload.to ? [payload.to] : [],
        from: payload.from ?? '',
        created_at: new Date().toISOString(),
        subject: payload.subject ?? '',
        html: payload.html ?? null,
        text: payload.text ?? null,
        headers: {},
        cc: [],
        bcc: [],
        reply_to: [],
        attachments: [],
        raw: null,
      }
    } else {
      const webhookSecret = process.env.RESEND_WEBHOOK_SECRET
      if (!shouldSkipVerification()) {
        if (!webhookSecret) {
          return NextResponse.json({ error: 'RESEND_WEBHOOK_SECRET is not configured' }, { status: 500 })
        }
        verifyResendWebhookSignature({
          payload: rawBody,
          headers: request.headers,
          webhookSecret,
        })
      }

      const event = payload as ResendWebhookEvent
      if (event.type !== 'email.received' || !event.data?.email_id) {
        return NextResponse.json({ ok: true, ignored: true })
      }

      receivedEmail = await fetchReceivedEmail(event.data.email_id)
    }

    const toAddress = normalizeEmailAddress(receivedEmail?.to)
    const fromAddress = normalizeEmailAddress(receivedEmail?.from)
    const subject = receivedEmail?.subject ?? ''
    const textBody = receivedEmail?.text ?? ''
    const htmlBody = receivedEmail?.html ?? ''

    const inboxMatch = toAddress.match(/bills\.([a-f0-9]{8})@/i)
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
    const explanationLanguage = settings.preferred_language ?? 'en'
    const fullText = `${subject}\n${textBody}\n${htmlBody}`
    const doccleUrl = extractDoccleUrl(fullText)

    if (doccleUrl) {
      return await handleDoccleEmail(userId, doccleUrl, fullText, explanationLanguage, supabase)
    }

    return await handleGenericEmail(userId, fullText, subject, fromAddress, explanationLanguage, supabase)
  } catch (err) {
    console.error('Ingest email error:', err)
    return NextResponse.json({ error: err instanceof Error ? err.message : 'Internal error' }, { status: 500 })
  }
}

async function handleDoccleEmail(
  userId: string,
  doccleUrl: string,
  originalText: string,
  explanationLanguage: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  let doccleHtml = ''

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

  const pageMeta = parseDoccleHtml(doccleHtml)
  const emailMeta = parseDoccleHtml(originalText)
  const htmlMeta = {
    amount: pageMeta.amount ?? emailMeta.amount,
    dueDate: pageMeta.dueDate ?? emailMeta.dueDate,
    payee: pageMeta.payee ?? emailMeta.payee,
    status: pageMeta.status ?? emailMeta.status,
  }

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
        const pdfBuffer = Buffer.from(arrayBuffer)
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

  const combinedText = `
DOCCLE BILL NOTIFICATION
From: ${originalText.slice(0, 1000)}
---
Doccle page content: ${doccleHtml.slice(0, 4000)}
  `.trim()

  const extractionResponse = await extractFromText(combinedText, userId, { explanationLanguage })
  const extraction = extractionResponse.result

  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    const formatted = formatStructuredComm(extraction.structured_comm)
    extraction.structured_comm = formatted
    structuredCommValid = validateStructuredComm(formatted)
  }

  const vendor = await matchOrCreateVendor(supabase, userId, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  const needsReview = !!htmlMeta.amount && !!extraction.amount &&
    Math.abs(htmlMeta.amount - (extraction.amount ?? 0)) > 0.01

  const sourcePayeeName = extraction.payee_name || htmlMeta.payee || 'Unknown (Doccle)'
  const duplicates = await findDuplicates(supabase, userId, {
    payee_name: sourcePayeeName,
    amount: extraction.amount ?? htmlMeta.amount ?? null,
    due_date: extraction.due_date || htmlMeta.dueDate || null,
    structured_comm: extraction.structured_comm,
  })
  if (duplicates.length > 0) {
    return NextResponse.json({ success: true, bill_id: duplicates[0].id, source: 'doccle', duplicate: true })
  }

  const { data: bill, error } = await supabase.from('bills').insert({
    user_id: userId,
    source: 'doccle',
    payee_name: sourcePayeeName,
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

  if (extractionResponse.logId && bill?.id) {
    await linkExtractionLogToBill(extractionResponse.logId, bill.id)
  }

  if (bill?.due_date) {
    await createBillReminder(supabase, {
      billId: bill.id,
      userId,
      dueDate: bill.due_date,
    })
  }

  return NextResponse.json({ success: true, bill_id: bill?.id, source: 'doccle' })
}

async function handleGenericEmail(
  userId: string,
  fullText: string,
  subject: string,
  fromAddress: string,
  explanationLanguage: string,
  supabase: ReturnType<typeof createServiceClient>
) {
  const extractionResponse = await extractFromText(fullText, userId, { explanationLanguage })
  const extraction = extractionResponse.result

  let structuredCommValid: boolean | null = null
  if (extraction.structured_comm) {
    extraction.structured_comm = formatStructuredComm(extraction.structured_comm)
    structuredCommValid = validateStructuredComm(extraction.structured_comm)
  }

  const vendor = await matchOrCreateVendor(supabase, userId, extraction)
  if (vendor && !extraction.bic && vendor.bic) {
    extraction.bic = vendor.bic
  }

  const sourcePayeeName = extraction.payee_name || subject || fromAddress || 'Unknown'
  const duplicates = await findDuplicates(supabase, userId, {
    payee_name: sourcePayeeName,
    amount: extraction.amount,
    due_date: extraction.due_date,
    structured_comm: extraction.structured_comm,
  })
  if (duplicates.length > 0) {
    return NextResponse.json({ success: true, bill_id: duplicates[0].id, source: 'email', duplicate: true })
  }

  const { data: bill, error } = await supabase.from('bills').insert({
    user_id: userId,
    source: 'email',
    payee_name: sourcePayeeName,
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

  if (extractionResponse.logId && bill?.id) {
    await linkExtractionLogToBill(extractionResponse.logId, bill.id)
  }

  if (bill?.due_date) {
    await createBillReminder(supabase, {
      billId: bill.id,
      userId,
      dueDate: bill.due_date,
    })
  }

  return NextResponse.json({ success: true, bill_id: bill?.id, source: 'email' })
}
