/**
 * PII detection for Belgian bill documents.
 *
 * Identifies personal information in extracted text and returns
 * matches with their positions for user review before redaction.
 */

export type PiiType =
  | 'national_number'  // Belgian NN: XX.XX.XX-XXX.XX
  | 'phone'            // Belgian phone: +32..., 04XX/XX.XX.XX
  | 'email'            // email@domain.com
  | 'address'          // Street + number patterns
  | 'name_header'      // "Naam/Nom:" followed by a name

export interface PiiMatch {
  type: PiiType
  value: string
  start: number
  end: number
  replacement: string
}

/** Belgian national number: XX.XX.XX-XXX.XX or XXXXXXXXX-XX */
const NATIONAL_NUMBER_PATTERNS = [
  /\b\d{2}\.\d{2}\.\d{2}[-–]\d{3}\.\d{2}\b/g,
  /\b\d{6}[-–]\d{3}[-–]\d{2}\b/g,
  // NN without separators (11 digits starting with valid birth date)
  /\b[0-9]{2}[01]\d[0-3]\d\d{3}\d{2}\b/g,
]

/** Belgian phone numbers */
const PHONE_PATTERNS = [
  /(?:\+32|0032)\s*[\d\s./-]{8,12}/g,
  /\b0\d[\s./\-]?\d{2,3}[\s./\-]?\d{2}[\s./\-]?\d{2}\b/g,
  /\b04\d{2}[\s./\-]?\d{2}[\s./\-]?\d{2}[\s./\-]?\d{2}\b/g,
]

/** Email addresses */
const EMAIL_PATTERN = /\b[A-Za-z0-9._%+-]+@[A-Za-z0-9.-]+\.[A-Za-z]{2,}\b/g

/**
 * Belgian address patterns — street names followed by numbers.
 * Matches common patterns like:
 *   "Rue de la Loi 16", "Wetstraat 16", "Avenue Louise 123/4"
 */
const ADDRESS_PATTERNS = [
  // FR: Rue/Avenue/Boulevard + name + number
  /(?:Rue|Avenue|Boulevard|Place|Allée|Chemin|Impasse|Chaussée)\s+[A-ZÀ-Ü][a-zà-ü]+(?:\s+[a-zà-ü]+)*\s+\d{1,4}(?:\s*[\/,]\s*\d{1,4})?\b/gi,
  // NL: straat/laan/weg/plein + number
  /\b[A-ZÀ-Ü][a-zà-ü]+(?:straat|laan|weg|plein|dreef|steenweg|singel)\s+\d{1,4}(?:\s*[\/,]\s*\d{1,4})?\b/gi,
  // Postal code + city: 1000 Bruxelles, 2000 Antwerpen
  /\b[1-9]\d{3}[ \t]+[A-ZÀ-Ü][a-zà-ü]+(?:[ \t]+[A-ZÀ-Ü][a-zà-ü]+)?\b/g,
]

/** Name headers in Belgian bills */
const NAME_HEADER_PATTERNS = [
  // Dutch: "Naam:", "Naam van de klant:", "Klant:"
  /(?:Naam|Klant|Bestemming|Begunstigde|Geadresseerde)\s*:\s*[A-ZÀ-Ü][^\n,]{2,40}/gi,
  // French: "Nom:", "Nom du client:", "Destinataire:"
  /(?:Nom|Client|Destinataire|Titulaire)\s*:\s*[A-ZÀ-Ü][^\n,]{2,40}/gi,
]

const REPLACEMENT_MAP: Record<PiiType, string> = {
  national_number: '[REDACTED_NN]',
  phone: '[REDACTED_PHONE]',
  email: '[REDACTED_EMAIL]',
  address: '[REDACTED_ADDRESS]',
  name_header: '[REDACTED_NAME]',
}

/**
 * Detect PII in text. Returns all matches sorted by position.
 * Does NOT redact — returns matches for user review.
 */
export function detectPii(text: string): PiiMatch[] {
  const matches: PiiMatch[] = []

  // National numbers
  for (const pattern of NATIONAL_NUMBER_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern))) {
      matches.push({
        type: 'national_number',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        replacement: REPLACEMENT_MAP.national_number,
      })
    }
  }

  // Phones
  for (const pattern of PHONE_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern))) {
      matches.push({
        type: 'phone',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        replacement: REPLACEMENT_MAP.phone,
      })
    }
  }

  // Emails
  for (const match of text.matchAll(new RegExp(EMAIL_PATTERN))) {
    matches.push({
      type: 'email',
      value: match[0],
      start: match.index!,
      end: match.index! + match[0].length,
      replacement: REPLACEMENT_MAP.email,
    })
  }

  // Addresses
  for (const pattern of ADDRESS_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern))) {
      matches.push({
        type: 'address',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        replacement: REPLACEMENT_MAP.address,
      })
    }
  }

  // Name headers
  for (const pattern of NAME_HEADER_PATTERNS) {
    for (const match of text.matchAll(new RegExp(pattern))) {
      matches.push({
        type: 'name_header',
        value: match[0],
        start: match.index!,
        end: match.index! + match[0].length,
        replacement: REPLACEMENT_MAP.name_header,
      })
    }
  }

  // Filter out matches that overlap with IBANs or structured communications
  const protectedRanges = findProtectedRanges(text)
  const filtered = matches.filter(m => !protectedRanges.some(([s, e]) => m.start < e && m.end > s))

  // Sort by position and deduplicate overlapping matches
  filtered.sort((a, b) => a.start - b.start)
  return deduplicateOverlapping(filtered)
}

const IBAN_RE = /\b[A-Z]{2}\d{2}\s*\d{4}\s*\d{4}\s*\d{4}\s*\d{0,4}\b/g
const STRUCTURED_COMM_RE = /\+{3}\d{3}\/\d{4}\/\d{5}\+{3}/g

function findProtectedRanges(text: string): [number, number][] {
  const ranges: [number, number][] = []
  for (const m of text.matchAll(new RegExp(IBAN_RE))) {
    ranges.push([m.index!, m.index! + m[0].length])
  }
  for (const m of text.matchAll(new RegExp(STRUCTURED_COMM_RE))) {
    ranges.push([m.index!, m.index! + m[0].length])
  }
  return ranges
}

/**
 * Remove overlapping matches, keeping the longer one.
 */
function deduplicateOverlapping(matches: PiiMatch[]): PiiMatch[] {
  if (matches.length <= 1) return matches

  const result: PiiMatch[] = [matches[0]]
  for (let i = 1; i < matches.length; i++) {
    const prev = result[result.length - 1]
    const curr = matches[i]
    if (curr.start < prev.end) {
      // Overlapping — keep the longer match
      if (curr.end - curr.start > prev.end - prev.start) {
        result[result.length - 1] = curr
      }
    } else {
      result.push(curr)
    }
  }
  return result
}

/**
 * Apply redactions to text based on PII matches.
 * Only redacts matches the user has approved (by index).
 */
export function applyRedactions(text: string, matches: PiiMatch[], approvedIndices?: number[]): string {
  // If no approved indices specified, redact all
  const toRedact = approvedIndices
    ? matches.filter((_, i) => approvedIndices.includes(i))
    : matches

  // Apply from end to start to preserve positions
  let result = text
  for (let i = toRedact.length - 1; i >= 0; i--) {
    const m = toRedact[i]
    result = result.slice(0, m.start) + m.replacement + result.slice(m.end)
  }
  return result
}
