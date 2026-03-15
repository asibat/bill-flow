# BillFlow Architecture

Belgian bill management app for expats. Extracts payment details from uploaded bills and email forwards using AI, with privacy controls and deduplication.

## System Context

```
┌─────────────┐         ┌──────────────────────────────────┐
│   User      │────────▶│         BillFlow (Next.js)        │
│  (Browser)  │◀────────│                                    │
└─────────────┘         │  ┌────────┐  ┌─────────────────┐  │
                        │  │ App    │  │ API Routes      │  │
                        │  │ Router │  │ /api/upload     │  │
                        │  │        │  │ /api/bills      │  │
                        │  │        │  │ /api/ingest     │  │
                        │  │        │  │ /api/pii        │  │
                        │  │        │  │ /api/recurring  │  │
                        │  │        │  │ /api/analytics  │  │
                        │  └────────┘  └────────┬────────┘  │
                        └───────────────────────┼───────────┘
                                                │
                    ┌───────────────┬────────────┼────────────┐
                    ▼               ▼            ▼            ▼
              ┌──────────┐  ┌────────────┐ ┌─────────┐ ┌──────────┐
              │ Supabase │  │ Gemini /   │ │ Resend  │ │ Tesseract│
              │ (DB +    │  │ Claude API │ │ (Email) │ │ (Local   │
              │ Storage) │  │ (Extract)  │ │         │ │  OCR)    │
              └──────────┘  └────────────┘ └─────────┘ └──────────┘
```

## Core Flows

### 1. Bill Upload (with Privacy Protection)

The upload flow runs direct extraction first, then scans for PII. The user chooses between privacy-first (redacted) or maximum accuracy (direct). When OCR confidence is low, a side-by-side comparison helps the user pick the best fields from either extraction.

```
User uploads file
       │
       ▼
┌──────────────────┐
│ POST /api/upload │──────▶ Store file in Supabase Storage
│                  │──────▶ Send image/PDF to Gemini (direct extraction)
└────────┬─────────┘
         │
         ▼
┌──────────────────┐
│ POST /api/pii/   │──────▶ OCR with tesseract.js (local, no API)
│      scan        │──────▶ Regex PII detection (NN, phone, email, address, name)
└────────┬─────────┘
         │
         ├── No PII found ──▶ Go to Review step
         │
         ▼ PII found
┌──────────────────┐
│ Privacy Choice   │  User picks one of two modes:
└────────┬─────────┘
         │
         ├── 🎯 Maximum Accuracy ──▶ Use direct extraction, go to Review
         │
         ▼ 🔒 Strict Privacy
┌──────────────────┐
│ Redaction Preview│  User sees highlighted PII with per-item toggle
│ (client-side)    │  Can select which items to redact
└────────┬─────────┘
         │
         ▼ Approve redactions
┌──────────────────┐
│ POST /api/pii/   │──────▶ Send REDACTED text to Gemini
│    extract       │        (AI never sees personal data)
└────────┬─────────┘
         │
         ├── OCR confidence >= 80% ──▶ Use redacted extraction, go to Review
         │
         ▼ OCR confidence < 80%
┌──────────────────────────────────────────────────┐
│ Side-by-Side Comparison                          │
│                                                  │
│  ┌─────────────────┐    ┌─────────────────┐      │
│  │ 🔒 Redacted     │ vs │ 🎯 Direct       │      │
│  │ (privacy-first) │    │ (full image)    │      │
│  └─────────────────┘    └─────────────────┘      │
│                                                  │
│  User clicks cells to pick best value per field  │
│  Fields that differ are highlighted              │
│  Default: prefer redacted unless field is empty  │
└────────┬─────────────────────────────────────────┘
         │
         ▼
┌──────────────────┐
│ Review & Save    │──────▶ Dedup check ──▶ POST /api/bills
└──────────────────┘
```

**Privacy vs accuracy tradeoff:** The user controls this per bill:
- **Strict Privacy** — AI only sees redacted OCR text. May lose accuracy on poor scans.
- **Maximum Accuracy** — AI reads the original image. Best extraction quality.
- **Comparison view** — Shown when OCR confidence < 80%. User cherry-picks fields from both extractions. Default selection favors privacy (redacted values) unless a field is empty.

### 2. Email / Doccle Ingestion

```
Email arrives at bills.{userId}@billflow.app
       │
       ▼
┌──────────────────────┐
│ POST /api/ingest/    │
│      email           │
└────────┬─────────────┘
         │
         ├── Contains Doccle URL? ──▶ handleDoccleEmail()
         │                                │
         │                                ├── Fetch Doccle page HTML
         │                                ├── Try to download PDF
         │                                ├── Parse HTML metadata (amount, date, payee)
         │                                ├── Extract via Gemini from combined text
         │                                ├── Dedup check ──▶ skip if duplicate
         │                                └── Insert bill + auto-create reminder
         │
         └── Generic email ──▶ handleGenericEmail()
                                    │
                                    ├── Extract via Gemini from email text
                                    ├── Dedup check ──▶ skip if duplicate
                                    └── Insert bill
```

