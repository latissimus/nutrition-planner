alter table public.reminders
  add column if not exists routine_id uuid references public.routines(id) on delete cascade;

alter table public.reminders
  drop constraint if exists reminders_routine_id_key;
alter table public.reminders
  add constraint reminders_routine_id_key unique (routine_id);;
