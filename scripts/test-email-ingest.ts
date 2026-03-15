/**
 * Test script: reads a raw email file, parses it, and POSTs to the ingest endpoint.
 * Usage: npx tsx scripts/test-email-ingest.ts [path-to-email.txt]
 */

import { readFileSync } from "fs";
import { resolve } from "path";

const emailFile = process.argv[2] || resolve(__dirname, "../email.txt");
const INGEST_URL =
  process.env.INGEST_URL || "http://localhost:3000/api/ingest/email";
const INBOX_ADDRESS = "bills.c0af7150@billflow.app";

function decodeQuotedPrintable(str: string): string {
  return str
    .replace(/=\r?\n/g, "") // soft line breaks
    .replace(/=([0-9A-Fa-f]{2})/g, (_, hex) =>
      String.fromCharCode(parseInt(hex, 16))
    );
}

function parseRawEmail(raw: string) {
  // Split headers from body (first blank line)
  const headerBodySplit = raw.indexOf("\n\n");
  const headerSection = raw.slice(0, headerBodySplit);
  const bodyRaw = raw.slice(headerBodySplit + 2);

  // Parse headers (unfold continuation lines)
  const unfolded = headerSection.replace(/\r?\n\s+/g, " ");
  const headers: Record<string, string> = {};
  for (const line of unfolded.split("\n")) {
    const match = line.match(/^([\w-]+):\s*(.+)/);
    if (match) {
      headers[match[1].toLowerCase()] = match[2].trim();
    }
  }

  // Decode body
  const isQuotedPrintable = (
    headers["content-transfer-encoding"] || ""
  ).includes("quoted-printable");
  const html = isQuotedPrintable ? decodeQuotedPrintable(bodyRaw) : bodyRaw;

  return {
    from: headers["from"] || "",
    to: INBOX_ADDRESS,
    subject: headers["subject"] || "",
    text: "",
    html,
  };
}

async function main() {
  const raw = readFileSync(emailFile, "utf-8");
  const parsed = parseRawEmail(raw);

  console.log("--- Parsed email ---");
  console.log("From:", parsed.from);
  console.log("To:", parsed.to);
  console.log("Subject:", parsed.subject);
  console.log("HTML length:", parsed.html.length, "chars");
  console.log("");
  console.log(`POSTing to ${INGEST_URL}...`);

  const res = await fetch(INGEST_URL, {
    method: "POST",
    headers: { "Content-Type": "application/json" },
    body: JSON.stringify(parsed),
  });

  const body = await res.json();
  console.log(`Response: ${res.status}`, body);
}

main().catch(console.error);
