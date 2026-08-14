-- SLEEP-DEX: Wochenplan, Morgen-Check-ins, Benachrichtigungen und eine
-- einmalige MUSCLE-COIN-Vergütung pro protokollierter Nacht.

create table if not exists public.sleep_settings (
  user_id uuid primary key references auth.users(id) on delete cascade,
  wind_down_minutes smallint not null default 30 check (wind_down_minutes between 0 and 180),
  wind_down_reminder boolean not null default true,
  bedtime_reminder boolean not null default true,
  morning_reminder boolean not null default true,
  updated_at timestamptz not null default now()
);

create table if not exists public.sleep_schedules (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  weekday smallint not null check (weekday between 0 and 6),
  bedtime time not null default '22:30',
  wake_time time not null default '06:30',
  active boolean not null default true,
  updated_at timestamptz not null default now(),
  unique (user_id, weekday)
);

create table if not exists public.sleep_logs (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  sleep_date date not null default current_date,
  bedtime time not null,
  wake_time time not null,
  quality smallint not null check (quality between 1 and 5),
  energy smallint not null check (energy between 1 and 5),
  awakenings smallint not null default 0 check (awakenings between 0 and 30),
  tags text[] not null default '{}',
  note text not null default '' check (char_length(note) <= 1000),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, sleep_date),
  check (cardinality(tags) <= 20)
);

create index if not exists sleep_logs_user_date_idx
  on public.sleep_logs(user_id, sleep_date desc);

alter table public.sleep_settings enable row level security;
alter table public.sleep_schedules enable row level security;
alter table public.sleep_logs enable row level security;

drop policy if exists sleep_settings_all_own on public.sleep_settings;
create policy sleep_settings_all_own on public.sleep_settings for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sleep_schedules_all_own on public.sleep_schedules;
create policy sleep_schedules_all_own on public.sleep_schedules for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists sleep_logs_all_own on public.sleep_logs;
create policy sleep_logs_all_own on public.sleep_logs for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists sleep_settings_touch_updated_at on public.sleep_settings;
create trigger sleep_settings_touch_updated_at before update on public.sleep_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists sleep_schedules_touch_updated_at on public.sleep_schedules;
create trigger sleep_schedules_touch_updated_at before update on public.sleep_schedules
  for each row execute function public.touch_updated_at();
drop trigger if exists sleep_logs_touch_updated_at on public.sleep_logs;
create trigger sleep_logs_touch_updated_at before update on public.sleep_logs
  for each row execute function public.touch_updated_at();

create or replace function public.sync_sleep_reminders(target_user uuid)
returns void language plpgsql security definer set search_path = public, pg_temp as $$
declare
  settings public.sleep_settings%rowtype;
  schedule public.sleep_schedules%rowtype;
  day_name text;
  wake_day_name text;
begin
  select * into settings from public.sleep_settings where user_id = target_user;
  if not found then return; end if;

  for schedule in select * from public.sleep_schedules where user_id = target_user loop
    day_name := (array['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'])[schedule.weekday + 1];
    wake_day_name := (array['Sonntag','Montag','Dienstag','Mittwoch','Donnerstag','Freitag','Samstag'])[((schedule.weekday + 1) % 7) + 1];
    insert into public.reminders(user_id,type,label,time,weekdays,active,metadata,route)
    values (
      target_user,'sleep','Runterfahren · ' || day_name,
      schedule.bedtime - make_interval(mins => settings.wind_down_minutes),array[schedule.weekday],
      schedule.active and settings.wind_down_reminder,
      jsonb_build_object('icon','bedtime','phase','wind-down'),'#sleep'
    ) on conflict(user_id,type,label) do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;

    insert into public.reminders(user_id,type,label,time,weekdays,active,metadata,route)
    values (
      target_user,'sleep','Schlafenszeit · ' || day_name,schedule.bedtime,array[schedule.weekday],
      schedule.active and settings.bedtime_reminder,
      jsonb_build_object('icon','bedtime','phase','bedtime'),'#sleep'
    ) on conflict(user_id,type,label) do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;

    insert into public.reminders(user_id,type,label,time,weekdays,active,metadata,route)
    values (
      target_user,'sleep','Morgen-Check-in · ' || wake_day_name,schedule.wake_time,array[(schedule.weekday + 1) % 7],
      schedule.active and settings.morning_reminder,
      jsonb_build_object('icon','bedtime','phase','check-in'),'#sleep'
    ) on conflict(user_id,type,label) do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;
  end loop;
end;
$$;

create or replace function public.sleep_settings_sync_reminders()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  perform public.sync_sleep_reminders(new.user_id);
  return new;
end;
$$;

drop trigger if exists sleep_settings_sync_reminders on public.sleep_settings;
create trigger sleep_settings_sync_reminders after insert or update on public.sleep_settings
  for each row execute function public.sleep_settings_sync_reminders();
drop trigger if exists sleep_schedules_sync_reminders on public.sleep_schedules;
create trigger sleep_schedules_sync_reminders after insert or update on public.sleep_schedules
  for each row execute function public.sleep_settings_sync_reminders();

alter table public.muscle_coin_ledger
  add column if not exists sleep_log_id uuid references public.sleep_logs(id) on delete cascade;
alter table public.muscle_coin_ledger drop constraint if exists muscle_coin_ledger_event_type_check;
alter table public.muscle_coin_ledger add constraint muscle_coin_ledger_event_type_check
  check (event_type in ('routine_complete','sleep_checkin','reward_redeem','adjustment'));
create unique index if not exists muscle_coin_ledger_sleep_log_unique
  on public.muscle_coin_ledger(user_id,sleep_log_id) where sleep_log_id is not null;

create or replace function public.reward_sleep_checkin()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.muscle_coin_ledger(user_id,amount,event_type,sleep_log_id,note)
  values(new.user_id,3,'sleep_checkin',new.id,'Morgen-Check-in')
  on conflict(user_id,sleep_log_id) where sleep_log_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists sleep_logs_reward_checkin on public.sleep_logs;
create trigger sleep_logs_reward_checkin after insert on public.sleep_logs
  for each row execute function public.reward_sleep_checkin();

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sleep_logs'
  ) then alter publication supabase_realtime add table public.sleep_logs; end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname='supabase_realtime' and schemaname='public' and tablename='sleep_schedules'
  ) then alter publication supabase_realtime add table public.sleep_schedules; end if;
end $$;

alter table public.sleep_logs replica identity full;
alter table public.sleep_schedules replica identity full;

revoke all on function public.sync_sleep_reminders(uuid) from public, anon;
grant execute on function public.sync_sleep_reminders(uuid) to authenticated;
