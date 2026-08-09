create table if not exists public.routines (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 100),
  note text not null default '' check (char_length(note) <= 500),
  icon text not null default '✓' check (char_length(icon) between 1 and 16),
  period text not null default 'morning' check (period in ('morning','midday','evening')),
  time time,
  weekdays smallint[] not null default array[1,2,3,4,5,6,7],
  active boolean not null default true,
  position bigint generated always as identity,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.routine_completions (
  routine_id uuid not null references public.routines(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  completed_on date not null default current_date,
  created_at timestamptz not null default now(),
  primary key (routine_id, completed_on)
);

create index if not exists routines_user_position_idx on public.routines(user_id, position);
create index if not exists routine_completions_user_date_idx on public.routine_completions(user_id, completed_on);

alter table public.routines enable row level security;
alter table public.routine_completions enable row level security;

drop policy if exists routines_all_own on public.routines;
create policy routines_all_own on public.routines for all
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists routine_completions_all_own on public.routine_completions;
create policy routine_completions_all_own on public.routine_completions for all
  using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and exists (select 1 from public.routines r where r.id = routine_id and r.user_id = auth.uid())
  );

drop trigger if exists routines_touch_updated_at on public.routines;
create trigger routines_touch_updated_at before update on public.routines
  for each row execute function public.touch_updated_at();
