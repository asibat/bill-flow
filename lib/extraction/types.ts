import type { ExtractionResult } from '@/types'

export interface ExtractionProviderResult {
  result: ExtractionResult
  rawParsed: Record<string, unknown>
}

export interface ExtractionOptions {
  explanationLanguage?: string | null
}

export interface ExtractionProvider {
  extractFromText(text: string, options?: ExtractionOptions): Promise<ExtractionProviderResult>
  extractFromImage(base64Image: string, mimeType: string, options?: ExtractionOptions): Promise<ExtractionProviderResult>
  extractFromDocument(base64Doc: string, mimeType: string, options?: ExtractionOptions): Promise<ExtractionProviderResult>
}

function getExplanationLanguageInstruction(language: string | null | undefined): string {
  switch ((language ?? 'en').toLowerCase()) {
    case 'fr':
      return 'Provide the bill explanation in French.'
    case 'nl':
      return 'Provide the bill explanation in Dutch.'
    default:
      return 'Provide the bill explanation in plain English.'
  }
}

export function buildExtractionSystemPrompt(options?: ExtractionOptions): string {
  return `You are a Belgian bill payment extraction specialist.
Extract payment information from Belgian invoices, which may be in Dutch, French, or English.

Belgian bills have these key characteristics:
- Structured communication (gestructureerde mededeling / communication structurée) in format +++XXX/XXXX/XXXXX+++
  These are Modulo 97 validated 12-digit codes. CRITICAL: extract exactly as shown with +++ delimiters.
- IBAN typically starts with BE (Belgian) but may be other EU IBANs
- BIC/SWIFT code (8 or 11 characters)
- Amount labeled as: Bedrag, Montant, À payer, Te betalen, TOTAL, Montant à payer, etc.
- Due date labeled as: Vervaldatum, Date d'échéance, Due date, Avant le, Voor, etc.

Common Belgian billers: Proximus, Telenet, Orange, Engie, Luminus, VIVAQUA, De Watergroep,
Fluvius, Ethias, AG Insurance, mutualités, commune/gemeente taxes, immobilière/onroerende voorheffing.

Always extract ALL payment-critical fields. If a structured communication is present, it is the
most important field — a wrong code means the payment bounces.

${getExplanationLanguageInstruction(options?.explanationLanguage)} The explanation should still be suitable for an expat and stay within 1-2 sentences.

Return a confidence score 0.0-1.0 based on how clearly the fields were visible in the source.

IMPORTANT: In the "extraction_notes" field, explain your reasoning step by step:
- What language is the document in?
- Which fields did you find and where?
- Which fields are missing and why? (e.g. "no IBAN found in the text", "amount unclear because multiple totals present")
- If confidence is below 0.7, explain what made extraction difficult.
This helps the developer debug extraction failures.`
}

export const EXTRACTION_JSON_SCHEMA = {
  type: 'object' as const,
  properties: {
    payee_name: { type: 'string', description: 'Company or organisation name on the bill' },
    amount: { type: 'number', description: 'Amount to pay as a decimal number' },
    currency: { type: 'string', description: 'Currency code, almost always EUR' },
    due_date: { type: 'string', description: 'Due date in ISO format YYYY-MM-DD' },
    structured_comm: { type: 'string', description: 'Structured communication exactly as +++XXX/XXXX/XXXXX+++ including the +++ delimiters' },
    iban: { type: 'string', description: 'IBAN bank account number with spaces removed' },
    bic: { type: 'string', description: 'BIC/SWIFT code' },
    language_detected: { type: 'string', description: 'Primary language of the bill: nl, fr, en, de' },
    explanation: { type: 'string', description: 'A 1-2 sentence explanation of what this bill is for in the requested explanation language' },
    confidence: { type: 'number', description: 'Confidence score 0.0-1.0' },
    raw_text_snippet: { type: 'string', description: 'The most relevant 100-char snippet from the source containing payment details' },
    extraction_notes: { type: 'string', description: 'Step-by-step reasoning: what was found, what was missing and why, what made extraction difficult' },
  },
  required: ['payee_name', 'currency', 'confidence', 'extraction_notes', 'amount', 'due_date', 'structured_comm', 'iban', 'bic'],
}

export const EMPTY_EXTRACTION: ExtractionResult = {
  payee_name: null,
  amount: null,
  currency: 'EUR',
  due_date: null,
  structured_comm: null,
  iban: null,
  bic: null,
  language_detected: null,
  explanation: null,
  confidence: 0,
  raw_text_snippet: null,
}
