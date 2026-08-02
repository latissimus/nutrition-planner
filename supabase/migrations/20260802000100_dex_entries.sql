create table if not exists public.dex_entries (
  id             uuid primary key default gen_random_uuid(),
  user_id        uuid not null references auth.users(id) on delete cascade,
  collection_id  uuid references public.collections(id) on delete cascade,
  root_key       text not null,
  entry_type     text not null check (entry_type in ('link', 'image')),
  title          text not null default '',
  note           text not null default '',
  url            text,
  image_path     text,
  created_at     timestamptz not null default now(),
  updated_at     timestamptz not null default now(),
  check (
    (entry_type = 'link' and url is not null and image_path is null)
    or (entry_type = 'image' and image_path is not null)
  )
);

create index if not exists dex_entries_scope_idx
  on public.dex_entries(user_id, root_key, collection_id, entry_type, created_at desc);

alter table public.dex_entries enable row level security;

drop policy if exists dex_entries_all_own on public.dex_entries;
create policy dex_entries_all_own on public.dex_entries
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (collection_id is null or public.owns_collection(collection_id))
  );

drop trigger if exists dex_entries_touch_updated_at on public.dex_entries;
create trigger dex_entries_touch_updated_at
  before update on public.dex_entries
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'dex-entries', 'dex-entries', false, 8388608,
  array['image/jpeg','image/png','image/webp','image/gif','image/heic','image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists dex_entry_images_select_own on storage.objects;
create policy dex_entry_images_select_own on storage.objects
  for select using (
    bucket_id = 'dex-entries'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists dex_entry_images_insert_own on storage.objects;
create policy dex_entry_images_insert_own on storage.objects
  for insert with check (
    bucket_id = 'dex-entries'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists dex_entry_images_update_own on storage.objects;
create policy dex_entry_images_update_own on storage.objects
  for update using (
    bucket_id = 'dex-entries'
    and auth.uid()::text = (storage.foldername(name))[1]
  );

drop policy if exists dex_entry_images_delete_own on storage.objects;
create policy dex_entry_images_delete_own on storage.objects
  for delete using (
    bucket_id = 'dex-entries'
    and auth.uid()::text = (storage.foldername(name))[1]
  );
