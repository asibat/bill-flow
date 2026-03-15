export type BillStatus = 'received' | 'scheduled' | 'payment_sent' | 'confirmed' | 'overdue'
export type BillSource = 'doccle' | 'email' | 'upload' | 'manual'

export interface Bill {
  id: string
  user_id: string
  source: BillSource
  payee_name: string
  payee_id: string | null
  amount: number
  currency: string
  due_date: string
  structured_comm: string | null
  structured_comm_valid: boolean | null
  iban: string | null
  bic: string | null
  status: BillStatus
  extraction_confidence: number | null
  language_detected: string | null
  explanation: string | null
  raw_pdf_path: string | null
  doccle_url: string | null
  wire_reference: string | null
  paid_at: string | null
  notes: string | null
  needs_review: boolean
  created_at: string
  updated_at: string
}

export interface Payee {
  id: string
  user_id: string | null
  name: string
  iban: string | null
  bic: string | null
  category: 'utility' | 'telecom' | 'tax' | 'insurance' | 'rent' | 'other'
  country: string
  verified: boolean
  created_at: string
}

export interface Reminder {
  id: string
  bill_id: string
  remind_at: string
  channel: 'email' | 'push'
  sent_at: string | null
  dismissed_at: string | null
}

export interface ExtractionResult {
  payee_name: string | null
  amount: number | null
  currency: string
  due_date: string | null
  structured_comm: string | null
  iban: string | null
  bic: string | null
  language_detected: string | null
  explanation: string | null
  confidence: number
  raw_text_snippet: string | null
}

export interface VendorMatch {
  payee_id: string
  payee_name: string
  category: string
  is_new: boolean
}

export interface UploadResponse {
  extraction: ExtractionResult
  structured_comm_valid: boolean | null
  storage_path: string
  needs_review: boolean
  vendor: VendorMatch | null
}

export type BillFormData = Record<string, unknown>

export interface WireTransferCard {
  beneficiary: string
  iban: string
  bic: string
  amount: number
  currency: string
  structured_comm: string
  due_date: string
  reference: string
}
