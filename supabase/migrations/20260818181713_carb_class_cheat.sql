alter table public.dex_entries drop constraint if exists dex_entries_carb_class_check;

alter table public.dex_entries
  add constraint dex_entries_carb_class_check
  check (carb_class is null or carb_class in ('low', 'high', 'balanced', 'cheat', 'unset'));;
