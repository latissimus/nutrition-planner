-- CAPBOY Coaching, Schritt 5: Wochen-Coaching am Montag (COACHING-PLAN.md).
--
-- 1) Ein Anspruch je Person und Tag, egal welcher Art (GPT-Review 05.10.2026):
--    Montags ersetzt das Wochen-Coaching das Tages-Coaching. Mit der alten
--    Eindeutigkeit (Person, Art, Datum) hätten an einem Montag beide Läufe
--    bezahlt werden können; jetzt scheitert schon das zweite Reservieren.
alter table public.coach_coachings drop constraint if exists coach_coachings_user_id_art_datum_key;
alter table public.coach_coachings drop constraint if exists coach_coachings_user_id_datum_key;
alter table public.coach_coachings add constraint coach_coachings_user_id_datum_key unique (user_id, datum);

-- 2) LOGMAN-Volumenstand (Prioritäten, Stufen), den jeder Wochen-Lauf beim
--    Reservieren festhält. Daran erkennt der nächste, ob das Volumen in den
--    letzten zwei Wochen geändert wurde (dann wird zuerst beobachtet).
alter table public.coach_coachings add column if not exists volumen_stand jsonb;

-- 3) Das freiwillige Wochen-Kärtchen: der eigene Rückblick auf die Woche
--    (Sonntag bis Montag 21 Uhr). Speichern kostet nichts; der Montags-Lauf
--    liest es. Kein Auslöser für den Änderungszähler: Das Kärtchen allein soll
--    am Sonntag kein bezahltes Tages-Coaching auslösen.
create table if not exists public.coach_wochen_checkins (
  user_id uuid not null references auth.users(id) on delete cascade,
  woche text not null check (woche ~ '^[0-9]{4}-W[0-9]{2}$'),
  umstaende text[] not null default '{}'
    check (umstaende <@ array['krank', 'unterwegs', 'stress', 'wenig_schlaf', 'ausnahme']::text[]),
  notiz text not null default '' check (char_length(notiz) <= 300),
  -- Umsetzung der laufenden Maßnahmen zum Zeitpunkt des Rückblicks:
  -- [{ "id": "<coach_interventions.id>", "adherence": "kaum" | … }]
  umsetzung jsonb not null default '[]'::jsonb check (jsonb_typeof(umsetzung) = 'array'),
  gespeichert_am timestamptz not null default now(),
  primary key (user_id, woche)
);

alter table public.coach_wochen_checkins enable row level security;
revoke all on table public.coach_wochen_checkins from anon;
grant select, insert, update, delete on table public.coach_wochen_checkins to authenticated;

drop policy if exists coach_wochen_checkins_select_own on public.coach_wochen_checkins;
create policy coach_wochen_checkins_select_own on public.coach_wochen_checkins
  for select to authenticated using (user_id = auth.uid());
drop policy if exists coach_wochen_checkins_insert_own on public.coach_wochen_checkins;
create policy coach_wochen_checkins_insert_own on public.coach_wochen_checkins
  for insert to authenticated with check (user_id = auth.uid());
drop policy if exists coach_wochen_checkins_update_own on public.coach_wochen_checkins;
create policy coach_wochen_checkins_update_own on public.coach_wochen_checkins
  for update to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
drop policy if exists coach_wochen_checkins_delete_own on public.coach_wochen_checkins;
create policy coach_wochen_checkins_delete_own on public.coach_wochen_checkins
  for delete to authenticated using (user_id = auth.uid());

-- 4) Verlauf der LOGMAN-Prioritäten (GPT-Review Schritt 5, Punkt 1): Die
--    geplanten Sätze eines Zyklus hängen von den Prioritäten ab, die damals
--    galten. LOGMAN speichert nur die aktuelle Fassung; ohne Verlauf würde ein
--    alter Zyklus mit der heutigen Priorität nachgerechnet und sähe nachträglich
--    besser oder schlechter aus. logman-abgleich hängt bei jeder Änderung einen
--    Eintrag { ab: Datum, prioritaet: … } an. Zyklen, deren Vorgabe sich so
--    nicht sicher bestimmen lässt, bewertet das Wochen-Coaching nicht.
alter table public.logman_spiegel add column if not exists prioritaet_verlauf jsonb not null default '[]'::jsonb
  check (jsonb_typeof(prioritaet_verlauf) = 'array');
