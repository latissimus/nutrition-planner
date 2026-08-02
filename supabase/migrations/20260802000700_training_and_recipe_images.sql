-- TRAINING ist ein fester DEX mit eigenen Unter-Dex. Eigene Rezepte duerfen
-- als Notiz/Rezept zusaetzlich ein Bild besitzen.

alter table public.collections drop constraint if exists collections_root_key_check;
alter table public.collections
  add constraint collections_root_key_check
    check (root_key in ('home', 'food-log', 'training'));

alter table public.dex_entries drop constraint if exists dex_entries_content_check;
alter table public.dex_entries
  add constraint dex_entries_content_check
    check (
      (entry_type = 'link' and url is not null and image_path is null)
      or (entry_type = 'image' and image_path is not null)
      or (entry_type = 'note' and url is null)
    );
