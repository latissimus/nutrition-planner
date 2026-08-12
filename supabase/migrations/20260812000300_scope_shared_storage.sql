-- Freigegebene Food-Logs dürfen nur auf Medien ihres eigenen Bereichs
-- zugreifen. Neue Dateien liegen unter <user>/food-log/<datei>.
-- Alte, zweistufige Pfade bleiben ausschließlich lesbar, wenn sie tatsächlich
-- von einem Food-Log-Eintrag referenziert werden.

drop policy if exists dex_entry_images_shared_food_select on storage.objects;
create policy dex_entry_images_shared_food_select on storage.objects
for select to authenticated using (
  bucket_id = 'dex-entries'
  and public.can_access_shared_space(((storage.foldername(name))[1])::uuid, 'food-log')
  and (
    (storage.foldername(name))[2] = 'food-log'
    or exists (
      select 1 from public.dex_entries e
      where e.user_id = ((storage.foldername(name))[1])::uuid
        and e.root_key = 'food-log'
        and (e.image_path = name or e.audio_path = name)
    )
  )
);

drop policy if exists dex_entry_images_shared_food_insert on storage.objects;
create policy dex_entry_images_shared_food_insert on storage.objects
for insert to authenticated with check (
  bucket_id = 'dex-entries'
  and (storage.foldername(name))[2] = 'food-log'
  and public.can_access_shared_space(((storage.foldername(name))[1])::uuid, 'food-log')
);

drop policy if exists dex_entry_images_shared_food_delete on storage.objects;
create policy dex_entry_images_shared_food_delete on storage.objects
for delete to authenticated using (
  bucket_id = 'dex-entries'
  and (storage.foldername(name))[2] = 'food-log'
  and public.can_access_shared_space(((storage.foldername(name))[1])::uuid, 'food-log')
);
