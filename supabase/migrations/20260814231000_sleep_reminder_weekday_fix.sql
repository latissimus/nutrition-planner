-- Eine Nacht wird dem Abend zugeordnet. Der Morgen-Check-in liegt deshalb am
-- folgenden Wochentag; diese Korrektur aktualisiert bereits ausgerollte DBs.

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

do $$
declare target_user uuid;
begin
  for target_user in select user_id from public.sleep_settings loop
    perform public.sync_sleep_reminders(target_user);
  end loop;
end $$;
