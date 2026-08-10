-- Konkrete, geordnete Übungsabläufe für Mobility-Routinen.

alter table public.routines
  add column if not exists mobility_exercises jsonb not null default '[]'::jsonb;

alter table public.routines drop constraint if exists routines_mobility_exercises_check;
alter table public.routines add constraint routines_mobility_exercises_check
  check (jsonb_typeof(mobility_exercises) = 'array');
