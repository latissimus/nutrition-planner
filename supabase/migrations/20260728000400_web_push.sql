-- Geräte-Abos und idempotente Versandhistorie für echte Web-Push-Erinnerungen.

create table if not exists public.push_subscriptions (
  id            uuid primary key default gen_random_uuid(),
  user_id       uuid not null references auth.users(id) on delete cascade,
  endpoint      text not null unique,
  p256dh        text not null,
  auth          text not null,
  user_agent    text not null default '',
  last_seen_at  timestamptz not null default now(),
  created_at    timestamptz not null default now(),
  updated_at    timestamptz not null default now()
);

create index if not exists push_subscriptions_user_idx
  on public.push_subscriptions(user_id);

alter table public.push_subscriptions enable row level security;

drop policy if exists push_subscriptions_all_own on public.push_subscriptions;
create policy push_subscriptions_all_own on public.push_subscriptions
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists push_subscriptions_touch_updated_at on public.push_subscriptions;
create trigger push_subscriptions_touch_updated_at
  before update on public.push_subscriptions
  for each row execute function public.touch_updated_at();

-- Diese Tabelle ist absichtlich nur für den Service-Role-Client der Edge
-- Function zugänglich. Nutzer benötigen keinen direkten Zugriff.
create table if not exists public.push_deliveries (
  id               uuid primary key default gen_random_uuid(),
  reminder_id      uuid not null references public.reminders(id) on delete cascade,
  subscription_id  uuid not null references public.push_subscriptions(id) on delete cascade,
  scheduled_for    timestamptz not null,
  status           text not null default 'pending'
                     check (status in ('pending', 'sent', 'failed')),
  error             text,
  created_at        timestamptz not null default now(),
  sent_at           timestamptz,
  unique (reminder_id, subscription_id, scheduled_for)
);

create index if not exists push_deliveries_created_idx
  on public.push_deliveries(created_at desc);

alter table public.push_deliveries enable row level security;

create or replace function public.cleanup_push_deliveries()
returns void
language sql
security definer
set search_path = public, pg_temp
as $$
  delete from public.push_deliveries
  where created_at < now() - interval '30 days';
$$;

revoke all on function public.cleanup_push_deliveries() from public, anon, authenticated;

