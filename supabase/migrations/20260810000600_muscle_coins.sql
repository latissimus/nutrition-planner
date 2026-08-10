-- MUSCLE-COINS: idempotente Belohnungen fuer Routinen und frei definierbare
-- Praemien. Die Punktevergabe geschieht serverseitig, damit ein erneuter Tap
-- oder ein zweites Geraet denselben Tagesabschluss nicht doppelt zaehlt.

alter table public.routines
  add column if not exists coin_reward smallint;

alter table public.routines drop constraint if exists routines_coin_reward_check;
alter table public.routines add constraint routines_coin_reward_check
  check (coin_reward is null or coin_reward between 0 and 50);

create table if not exists public.muscle_rewards (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  name text not null check (char_length(trim(name)) between 1 and 80),
  cost integer not null check (cost between 1 and 100000),
  note text not null default '' check (char_length(note) <= 500),
  link_url text,
  active boolean not null default true,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create table if not exists public.muscle_coin_ledger (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  amount integer not null check (amount <> 0),
  event_type text not null check (event_type in ('routine_complete','reward_redeem','adjustment')),
  routine_id uuid references public.routines(id) on delete cascade,
  completion_date date,
  reward_id uuid references public.muscle_rewards(id) on delete set null,
  note text not null default '',
  created_at timestamptz not null default now(),
  unique (user_id, routine_id, completion_date)
);

create index if not exists muscle_coin_ledger_user_created_idx
  on public.muscle_coin_ledger(user_id, created_at desc);
create index if not exists muscle_rewards_user_cost_idx
  on public.muscle_rewards(user_id, active, cost);

alter table public.muscle_rewards enable row level security;
alter table public.muscle_coin_ledger enable row level security;

drop policy if exists muscle_rewards_all_own on public.muscle_rewards;
create policy muscle_rewards_all_own on public.muscle_rewards for all to authenticated
  using (auth.uid() = user_id) with check (auth.uid() = user_id);

drop policy if exists muscle_coin_ledger_read_own on public.muscle_coin_ledger;
create policy muscle_coin_ledger_read_own on public.muscle_coin_ledger for select to authenticated
  using (auth.uid() = user_id);

drop trigger if exists muscle_rewards_touch_updated_at on public.muscle_rewards;
create trigger muscle_rewards_touch_updated_at before update on public.muscle_rewards
  for each row execute function public.touch_updated_at();

create or replace function public.muscle_coin_balance()
returns integer language sql stable security definer set search_path = public, pg_temp as $$
  select coalesce(sum(amount), 0)::integer
  from public.muscle_coin_ledger where user_id = auth.uid();
$$;

create or replace function public.set_routine_coin_state(
  target_routine uuid,
  target_date date,
  is_completed boolean
)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  selected_routine public.routines%rowtype;
  reward_amount integer;
begin
  select * into selected_routine from public.routines
  where id = target_routine and user_id = auth.uid();
  if not found then raise exception 'Routine nicht gefunden'; end if;

  if is_completed and not exists (
    select 1 from public.routine_completions
    where routine_id = target_routine and user_id = auth.uid()
      and completed_on = target_date
  ) then
    raise exception 'Routine ist an diesem Tag nicht als erledigt gespeichert';
  end if;

  reward_amount := coalesce(selected_routine.coin_reward,
    case
      when selected_routine.template_type = 'meditation' then
        case selected_routine.duration_minutes
          when 2 then 2 when 5 then 4 when 10 then 7
          when 15 then 10 when 20 then 12 else 4 end
      when selected_routine.template_type = 'mobility' then 6
      else 5
    end
  );

  if is_completed and reward_amount > 0 then
    insert into public.muscle_coin_ledger(
      user_id, amount, event_type, routine_id, completion_date, note
    ) values (
      auth.uid(), reward_amount, 'routine_complete', target_routine,
      target_date, selected_routine.name
    ) on conflict (user_id, routine_id, completion_date) do nothing;
  else
    delete from public.muscle_coin_ledger
    where user_id = auth.uid() and routine_id = target_routine
      and completion_date = target_date and event_type = 'routine_complete';
  end if;

  return public.muscle_coin_balance();
end;
$$;

create or replace function public.redeem_muscle_reward(target_reward uuid)
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
declare
  selected_reward public.muscle_rewards%rowtype;
  current_balance integer;
begin
  select * into selected_reward from public.muscle_rewards
  where id = target_reward and user_id = auth.uid() and active = true;
  if not found then raise exception 'Belohnung nicht gefunden'; end if;
  current_balance := public.muscle_coin_balance();
  if current_balance < selected_reward.cost then
    raise exception 'Noch nicht genug MUSCLE-COINS';
  end if;
  insert into public.muscle_coin_ledger(user_id, amount, event_type, reward_id, note)
  values(auth.uid(), -selected_reward.cost, 'reward_redeem', selected_reward.id, selected_reward.name);
  return public.muscle_coin_balance();
end;
$$;

revoke all on function public.muscle_coin_balance() from public, anon;
revoke all on function public.set_routine_coin_state(uuid,date,boolean) from public, anon;
revoke all on function public.redeem_muscle_reward(uuid) from public, anon;
grant execute on function public.muscle_coin_balance() to authenticated;
grant execute on function public.set_routine_coin_state(uuid,date,boolean) to authenticated;
grant execute on function public.redeem_muscle_reward(uuid) to authenticated;
