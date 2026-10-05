-- Tägliches Coaching um 21 Uhr (COACHING-PLAN.md, Schritt 3).
--
-- coach_coachings hält je Person und Tag höchstens ein Coaching. „art“ trennt
-- Tag und Woche (die Wochenbilanz folgt in Schritt 5). „bereiche“ nennt die
-- angesprochenen Bereiche, daraus entstehen später die Punkte an den Reitern.
-- „gelesen_am“ setzt die App, wenn die Person das Coaching geöffnet hat.
-- Schreiben tut nur die Edge Function capboy-coach (Service-Rolle).
--
-- Der Zeitplan ruft capboy-coach um 19:00 und 20:00 UTC auf. Die Funktion
-- arbeitet nur, wenn es in Europe/Berlin 21 Uhr ist: So stimmt die Uhrzeit im
-- Sommer und im Winter. Das Geheimnis kommt wie beim Erinnerungslauf aus dem
-- Tresor (send_reminders_cron_secret). Der öffentliche anon-Schlüssel im Kopf
-- ist nur für das Gateway (verify_jwt); berechtigt ist der Lauf allein über
-- x-cron-secret.

begin;

create table if not exists public.coach_coachings (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  art         text not null default 'tag' check (art in ('tag', 'woche')),
  datum       date not null,
  ergebnis    jsonb,
  bereiche    text[] not null default '{}',
  modell      text,
  erstellt_am timestamptz not null default now(),
  gelesen_am  timestamptz,
  status      text not null default 'laeuft' check (status in ('laeuft', 'bereit', 'fehlgeschlagen')),
  input_revision bigint not null default 0,
  fehler      text,
  check ((status = 'bereit' and ergebnis is not null) or (status <> 'bereit' and ergebnis is null)),
  unique (user_id, art, datum)
);
create index if not exists coach_coachings_user_datum on public.coach_coachings (user_id, datum desc);

alter table public.coach_coachings enable row level security;
revoke insert, delete on table public.coach_coachings from anon, authenticated;
drop policy if exists coach_coachings_select_own on public.coach_coachings;
create policy coach_coachings_select_own on public.coach_coachings
  for select to authenticated using (user_id = auth.uid());
-- Nur „gelesen“ markieren: Spaltenrecht auf gelesen_am, Zeile nur die eigene.
revoke update on table public.coach_coachings from anon, authenticated;
grant update (gelesen_am) on table public.coach_coachings to authenticated;
drop policy if exists coach_coachings_gelesen_own on public.coach_coachings;
create policy coach_coachings_gelesen_own on public.coach_coachings
  for update to authenticated using (user_id = auth.uid() and status = 'bereit') with check (user_id = auth.uid() and status = 'bereit');

-- Jede Änderung relevanter Daten zählt, auch wenn ihr Messdatum in der
-- Vergangenheit liegt. So löst ein nachgetragener Schlafwert ein Coaching aus.
-- Die App hat keinen direkten Schreibzugriff auf diesen Zähler.
create table if not exists public.coach_input_revisions (
  user_id uuid primary key references auth.users(id) on delete cascade,
  revision bigint not null default 0,
  geaendert_am timestamptz not null default now(),
  letzte_quelle text not null default '',
  quellen_revisionen jsonb not null default '{}'::jsonb
);
alter table public.coach_input_revisions enable row level security;
revoke all on table public.coach_input_revisions from anon, authenticated;

create or replace function public.coach_input_geaendert()
returns trigger language plpgsql security definer set search_path = public, pg_temp as $$
declare
  person uuid;
begin
  person := case when TG_OP = 'DELETE' then old.user_id else new.user_id end;
  insert into public.coach_input_revisions (user_id, revision, geaendert_am, letzte_quelle, quellen_revisionen)
  values (person, 1, now(), TG_TABLE_NAME, jsonb_build_object(TG_TABLE_NAME, 1))
  on conflict (user_id) do update set
    revision = public.coach_input_revisions.revision + 1,
    geaendert_am = excluded.geaendert_am,
    letzte_quelle = excluded.letzte_quelle,
    quellen_revisionen = jsonb_set(
      public.coach_input_revisions.quellen_revisionen,
      array[excluded.letzte_quelle],
      to_jsonb(public.coach_input_revisions.revision + 1), true
    );
  return null;
end;
$$;
revoke all on function public.coach_input_geaendert() from public, anon, authenticated;

-- Ein Update zählt nur, wenn sich die Zeile fachlich ändert. Der
-- LOGMAN-Abgleich schreibt alle Leistungszeilen bei jeder neuen LOGMAN-Version
-- erneut, meist unverändert. Ohne diese Bedingung stiege der Zähler dabei
-- jedes Mal, und das Coaching liefe kostenpflichtig, obwohl nichts trainiert
-- wurde.
do $$
declare
  quelle text;
