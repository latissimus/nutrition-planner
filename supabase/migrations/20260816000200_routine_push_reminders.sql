-- Routinen sollen wie Mahlzeiten/Supplements auch bei geschlossener App
-- benachrichtigen. Dafür wird zu jeder Routine mit Uhrzeit eine gespiegelte
-- Zeile vom Typ 'habit' in reminders angelegt, die dieselbe Push-Pipeline
-- (Cron + push_deliveries) nutzt. Die Verknüpfung erfolgt über routine_id.
--
-- ON DELETE CASCADE: Wird eine Routine gelöscht, verschwindet die gespiegelte
-- Erinnerung automatisch – und über push_deliveries.reminder_id (ebenfalls
-- CASCADE) auch deren Zustellprotokoll.
alter table public.reminders
  add column if not exists routine_id uuid references public.routines(id) on delete cascade;

-- UNIQUE über routine_id erlaubt beliebig viele NULL-Werte (alle Nicht-Habit-
-- Reminder) und dient zugleich als Upsert-Ziel (onConflict: 'routine_id'),
-- damit pro Routine genau eine Erinnerung existiert.
alter table public.reminders
  drop constraint if exists reminders_routine_id_key;
alter table public.reminders
  add constraint reminders_routine_id_key unique (routine_id);
