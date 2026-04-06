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
