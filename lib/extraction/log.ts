import { createServiceClient } from "@/lib/supabase/server";
import type { ExtractionResult } from "@/types";

export interface ExtractionLogEntry {
  userId: string;
  provider: string;
  inputType: "text" | "image";
  input: string;
  result: ExtractionResult;
  rawResponse: Record<string, unknown>;
  extractionNotes: string | null;
  durationMs: number;
  error: string | null;
}

/**
 * Persist an extraction attempt to the extraction_logs table.
 * Returns the log ID so it can be linked to a bill later.
 */
export async function saveExtractionLog(
  entry: ExtractionLogEntry,
): Promise<string | null> {
  try {
    const supabase = createServiceClient();
    const { data, error } = await supabase
      .from("extraction_logs")
      .insert({
        user_id: entry.userId,
        provider: entry.provider,
        input_type: entry.inputType,
        input_preview: entry.input.slice(0, 500),
        input_length: entry.input.length,
        raw_response: entry.rawResponse,
        extraction_notes: entry.extractionNotes,
        confidence: entry.result.confidence,
        duration_ms: entry.durationMs,
        error: entry.error,
      })
      .select("id")
      .single();

    if (error) {
      console.error("[extraction:log] Failed to save log:", error.message);
      return null;
    }
    return data.id;
  } catch (err) {
    console.error("[extraction:log] Unexpected error saving log:", err);
    return null;
  }
}

/**
 * Link an extraction log to a bill after the bill is created.
 */
export async function linkExtractionLogToBill(
  logId: string,
  billId: string,
): Promise<void> {
  try {
    const supabase = createServiceClient();
    await supabase
      .from("extraction_logs")
      .update({ bill_id: billId })
      .eq("id", logId);
  } catch (err) {
    console.error("[extraction:log] Failed to link log to bill:", err);
  }
}
