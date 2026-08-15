-- Kalorienzaehlen ist optional. Erinnerungen funktionieren unabhaengig davon weiter.

alter table public.nutrition_settings
  add column if not exists tracking_enabled boolean not null default true;
