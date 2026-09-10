-- ESSEN ist wie TRAINING und SUPPS eine feste Wissensseite mit eigenen
-- Unterordnern. Die vorhandene Constraint wird vollständig ersetzt, damit
-- ältere Datenbankstände alle bis heute gültigen Root-Keys behalten.
alter table public.collections drop constraint if exists collections_root_key_check;
alter table public.collections
  add constraint collections_root_key_check
    check (root_key in ('home', 'food-log', 'essen', 'training', 'stress', 'supps'));
