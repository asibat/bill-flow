import { format, formatDistanceToNow, isPast, differenceInDays } from 'date-fns'
import type { Bill, BillStatus } from '@/types'

// ── Modulo 97 validation for Belgian structured communications ──
// Format: +++XXX/XXXX/XXXXX+++ where the last 2 digits of the number are the check digits
// The check digit is the remainder of the 10-digit number (without check digits) mod 97
// If remainder is 0, check digit is 97
export function validateStructuredComm(comm: string): boolean {
  if (!comm) return false
  // Strip +++ delimiters and slashes
  const cleaned = comm.replace(/\+/g, '').replace(/\//g, '').trim()
  if (!/^\d{12}$/.test(cleaned)) return false

  const digits = cleaned.slice(0, 10)
  const checkDigits = parseInt(cleaned.slice(10, 12), 10)
  const remainder = parseInt(digits, 10) % 97
  const expected = remainder === 0 ? 97 : remainder
  return expected === checkDigits
}

// Format structured comm for display: +++XXX/XXXX/XXXXX+++
export function formatStructuredComm(comm: string): string {
  const cleaned = comm.replace(/\+/g, '').replace(/\//g, '').trim()
  if (cleaned.length !== 12) return comm
  return `+++${cleaned.slice(0, 3)}/${cleaned.slice(3, 7)}/${cleaned.slice(7, 12)}+++`
}

// Format IBAN with spaces for readability
export function formatIBAN(iban: string): string {
  const cleaned = iban.replace(/\s/g, '').toUpperCase()
  return cleaned.match(/.{1,4}/g)?.join(' ') ?? iban
}

// ── Bill status helpers ──
export function getBillUrgency(bill: Bill): 'overdue' | 'urgent' | 'upcoming' | 'paid' | 'sent' {
  if (bill.status === 'confirmed' || bill.status === 'payment_sent') return 'sent'
  if (bill.status === 'overdue') return 'overdue'
  const daysUntilDue = differenceInDays(new Date(bill.due_date), new Date())
  if (daysUntilDue < 0) return 'overdue'
  if (daysUntilDue <= 3) return 'urgent'
  return 'upcoming'
}

export function getBillStatusLabel(status: BillStatus): string {
  const labels: Record<BillStatus, string> = {
    received: 'To Pay',
    scheduled: 'Scheduled',
    payment_sent: 'Payment Sent',
    confirmed: 'Confirmed',
    overdue: 'Overdue',
  }
  return labels[status]
}

export function getBillStatusColor(status: BillStatus): string {
  const colors: Record<BillStatus, string> = {
    received: 'bg-amber-100 text-amber-800',
    scheduled: 'bg-blue-100 text-blue-800',
    payment_sent: 'bg-purple-100 text-purple-800',
    confirmed: 'bg-green-100 text-green-800',
    overdue: 'bg-red-100 text-red-800',
  }
  return colors[status]
}

// ── Date formatting ──
export function formatDueDate(dateStr: string): string {
  const date = new Date(dateStr)
  const days = differenceInDays(date, new Date())
  if (days < 0) return `${Math.abs(days)} days overdue`
  if (days === 0) return 'Due today'
  if (days === 1) return 'Due tomorrow'
  if (days <= 7) return `Due in ${days} days`
  return format(date, 'd MMM yyyy')
}

export function formatAmount(amount: number, currency = 'EUR'): string {
  return new Intl.NumberFormat('en-BE', { style: 'currency', currency }).format(amount)
}

// ── Extract Doccle URL from email text ──
export function extractDoccleUrl(emailText: string): string | null {
  const match = emailText.match(/https:\/\/secure\.doccle\.be\/doccle-euui\/direct\/document\/[^\s"'<>]+/)
  return match ? match[0] : null
}

// ── Parse Doccle page HTML for structured metadata ──
export function parseDoccleHtml(html: string): { amount?: number; dueDate?: string; payee?: string; status?: string } {
  const result: { amount?: number; dueDate?: string; payee?: string; status?: string } = {}
  
  // Amount: look for €XX,XX or EUR XX,XX patterns (€ may be UTF-8 encoded)
  const amountPatterns = [
    /€\s*(\d+[.,]\d{2})/,
    /\u20ac\s*(\d+[.,]\d{2})/,       // Unicode euro sign
    /EUR\s*(\d+[.,]\d{2})/i,
    /(\d+[.,]\d{2})\s*€/,
    /(\d+[.,]\d{2})\s*EUR/i,
  ]
  for (const pattern of amountPatterns) {
    const amountMatch = html.match(pattern)
    if (amountMatch) {
      result.amount = parseFloat(amountMatch[1].replace(',', '.'))
      break
    }
  }

  // Due date: look for date patterns near "Due date" or "Avant le" or "Vervaldatum"
  const datePatterns = [
    /(?:Due date|Avant le|Vervaldatum|échéance)[:\s]+(\d{1,2}[\s\/\-]\w+[\s\/\-]\d{4})/i,
    /(\d{1,2}\s+\w+\s+\d{4})/,
  ]
  for (const pattern of datePatterns) {
    const match = html.match(pattern)
    if (match) {
      const parsed = new Date(match[1])
      if (!isNaN(parsed.getTime())) {
        result.dueDate = format(parsed, 'yyyy-MM-dd')
        break
      }
    }
  }

  // Payee: look for sender name in title or header
  const titleMatch = html.match(/<title[^>]*>([^<]+)<\/title>/i)
  if (titleMatch) result.payee = titleMatch[1].trim()

  return result
}

// ── Generate unique inbox address from user ID ──
export function generateInboxAddress(userId: string, domain = 'billflow.app'): string {
  return `bills.${userId.slice(0, 8)}@${domain}`
}
