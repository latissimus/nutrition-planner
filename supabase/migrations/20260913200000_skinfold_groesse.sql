-- Koerpergroesse als eigenes Messfeld der Hautfaltenmessung.
-- Die YPSI-Formel (Formel.xlsx, Blatt "Tracking") berechnet Koerperfett aus
-- Groesse, Gewicht und Faltensumme und fuehrt die Groesse deshalb pro Messung
-- statt einmalig im Profil. nutrition_settings.height_cm bleibt unveraendert
-- als Grundlage der Kalorienschaetzung bestehen.

alter table public.skinfolds
  add column if not exists groesse_cm numeric(5,1)
    check (groesse_cm between 100 and 250);

comment on column public.skinfolds.groesse_cm is
  'Koerpergroesse in cm zum Messzeitpunkt. Eingang in die YPSI-Koerperfettformel.';
