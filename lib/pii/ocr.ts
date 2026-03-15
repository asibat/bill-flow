/**
 * OCR module using tesseract.js for local text extraction.
 * Runs entirely in Node — no external API calls.
 *
 * Uses createWorker API to avoid Next.js worker bundling issues.
 */

import { createWorker } from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  language: string
}

/**
 * Extract text from an image using tesseract.js.
 * Supports PNG, JPG, WebP.
 */
export async function extractText(
  imageBuffer: Buffer,
  languages = 'eng+fra+nld'
): Promise<OcrResult> {
  const worker = await createWorker(languages)
  try {
    const { data } = await worker.recognize(imageBuffer)
    return {
      text: data.text,
      confidence: data.confidence,
      language: languages,
    }
  } finally {
    await worker.terminate()
  }
}
