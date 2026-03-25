-- ── PAYMENT BATCHES ──────────────────────────────────────────
create table public.payment_batches (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  bill_ids     uuid[] not null default '{}',
  total_amount numeric(12,2) not null default 0,
  currency     text not null default 'EUR',
  status       text not null default 'pending'
    check (status in ('pending', 'in_progress', 'completed')),
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now()
);

create trigger payment_batches_updated_at
  before update on public.payment_batches
  for each row execute procedure public.handle_updated_at();

-- RLS
alter table public.payment_batches enable row level security;

create policy "Users can view own batches"
  on public.payment_batches for select
  using (auth.uid() = user_id);

create policy "Users can create own batches"
  on public.payment_batches for insert
  with check (auth.uid() = user_id);

create policy "Users can update own batches"
  on public.payment_batches for update
  using (auth.uid() = user_id);

create policy "Users can delete own batches"
  on public.payment_batches for delete
  using (auth.uid() = user_id);
