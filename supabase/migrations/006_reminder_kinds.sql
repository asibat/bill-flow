alter table public.reminders
  add column kind text not null default 'custom_due'
    check (kind in ('custom_due', 'due_7d', 'due_3d', 'due_today', 'payment_followup'));

create unique index reminders_bill_kind_channel_idx
  on public.reminders (bill_id, kind, channel);
