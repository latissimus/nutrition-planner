-- Audioaufnahmen als eigener DEX-Eintrag fuer freie DEX, Training und Routinen.

alter table public.dex_entries
  add column if not exists audio_path text;

alter table public.dex_entries drop constraint if exists dex_entries_entry_type_check;
alter table public.dex_entries drop constraint if exists dex_entries_content_check;

alter table public.dex_entries
  add constraint dex_entries_entry_type_check
    check (entry_type in ('link', 'image', 'note', 'audio')),
  add constraint dex_entries_content_check
    check (
      (entry_type = 'link' and url is not null and image_path is null and audio_path is null)
      or (entry_type = 'image' and image_path is not null and url is null and audio_path is null)
      or (entry_type = 'note' and url is null and audio_path is null)
      or (entry_type = 'audio' and audio_path is not null and url is null and image_path is null)
    );

update storage.buckets
set file_size_limit = 26214400,
    allowed_mime_types = array[
      'image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif',
      'audio/mpeg','audio/mp4','audio/x-m4a','audio/aac','audio/wav','audio/webm','audio/ogg'
    ]
where id = 'dex-entries';
