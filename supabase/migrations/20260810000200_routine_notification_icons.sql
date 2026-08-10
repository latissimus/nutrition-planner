-- Routine-Icons liegen bereits entweder als Icon-ID oder als "emoji:…" vor.
-- Der alte Trigger stellte pauschal ein zweites "emoji:" davor.

create or replace function public.sync_routine_reminder()
returns trigger
language plpgsql
security definer
set search_path = public
as $$
declare
  converted_weekdays int[];
begin
  if tg_op = 'DELETE' then
    delete from public.reminders where id = old.id;
    return old;
  end if;

  if new.active and new.time is not null then
    select coalesce(array_agg(case when day_number = 7 then 0 else day_number end order by ordinal), array[]::int[])
      into converted_weekdays
      from unnest(new.weekdays) with ordinality as selected_days(day_number, ordinal);

    insert into public.reminders (id, user_id, type, label, time, weekdays, active, metadata, route)
    values (
      new.id, new.user_id, 'habit', new.name, new.time, converted_weekdays, true,
      jsonb_build_object('icon', new.icon, 'routine_id', new.id, 'notiz', new.note),
      '#habits'
    )
    on conflict (id) do update set
      user_id = excluded.user_id,
      type = excluded.type,
      label = excluded.label,
      time = excluded.time,
      weekdays = excluded.weekdays,
      active = excluded.active,
      metadata = excluded.metadata,
      route = excluded.route,
      updated_at = now();
  else
    delete from public.reminders where id = new.id;
  end if;
  return new;
end;
$$;

-- Bereits synchronisierte Routine-Erinnerungen ebenfalls berichtigen.
update public.reminders reminder
set metadata = jsonb_build_object(
  'icon', routine.icon,
  'routine_id', routine.id,
  'notiz', routine.note
), updated_at = now()
from public.routines routine
where reminder.id = routine.id and reminder.type = 'habit';
