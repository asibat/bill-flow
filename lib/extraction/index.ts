import type { ExtractionProvider } from "./types";
import type { ExtractionResult } from "@/types";
import { saveExtractionLog } from "./log";

export type { ExtractionProvider } from "./types";
export { EMPTY_EXTRACTION } from "./types";
export { linkExtractionLogToBill } from "./log";

export interface ExtractionResponse {
  result: ExtractionResult;
  logId: string | null;
}

function getProvider(): { instance: ExtractionProvider; name: string } {
  const provider = process.env.EXTRACTION_PROVIDER || "gemini";

  switch (provider) {
    case "claude":
      return { instance: require("./claude").claudeProvider, name: "claude" };
    case "gemini":
      return { instance: require("./gemini").geminiProvider, name: "gemini" };
    default:
      throw new Error(`Unknown extraction provider: ${provider}`);
  }
}

const { instance: extraction, name: providerName } = getProvider();

export async function extractFromText(
  text: string,
  userId: string,
): Promise<ExtractionResponse> {
  const start = Date.now();
  let error: string | null = null;

  const { result, rawParsed } = await extraction.extractFromText(text);
  const durationMs = Date.now() - start;

  if (result.confidence === 0 && !result.payee_name) {
    error = "Extraction returned empty result";
  }

  const logId = await saveExtractionLog({
    userId,
    provider: providerName,
    inputType: "text",
    input: text,
    result,
    rawResponse: rawParsed,
    extractionNotes:
      (rawParsed as Record<string, string>).extraction_notes ?? null,
    durationMs,
    error,
  });

  return { result, logId };
}

export async function extractFromImage(
  base64Image: string,
  mimeType: string,
  userId: string,
): Promise<ExtractionResponse> {
  const start = Date.now();
  let error: string | null = null;

  const { result, rawParsed } = await extraction.extractFromImage(
    base64Image,
    mimeType,
  );
  const durationMs = Date.now() - start;

  if (result.confidence === 0 && !result.payee_name) {
    error = "Extraction returned empty result";
  }

  const logId = await saveExtractionLog({
    userId,
    provider: providerName,
    inputType: "image",
    input: `[image:${mimeType}:${base64Image.length} bytes]`,
    result,
    rawResponse: rawParsed,
    extractionNotes:
      (rawParsed as Record<string, string>).extraction_notes ?? null,
    durationMs,
    error,
  });

  return { result, logId };
}

export async function extractFromDocument(
  base64Doc: string,
  mimeType: string,
  userId: string,
): Promise<ExtractionResponse> {
  const start = Date.now();
  let error: string | null = null;

  const { result, rawParsed } = await extraction.extractFromDocument(
    base64Doc,
    mimeType,
  );
  const durationMs = Date.now() - start;

  if (result.confidence === 0 && !result.payee_name) {
    error = "Extraction returned empty result";
  }

  const logId = await saveExtractionLog({
    userId,
    provider: providerName,
    inputType: "text",
    input: `[document:${mimeType}:${base64Doc.length} bytes]`,
    result,
    rawResponse: rawParsed,
    extractionNotes:
      (rawParsed as Record<string, string>).extraction_notes ?? null,
    durationMs,
    error,
  });

  return { result, logId };
}
