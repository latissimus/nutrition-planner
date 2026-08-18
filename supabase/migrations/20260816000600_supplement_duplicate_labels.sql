-- Supplements dürfen denselben Namen in mehreren Mahlzeit-Slots tragen
-- (z. B. „Multis" zum Frühstück UND zum Abendessen). Bisher verhinderte das der
-- Unique-Key (user_id, type, label): Beim Umbenennen des zweiten Supplements auf
-- einen bereits vergebenen Namen schlug das UPDATE mit 23505 fehl.
--
-- Neu: Uniqueness für Supplements über (user_id, type, label, time) – gleicher
-- Name zu unterschiedlichen Uhrzeiten ist erlaubt. Für alle anderen Typen
-- (Mahlzeit, Schlaf, Körperwerte, Routine, Trinken) bleibt es beim Namen, damit
-- die bestehenden Sync-Trigger ihre Zeile weiterhin per Label finden/aktualisieren.

alter table public.reminders drop constraint if exists reminders_user_id_type_label_key;

create unique index if not exists reminders_label_uniq
  on public.reminders (user_id, type, label)
  where type <> 'supplement';

create unique index if not exists reminders_supplement_uniq
  on public.reminders (user_id, type, label, time)
  where type = 'supplement';

-- Schlaf- und Body-Sync nutzen ON CONFLICT auf (user_id, type, label). Der
-- passende Arbiter ist jetzt der partielle Index reminders_label_uniq – dessen
-- Prädikat muss in der ON-CONFLICT-Klausel wiederholt werden.

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
    ) on conflict(user_id,type,label) where type <> 'supplement' do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;

    insert into public.reminders(user_id,type,label,time,weekdays,active,metadata,route)
    values (
      target_user,'sleep','Schlafenszeit · ' || day_name,schedule.bedtime,array[schedule.weekday],
      schedule.active and settings.bedtime_reminder,
      jsonb_build_object('icon','bedtime','phase','bedtime'),'#sleep'
    ) on conflict(user_id,type,label) where type <> 'supplement' do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;

    insert into public.reminders(user_id,type,label,time,weekdays,active,metadata,route)
    values (
      target_user,'sleep','Morgen-Check-in · ' || wake_day_name,schedule.wake_time,array[(schedule.weekday + 1) % 7],
      schedule.active and settings.morning_reminder,
      jsonb_build_object('icon','bedtime','phase','check-in'),'#sleep'
    ) on conflict(user_id,type,label) where type <> 'supplement' do update set
      time=excluded.time,weekdays=excluded.weekdays,active=excluded.active,metadata=excluded.metadata,route=excluded.route;
  end loop;
end;
$$;

create or replace function public.sync_body_reminder(target_user uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  prof public.profiles%rowtype;
  letzte date;
  intervall int;
  heute date;
  faellig boolean;
begin
  select * into prof from public.profiles where id = target_user;
  if not found then return; end if;

  intervall := greatest(1, coalesce(prof.falten_intervall_wochen, 2));
  heute := (now() at time zone coalesce(nullif(prof.zeitzone, ''), 'UTC'))::date;
  select max(gemessen_am) into letzte from public.skinfolds where user_id = target_user;
  faellig := letzte is not null and heute >= (letzte + (intervall * 7));

  insert into public.reminders (user_id, type, label, time, weekdays, active, metadata, route)
  values (
    target_user, 'body', 'Körperwerte messen',
    coalesce(prof.falten_uhrzeit, time '08:00'),
    array[0,1,2,3,4,5,6],
    coalesce(prof.falten_erinnerung, false) and faellig,
    jsonb_build_object('icon', 'emoji:📏', 'intervall_wochen', intervall),
    '#body'
  )
  on conflict (user_id, type, label) where type <> 'supplement' do update set
    time = excluded.time,
    weekdays = excluded.weekdays,
    active = excluded.active,
    metadata = excluded.metadata,
    route = excluded.route;
end;
$$;
