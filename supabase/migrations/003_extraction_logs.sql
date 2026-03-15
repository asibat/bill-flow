-- ── EXTRACTION LOGS ────────────────────────────────────────
-- Audit trail for every AI extraction attempt (success or failure).
create table public.extraction_logs (
  id              uuid primary key default gen_random_uuid(),
  bill_id         uuid references public.bills(id) on delete set null,
  user_id         uuid not null references auth.users(id) on delete cascade,
  provider        text not null,                          -- 'gemini' | 'claude'
  input_type      text not null,                          -- 'text' | 'image'
  input_preview   text,                                   -- first ~500 chars of input
  input_length    integer not null default 0,
  raw_response    jsonb,                                  -- full AI response
  extraction_notes text,                                  -- AI reasoning / step-by-step
  confidence      numeric(3,2) not null default 0,
  duration_ms     integer not null default 0,
  error           text,                                   -- error message if extraction failed
  created_at      timestamptz not null default now()
);

create index idx_extraction_logs_bill    on public.extraction_logs(bill_id);
create index idx_extraction_logs_user    on public.extraction_logs(user_id);
create index idx_extraction_logs_created on public.extraction_logs(created_at desc);
create index idx_extraction_logs_confidence on public.extraction_logs(confidence);

-- RLS: users see only their own logs
alter table public.extraction_logs enable row level security;

create policy "Users can read own extraction logs"
  on public.extraction_logs for select
  using (auth.uid() = user_id);

-- Service role inserts (API routes use service client)
create policy "Service role can insert extraction logs"
  on public.extraction_logs for insert
  with check (true);
