-- CAPCOINS zuruecksetzen: Der Kontostand faellt auf null, die Belohnungen
-- bleiben. Das Kassenbuch ist fuer die App nur lesbar, damit niemand sich
-- Coins selbst gutschreibt; das Loeschen laeuft deshalb ueber diese Funktion
-- und trifft ausschliesslich die eigenen Buchungen. Geloeschte Zeilen sichert
-- der Datenverlauf-Trigger (20260929085719_datenverlauf).
create or replace function public.reset_muscle_coins()
returns integer language plpgsql security definer set search_path = public, pg_temp as $$
begin
  if auth.uid() is null then raise exception 'Nicht angemeldet'; end if;
  delete from public.muscle_coin_ledger where user_id = auth.uid();
  return public.muscle_coin_balance();
end;
$$;

revoke all on function public.reset_muscle_coins() from public, anon;
grant execute on function public.reset_muscle_coins() to authenticated;
