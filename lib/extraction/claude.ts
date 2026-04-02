import Anthropic from '@anthropic-ai/sdk'
import type { ExtractionResult } from '@/types'
import {
  type ExtractionProvider,
  type ExtractionProviderResult,
  type ExtractionOptions,
  buildExtractionSystemPrompt,
  EXTRACTION_JSON_SCHEMA,
  EMPTY_EXTRACTION,
} from './types'

const anthropic = new Anthropic({ apiKey: process.env.ANTHROPIC_API_KEY })

const EXTRACTION_TOOL = {
  name: 'extract_bill',
  description: 'Extract all payment fields from a Belgian bill',
  input_schema: EXTRACTION_JSON_SCHEMA,
}

function extractToolResult(response: Anthropic.Message): ExtractionProviderResult {
  const toolUse = response.content.find(b => b.type === 'tool_use')
  if (!toolUse || toolUse.type !== 'tool_use') {
    return { result: EMPTY_EXTRACTION, rawParsed: { error: 'No tool_use block in response' } }
  }
  const rawParsed = toolUse.input as Record<string, unknown>
  const result = rawParsed as unknown as ExtractionResult
  if (rawParsed.extraction_notes) {
    console.log('[extraction:claude] AI reasoning:', rawParsed.extraction_notes)
  }
  return { result, rawParsed }
}

export const claudeProvider: ExtractionProvider = {
  async extractFromText(text: string, options?: ExtractionOptions): Promise<ExtractionProviderResult> {
    console.log('[extraction:claude] extractFromText called, input length:', text.length)
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildExtractionSystemPrompt(options),
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'auto' },
        messages: [{ role: 'user', content: `Extract payment information from this Belgian bill:\n\n${text.slice(0, 8000)}` }],
      })
      return extractToolResult(response)
    } catch (err) {
      console.error('[extraction:claude] API call failed:', err)
      return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } }
    }
  },

  async extractFromImage(base64Image: string, mimeType: string, options?: ExtractionOptions): Promise<ExtractionProviderResult> {
    console.log('[extraction:claude] extractFromImage called, mimeType:', mimeType)
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildExtractionSystemPrompt(options),
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
      return extractToolResult(response)
    } catch (err) {
      console.error('[extraction:claude] API call failed:', err)
      return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } }
    }
  },

  async extractFromDocument(base64Doc: string, mimeType: string, options?: ExtractionOptions): Promise<ExtractionProviderResult> {
    console.log('[extraction:claude] extractFromDocument called, mimeType:', mimeType)
    try {
      const response = await anthropic.messages.create({
        model: 'claude-sonnet-4-6',
        max_tokens: 1024,
        system: buildExtractionSystemPrompt(options),
        tools: [EXTRACTION_TOOL],
        tool_choice: { type: 'auto' },
        messages: [{
          role: 'user',
          content: [
            {
              type: 'document',
              source: { type: 'base64', media_type: mimeType as 'application/pdf', data: base64Doc },
            },
            { type: 'text', text: 'Extract all payment information from this Belgian bill document.' },
          ],
        }],
      })
      return extractToolResult(response)
    } catch (err) {
      console.error('[extraction:claude] API call failed:', err)
      return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } }
    }
  },
}
