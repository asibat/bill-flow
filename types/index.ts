export interface UserSettings {
  user_id: string
  display_name: string | null
  preferred_language: string
  salary_day: number | null
  email_inbox_address: string | null
  reminder_days_before: number
  email_notifications: boolean
  push_notifications: boolean
  onboarding_completed: boolean
  household_size: number | null
  monthly_income: number | null
  income_currency: string
  spending_date_from: string | null
  created_at: string
  updated_at: string
}

export type SpendingCategory =
  | 'housing'
  | 'utilities'
  | 'groceries'
  | 'transport'
  | 'travel'
  | 'health'
  | 'dining'
  | 'subscriptions'
  | 'shopping'
  | 'cash'
  | 'income'
  | 'transfer'
  | 'other'

export interface Transaction {
  id: string
  user_id: string
  date: string
  amount: number
  currency: string
  payee_raw: string
  category_n26: string | null
  category_ai: SpendingCategory | null
  category_user: SpendingCategory | null
  offsets_category: SpendingCategory | null
  description: string | null
  account: string | null
  account_name: string | null
  source_file: string | null
  created_at: string
}

/** The effective category — user override takes precedence over AI */
export function effectiveCategory(tx: Transaction): SpendingCategory {
  return tx.category_user ?? tx.category_ai ?? 'other'
}

export interface SpendingPayee {
  id: string
  user_id: string
  payee_raw: string
  display_name: string | null
  category: SpendingCategory | null
  notes: string | null
  offsets_category: SpendingCategory | null
  created_at: string
  updated_at: string
}

export interface CategorySummary {
  category: SpendingCategory
  gross: number        // raw expense total
  offsets: number      // income that offsets this category
  net: number          // gross - offsets
  count: number
  percentage: number   // % of total gross expenses
}

export interface TransactionSummary {
  totalExpenses: number
  totalIncome: number
  net: number
  currency: string
  byCategory: CategorySummary[]
  byMonth: Array<{ month: string; label: string; expenses: number; income: number }>
  topPayees: Array<{ payee: string; total: number; count: number }>
  savingsRate: number | null
  costOfLiving: number
  accountNames: string[]
  intraHouseholdCount: number
}

export type TransferPairStatus = 'pending' | 'confirmed' | 'rejected'

export interface HouseholdTransferPair {
  id: string
  user_id: string
  outgoing_transaction_id: string
  incoming_transaction_id: string
  status: TransferPairStatus
  amount_diff_pct: number
  date_diff_days: number
  created_at: string
  updated_at: string
  // Joined for UI display
  outgoing?: Transaction
  incoming?: Transaction
}

export type BillStatus = 'received' | 'scheduled' | 'payment_sent' | 'confirmed' | 'overdue'
export type BillSource = 'doccle' | 'email' | 'upload' | 'manual'
export type BillIngestionMethod =
  | 'doccle_html_pdf'
  | 'email_body_text'
  | 'email_attachment'
  | 'upload_pdf'
  | 'upload_image'
  | 'manual_entry'

export interface Bill {
  id: string
  user_id: string
  source: BillSource
  ingestion_method?: BillIngestionMethod | null
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
  user_id: string
  remind_at: string
  kind: 'custom_due' | 'due_7d' | 'due_3d' | 'due_today' | 'payment_followup'
  channel: 'email' | 'push'
  sent_at: string | null
  dismissed_at: string | null
  created_at: string
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

export type BatchStatus = 'pending' | 'in_progress' | 'completed'

export interface PaymentBatch {
  id: string
  user_id: string
  bill_ids: string[]
  total_amount: number
  currency: string
  status: BatchStatus
  created_at: string
  updated_at: string
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
