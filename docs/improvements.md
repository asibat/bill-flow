# Improvements Roadmap

This document captures the next product and engineering improvements after the current MVP baseline. The focus is not feature count. The focus is making BillFlow trustworthy, fast to use, easy to deploy, and good enough to live on a phone every day.

## Priority Order

### 1. Core reliability

Goal: make ingestion dependable for real forwarded bills, not just ideal-case emails.

- Add generic email attachment ingestion for non-Doccle billers
- Prefer PDF/image attachment extraction over body-text extraction when supported attachments are present
- Improve low-confidence review states and extraction failure handling
- Add stronger duplicate detection on forwarded invoices
- Add clearer bill-level provenance: source, extraction method, review edits

Implementation notes:

- Use Resend Receiving attachments API to fetch short-lived `download_url` values after the webhook fires
- Support PDFs and common image formats first
- Fall back to body-text extraction when attachment retrieval or extraction fails
- Log attachment selection, download failure, storage failure, extraction failure, and fallback path explicitly

### 2. Payment workflow polish

Goal: make the payment loop faster and harder to misuse.

- Add “copy all transfer details” in addition to individual field copy
- Improve batch payment flow and post-batch confirmation flow
- Add payment timeline/history on each bill
- Improve `payment_sent` vs `confirmed` UX so users do not get stuck mid-flow

Implementation notes:

- Keep individual field copy as the primary path
- Add a compact “step through payments” mode for batch execution on mobile
- Make follow-up reminders deep-link directly to the relevant bill

### 3. Phone UX

Goal: make the app comfortable to use from an installed phone web app.

- Tighten mobile layout, spacing, and tap targets
- Improve the wire transfer card for one-handed use
- Add camera-first upload and share-sheet friendly ingestion
- Polish standalone PWA behavior and installed-app framing

Implementation notes:

- Prioritize the bill detail and upload flows
- Make the wire transfer card sticky on mobile where possible
- Optimize for the “open app while looking at email or PDF” workflow

### 4. Notification quality

Goal: make reminders feel useful instead of noisy.

- Add snooze actions
- Add per-channel preferences: email, push, or both
- Add quiet hours / preferred notification time
- Add notification deep links to the exact bill detail
- Add presets: minimal, normal, aggressive

Implementation notes:

- Keep email as fallback
- Store notification preferences in `user_settings`
- Reuse the current reminder model rather than building a second scheduling system

### 5. Deployment hardening

Goal: make production deployment predictable.

- Add env validation on startup
- Add health/readiness route
- Add safer webhook logging and error diagnostics
- Add ingestion metrics and failure counters
- Expand deployment checklist for Vercel + Supabase + Resend

Implementation notes:

- Fail fast on missing critical env vars
- Avoid logging document contents or secrets
- Prefer structured logs for ingest, extraction, reminder delivery, and push delivery

### 6. Product trust

Goal: make users trust the payment details shown in the app.

- Add visible validation badges and review reasons
- Add data retention and delete-document controls
- Show why a vendor was matched
- Surface extraction confidence and provenance more clearly

Implementation notes:

- The user should be able to answer: “where did this amount and reference come from?”
- Keep the UI concise, but never hide the source of a critical payment field

### 7. Growth features after the above

Goal: expand channels only after the core loop is solid.

- Gmail / Outlook direct integrations
- Bank CSV import
- Recurring bill detection improvements
- Shared/family inbox
- Wise / Revolut deep-linking

Implementation notes:

- These should follow, not precede, generic attachment ingestion and phone UX work

## Suggested Next 10 Tasks

1. Implement generic PDF/image attachment ingestion with logging and fallback
2. Add attachment-specific extraction provenance on bill records
3. Add deep links from reminders to bill detail
4. Add snooze reminder action
5. Improve mobile wire transfer card layout
6. Add camera capture flow on mobile
7. Add notification quiet hours
8. Add startup env validation for production deploys
9. Add ingestion metrics and structured logs
10. Add delete-document / retention controls
