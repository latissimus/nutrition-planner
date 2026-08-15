-- Fuenf alltagstaugliche Mahlzeiten-Slots statt drei grober Tageszeiten.

alter table public.nutrition_log_entries
  drop constraint if exists nutrition_log_entries_period_check;

update public.nutrition_log_entries set period = 'breakfast' where period = 'morning';
update public.nutrition_log_entries set period = 'lunch' where period = 'midday';
update public.nutrition_log_entries set period = 'dinner' where period = 'evening';

alter table public.nutrition_log_entries
  add constraint nutrition_log_entries_period_check
  check (period in ('breakfast', 'snack_morning', 'lunch', 'snack_afternoon', 'dinner'));
