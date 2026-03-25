# Bank Statements and Cost-of-Living Plan

This document defines the next major product line for BillFlow: ingesting bank statements, learning from real account activity, and turning bills plus transactions into a coherent cost-of-living product.

The goal is not to bolt on a second tool. The goal is to reshape BillFlow into one app with multiple financial input streams and one clear output: understanding what needs to be paid, what was paid, and where money goes.

## Product Thesis

BillFlow already handles:

- bills that ask the user to pay
- reminders that help the user act
- extraction and review of payment details
- basic vendor and spending analytics derived from bills

The next step is to add a second data stream:

- bank statements that show what actually happened in the user’s account

That unlocks a stronger product:

- bill management
- payment reconciliation
- recurring cost detection
- cost-of-living insights
- spending categorization
- merchant learning

## Core Product Model

The app should be organized around three connected objects:

1. Bills
- money the user is asked to pay
- usually comes from uploads, forwarded emails, or manual entry

2. Transactions
- money that actually moved in or out of the user’s bank account
- usually comes from bank statements or CSV imports

3. Insights
- the combined understanding of bills and transactions
- answers: what is due, what was paid, what repeats, and where money goes

This means bank statements should not create bills by default.

Instead:

- bank statements create `transactions`
- transactions can optionally match existing `bills`
- unmatched recurring outflows can become suggested recurring costs
- unmatched one-off outflows can stay as categorized spend

## User Value

With this feature, a user should be able to:

- upload a monthly or quarterly bank statement
- review parsed transactions and fix mistakes
- approve merchant/category suggestions
- link transactions to existing bills when appropriate
- turn repeated non-bill payments into recurring costs
- see a usable cost-of-living picture across housing, groceries, utilities, transport, subscriptions, taxes, and other spending

## MVP Scope

The first version should include:

- PDF bank statement upload
- CSV import when available
- normalized transaction extraction
- review and correction UI
- categorization rules
- bill-to-transaction matching
- recurring merchant detection
- cost-of-living dashboard

The first version should not include:

- direct bank account sync
- native mobile-specific statement parsing
- photo OCR for printed statements
- tax exports
- shared family budgeting
- AI-only autonomous categorization with no review path

## Data Model

Add these tables.

### `bank_accounts`

Purpose:
- represent one user bank account or card account

Suggested columns:
- `id`
- `user_id`
- `bank_name`
- `account_name`
- `account_type`
- `iban_masked`
- `currency`
- `is_primary`
- `created_at`
- `updated_at`

### `statement_imports`

Purpose:
- track each uploaded statement file and its parse lifecycle

Suggested columns:
- `id`
- `user_id`
- `bank_account_id`
- `source_type` (`pdf` | `csv`)
- `raw_file_path`
- `period_start`
- `period_end`
- `parser_name`
- `parse_status` (`uploaded` | `parsed` | `needs_review` | `finalized` | `failed`)
- `parse_confidence`
- `row_count`
- `failure_reason`
- `created_at`
- `updated_at`

### `transactions`

Purpose:
- store normalized account activity

Suggested columns:
- `id`
- `user_id`
- `bank_account_id`
- `statement_import_id`
- `booked_at`
- `value_date`
- `amount`
- `currency`
- `direction` (`debit` | `credit`)
- `description_raw`
- `merchant_normalized`
- `counterparty_name`
- `counterparty_iban`
- `structured_comm`
- `category`
- `subcategory`
- `is_internal_transfer`
- `is_refund`
- `is_ignored`
- `matched_bill_id`
- `recurring_group_id`
- `confidence`
- `needs_review`
- `user_corrected`
- `created_at`
- `updated_at`

### `transaction_category_rules`

Purpose:
- store user-approved learning rules

Suggested columns:
- `id`
- `user_id`
- `match_type` (`merchant` | `iban` | `contains_text`)
- `match_value`
- `category`
- `subcategory`
- `priority`
- `created_at`

### `recurring_transaction_groups`

Purpose:
- store learned recurring non-bill costs

Suggested columns:
- `id`
- `user_id`
- `merchant_normalized`
- `counterparty_iban`
- `category`
- `expected_interval_days`
- `average_amount`
- `confidence`
- `last_seen_at`
- `next_expected_at`
- `created_at`
- `updated_at`

