insert into public.reminders (bill_id, user_id, remind_at, channel, kind)
select
  b.id,
  b.user_id,
  ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour' - interval '7 day'),
  'email',
  'due_7d'
from public.bills b
where b.status in ('received', 'scheduled', 'overdue')
  and ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour' - interval '7 day') > now()
  and not exists (
    select 1
    from public.reminders r
    where r.bill_id = b.id
      and r.kind = 'due_7d'
      and r.channel = 'email'
  );

insert into public.reminders (bill_id, user_id, remind_at, channel, kind)
select
  b.id,
  b.user_id,
  ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour' - interval '3 day'),
  'email',
  'due_3d'
from public.bills b
where b.status in ('received', 'scheduled', 'overdue')
  and ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour' - interval '3 day') > now()
  and not exists (
    select 1
    from public.reminders r
    where r.bill_id = b.id
      and r.kind = 'due_3d'
      and r.channel = 'email'
  );

insert into public.reminders (bill_id, user_id, remind_at, channel, kind)
select
  b.id,
  b.user_id,
  ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour'),
  'email',
  'due_today'
from public.bills b
where b.status in ('received', 'scheduled', 'overdue')
  and ((b.due_date::timestamp at time zone 'UTC') + interval '8 hour') > now()
  and not exists (
    select 1
    from public.reminders r
    where r.bill_id = b.id
      and r.kind = 'due_today'
      and r.channel = 'email'
  );
