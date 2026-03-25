alter table public.user_settings
  add column email_notifications boolean not null default true,
  add column push_notifications boolean not null default false;

create table public.push_subscriptions (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  endpoint     text not null unique,
  p256dh       text not null,
  auth         text not null,
  user_agent   text,
  created_at   timestamptz not null default now(),
  updated_at   timestamptz not null default now(),
  last_seen_at timestamptz not null default now()
);

create trigger push_subscriptions_updated_at
  before update on public.push_subscriptions
  for each row execute procedure public.handle_updated_at();

alter table public.push_subscriptions enable row level security;

create policy "Users can CRUD own push subscriptions"
  on public.push_subscriptions for all
  using (auth.uid() = user_id)
  with check (auth.uid() = user_id);

create index push_subscriptions_user_id_idx on public.push_subscriptions(user_id);