## Relationship to Existing Tables

Keep the current bill model.

Add only these links:

- `transactions.matched_bill_id -> bills.id`
- optional `transactions.recurring_group_id -> recurring_transaction_groups.id`

Do not collapse transactions into bills. That would damage the existing bill workflow.

## Parsing Strategy

Do not rely on AI as the only parser.

Use this priority order:

1. CSV parser for supported banks
2. bank-specific PDF text parser
3. generic PDF text extraction fallback
4. AI normalization for ambiguous rows

Why this is the right approach:

- bank statements are repetitive and structured
- deterministic parsers are easier to debug
- CSV is cheaper and more accurate when available
- AI is most useful for normalization and edge cases, not primary extraction of every row

## Supported Inputs for First Rollout

Start with a narrow set:

- BNP Paribas Fortis CSV/PDF
- ING Belgium CSV/PDF
- KBC CSV/PDF
- Belfius CSV/PDF

If this is too much for the first cut, start with:

- one bank CSV
- one bank PDF
- one generic PDF fallback

## Review and Correction Workflow

The review step is mandatory for trust.

User flow:

1. Upload statement
2. Parse transactions
3. Show grouped review table
4. Let user correct rows
5. Save finalized import
6. Generate insights

The review screen should support:

- editing date, amount, merchant, category, and notes
- marking a row as internal transfer
- marking a row as refund
- marking a row as ignored
- linking a row to an existing bill
- creating a new recurring cost from a repeated merchant
- bulk category assignment
- bulk ignore for noise rows

The app should clearly flag:

- low-confidence rows
- duplicate imports
- rows that might match a bill
- rows that look like recurring costs

## Learning Model

For MVP, “learning” should mean explicit user-approved rules.

Examples:

- `CARREFOUR EXPRESS` -> groceries
- landlord IBAN -> housing
- `SPOTIFY` -> subscriptions
- monthly debit from same merchant -> recurring cost

Learning should work like this:

1. parser suggests category or recurring grouping
2. user corrects or confirms
3. app stores a rule
4. future imports apply that rule automatically

This is preferable to a black-box model because it is:

- explainable
- debuggable
- easier to trust
- safer for financial UX

## Bills, Transactions, and Recurring Costs

The app should help the user classify money flows into one of three buckets:

1. Bill-backed payments
- transactions linked to a known bill
- examples: water, telecom, insurance invoice

2. Recurring costs
- repeated account outflows that may never arrive as bills inside the app
- examples: rent, gym, Spotify, groceries subscription, childcare transfer

3. General spending
- one-off or variable spending
- examples: groceries, transport, eating out, pharmacy

This creates a clean operating model:

- bills = obligations to act on
- recurring costs = expected recurring outflows
- transactions = actual account activity
- insights = summary of what happened

## Suggested Product Suggestions

The app should proactively suggest actions after statement review.

Examples:

- “This looks like a payment for an existing bill. Link it?”
- “This merchant appears every month. Create a recurring cost?”
- “This looks like rent. Track it as housing?”
- “These supermarket transactions should count as groceries. Apply this rule to future imports?”
- “This transfer has a Belgian structured communication. Match it to a bill?”

These suggestions should be reviewable, not auto-committed without visibility.

## Coherent App Reshape

The current app is bill-centric. After bank statements land, the app should be reshaped around one home and four clear product areas.

### Proposed Information Architecture

Primary navigation:

- Home
- Inbox
- Payments
- Spending
- Settings

Supporting areas:

- Vendors
- Accounts
- Imports

### What each area means

#### Home

The command center.

Shows:

- urgent bills due soon
- payment follow-ups
- recent statement imports needing review
- cost-of-living snapshot
- latest recurring-cost suggestions

This is where the product stops feeling like separate modules.

#### Inbox

All incoming financial inputs.

Contains:

- uploaded bills
- forwarded bill emails
- uploaded bank statements
- parsing/review queues

This gives the user one place to process incoming documents.

#### Payments

Everything bill-related and action-oriented.

Contains:

- bills list
- bill detail
- wire transfer card
- batches
- payment follow-up reminders
- matched payment confirmation

This keeps the original MVP value proposition intact.

#### Spending

Everything transaction and insight related.

Contains:

- transaction list
- category breakdown
- recurring costs
- monthly trends
- top merchants
- cost-of-living summary

