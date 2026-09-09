-- SUPPS ist wie REZEPTE und TRAINING ein fester DEX mit eigenen Unterordnern.
-- STRESS bleibt in der erlaubten Liste, damit dessen bestehende Ordnerstruktur
-- beim Erweitern der Constraint nicht versehentlich ausgeschlossen wird.

alter table public.collections drop constraint if exists collections_root_key_check;
alter table public.collections
  add constraint collections_root_key_check
    check (root_key in ('home', 'food-log', 'training', 'stress', 'supps'));
