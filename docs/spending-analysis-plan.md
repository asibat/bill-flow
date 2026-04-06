# Spending Analysis Feature — Implementation Plan

## Overview

Import N26 bank statement CSVs, AI-recategorize transactions (N26's built-in categories are unreliable), and visualize household cost-of-living breakdowns. Hidden behind `FEATURE_SPENDING_ANALYSIS` flag for local dev only.

---

## Requirements

- Upload N26 CSV exports (monthly or quarterly)
- AI re-categorizes every transaction using Claude
- User can override individual category assignments
- Track and visualize where money is going (by category, payee, month)
- User configures household context (size, income) for richer insights
- Feature-flagged — only visible when `FEATURE_SPENDING_ANALYSIS=true` in `.env.local`

---

## Open Question

> Should the spending dashboard be a **new top-level route** (`/spending`) or a **tab inside `/dashboard`**?

---

## Phase 1 — Database Schema

**New migration:** `supabase/migrations/010_transactions.sql`

### `transactions` table
| Column | Type | Notes |
|---|---|---|
| `id` | `uuid` | PK, default `gen_random_uuid()` |
| `user_id` | `uuid` | FK → `auth.users`, RLS enforced |
| `date` | `date` | Transaction date from CSV |
| `amount` | `numeric(12,2)` | Negative = expense, positive = income |
| `currency` | `text` | e.g. `EUR` |
| `payee_raw` | `text` | Original payee name from N26 |
| `category_n26` | `text` | N26's original category (kept for reference) |
| `category_ai` | `text` | Claude-assigned category |
| `category_user` | `text` | User override (nullable — takes precedence over AI) |
| `description` | `text` | Raw transaction description/reference |
| `account` | `text` | Account name/IBAN from N26 export |
| `source_file` | `text` | Original filename (for dedup + audit) |
| `created_at` | `timestamptz` | Default `now()` |

### `user_settings` extensions
Add to existing `user_settings` table:
| Column | Type | Notes |
|---|---|---|
| `household_size` | `int` | Number of people in household |
| `monthly_income` | `numeric(12,2)` | Combined net monthly income |
| `income_currency` | `text` | Default `EUR` |

### Indexes & RLS
- Index on `(user_id, date)` for date-range queries
- Index on `(user_id, category_ai)` for category breakdowns
- RLS: users can only read/write their own transactions

---

## Phase 2 — N26 CSV Parser

**File:** `lib/spending/csv-parser.ts`

N26 exports are semicolon-delimited CSVs with these columns:
```
"Date";"Payee";"Account number";"Transaction type";"Payment reference";"Amount (EUR)";"Amount (Foreign Currency)";"Type Foreign Currency";"Exchange Rate"
```

- Handle UTF-8 BOM and encoding quirks
- Strip quotes, parse amounts as floats
- Map to typed `RawTransaction[]`
- Return parse errors per row (don't fail the whole import on one bad row)

---

## Phase 3 — AI Categorization

**File:** `lib/spending/categorize.ts`

### Categories
| Category | Examples |
|---|---|
| `housing` | Rent, mortgage, property tax |
| `utilities` | Gas, electricity, water, internet |
| `groceries` | Supermarkets, food shops |
| `transport` | STIB, SNCB, Uber, fuel, parking |
| `health` | Pharmacy, doctor, insurance |
| `dining` | Restaurants, cafes, takeaway |
| `subscriptions` | Netflix, Spotify, SaaS tools |
| `shopping` | Amazon, clothing, electronics |
| `income` | Salary, freelance, refunds |
| `transfer` | Interbank transfers, Revolut top-ups |
| `other` | Uncategorized |

### Strategy
- Batch 50 transactions per Claude call (minimize API cost)
- Use tool_use for structured JSON output
- Store both N26 category and AI category for comparison/debugging
- User overrides stored in `category_user` — always takes precedence in UI

---

## Phase 4 — API Routes

| Route | Method | Purpose |
|---|---|---|
| `/api/spending/import` | `POST` | Accept CSV upload, parse, batch-categorize via Claude, store |
| `/api/spending/transactions` | `GET` | List transactions with filters (date range, category, search) |
| `/api/spending/transactions/[id]` | `PATCH` | Override category for a single transaction |
| `/api/spending/summary` | `GET` | Aggregated stats for charts (category totals, monthly trend, top payees) |

---

## Phase 5 — UI

### Route
`/app/spending/page.tsx` — server component, checks feature flag, fetches summary

### Components
- **`SpendingUpload`** — CSV dropzone + import progress, shows parse/categorization status
- **`CategoryBreakdown`** — Pie/donut chart of spend by category this month
- **`MonthlyTrend`** — Bar chart of total spend per month (last 6 months)
- **`TopPayees`** — Ranked list of highest-spend payees
- **`TransactionTable`** — Paginated list with inline category override dropdown
- **`HouseholdSummary`** — Cards: total spent, avg per person, vs. income %

### Charting Library
Add `recharts` — lightweight, React-native, no canvas required.
```bash
npm install recharts
```

---

## Feature Flag

Add to `lib/features/index.ts`:
```typescript
SPENDING_ANALYSIS: false,
```

Enable locally in `.env.local`:
```
FEATURE_SPENDING_ANALYSIS=true
```

Gate in layout/nav so the route is invisible unless enabled.

---

## Dependencies & Risks

| Item | Risk | Mitigation |
|---|---|---|
| N26 CSV format changes | Medium | Parser is isolated in `lib/spending/csv-parser.ts`, easy to update |
| Claude API cost on large imports | Low | Batch 50 transactions/call; quarterly CSV ~300 rows = 6 calls |
| Duplicate imports | Medium | Dedup on `(user_id, date, amount, payee_raw)` unique constraint |
| Category quality | Low | User override always available; AI reasoning logged |

---

## Implementation Order

1. [ ] Migration `010_transactions.sql`
2. [ ] `lib/spending/csv-parser.ts` + unit tests
3. [ ] `lib/spending/categorize.ts` (Claude batch tool)
4. [ ] API routes (import → transactions → summary)
5. [ ] Feature flag + nav link
6. [ ] UI: upload → transaction table → charts
7. [ ] Household settings page extension
