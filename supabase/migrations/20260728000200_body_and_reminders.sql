-- Koerperwerte und Reminder-Basis.
--
-- Diese Migration gehoert zum eigenstaendigen nutrition-planner-Projekt.

create table if not exists public.skinfolds (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gemessen_am  date not null default current_date,
  falten       jsonb not null,
  created_at   timestamptz not null default now(),
  unique (user_id, gemessen_am)
);

create index if not exists skinfolds_user_datum_idx
  on public.skinfolds(user_id, gemessen_am desc);

create table if not exists public.weights (
  id           uuid primary key default gen_random_uuid(),
  user_id      uuid not null references auth.users(id) on delete cascade,
  gemessen_am  date not null default current_date,
  kg           numeric(5,2) not null check (kg > 0 and kg < 500),
  created_at   timestamptz not null default now(),
  unique (user_id, gemessen_am)
);

create index if not exists weights_user_datum_idx
  on public.weights(user_id, gemessen_am desc);

alter table public.profiles
  add column if not exists falten_intervall_wochen int not null default 2
    check (falten_intervall_wochen between 1 and 4),
  add column if not exists falten_erinnerung boolean not null default false,
  add column if not exists falten_uhrzeit time not null default '08:00';

create table if not exists public.reminders (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  type        text not null check (type in ('meal', 'supplement', 'drink', 'body', 'habit', 'sleep')),
  label       text not null check (char_length(trim(label)) between 1 and 80),
  time        time not null default '08:00',
  weekdays    int[] not null default array[0,1,2,3,4,5,6],
  active      boolean not null default false,
  metadata    jsonb not null default '{}'::jsonb,
  route       text not null default '#reminders',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  unique (user_id, type, label),
  check (weekdays <@ array[0,1,2,3,4,5,6])
);

create index if not exists reminders_user_type_idx
  on public.reminders(user_id, type, time);

alter table public.skinfolds enable row level security;
alter table public.weights enable row level security;
alter table public.reminders enable row level security;

drop policy if exists skinfolds_all_own on public.skinfolds;
create policy skinfolds_all_own on public.skinfolds
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists weights_all_own on public.weights;
create policy weights_all_own on public.weights
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop policy if exists reminders_all_own on public.reminders;
create policy reminders_all_own on public.reminders
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create or replace function public.touch_updated_at()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists reminders_touch_updated_at on public.reminders;
create trigger reminders_touch_updated_at
  before update on public.reminders
  for each row execute function public.touch_updated_at();
