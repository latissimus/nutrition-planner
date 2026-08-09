-- Routinen bleiben eigenständige Einträge und werden nicht mit Notizen vermischt.

alter table public.dex_entries drop constraint if exists dex_entries_entry_type_check;
alter table public.dex_entries drop constraint if exists dex_entries_content_check;

alter table public.dex_entries
  add constraint dex_entries_entry_type_check
    check (entry_type in ('link', 'image', 'note', 'audio', 'routine')),
  add constraint dex_entries_content_check
    check (
      (entry_type = 'link' and url is not null and image_path is null and audio_path is null)
      or (entry_type = 'image' and image_path is not null and url is null and audio_path is null)
      or (entry_type in ('note', 'routine') and url is null and audio_path is null)
      or (entry_type = 'audio' and audio_path is not null and url is null and image_path is null)
    );
