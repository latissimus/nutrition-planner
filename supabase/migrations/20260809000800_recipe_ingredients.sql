alter table public.dex_entries
  add column if not exists ingredients text[] not null default array[]::text[];

alter table public.dex_entries
  drop constraint if exists dex_entries_ingredients_count_check;

alter table public.dex_entries
  add constraint dex_entries_ingredients_count_check
  check (cardinality(ingredients) <= 100);
