alter table public.dex_entries
  add column if not exists ingredient_items jsonb not null default '[]'::jsonb;

alter table public.dex_entries
  drop constraint if exists dex_entries_ingredient_items_check;

alter table public.dex_entries
  add constraint dex_entries_ingredient_items_check
  check (jsonb_typeof(ingredient_items) = 'array' and jsonb_array_length(ingredient_items) <= 100);;