begin
  foreach quelle in array array[
    'nutrition_log_entries', 'sleep_logs', 'weights', 'skinfolds',
    'waist_measurements', 'bodycomp_checkins', 'routine_completions',
    'nutrition_settings', 'routines'
  ] loop
    execute format('drop trigger if exists coach_input_geaendert on public.%I', quelle);
    execute format('drop trigger if exists coach_input_geaendert_aenderung on public.%I', quelle);
    execute format('create trigger coach_input_geaendert after insert or delete on public.%I for each row execute function public.coach_input_geaendert()', quelle);
    execute format('create trigger coach_input_geaendert_aenderung after update on public.%I for each row when (old.* is distinct from new.*) execute function public.coach_input_geaendert()', quelle);
  end loop;
end;
$$;

-- Leistungswerte: nur die fachlichen Werte vergleichen, nicht Verwaltungsfelder
-- wie imported_at oder source. Löschen zählt (gelöschte Sätze in LOGMAN).
drop trigger if exists coach_input_geaendert on public.logman_performance;
drop trigger if exists coach_input_geaendert_aenderung on public.logman_performance;
create trigger coach_input_geaendert after insert or delete on public.logman_performance
  for each row execute function public.coach_input_geaendert();
create trigger coach_input_geaendert_aenderung after update on public.logman_performance
  for each row when (
    (old.performed_on, old.exercise, old.category, old.weight_kg, old.repetitions, old.estimated_1rm, old.volume)
    is distinct from
    (new.performed_on, new.exercise, new.category, new.weight_kg, new.repetitions, new.estimated_1rm, new.volume)
  )
  execute function public.coach_input_geaendert();

-- LOGMAN-Spiegel: Es zählt nur, wenn eine Einheit mit Datum neu dazukommt oder
-- wegfällt. Schon ein Blick auf einen Tag in LOGMAN legt leere Blöcke an und
-- erhöht dort die Version; das ist kein Training. Ein leerer Spiegel ({}) und
-- Einheiten von vor der Kopplung (Datum null) zählen ebenfalls nicht. Weitere
-- Sätze in einer Einheit zeigen sich über logman_performance. Das Löschen des
-- Spiegels beim Neu-Koppeln ist kein Training und zählt nicht.
create or replace function public.coach_datierte_einheiten(p jsonb)
returns jsonb
language sql
immutable
set search_path = public
as $$
  select coalesce(jsonb_object_agg(eintrag.key, eintrag.value), '{}'::jsonb)
  from jsonb_each(case when jsonb_typeof(p) = 'object' then p else '{}'::jsonb end) as eintrag
  where jsonb_typeof(eintrag.value) = 'string'
$$;
drop trigger if exists coach_input_geaendert on public.logman_spiegel;
drop trigger if exists coach_input_geaendert_neu on public.logman_spiegel;
drop trigger if exists coach_input_geaendert_aenderung on public.logman_spiegel;
create trigger coach_input_geaendert_neu after insert on public.logman_spiegel
  for each row when (public.coach_datierte_einheiten(new.einheiten_gesehen) <> '{}'::jsonb)
  execute function public.coach_input_geaendert();
create trigger coach_input_geaendert_aenderung after update on public.logman_spiegel
  for each row when (public.coach_datierte_einheiten(old.einheiten_gesehen) is distinct from public.coach_datierte_einheiten(new.einheiten_gesehen))
  execute function public.coach_input_geaendert();

select cron.unschedule('coaching-taeglich') where exists (select 1 from cron.job where jobname = 'coaching-taeglich');
select cron.schedule('coaching-taeglich', '0 19,20 * * *', $job$
  select net.http_post(
    url := 'https://ukpzvinoxzwypnpnrbdp.supabase.co/functions/v1/capboy-coach',
    headers := jsonb_build_object(
      'Content-Type', 'application/json',
      'Authorization', 'Bearer eyJhbGciOiJIUzI1NiIsInR5cCI6IkpXVCJ9.eyJpc3MiOiJzdXBhYmFzZSIsInJlZiI6InVrcHp2aW5veHp3eXBucG5yYmRwIiwicm9sZSI6ImFub24iLCJpYXQiOjE3ODUyMzg2OTYsImV4cCI6MjEwMDgxNDY5Nn0.DBGb2Fj5Qb2kR4huH0Buaz-SOahOBvkvXWoPiaZqVIY',
      'x-cron-secret', (select decrypted_secret from vault.decrypted_secrets where name = 'send_reminders_cron_secret' limit 1)
    ),
    body := '{"mode":"coaching-lauf"}'::jsonb,
    timeout_milliseconds := 5000
  );
$job$);

commit;
