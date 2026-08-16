-- Strukturierte Rezept-Zutaten: jede Zutat verweist auf ein echtes Lebensmittel
-- aus der Datenbank (BLS/Open Food Facts/eigene Mahlzeit) samt 100-g-Nährwerten.
-- Der Meal-Log summiert daraus die Nährwerte, ohne Namen erraten zu müssen.
-- Format je Element: { name, grams, kcal_100g, protein_100g, carbs_100g,
--                      fat_100g, source, barcode?, image_url? }
alter table public.dex_entries
  add column if not exists ingredient_items jsonb not null default '[]'::jsonb;

alter table public.dex_entries
  drop constraint if exists dex_entries_ingredient_items_check;

alter table public.dex_entries
  add constraint dex_entries_ingredient_items_check
  check (jsonb_typeof(ingredient_items) = 'array' and jsonb_array_length(ingredient_items) <= 100);
