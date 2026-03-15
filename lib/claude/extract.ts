import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionResult } from '@/types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_SYSTEM_PROMPT = `You are a Belgian bill payment extraction specialist. 
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

Provide a plain English explanation of what this bill is for, suitable for an expat who may not 
read Dutch or French. Keep it to 1-2 sentences.

Return a confidence score 0.0-1.0 based on how clearly the fields were visible in the source.`

const EXTRACTION_TOOL = {
  name: 'extract_bill',
  description: 'Extract all payment fields from a Belgian bill',
  input_schema: {
    type: 'object' as const,
    properties: {
      payee_name: { type: 'string', description: 'Company or organisation name on the bill' },
      amount: { type: 'number', description: 'Amount to pay as a decimal number' },
      currency: { type: 'string', description: 'Currency code, almost always EUR', default: 'EUR' },
      due_date: { type: 'string', description: 'Due date in ISO format YYYY-MM-DD' },
      structured_comm: { type: 'string', description: 'Structured communication exactly as +++XXX/XXXX/XXXXX+++ including the +++ delimiters' },
      iban: { type: 'string', description: 'IBAN bank account number with spaces removed' },
      bic: { type: 'string', description: 'BIC/SWIFT code' },
      language_detected: { type: 'string', description: 'Primary language of the bill: nl, fr, en, de' },
      explanation: { type: 'string', description: 'Plain English 1-2 sentence explanation of what this bill is for' },
      confidence: { type: 'number', description: 'Confidence score 0.0-1.0' },
      raw_text_snippet: { type: 'string', description: 'The most relevant 100-char snippet from the source containing payment details' },
    },
    required: ['payee_name', 'currency', 'confidence'],
  },
}

export async function extractFromText(text: string): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{ role: 'user', content: `Extract payment information from this Belgian bill:\n\n${text.slice(0, 8000)}` }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { payee_name: null, amount: null, currency: 'EUR', due_date: null, structured_comm: null, iban: null, bic: null, language_detected: null, explanation: null, confidence: 0, raw_text_snippet: null }
  }

  return toolUse.input as ExtractionResult
}

export async function extractFromImage(base64Image: string, mimeType: string): Promise<ExtractionResult> {
  const response = await anthropic.messages.create({
    model: 'claude-sonnet-4-5',
    max_tokens: 1024,
    system: EXTRACTION_SYSTEM_PROMPT,
    tools: [EXTRACTION_TOOL],
    tool_choice: { type: 'auto' },
    messages: [{
      role: 'user',
      content: [
        {
          type: 'image',
          source: { type: 'base64', media_type: mimeType as 'image/jpeg' | 'image/png' | 'image/webp', data: base64Image },
        },
        { type: 'text', text: 'Extract all payment information from this Belgian bill image.' },
      ],
    }],
  })

  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { payee_name: null, amount: null, currency: 'EUR', due_date: null, structured_comm: null, iban: null, bic: null, language_detected: null, explanation: null, confidence: 0, raw_text_snippet: null }
  }

  return toolUse.input as ExtractionResult
}
