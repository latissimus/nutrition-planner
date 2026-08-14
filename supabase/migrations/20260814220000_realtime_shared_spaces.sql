-- Gemeinsame Bereiche ohne Neuladen synchronisieren. Die Tabellen bleiben
-- vollständig durch ihre bestehenden RLS-Regeln geschützt; Realtime liefert
-- einem angemeldeten Client nur Datensätze, die er auch normal lesen darf.

do $$
begin
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'shopping_items'
  ) then
    alter publication supabase_realtime add table public.shopping_items;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'dex_entries'
  ) then
    alter publication supabase_realtime add table public.dex_entries;
  end if;
  if not exists (
    select 1 from pg_publication_tables
    where pubname = 'supabase_realtime' and schemaname = 'public' and tablename = 'collections'
  ) then
    alter publication supabase_realtime add table public.collections;
  end if;
end $$;

alter table public.shopping_items replica identity full;
alter table public.dex_entries replica identity full;
alter table public.collections replica identity full;
