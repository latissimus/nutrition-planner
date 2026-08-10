-- Spaziergang als festes Routinen-Template und eindeutige, nicht pro Routine
-- manipulierbare Verguetung fuer alle Vorlagen. Nur freie Routinen verwenden
-- den vom Nutzer eingestellten coin_reward-Wert.

alter table public.routines drop constraint if exists routines_template_type_check;
alter table public.routines add constraint routines_template_type_check
  check (template_type in ('custom', 'meditation', 'mobility', 'walk'));

alter table public.routines drop constraint if exists routines_duration_minutes_check;
alter table public.routines add constraint routines_duration_minutes_check
  check (duration_minutes is null or duration_minutes in (2, 5, 10, 15, 20, 30, 45, 60));

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

  reward_amount := case selected_routine.template_type
    when 'meditation' then case selected_routine.duration_minutes
      when 2 then 2 when 5 then 4 when 10 then 7
      when 15 then 10 when 20 then 12 else 4 end
    when 'mobility' then case
      when selected_routine.duration_minutes >= 15 then 10 else 6 end
    when 'walk' then case selected_routine.duration_minutes
      when 15 then 8 when 30 then 12 when 45 then 16
      when 60 then 20 else 8 end
    else coalesce(selected_routine.coin_reward, 5)
  end;

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

revoke all on function public.set_routine_coin_state(uuid,date,boolean) from public, anon;
grant execute on function public.set_routine_coin_state(uuid,date,boolean) to authenticated;
