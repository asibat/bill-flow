/**
 * N26 CSV export parser.
 *
 * N26 exports semicolon-delimited CSVs with a header row. The exact column
 * names vary slightly by account region/language but the canonical English
 * export looks like:
 *
 *   "Date";"Payee";"Account number";"Transaction type";"Payment reference";
 *   "Amount (EUR)";"Amount (Foreign Currency)";"Type Foreign Currency";"Exchange Rate"
 *
 * Amounts use "." as decimal separator, may be negative for debits.
 */

export interface RawTransaction {
  date: string          // ISO YYYY-MM-DD
  payee: string
  account: string | null
  type: string | null
  reference: string | null
  amount: number        // negative = expense, positive = income
  currency: string
}

export interface ParseResult {
  transactions: RawTransaction[]
  errors: Array<{ row: number; message: string }>
  filename: string
}

// Maps common N26 column header variants → canonical key
const COLUMN_MAP: Record<string, keyof RawTransaction | '_skip'> = {
  // N26 English export (old format)
  'date': 'date',
  'payee': 'payee',
  'account number': 'account',
  'transaction type': 'type',
  'payment reference': 'reference',
  'amount (eur)': 'amount',
  'amount (foreign currency)': '_skip',
  'type foreign currency': '_skip',
  // N26 English export (new format)
  'booking date': 'date',
  'value date': '_skip',
  'partner name': 'payee',
  'partner iban': 'account',
  'type': 'type',
  'account name': '_skip',
  'original amount': '_skip',
  'original currency': '_skip',
}

function stripBom(text: string): string {
  return text.charCodeAt(0) === 0xfeff ? text.slice(1) : text
}

function parseAmount(raw: string): number | null {
  const cleaned = raw.replace(/\s/g, '').replace(',', '.')
  const n = parseFloat(cleaned)
  return isNaN(n) ? null : n
}

function parseDate(raw: string): string | null {
  // N26 uses YYYY-MM-DD, but guard against locale variants
  const trimmed = raw.trim()
  // Already ISO
  if (/^\d{4}-\d{2}-\d{2}$/.test(trimmed)) return trimmed
  // DD/MM/YYYY
  const dmy = trimmed.match(/^(\d{2})\/(\d{2})\/(\d{4})$/)
  if (dmy) return `${dmy[3]}-${dmy[2]}-${dmy[1]}`
  // MM/DD/YYYY
  const mdy = trimmed.match(/^(\d{2})-(\d{2})-(\d{4})$/)
  if (mdy) return `${mdy[3]}-${mdy[1]}-${mdy[2]}`
  return null
}

function splitCsvRow(line: string, delimiter: string): string[] {
  const result: string[] = []
  let current = ''
  let inQuotes = false

  for (let i = 0; i < line.length; i++) {
    const ch = line[i]
    if (ch === '"') {
      inQuotes = !inQuotes
    } else if (ch === delimiter && !inQuotes) {
      result.push(current.trim())
      current = ''
    } else {
      current += ch
    }
  }
  result.push(current.trim())
  return result
}

function detectDelimiter(headerLine: string): string {
  const semicolons = (headerLine.match(/;/g) ?? []).length
  const commas = (headerLine.match(/,/g) ?? []).length
  return semicolons >= commas ? ';' : ','
}

export function parseN26Csv(csvText: string, filename: string): ParseResult {
  const errors: Array<{ row: number; message: string }> = []
  const transactions: RawTransaction[] = []

  const lines = stripBom(csvText).split('\n').map(l => l.trim()).filter(Boolean)
  if (lines.length < 2) {
    return { transactions, errors: [{ row: 0, message: 'File is empty or has no data rows' }], filename }
  }

  const delimiter = detectDelimiter(lines[0])
  const headers = splitCsvRow(lines[0], delimiter).map(h => h.toLowerCase().replace(/"/g, ''))

  // Build index map: column position → canonical field
  const colIndex: Record<number, keyof RawTransaction | '_skip'> = {}
  let amountCol = -1

  for (let i = 0; i < headers.length; i++) {
    const mapped = COLUMN_MAP[headers[i]]
    if (mapped) {
      colIndex[i] = mapped
      if (mapped === 'amount') amountCol = i
    }
  }

  if (amountCol === -1) {
    return { transactions, errors: [{ row: 0, message: 'Could not find amount column. Is this an N26 CSV export?' }], filename }
  }

  for (let rowIdx = 1; rowIdx < lines.length; rowIdx++) {
    const cells = splitCsvRow(lines[rowIdx], delimiter).map(c => c.replace(/^"|"$/g, ''))

    try {
      const raw: Partial<RawTransaction> = { currency: 'EUR' }

      for (const [idxStr, field] of Object.entries(colIndex)) {
        if (field === '_skip') continue
        const idx = Number(idxStr)
        const val = cells[idx] ?? ''

        if (field === 'date') {
          const parsed = parseDate(val)
          if (!parsed) {
            errors.push({ row: rowIdx + 1, message: `Invalid date: "${val}"` })
            continue
          }
          raw.date = parsed
        } else if (field === 'amount') {
          const parsed = parseAmount(val)
          if (parsed === null) {
            errors.push({ row: rowIdx + 1, message: `Invalid amount: "${val}"` })
            continue
          }
          raw.amount = parsed
        } else {
          (raw as Record<string, string | null>)[field] = val || null
        }
      }

      if (!raw.date || raw.amount === undefined || !raw.payee) {
        errors.push({ row: rowIdx + 1, message: `Missing required fields (date, amount, payee)` })
        continue
      }

      transactions.push(raw as RawTransaction)
    } catch (err) {
      errors.push({ row: rowIdx + 1, message: `Parse error: ${String(err)}` })
    }
  }

  return { transactions, errors, filename }
}
