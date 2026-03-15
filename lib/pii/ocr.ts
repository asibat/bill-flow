/**
 * OCR module using tesseract.js for local text extraction.
 * Runs entirely in Node — no external API calls.
 */

import Tesseract from 'tesseract.js'

export interface OcrResult {
  text: string
  confidence: number
  language: string
}

/**
 * Extract text from an image or PDF page using tesseract.js.
 * Supports PNG, JPG, WebP, and single-page PDFs (as images).
 */
export async function extractText(
  imageBuffer: Buffer,
  languages = 'nld+fra+eng'
): Promise<OcrResult> {
  const { data } = await Tesseract.recognize(imageBuffer, languages, {
    logger: () => {},  // suppress progress logs
  })

  return {
    text: data.text,
    confidence: data.confidence,
    language: languages,
  }
}
