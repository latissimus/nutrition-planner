-- Routine-Abschluss, Push-Status und MUSCLE-COINS gehoeren fachlich zu einer
-- Aktion. Diese RPC fuehrt sie in einer einzigen Datenbanktransaktion aus.
-- Wir verwenden absichtlich die bestehende set_routine_coin_state-Funktion,
-- damit die festgelegten Verguetungen nur an einer Stelle gepflegt werden.

-- Die Tabelle entstand im Remote-Projekt bereits waehrend der ersten
-- Push-Umsetzung. Sie wird hier auch lokal beschrieben, damit ein komplett
-- neues Projekt die gesamte Migrationhistorie reproduzierbar ausfuehren kann.
create table if not exists public.reminder_completions (
  reminder_id uuid not null references public.reminders(id) on delete cascade,
  user_id uuid not null references auth.users(id) on delete cascade,
  date date not null,
  completed_at timestamptz,
  snoozed_until timestamptz,
  created_at timestamptz not null default now(),
  primary key (user_id, reminder_id, date)
);

create index if not exists reminder_completions_user_date_idx
  on public.reminder_completions(user_id, date);

alter table public.reminder_completions enable row level security;
drop policy if exists reminder_completions_all_own on public.reminder_completions;
create policy reminder_completions_all_own on public.reminder_completions
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and exists (
      select 1 from public.reminders reminder
      where reminder.id = reminder_id and reminder.user_id = auth.uid()
    )
  );

create or replace function public.set_routine_completion_state(
  target_routine uuid,
  target_date date,
  is_completed boolean,
  target_snoozed_until timestamptz default null
)
returns integer
language plpgsql
security definer
set search_path = public, pg_temp
as $$
declare
  selected_routine public.routines%rowtype;
begin
  if target_date is null then
    raise exception 'Datum fehlt';
  end if;

  select * into selected_routine
  from public.routines
  where id = target_routine and user_id = auth.uid()
  for update;

  if not found then
    raise exception 'Routine nicht gefunden';
  end if;

  if is_completed then
    insert into public.routine_completions(routine_id, user_id, completed_on)
    values (target_routine, auth.uid(), target_date)
    on conflict (routine_id, completed_on) do nothing;

    -- Routinen ohne Uhrzeit besitzen absichtlich keine Reminder-Zeile.
    if exists (
      select 1 from public.reminders
      where id = target_routine and user_id = auth.uid()
    ) then
      insert into public.reminder_completions(
        reminder_id, user_id, date, completed_at, snoozed_until
      ) values (
        target_routine, auth.uid(), target_date, now(), null
      )
      on conflict (user_id, reminder_id, date) do update set
        completed_at = excluded.completed_at,
        snoozed_until = null;
    end if;
  else
    delete from public.routine_completions
    where routine_id = target_routine
      and user_id = auth.uid()
      and completed_on = target_date;

    if target_snoozed_until is null then
      delete from public.reminder_completions
      where reminder_id = target_routine
        and user_id = auth.uid()
        and date = target_date;
    elsif exists (
      select 1 from public.reminders
      where id = target_routine and user_id = auth.uid()
    ) then
      insert into public.reminder_completions(
        reminder_id, user_id, date, completed_at, snoozed_until
      ) values (
        target_routine, auth.uid(), target_date, null, target_snoozed_until
      )
      on conflict (user_id, reminder_id, date) do update set
        completed_at = null,
        snoozed_until = excluded.snoozed_until;
    end if;
  end if;

  -- Ein Fehler bei der Coin-Synchronisierung rollt auch alle obigen
  -- Aenderungen zurueck. Umgekehrt kann es keinen Coin ohne Abschluss geben.
  perform public.set_routine_coin_state(target_routine, target_date, is_completed);
  return public.muscle_coin_balance();
end;
$$;

revoke all on function public.set_routine_completion_state(uuid,date,boolean,timestamptz)
  from public, anon;
grant execute on function public.set_routine_completion_state(uuid,date,boolean,timestamptz)
  to authenticated;
