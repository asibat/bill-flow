# BillFlow — Setup Guide

Belgian bill management for expats. Forward Doccle notifications, upload PDFs/screenshots, and get copy-paste wire transfer cards with validated structured communications.

---

## Prerequisites

- Node.js 18+
- A [Supabase](https://supabase.com) account (free)
- An [Anthropic](https://console.anthropic.com) API key
- A [Resend](https://resend.com) account (free tier)
- A [Vercel](https://vercel.com) account (free) for deployment

---

## Step 1 — Clone & Install

```bash
git clone <your-repo>
cd billflow
npm install
cp .env.example .env.local
```

---

## Step 2 — Supabase Setup (10 min)

1. Go to [supabase.com](https://supabase.com) → New project → name it `billflow`
2. Wait for it to provision (~2 min)
3. Go to **Settings → API** and copy:
   - `Project URL` → `NEXT_PUBLIC_SUPABASE_URL`
   - `anon public` key → `NEXT_PUBLIC_SUPABASE_ANON_KEY`
   - `service_role` key → `SUPABASE_SERVICE_ROLE_KEY`
4. Go to **SQL Editor** → paste the entire contents of `supabase/migrations/001_initial_schema.sql` → Run
5. Go to **Storage** → New bucket → name: `bill-documents` → Private
6. In Storage → Policies → Add policy for `bill-documents`:
   - **For SELECT**: `(auth.uid()::text) = (storage.foldername(name))[1]`
   - **For INSERT**: `(auth.uid()::text) = (storage.foldername(name))[1]`
7. Go to **Authentication → Providers** → Enable Google (optional but recommended)
   - Add your Google OAuth credentials from [Google Cloud Console](https://console.cloud.google.com)

---

## Step 3 — Anthropic API Key

1. Go to [console.anthropic.com](https://console.anthropic.com) → API Keys → Create key
2. Copy to `ANTHROPIC_API_KEY` in `.env.local`

---

## Step 4 — Resend Setup (email forwarding)

1. Go to [resend.com](https://resend.com) → Create account
2. API Keys → Create key → copy to `RESEND_API_KEY`
3. **Domains** → Add domain (you need a domain, e.g. `billflow.app` or your own)
   - Add the DNS records Resend shows you
4. **Inbound** → Enable inbound email for your domain
5. Set the inbound webhook URL to: `https://your-app.vercel.app/api/ingest/email`
6. Copy the webhook secret to `RESEND_WEBHOOK_SECRET`

> **Without a custom domain:** For local testing, you can use a service like [ngrok](https://ngrok.com) to expose localhost and test inbound webhooks. Email forwarding requires a real domain for production.

---

## Step 5 — Local Development

```bash
# Create .env.local with all your keys (copy from .env.example)
npm run dev
# Open http://localhost:3000
```

---

## Step 6 — Deploy to Vercel

```bash
# Install Vercel CLI
npm i -g vercel

# Deploy
vercel

# Set environment variables in Vercel dashboard or via CLI:
vercel env add NEXT_PUBLIC_SUPABASE_URL
vercel env add NEXT_PUBLIC_SUPABASE_ANON_KEY
vercel env add SUPABASE_SERVICE_ROLE_KEY
vercel env add ANTHROPIC_API_KEY
vercel env add RESEND_API_KEY
vercel env add RESEND_WEBHOOK_SECRET
vercel env add NEXT_PUBLIC_APP_URL  # your-app.vercel.app

# Redeploy with env vars
vercel --prod
```

After deploying, update your Resend inbound webhook URL to your Vercel URL.

---

## How to Use

### Forward Doccle notifications
1. Sign up / sign in
2. Your personal inbox address is shown in the sidebar (e.g. `bills.a1b2c3d4@billflow.app`)
3. Forward any Doccle notification email to that address
4. Within ~30 seconds the bill appears in your dashboard with all fields extracted

### Upload a PDF or screenshot
1. Click **Add Bill → Upload PDF or Screenshot**
2. Drop your file — AI extracts payee, amount, due date, IBAN, structured communication
3. Review and confirm the extracted fields
4. Click **Save Bill**

### Manual entry
1. Click **Add Bill → Enter Manually**
2. Fill in the fields — the structured communication field validates Modulo 97 in real time
3. Structured communications should be in format `+++XXX/XXXX/XXXXX+++`

### Pay a bill
1. Open any bill → see the **Wire Transfer Instructions** card
2. Copy each field (beneficiary, IBAN, BIC, amount, structured comm) individually
3. Paste into your bank's wire transfer form
4. Come back and click **Mark as Payment Sent**

---

## Architecture

```
billflow/
├── app/
│   ├── auth/           # Login, signup, OAuth callback
│   ├── dashboard/      # Main dashboard with bill overview
│   ├── bills/          # Bill list, detail, new bill
│   └── api/
│       ├── ingest/email/  # Resend inbound webhook (Doccle + generic)
│       ├── bills/         # CRUD API for bills
│       └── upload/        # PDF/image upload + AI extraction
├── components/
│   ├── bills/          # WireTransferCard, BillActions
│   └── layout/         # Sidebar, NavLink, SignOutButton
├── lib/
│   ├── supabase/       # Browser + server + service role clients
│   ├── claude/         # AI extraction (text + vision)
│   └── utils/          # Modulo 97, formatters, Doccle URL parser
├── supabase/
│   └── migrations/     # Full schema SQL
└── types/              # TypeScript types
```

---

## Key Technical Notes

**Modulo 97 validation:** Every structured communication is validated against the Belgian standard. A green checkmark means the code is mathematically valid; a red warning means you should verify it against the original document before paying — a wrong code causes the payment to bounce or be misattributed.

**Doccle ingestion pipeline:**
1. Receive forwarded email → extract `secure.doccle.be` URL
2. Server-side fetch of that URL (no login required, token-authenticated)
3. Parse HTML for amount/date/payee metadata
4. Download and archive PDF immediately (Doccle URLs expire ~6 weeks)
5. Claude extracts structured comm + IBAN from PDF
6. Cross-check HTML metadata vs. Claude extraction — flag disagreements

**Security:**
- All Supabase tables have Row Level Security — users can only access their own data
- PDFs stored in private Supabase Storage buckets with signed URLs
- Service role key never exposed to the client
- Each user gets a unique inbox address

---

## Environment Variables Reference

| Variable | Where to get it |
|---|---|
| `NEXT_PUBLIC_SUPABASE_URL` | Supabase → Settings → API |
| `NEXT_PUBLIC_SUPABASE_ANON_KEY` | Supabase → Settings → API |
| `SUPABASE_SERVICE_ROLE_KEY` | Supabase → Settings → API (keep secret!) |
| `ANTHROPIC_API_KEY` | console.anthropic.com |
| `RESEND_API_KEY` | resend.com → API Keys |
| `RESEND_WEBHOOK_SECRET` | resend.com → Inbound |
| `NEXT_PUBLIC_APP_URL` | Your Vercel URL |
