# Household Transfer Deduplication

Detect and flag intra-household transfers (money moving between accounts owned by the same user) so the combined household summary excludes double-counted amounts.

## Problem

When Nevena sends Amir €740/month for rent:
- **Amir's account:** +€740 incoming, `offsets_category = housing`
- **Nevena's account:** -€740 outgoing, categorized as `transfer` expense

At household level the €740 is double-counted — expense on her side, offset on his. The combined cost of living is inflated.

## Architecture

- **New table:** `household_transfer_pairs` (migration 015)
- **New file:** `lib/spending/transfer-detector.ts`
- **New routes:** `app/api/spending/transfers/route.ts` (GET/PATCH), `app/api/spending/transfers/detect/route.ts` (POST)
- **New component:** `app/spending/_components/TransferReview.tsx`
- **Modified:** `app/api/spending/import/route.ts` — trigger detection post-import
- **Modified:** `app/spending/page.tsx` — fetch confirmed pairs, exclude from `buildSummary`
- **Modified:** `app/spending/_components/SpendingDashboard.tsx` — banner + review UI
- **Modified:** `types/index.ts` — `HouseholdTransferPair`, `TransactionSummary.intraHouseholdCount`

## Implementation

### Phase 1 — Database Schema

**`supabase/migrations/015_household_transfers.sql`**

```sql
create table household_transfer_pairs (
  id                      uuid primary key default gen_random_uuid(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  outgoing_transaction_id uuid not null references transactions(id) on delete cascade,
  incoming_transaction_id uuid not null references transactions(id) on delete cascade,
  status                  text not null default 'pending'
                            check (status in ('pending', 'confirmed', 'rejected')),
  amount_diff_pct         numeric(5,4),
  date_diff_days          integer,
  created_at              timestamptz default now(),
  updated_at              timestamptz default now()
);

create unique index household_transfer_pairs_pair_idx
  on household_transfer_pairs (outgoing_transaction_id, incoming_transaction_id);

create index household_transfer_pairs_user_status_idx
  on household_transfer_pairs (user_id, status);

alter table household_transfer_pairs enable row level security;

create policy "Users manage own pairs"
  on household_transfer_pairs
  for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);
```

### Phase 2 — Detection Algorithm

**`lib/spending/transfer-detector.ts`**

- Takes `Transaction[]` (all user transactions) + set of already-matched tx IDs
- Filters outgoing (amount < 0) and incoming (amount > 0) across different `account_name` values
- Matches where `abs(abs(out.amount) - in.amount) / in.amount <= 0.02` (±2%)
- Matches where `abs(date_diff) <= 3` days
- Greedy: sort candidates by smallest (amount_diff + date_diff), each tx used once
- Returns `{ outgoing_id, incoming_id, amount_diff_pct, date_diff_days }[]`

### Phase 3 — API Routes

- `POST /api/spending/transfers/detect` — run detection, upsert pending pairs, return `{ detected, total_pending }`
- `GET /api/spending/transfers?status=pending` — list pairs joined with transaction data
- `PATCH /api/spending/transfers` — `{ id, status: 'confirmed' | 'rejected' }`
- Import route calls detection inline after successful insert, adds `detectedTransfers` to response

### Phase 4 — Summary Logic

- `SpendingPage` fetches confirmed pairs, builds `Set<string>` of excluded tx IDs
- Passes to `buildSummary` as `excludedTransactionIds`
- Both sides filtered out of: expenses, income, byCategory, byMonth, costOfLiving, savingsRate
- **Only when `activeAccount === 'all'`** — per-account views unchanged
- `intraHouseholdCount` added to `TransactionSummary`

### Phase 5 — Review UI

- `TransferReview` component: table of pairs, Confirm/Reject per row, batch actions
- Dashboard banner when `pendingTransferCount > 0` and viewing all accounts
- Cost of Living card annotated with "excl. X intra-household transfers"

## Matching Rules

| Parameter | Value |
|---|---|
| Amount tolerance | ±2% |
| Date window | ±3 days |
| Account constraint | Different `account_name`, same `user_id` |
| Matching strategy | Greedy, sort by smallest combined diff |
| Null account_name | Skip (can't determine account) |

## Key Decisions

- **Join table over boolean flag:** Preserves pair relationship, match metadata, and review state
- **No AI:** Purely deterministic — amount + date is sufficient signal
- **Confirm before effect:** Nothing excluded from summary until user explicitly confirms
- **Cascade deletes:** Deleting either transaction removes the pair automatically

## Risks

| Risk | Mitigation |
|---|---|
| Greedy mismatch on similar amounts | Sort by smallest diff; review UI is the safety net |
| Import latency increase | Short-circuits if no multiple account_names exist |
| Orphaned pairs on tx delete | `ON DELETE CASCADE` on both FKs |

## Success Criteria

- [ ] Matching transfers auto-detected after CSV import
- [ ] Review UI accessible from dashboard
- [ ] Confirming a pair excludes both sides from all-accounts summary
- [ ] Rejecting leaves summary unchanged
- [ ] Per-account views completely unaffected
- [ ] Dashboard banner for pending pairs
- [ ] Unit tests cover tolerance boundaries, same-account rejection, greedy ordering
