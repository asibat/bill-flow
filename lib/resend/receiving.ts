import { createHmac, timingSafeEqual } from 'crypto'

const RESEND_API_BASE = 'https://api.resend.com'
const DEFAULT_TIMESTAMP_TOLERANCE_SECONDS = 5 * 60

export interface ResendWebhookEvent {
  type: string
  created_at?: string
  data?: {
    email_id?: string
    from?: string
    to?: string[]
    cc?: string[]
    bcc?: string[]
    reply_to?: string[]
    subject?: string
    attachments?: Array<{
      id: string
      filename: string
      content_type: string
      content_disposition: string | null
      content_id: string | null
      size: number
    }>
  }
}

export interface ReceivedEmail {
  id: string
  to: string[]
  from: string
  created_at: string
  subject: string
  html: string | null
  text: string | null
  headers: Record<string, string>
  cc: string[]
  bcc: string[]
  reply_to: string[]
  attachments: Array<{
    id: string
    filename: string
    content_type: string
    content_disposition: string | null
    content_id: string | null
    size: number
  }>
  raw?: {
    download_url: string
    expires_at: string
  } | null
}

export interface ReceivedAttachment {
  id: string
  filename: string
  size: number
  content_type: string
  content_disposition: string | null
  content_id: string | null
  download_url: string
  expires_at: string
}

function decodeWebhookSecret(secret: string): Buffer {
  const normalized = secret.startsWith('whsec_') ? secret.slice(6) : secret
  return Buffer.from(normalized, 'base64')
}

function secureCompare(a: string, b: string): boolean {
  const aBuf = Buffer.from(a)
  const bBuf = Buffer.from(b)
  if (aBuf.length !== bBuf.length) return false
  return timingSafeEqual(aBuf, bBuf)
}

export function verifyResendWebhookSignature({
  payload,
  headers,
  webhookSecret,
  toleranceSeconds = DEFAULT_TIMESTAMP_TOLERANCE_SECONDS,
}: {
  payload: string
  headers: Headers
  webhookSecret: string
  toleranceSeconds?: number
}): void {
  const id = headers.get('svix-id')
  const timestamp = headers.get('svix-timestamp')
  const signature = headers.get('svix-signature')

  if (!id || !timestamp || !signature) {
    throw new Error('Missing Resend webhook signature headers')
  }

  const ts = Number(timestamp)
  if (!Number.isFinite(ts)) {
    throw new Error('Invalid Resend webhook timestamp')
  }

  const now = Math.floor(Date.now() / 1000)
  if (Math.abs(now - ts) > toleranceSeconds) {
    throw new Error('Resend webhook timestamp is outside the allowed tolerance')
  }

  const signedContent = `${id}.${timestamp}.${payload}`
  const expected = createHmac('sha256', decodeWebhookSecret(webhookSecret))
    .update(signedContent)
    .digest('base64')

  const signatures = signature
    .trim()
    .split(/\s+/)
    .map(part => part.split(','))
    .filter(parts => parts.length === 2 && parts[0] === 'v1')
    .map(parts => parts[1])

  if (signatures.length === 0) {
    throw new Error('No supported Resend webhook signatures found')
  }

  const valid = signatures.some(value => secureCompare(value, expected))
  if (!valid) {
    throw new Error('Invalid Resend webhook signature')
  }
}

export async function fetchReceivedEmail(emailId: string): Promise<ReceivedEmail> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to fetch received emails')
  }

  const response = await fetch(`${RESEND_API_BASE}/emails/receiving/${emailId}`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to fetch received email (${response.status}): ${body}`)
  }

  return response.json() as Promise<ReceivedEmail>
}

export async function listReceivedEmailAttachments(emailId: string): Promise<ReceivedAttachment[]> {
  const apiKey = process.env.RESEND_API_KEY
  if (!apiKey) {
    throw new Error('RESEND_API_KEY is required to list received email attachments')
  }

  const response = await fetch(`${RESEND_API_BASE}/emails/receiving/${emailId}/attachments`, {
    headers: {
      Authorization: `Bearer ${apiKey}`,
      'User-Agent': 'BillFlow/1.0',
    },
    signal: AbortSignal.timeout(15000),
  })

  if (!response.ok) {
    const body = await response.text()
    throw new Error(`Failed to list received email attachments (${response.status}): ${body}`)
  }

  const json = await response.json() as { data?: ReceivedAttachment[] }
  return json.data ?? []
}
