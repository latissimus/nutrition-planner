-- Beim Löschen eines Auth-Users werden alle DB-Daten bereits per ON DELETE
-- CASCADE entfernt. Storage-Objekte hängen jedoch nicht an auth.users (kein
-- Foreign Key), sodass hochgeladene Bilder (z. B. dex-entries) sonst als
-- Waisen zurückbleiben. Dieser Trigger räumt die Objekte des Nutzers mit auf.
-- Er greift für beide Löschwege: die App-RPC delete_own_account und das
-- manuelle Löschen im Supabase-Auth-Dashboard.
--
-- Hinweis: null-owner-Objekte (z. B. geteilte link-previews) bleiben bewusst
-- erhalten, da sie keinem einzelnen Nutzer gehören.
create or replace function public.cleanup_user_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- storage.objects ist per Schutz-Trigger gegen direktes SQL-Löschen gesperrt.
  -- Der offizielle Ausweg ist das transaktionslokale Flag; es gilt nur für
  -- diese Löschung und setzt sich am Transaktionsende von selbst zurück.
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where owner = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_cleanup_storage on auth.users;
create trigger on_auth_user_deleted_cleanup_storage
  before delete on auth.users
  for each row execute function public.cleanup_user_storage();

-- Liefert die Storage-Pfade eines Nutzers, damit die delete-account-Edge-
-- Function die Objekte physisch über die Storage-API entfernen kann (der
-- Trigger oben löscht nur den Datensatz, nicht die Datei im Backend). Nur für
-- service_role aufrufbar; die Function reicht ausschließlich die ID des
-- authentifizierten Aufrufers hinein.
create or replace function public.user_storage_paths(ziel uuid)
returns table(bucket_id text, name text)
language sql
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name from storage.objects o where o.owner = ziel;
$$;

revoke all on function public.user_storage_paths(uuid) from public;
grant execute on function public.user_storage_paths(uuid) to service_role;
