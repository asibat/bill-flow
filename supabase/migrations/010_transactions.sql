-- Spending analysis: bank transaction imports (e.g. N26 CSV)
-- Feature-flagged: FEATURE_SPENDING_ANALYSIS

create table if not exists transactions (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  date            date not null,
  amount          numeric(12, 2) not null,
  currency        text not null default 'EUR',
  payee_raw       text not null,
  category_n26    text,
  category_ai     text,
  category_user   text,
  description     text,
  account         text,
  source_file     text,
  created_at      timestamptz not null default now()
);

-- Prevent duplicate imports of the same transaction from the same file
create unique index if not exists transactions_dedup_idx
  on transactions (user_id, date, amount, payee_raw, source_file);

create index if not exists transactions_user_date_idx
  on transactions (user_id, date desc);

create index if not exists transactions_user_category_idx
  on transactions (user_id, category_ai);

-- RLS
alter table transactions enable row level security;

create policy "Users can manage their own transactions"
  on transactions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Household settings columns on user_settings
alter table user_settings
  add column if not exists household_size    int,
  add column if not exists monthly_income    numeric(12, 2),
  add column if not exists income_currency   text default 'EUR';
