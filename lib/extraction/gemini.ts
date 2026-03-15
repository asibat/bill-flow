import { GoogleGenerativeAI } from "@google/generative-ai";
import type { ExtractionResult } from "@/types";
import {
  type ExtractionProvider,
  type ExtractionProviderResult,
  EXTRACTION_SYSTEM_PROMPT,
  EXTRACTION_JSON_SCHEMA,
  EMPTY_EXTRACTION,
} from "./types";

const genAI = new GoogleGenerativeAI(process.env.GEMINI_API_KEY!);

const model = genAI.getGenerativeModel({
  model: "gemini-2.5-flash",
  systemInstruction: EXTRACTION_SYSTEM_PROMPT,
  generationConfig: {
    responseMimeType: "application/json",
    responseSchema: EXTRACTION_JSON_SCHEMA,
  },
});

/** Sanitize AI values — Gemini sometimes returns "N/A", "none", -1, etc. instead of null */
function clean(val: unknown): string | null {
  if (val === null || val === undefined) return null;
  const s = String(val).trim();
  if (!s || /^(n\/?a|none|null|unknown|-|—)$/i.test(s)) return null;
  return s;
}

function cleanNumber(val: unknown): number | null {
  if (val === null || val === undefined) return null;
  const n = Number(val);
  if (isNaN(n) || n < 0) return null;
  return n;
}

function cleanDate(val: unknown): string | null {
  const s = clean(val);
  if (!s) return null;
  // Must look like a date (YYYY-MM-DD or parseable)
  const d = new Date(s);
  if (isNaN(d.getTime())) return null;
  return s;
}

function parseResponse(text: string): ExtractionProviderResult {
  console.log("[extraction:gemini] Raw response:", text);
  try {
    const parsed = JSON.parse(text);
    const result: ExtractionResult = {
      payee_name: clean(parsed.payee_name),
      amount: cleanNumber(parsed.amount),
      currency: clean(parsed.currency) ?? "EUR",
      due_date: cleanDate(parsed.due_date),
      structured_comm: clean(parsed.structured_comm),
      iban: clean(parsed.iban),
      bic: clean(parsed.bic),
      language_detected: clean(parsed.language_detected),
      explanation: clean(parsed.explanation),
      confidence: parsed.confidence ?? 0,
      raw_text_snippet: clean(parsed.raw_text_snippet),
    };
    console.log("[extraction:gemini] Parsed result:", {
      payee: result.payee_name,
      amount: result.amount,
      confidence: result.confidence,
      due_date: result.due_date,
      iban: result.iban ?? "MISSING",
      structured_comm: result.structured_comm ?? "MISSING",
      bic: result.bic ?? "MISSING",
    });
    if (parsed.extraction_notes) {
      console.log("[extraction:gemini] AI reasoning:", parsed.extraction_notes);
    }
    if (result.confidence < 0.7) {
      console.warn("[extraction:gemini] LOW CONFIDENCE:", result.confidence, "- check extraction_notes above");
    }
    return { result, rawParsed: parsed };
  } catch (err) {
    console.error("[extraction:gemini] Failed to parse response:", err);
    return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } };
  }
}

export const geminiProvider: ExtractionProvider = {
  async extractFromText(text: string): Promise<ExtractionProviderResult> {
    const input = text.slice(0, 8000);
    console.log("[extraction:gemini] extractFromText called, input length:", text.length);
    console.log("[extraction:gemini] Input preview (first 500 chars):", input.slice(0, 500));
    console.log("[extraction:gemini] Input preview (last 500 chars):", input.slice(-500));
    try {
      const res = await model.generateContent(
        `Extract payment information from this Belgian bill:\n\n${input}`,
      );
      return parseResponse(res.response.text());
    } catch (err) {
      console.error("[extraction:gemini] API call failed:", err);
      return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } };
    }
  },

  async extractFromImage(
    base64Image: string,
    mimeType: string,
  ): Promise<ExtractionProviderResult> {
    console.log("[extraction:gemini] extractFromImage called, mimeType:", mimeType, "base64 length:", base64Image.length);
    try {
      const res = await model.generateContent([
        {
          inlineData: {
            mimeType,
            data: base64Image,
          },
        },
        { text: "Extract all payment information from this Belgian bill image." },
      ]);
      return parseResponse(res.response.text());
    } catch (err) {
      console.error("[extraction:gemini] API call failed:", err);
      return { result: EMPTY_EXTRACTION, rawParsed: { error: String(err) } };
    }
  },
};
