-- CAPBOY Coach, Schritt 6: persönliche Experimente mit Ergebnisprüfung.
--
-- Eine Maßnahme kann jetzt ein Experiment sein: mit einer Zielgröße aus einer
-- festen Liste (siehe supabase/functions/capboy-coach/experiments.ts), der
-- erwarteten Richtung und dem Ausgangswert, wie der Coach ihn aus den Daten
-- zitiert hat. Die Messung vor und nach dem Start berechnet die App bei jeder
-- Anfrage aus dem Wochenverlauf; gespeichert wird nur, was sie dafür braucht.
-- Bestehende Maßnahmen bleiben unverändert (alle neuen Spalten optional).

alter table public.coach_interventions
  add column if not exists target_metric_id text check (target_metric_id is null or target_metric_id in (
    'gewicht', 'faltensumme', 'taille', 'kraft', 'trainingstage', 'kalorien', 'protein', 'protokoll',
    'schlafdauer', 'schlafqualitaet', 'morgenenergie', 'erholung', 'hunger'
  )),
  add column if not exists expected_direction text check (expected_direction is null or expected_direction in ('steigt', 'sinkt', 'stabil')),
  add column if not exists baseline_note text check (baseline_note is null or char_length(baseline_note) <= 500);
