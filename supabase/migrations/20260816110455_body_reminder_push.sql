create or replace function public.sync_body_reminder(target_user uuid)
returns void language plpgsql security definer set search_path = ''
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
  on conflict (user_id, type, label) do update set
    time = excluded.time, weekdays = excluded.weekdays, active = excluded.active,
    metadata = excluded.metadata, route = excluded.route;
end; $$;

create or replace function public.profiles_sync_body_reminder()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform public.sync_body_reminder(new.id); return new; end; $$;

drop trigger if exists profiles_sync_body_reminder on public.profiles;
create trigger profiles_sync_body_reminder
  after insert or update of falten_erinnerung, falten_intervall_wochen, falten_uhrzeit, zeitzone
  on public.profiles for each row execute function public.profiles_sync_body_reminder();

create or replace function public.skinfolds_sync_body_reminder()
returns trigger language plpgsql security definer set search_path = ''
as $$ begin perform public.sync_body_reminder(coalesce(new.user_id, old.user_id)); return coalesce(new, old); end; $$;

drop trigger if exists skinfolds_sync_body_reminder on public.skinfolds;
create trigger skinfolds_sync_body_reminder
  after insert or delete on public.skinfolds
  for each row execute function public.skinfolds_sync_body_reminder();

create or replace function public.sync_all_body_reminders()
returns void language plpgsql security definer set search_path = ''
as $$ declare u uuid; begin
  for u in select id from public.profiles where falten_erinnerung = true loop
    perform public.sync_body_reminder(u);
  end loop;
end; $$;;
