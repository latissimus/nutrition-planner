-- FOOD-LOG wird zum zentralen Rezept- und Mahlzeiten-Dex. Der bisherige
-- feste Rezepte-Dex wird samt seiner Unter-Dex und Eintraege uebernommen.

alter table public.dex_entries
  add column if not exists food_kind text,
  add column if not exists carb_class text,
  add column if not exists prep_minutes integer;

alter table public.dex_entries drop constraint if exists dex_entries_food_kind_check;
alter table public.dex_entries drop constraint if exists dex_entries_carb_class_check;
alter table public.dex_entries drop constraint if exists dex_entries_prep_minutes_check;

alter table public.dex_entries
  add constraint dex_entries_food_kind_check
    check (food_kind is null or food_kind in ('recipe', 'cheat_meal')),
  add constraint dex_entries_carb_class_check
    check (carb_class is null or carb_class in ('low', 'high', 'balanced', 'unset')),
  add constraint dex_entries_prep_minutes_check
    check (prep_minutes is null or prep_minutes between 1 and 1440);

-- Die urspruengliche Collections-Migration hat fuer root_key einen Check
-- angelegt. Erst nach dessen Entfernung koennen alte Rezepte verschoben werden.
alter table public.collections drop constraint if exists collections_root_key_check;

update public.dex_entries
set root_key = 'food-log',
    food_kind = coalesce(food_kind, 'recipe'),
    carb_class = coalesce(carb_class, 'unset')
where root_key = 'recipes';

update public.collections
set root_key = 'food-log'
where root_key = 'recipes';

alter table public.collections
  add constraint collections_root_key_check
    check (root_key in ('home', 'food-log'));

update public.dex_entries
set food_kind = coalesce(food_kind, 'recipe'),
    carb_class = coalesce(carb_class, 'unset')
where root_key = 'food-log';

create index if not exists dex_entries_food_filters_idx
  on public.dex_entries(user_id, root_key, food_kind, carb_class, favorite, created_at desc);