### 3. Deduplication

Runs before every bill insertion. Two matching strategies:

```
New bill candidate
       │
       ▼
┌──────────────────────┐
│ Strategy 1:          │  Structured comm is the strongest signal
│ Structured comm      │  for Belgian bills (unique per invoice)
│ match                │
└────────┬─────────────┘
         │
         ├── Match found ──▶ Block (upload) or skip (email)
         │
         ▼ No match
┌──────────────────────┐
│ Strategy 2:          │  Same vendor + same amount + same due date
│ Payee + Amount +     │  = almost certainly the same bill
│ Due date match       │
└────────┬─────────────┘
         │
         ├── Match found ──▶ Show duplicate warning (upload)
         │                   User can "Save Anyway" to force
         │
         └── No match ──▶ Insert bill
```

| Context | Duplicate behavior |
|---------|-------------------|
| Upload / Manual | Returns 409 with duplicate details. UI shows warning + "Save Anyway" |
| Email / Doccle | Silently skips, returns existing bill ID |

### 4. AI Extraction

Provider-agnostic extraction with Gemini (default) or Claude.

```
Input (text / image / PDF)
       │
       ▼
┌──────────────────────┐
│ Extraction Provider  │  Selected via EXTRACTION_PROVIDER env var
│ (Gemini / Claude)    │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Sanitization         │  clean() — converts "N/A", "none", -1 → null
│                      │  cleanNumber() — rejects negative values
│                      │  cleanDate() — validates date format
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Extraction Log       │  Persisted to extraction_logs table
│                      │  Raw AI response, reasoning notes, confidence
└────────┬─────────────┘
         │
         ▼
  ExtractionResult
  { payee_name, amount, currency, due_date,
    structured_comm, iban, bic, confidence, ... }
```

### 5. Recurring Detection

```
All user bills
       │
       ▼
┌──────────────────────┐
│ Group by payee       │  Case-insensitive payee name matching
│ (normalized)         │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Calculate average    │  Average days between due dates
│ interval per group   │
└────────┬─────────────┘
         │
         ▼
┌──────────────────────┐
│ Match to known       │  monthly (25-35d), bi-monthly (55-65d),
│ frequencies          │  quarterly (80-100d), semi-annual (165-195d),
│                      │  annual (350-380d)
└────────┬─────────────┘
         │
         ▼
  RecurringPattern
  { payee, frequency, avg_amount, next_expected_date, confidence }
```

## Key Modules

| Module | Path | Purpose |
|--------|------|---------|
| Extraction | `lib/extraction/` | AI-powered bill data extraction (Gemini/Claude) |
| PII | `lib/pii/` | OCR + PII detection + redaction |
| Dedup | `lib/dedup/` | Bill fingerprinting and duplicate detection |
| Recurring | `lib/recurring/` | Recurring bill pattern detection |
| Analytics | `lib/analytics/` | Spending trends, vendor breakdowns |
| Currency | `lib/currency/` | Multi-currency conversion and aggregation |
| Features | `lib/features/` | Feature flag system (env var based) |
| Vendors | `lib/vendors/` | Vendor matching and management |
| Utils | `lib/utils/` | Structured comm validation, formatting, Doccle parsing |

## Feature Flags

Controlled via environment variables:

| Flag | Default | Controls |
|------|---------|----------|
| `FEATURE_DASHBOARD_ANALYTICS` | `false` | Monthly spending chart + top vendors on dashboard |

## Data Flow Summary

```
                    ┌─────────┐
                    │  User   │
                    └────┬────┘
                         │
              ┌──────────┴──────────┐
              ▼                     ▼
        Upload / Manual        Email Forward
              │                     │
              ▼                     ▼
        ┌─────────┐          ┌───────────┐
        │ PII     │          │ Ingest    │
        │ Scan    │          │ (Doccle / │
        │ (opt)   │          │  Generic) │
        └────┬────┘          └─────┬─────┘
             │                     │
             └──────────┬──────────┘
                        ▼
                  ┌───────────┐
                  │ AI Extract│──▶ Extraction Log
                  └─────┬─────┘
                        ▼
                  ┌───────────┐
                  │ Dedup     │──▶ Block / Skip / Warn
                  └─────┬─────┘
                        ▼
                  ┌───────────┐
                  │ Save Bill │──▶ Vendor Match
                  └─────┬─────┘    + Auto Reminder
                        ▼
                  ┌───────────┐
                  │ Dashboard │──▶ Analytics
                  │ + Bills   │    + Recurring Detection
                  └───────────┘
```
