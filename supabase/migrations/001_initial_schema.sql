-- ============================================================
-- BillFlow Database Schema
-- Run this in Supabase SQL Editor
-- ============================================================

-- Enable UUID extension
create extension if not exists "uuid-ossp";

-- ── PAYEES (shared directory, community-validated) ──────────
create table public.payees (
  id          uuid primary key default uuid_generate_v4(),
  name        text not null,
  iban        text,
  bic         text,
  category    text not null default 'other'
              check (category in ('utility','telecom','tax','insurance','rent','other')),
  country     text not null default 'BE',
  verified    boolean not null default false,
  created_at  timestamptz not null default now()
);

-- Seed with common Belgian billers
insert into public.payees (name, iban, bic, category, verified) values
  ('Proximus',          'BE50 0003 2800 7424', 'BPOTBEB1', 'telecom',  true),
  ('Telenet',           'BE08 7340 0000 1010', 'KREDBEBB', 'telecom',  true),
  ('Orange Belgium',    'BE77 3100 7579 9795', 'BBRUBEBB', 'telecom',  true),
  ('Engie',             'BE05 2100 0000 0444', 'GEBABEBB', 'utility',  true),
  ('Luminus',           'BE97 3630 2800 0021', 'BBRUBEBB', 'utility',  true),
  ('VIVAQUA',           'BE52 0960 1178 4309', 'GKCCBEBB', 'utility',  true),
  ('De Watergroep',     'BE40 0000 2400 0220', 'BPOTBEB1', 'utility',  true),
  ('Fluvius',           'BE91 0000 2700 3400', 'BPOTBEB1', 'utility',  true),
  ('Ethias',            'BE89 0882 0000 0000', 'ETHIBEBB', 'insurance',true),
  ('AG Insurance',      'BE48 2100 0000 0010', 'GEBABEBB', 'insurance',true),
  ('Mutualité Chrétienne','BE19 0000 9898 9898','BPOTBEB1','insurance',true),
  ('Partena Mutualité', 'BE56 2100 0066 8432', 'GEBABEBB', 'insurance',true);

-- ── BILLS ───────────────────────────────────────────────────
create table public.bills (
  id                      uuid primary key default uuid_generate_v4(),
  user_id                 uuid not null references auth.users(id) on delete cascade,
  source                  text not null default 'manual'
                          check (source in ('doccle','email','upload','manual')),
  payee_name              text not null,
  payee_id                uuid references public.payees(id),
  amount                  numeric(10,2) not null,
  currency                text not null default 'EUR',
  due_date                date not null,
  structured_comm         text,
  structured_comm_valid   boolean,
  iban                    text,
  bic                     text,
  status                  text not null default 'received'
                          check (status in ('received','scheduled','payment_sent','confirmed','overdue')),
  extraction_confidence   numeric(3,2),
  language_detected       text,
  explanation             text,
  raw_pdf_path            text,
  doccle_url              text,
  wire_reference          text,
  paid_at                 timestamptz,
  notes                   text,
  needs_review            boolean not null default false,
  created_at              timestamptz not null default now(),
  updated_at              timestamptz not null default now()
);

-- Auto-update updated_at
create or replace function public.handle_updated_at()
returns trigger as $$
begin
  new.updated_at = now();
  return new;
end;
$$ language plpgsql;

create trigger bills_updated_at
  before update on public.bills
  for each row execute procedure public.handle_updated_at();

-- ── REMINDERS ───────────────────────────────────────────────
create table public.reminders (
  id           uuid primary key default uuid_generate_v4(),
  bill_id      uuid not null references public.bills(id) on delete cascade,
  user_id      uuid not null references auth.users(id) on delete cascade,
  remind_at    timestamptz not null,
  channel      text not null default 'email' check (channel in ('email','push')),
  sent_at      timestamptz,
  dismissed_at timestamptz,
  created_at   timestamptz not null default now()
);

-- ── USER SETTINGS ────────────────────────────────────────────
create table public.user_settings (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  salary_day            integer check (salary_day between 1 and 31),
  preferred_language    text not null default 'en',
  email_inbox_address   text unique,
  reminder_days_before  integer not null default 3,
  created_at            timestamptz not null default now(),
  updated_at            timestamptz not null default now()
);

create trigger user_settings_updated_at
  before update on public.user_settings
  for each row execute procedure public.handle_updated_at();

-- Auto-create user_settings on signup
create or replace function public.handle_new_user()
returns trigger as $$
declare
  inbox_addr text;
begin
  inbox_addr := 'bills.' || substr(new.id::text, 1, 8) || '@billflow.app';
  insert into public.user_settings (user_id, email_inbox_address)
  values (new.id, inbox_addr);
  return new;
end;
$$ language plpgsql security definer;

create trigger on_auth_user_created
  after insert on auth.users
  for each row execute procedure public.handle_new_user();

-- ── ROW LEVEL SECURITY ───────────────────────────────────────
alter table public.bills          enable row level security;
alter table public.reminders      enable row level security;
alter table public.user_settings  enable row level security;
alter table public.payees         enable row level security;

-- Bills: users see only their own
create policy "Users can CRUD own bills"
  on public.bills for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Reminders: users see only their own
create policy "Users can CRUD own reminders"
  on public.reminders for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- User settings: own only
create policy "Users can CRUD own settings"
  on public.user_settings for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

-- Payees: everyone can read, only service role can write
create policy "Anyone can read payees"
  on public.payees for select
  using (true);

-- ── STORAGE BUCKET ───────────────────────────────────────────
-- Run this after the above SQL:
-- In Supabase dashboard: Storage > New bucket > "bill-documents"
-- Set as Private. Add policy: authenticated users can read/write their own folder.
-- Path pattern: {user_id}/*

-- ── INDEXES ──────────────────────────────────────────────────
create index bills_user_id_idx        on public.bills(user_id);
create index bills_due_date_idx       on public.bills(due_date);
create index bills_status_idx         on public.bills(status);
create index reminders_remind_at_idx  on public.reminders(remind_at);
create index reminders_sent_at_idx    on public.reminders(sent_at) where sent_at is null;
