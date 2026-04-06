-- User-defined metadata for transaction payees
-- Allows labeling raw payee names (e.g. "Frederic Weiler" → display "Landlord", category "housing")

create table if not exists spending_payees (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  payee_raw    text not null,           -- exact match against transactions.payee_raw
  display_name text,                    -- friendly label shown in UI
  category     text,                    -- overrides category_ai for all transactions from this payee
  notes        text,                    -- free-form notes (e.g. "landlord", "monthly subscription")
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  unique (user_id, payee_raw)
);

alter table spending_payees enable row level security;

create policy "Users can manage their own payee metadata"
  on spending_payees for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create trigger set_spending_payees_updated_at
  before update on spending_payees
  for each row execute procedure public.handle_updated_at();
