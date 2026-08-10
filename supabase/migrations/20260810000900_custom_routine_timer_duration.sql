-- Freie Routinen dürfen eine individuelle Timerdauer verwenden. Die
-- Obergrenze entspricht dem Eingabefeld der App und verhindert versehentlich
-- unrealistisch große Werte.
alter table public.routines drop constraint if exists routines_duration_minutes_check;
alter table public.routines add constraint routines_duration_minutes_check
  check (duration_minutes is null or duration_minutes between 1 and 240);
