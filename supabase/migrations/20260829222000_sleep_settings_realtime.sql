-- Sleep-Log-Einstellungen wie Plan und Check-ins geräteübergreifend aktuell
-- halten. Die Migration ist idempotent, damit lokale und bestehende Projekte
-- denselben Stand erreichen.
do $$
begin
  if not exists (
    select 1
    from pg_publication_tables
    where pubname = 'supabase_realtime'
      and schemaname = 'public'
      and tablename = 'sleep_settings'
  ) then
    alter publication supabase_realtime add table public.sleep_settings;
  end if;
end $$;

alter table public.sleep_settings replica identity full;
