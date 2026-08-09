-- Routinen verwenden dieselbe Web-Push-Pipeline wie Mahlzeiten.
-- Routine und Erinnerung teilen sich ihre UUID, damit Erledigungen passen.

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
      jsonb_build_object('icon', 'emoji:' || new.icon, 'routine_id', new.id, 'notiz', new.note),
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

drop trigger if exists routines_sync_reminder on public.routines;
create trigger routines_sync_reminder
after insert or update or delete on public.routines
for each row execute function public.sync_routine_reminder();

insert into public.reminders (id, user_id, type, label, time, weekdays, active, metadata, route)
select
  r.id, r.user_id, 'habit', r.name, r.time,
  array(select case when day_number = 7 then 0 else day_number end from unnest(r.weekdays) day_number),
  true,
  jsonb_build_object('icon', 'emoji:' || r.icon, 'routine_id', r.id, 'notiz', r.note),
  '#habits'
from public.routines r
where r.active and r.time is not null
on conflict (id) do update set
  label = excluded.label,
  time = excluded.time,
  weekdays = excluded.weekdays,
  active = excluded.active,
  metadata = excluded.metadata,
  route = excluded.route,
  updated_at = now();
