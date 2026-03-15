-- ============================================================
-- Migration: Add user ownership to payees (vendors)
-- Allows per-user vendor directories alongside shared system vendors
-- ============================================================

-- Add user_id to payees (NULL = system/shared vendor)
alter table public.payees
  add column user_id uuid references auth.users(id) on delete cascade;

-- Normalize existing IBANs (remove spaces for consistent matching)
update public.payees set iban = replace(iban, ' ', '') where iban is not null;

-- Index for IBAN-based vendor matching
create index payees_iban_idx on public.payees(iban) where iban is not null;
create index payees_user_id_idx on public.payees(user_id) where user_id is not null;

-- Drop old read-only policy
drop policy if exists "Anyone can read payees" on public.payees;

-- Users can read system vendors (user_id IS NULL) + their own
create policy "Users can read system and own vendors"
  on public.payees for select
  using (user_id is null or user_id = auth.uid());

-- Users can insert their own vendors
create policy "Users can create own vendors"
  on public.payees for insert
  with check (user_id = auth.uid());

-- Users can update their own vendors only
create policy "Users can update own vendors"
  on public.payees for update
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

-- Users can delete their own vendors only
create policy "Users can delete own vendors"
  on public.payees for delete
  using (user_id = auth.uid());
