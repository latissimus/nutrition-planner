-- Eine Lieferung wird am fachlichen Termin dedupliziert, nicht an der Minute,
-- in der der Cronjob zufaellig ausgefuehrt wurde. Das ermoeglicht ein kurzes
-- Nachholfenster ohne doppelte Push-Benachrichtigungen.

alter table public.push_deliveries
  add column if not exists occurrence_key text;

create unique index if not exists push_deliveries_occurrence_unique
  on public.push_deliveries(reminder_id, subscription_id, occurrence_key)
  where occurrence_key is not null;

-- Alte Remote-Projekte besitzen diese ID bereits. Der Zusatz macht auch eine
-- neue, nur aus den lokalen Migrationen aufgebaute Datenbank kompatibel mit
-- dem bestehenden Snooze-Aufraeumcode.
alter table public.reminder_completions
  add column if not exists id uuid default gen_random_uuid();

update public.reminder_completions set id = gen_random_uuid() where id is null;
alter table public.reminder_completions alter column id set not null;
create unique index if not exists reminder_completions_id_unique
  on public.reminder_completions(id);

