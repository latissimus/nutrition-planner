-- Evidenzbasierte Körperwerte und adaptive Kalorienkalibrierung.
-- Bestehende KFA-Werte bleiben erhalten, werden aber nicht mehr als
-- Berechnungsgrundlage verwendet.

alter table public.nutrition_settings
  drop constraint if exists nutrition_settings_goal_check;
alter table public.nutrition_settings
  add constraint nutrition_settings_goal_check
  check (goal in ('lose', 'maintain', 'gain', 'gain_fast', 'bodycomp'));

alter table public.nutrition_settings
  add column if not exists adaptive_enabled boolean not null default false,
  add column if not exists adaptive_target integer check (adaptive_target between 800 and 10000),
  add column if not exists adaptive_updated_at timestamptz,
  add column if not exists adaptive_rejected_at timestamptz,
  add column if not exists adaptive_rejected_target integer check (adaptive_rejected_target between 800 and 10000),
  add column if not exists bodycomp_thresholds jsonb not null default
    '{"stableLoss":-0.15,"slowLoss":-0.5,"stableGain":0.15,"slowGain":0.3}'::jsonb;

alter table public.skinfolds
  add column if not exists messreihen jsonb not null default '{}'::jsonb,
  add column if not exists messqualitaet text check (messqualitaet in ('niedrig','mittel','hoch')),
  add column if not exists standardisiert boolean not null default false,
  add column if not exists bedingungen jsonb not null default '{}'::jsonb;

create table if not exists public.waist_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemessen_am date not null default current_date,
  cm numeric(5,1) not null check (cm between 30 and 250),
  standardisiert boolean not null default false,
  notiz text not null default '' check (char_length(notiz) <= 500),
  created_at timestamptz not null default now(),
  unique (user_id, gemessen_am)
);

create table if not exists public.external_body_fat_measurements (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  gemessen_am date not null,
  percent numeric(4,1) not null check (percent between 2 and 65),
  methode text not null check (char_length(trim(methode)) between 1 and 80),
  quelle text not null default '' check (char_length(quelle) <= 300),
  unsicherheit text not null default 'Externer Messwert mit methodenabhängiger Messunsicherheit.'
    check (char_length(unsicherheit) <= 500),
  created_at timestamptz not null default now()
);

create table if not exists public.nutrition_day_status (
  user_id uuid not null references auth.users(id) on delete cascade,
  log_date date not null,
  complete boolean not null default false,
  excluded boolean not null default false,
  exclude_reason text not null default '' check (char_length(exclude_reason) <= 300),
  updated_at timestamptz not null default now(),
  primary key (user_id, log_date)
);

create table if not exists public.bodycomp_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  checkin_date date not null,
  recovery smallint check (recovery between 1 and 5),
  mood smallint check (mood between 1 and 5),
  hunger smallint check (hunger between 1 and 5),
  illness boolean not null default false,
  travel boolean not null default false,
  unusual_meals boolean not null default false,
  note text not null default '' check (char_length(note) <= 1000),
  updated_at timestamptz not null default now(),
  primary key (user_id, checkin_date)
);

create table if not exists public.logman_performance (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  performed_on date not null,
  exercise text not null check (char_length(trim(exercise)) between 1 and 160),
  category text not null check (category in ('HEAVYS','MIDDLES')),
  weight_kg numeric(7,2),
  repetitions smallint,
  estimated_1rm numeric(8,2) not null check (estimated_1rm > 0),
  volume numeric(12,2),
  source text not null default 'LOGMAN-Import',
  imported_at timestamptz not null default now(),
  unique (user_id, performed_on, exercise, category)
);

create index if not exists waist_measurements_user_date_idx on public.waist_measurements(user_id, gemessen_am desc);
create index if not exists external_body_fat_user_date_idx on public.external_body_fat_measurements(user_id, gemessen_am desc);
create index if not exists nutrition_day_status_user_date_idx on public.nutrition_day_status(user_id, log_date desc);
create index if not exists bodycomp_checkins_user_date_idx on public.bodycomp_checkins(user_id, checkin_date desc);
create index if not exists logman_performance_user_date_idx on public.logman_performance(user_id, performed_on desc);

alter table public.waist_measurements enable row level security;
alter table public.external_body_fat_measurements enable row level security;
alter table public.nutrition_day_status enable row level security;
alter table public.bodycomp_checkins enable row level security;
alter table public.logman_performance enable row level security;

drop policy if exists waist_measurements_all_own on public.waist_measurements;
create policy waist_measurements_all_own on public.waist_measurements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists external_body_fat_all_own on public.external_body_fat_measurements;
create policy external_body_fat_all_own on public.external_body_fat_measurements for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists nutrition_day_status_all_own on public.nutrition_day_status;
create policy nutrition_day_status_all_own on public.nutrition_day_status for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists bodycomp_checkins_all_own on public.bodycomp_checkins;
create policy bodycomp_checkins_all_own on public.bodycomp_checkins for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists logman_performance_all_own on public.logman_performance;
create policy logman_performance_all_own on public.logman_performance for all to authenticated
  using (user_id = auth.uid()) with check (user_id = auth.uid());

drop trigger if exists nutrition_day_status_touch_updated_at on public.nutrition_day_status;
create trigger nutrition_day_status_touch_updated_at before update on public.nutrition_day_status
  for each row execute function public.touch_updated_at();
drop trigger if exists bodycomp_checkins_touch_updated_at on public.bodycomp_checkins;
create trigger bodycomp_checkins_touch_updated_at before update on public.bodycomp_checkins
  for each row execute function public.touch_updated_at();

alter table public.muscle_coin_ledger drop constraint if exists muscle_coin_ledger_event_type_check;
alter table public.muscle_coin_ledger add constraint muscle_coin_ledger_event_type_check
  check (event_type in ('routine_complete','sleep_checkin','reward_redeem','adjustment','body_log'));
alter table public.muscle_coin_ledger
  add column if not exists source_table text,
  add column if not exists source_id uuid;
create unique index if not exists muscle_coin_ledger_body_log_unique
  on public.muscle_coin_ledger(user_id, source_table, source_id)
  where event_type = 'body_log' and source_id is not null;

create or replace function public.reward_body_log()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
begin
  insert into public.muscle_coin_ledger(user_id, amount, event_type, source_table, source_id, note)
  values(new.user_id, 1, 'body_log', tg_table_name, new.id, 'Körperwert protokolliert')
  on conflict(user_id, source_table, source_id) where event_type = 'body_log' and source_id is not null do nothing;
  return new;
end;
$$;

drop trigger if exists weights_reward_body_log on public.weights;
create trigger weights_reward_body_log after insert on public.weights for each row execute function public.reward_body_log();
drop trigger if exists skinfolds_reward_body_log on public.skinfolds;
create trigger skinfolds_reward_body_log after insert on public.skinfolds for each row execute function public.reward_body_log();
drop trigger if exists waist_reward_body_log on public.waist_measurements;
create trigger waist_reward_body_log after insert on public.waist_measurements for each row execute function public.reward_body_log();

do $$
declare target_table text;
begin
  foreach target_table in array array['waist_measurements','nutrition_day_status','bodycomp_checkins','logman_performance'] loop
    if not exists (
      select 1 from pg_publication_tables
      where pubname='supabase_realtime' and schemaname='public' and tablename=target_table
    ) then execute format('alter publication supabase_realtime add table public.%I', target_table); end if;
  end loop;
end $$;

alter table public.waist_measurements replica identity full;
alter table public.nutrition_day_status replica identity full;
alter table public.bodycomp_checkins replica identity full;
alter table public.logman_performance replica identity full;