This is where the bank statement feature lives.

### Product Language

Avoid making “bills” the label for everything.

Preferred product language:

- `Inbox` for incoming documents and imports
- `Payments` for obligations and bill execution
- `Spending` for account activity and insights
- `Recurring costs` for repeated outflows not necessarily backed by app bills

This gives the app a coherent mental model.

## UX Pattern for Suggestions

After parsing a statement, the UI should not dump raw rows and leave the user alone.

Instead, the review screen should include a suggestion rail with actions such as:

- link to bill
- categorize as groceries
- save merchant rule
- create recurring cost
- ignore internal transfer

The user should be able to accept suggestions row-by-row or in bulk.

## Dashboard and Insight Output

The first useful insight set should include:

- total spent this month
- fixed costs vs variable costs
- bills paid vs bills still open
- category breakdown
- top merchants
- recurring monthly costs
- unmatched high-value transfers
- cost-of-living summary
- month-over-month change

The summary should answer:

- how much of my spending is predictable?
- how much did I spend on essentials?
- which recurring costs are growing?
- which payments were bill-backed versus ad hoc?

## Cost-of-Living Framework

Suggested top-level categories:

- housing
- utilities
- telecom
- insurance
- groceries
- transport
- health
- taxes
- subscriptions
- leisure
- savings_transfers
- other

The UI should distinguish:

- essential spending
- flexible spending
- transfers and non-spend noise

Without that distinction, “cost of living” becomes too noisy to trust.

## Implementation Roadmap

### Phase 1: Foundation

Goal:
- store statement imports and normalized transactions

Tasks:

- add `bank_accounts`
- add `statement_imports`
- add `transactions`
- add storage path for statement files
- add import status tracking
- add parse logs and failure reasons

### Phase 2: Parsing

Goal:
- parse one statement source reliably

Tasks:

- implement CSV parser for one bank
- implement PDF parser for one bank
- add generic PDF fallback
- add duplicate import detection
- add structured parse logging and low-confidence markers

### Phase 3: Review UX

Goal:
- let the user trust and correct imported rows

Tasks:

- build transaction review table
- add row editing
- add bulk actions
- add ignore/refund/internal transfer states
- add finalize import action

### Phase 4: Matching and Learning

Goal:
- connect statement data to the rest of the app

Tasks:

- match transactions to bills
- detect recurring merchants
- allow recurring cost creation
- persist category rules
- apply learned rules to new imports

### Phase 5: Insights

Goal:
- turn reviewed transactions into useful cost-of-living insight

Tasks:

- category charts
- fixed vs variable spend
- top merchants
- recurring cost trend
- bills vs non-bill spending
- cost-of-living snapshot

## Recommended First Slice

The first real implementation slice should be:

- one statement import entry point
- one normalized `transactions` table
- one review screen
- one category rules system
- one basic spending dashboard

Concretely:

1. upload CSV/PDF for one bank
2. parse into transactions
3. review and correct
4. save
5. see category totals and recurring-cost suggestions

That is enough to validate the full loop before adding more banks and more automation.

## Main Risks

The biggest risks are:

- parser quality across different bank formats
- false bill matches
- bad category defaults
- internal transfers polluting spending numbers
- duplicate imports from repeated uploads

Mitigations:

- mandatory review for low-confidence rows
- explicit ignore/internal transfer/refund flags
- import-level duplicate detection
- transparent rule application
- visible provenance and confidence

## Recommended Next 10 Tasks

1. Add schema for `bank_accounts`, `statement_imports`, and `transactions`
2. Add storage upload path and import API for statement files
3. Add structured import logs and parse status tracking
4. Implement one deterministic CSV parser
5. Implement one PDF parser with fallback normalization
6. Build review table for imported transactions
7. Add category and merchant correction flow
8. Add bill matching suggestions
9. Add recurring-cost suggestions and creation flow
10. Add initial spending dashboard and cost-of-living summary

## Product Direction Summary

BillFlow should evolve from:

- a bill extraction and reminder app

into:

- a financial operations app for newcomers and expats

That app has one coherent story:

- collect incoming bills and statements
- review and correct extracted data
- pay what needs action
- understand what was actually spent
- learn recurring costs over time
- show a reliable cost-of-living picture
