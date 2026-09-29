-- Verlauf fuer Nutzerdaten: Loeschen und Aendern werden umkehrbar.
--
-- Anlass: Im Schwesterprojekt LOGMAN hat am 29.09.2026 ein fehlerhafter
-- Upload ein komplettes Trainingslog ueberschrieben – ohne Backup endgueltig.
-- In CAPBOY war Loeschen bisher ebenso endgueltig (Einzel-Loeschen, die
-- "alle ... loeschen"-Knoepfe in COMP, Ueberschreiben eines Tageswerts).
--
-- Vor jedem Loeschen bzw. Aendern landet die alte Zeile als JSON in
-- datenverlauf und bleibt 180 Tage. Wiederherstellen per SQL, z. B.:
--   insert into public.weights
--   select * from jsonb_populate_record(null::public.weights,
--     (select zeile from public.datenverlauf where id = <id>));
--
-- Bewusst ausgenommen:
-- * KI-Chats, KI-Analysen und coach_profile_memory: Wer dort loescht, will,
--   dass es wirklich weg ist.
-- * push_*, shared_spaces, profiles: technisch bzw. ohne user_id.
-- * user_preferences: nur die COMP-Eintraege ('comp:%'); der Rest ist
--   Oberflaechenzustand und aendert sich bei jeder Navigation.
-- * reminders, shopping_items und die Erledigt-/Coin-Tabellen: nur Loeschen.
--   Erinnerungen werden im Hintergrund laufend aktualisiert (>5000 Updates),
--   die Einkaufsliste bei jedem Abhaken.
--
-- Konto-Loeschen (delete_own_account -> delete from auth.users, Kaskade):
-- Waehrend der Kaskade ist der auth.users-Eintrag bereits weg; der Trigger
-- sichert dann nichts, und datenverlauf faellt per Fremdschluessel mit. So
-- blockiert der Verlauf das Loeschen nicht und haelt keine Daten eines
-- geloeschten Kontos zurueck. Beides am 29.09.2026 getestet.

create table if not exists public.datenverlauf (
  id           bigint generated always as identity primary key,
  user_id      uuid not null references auth.users(id) on delete cascade,
  tabelle      text not null,
  vorgang      text not null check (vorgang in ('geaendert', 'geloescht')),
  zeile        jsonb not null,
  gesichert_am timestamptz not null default now()
);
create index if not exists datenverlauf_user_zeit on public.datenverlauf (user_id, gesichert_am desc);
create index if not exists datenverlauf_tabelle_zeit on public.datenverlauf (tabelle, gesichert_am desc);

alter table public.datenverlauf enable row level security;
drop policy if exists datenverlauf_select_own on public.datenverlauf;
create policy datenverlauf_select_own on public.datenverlauf
  for select to authenticated
  using (user_id = auth.uid());
-- Keine Insert-/Update-/Delete-Regeln: Schreiben darf nur der Trigger.

create or replace function public.datenverlauf_sichern()
returns trigger
language plpgsql
security definer
set search_path = public, auth
as $$
begin
  if not exists (select 1 from auth.users where id = old.user_id) then
    return null;
  end if;

  if tg_table_name = 'user_preferences' and coalesce(to_jsonb(old) ->> 'key', '') not like 'comp:%' then
    return null;
  end if;

  if tg_op = 'UPDATE' and to_jsonb(new) is not distinct from to_jsonb(old) then
    return null;
  end if;

  insert into public.datenverlauf (user_id, tabelle, vorgang, zeile)
  values (old.user_id, tg_table_name,
          case when tg_op = 'DELETE' then 'geloescht' else 'geaendert' end,
          to_jsonb(old));

  delete from public.datenverlauf
  where user_id = old.user_id
    and gesichert_am < now() - interval '180 days';

  return null;
end;
$$;

revoke execute on function public.datenverlauf_sichern() from public, anon, authenticated;

do $$
declare
  t text;
  voll text[] := array[
    'weights', 'waist_measurements', 'skinfolds', 'bodycomp_checkins',
    'external_body_fat_measurements', 'logman_performance',
    'food_logs', 'nutrition_log_entries', 'nutrition_products',
    'nutrition_settings', 'nutrition_day_status',
    'sleep_logs', 'sleep_settings', 'sleep_schedules',
    'routines', 'dex_entries', 'collections', 'muscle_rewards',
    'coach_interventions', 'coach_weekly_reviews', 'user_preferences'
  ];
  nur_loeschen text[] := array[
    'reminders', 'shopping_items', 'reminder_completions',
    'routine_completions', 'muscle_coin_ledger'
  ];
begin
  foreach t in array voll loop
    execute format('drop trigger if exists datenverlauf on public.%I', t);
    execute format('create trigger datenverlauf after update or delete on public.%I
                    for each row execute function public.datenverlauf_sichern()', t);
  end loop;
  foreach t in array nur_loeschen loop
    execute format('drop trigger if exists datenverlauf on public.%I', t);
    execute format('create trigger datenverlauf after delete on public.%I
                    for each row execute function public.datenverlauf_sichern()', t);
  end loop;
end $$;
