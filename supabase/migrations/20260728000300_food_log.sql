-- Privates Food-Log mit optionalen Mahlzeitenbildern.

create table if not exists public.food_logs (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  title       text not null check (char_length(trim(title)) between 1 and 100),
  note        text not null default '' check (char_length(note) <= 1000),
  eaten_at    date not null default current_date,
  image_path  text,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

create index if not exists food_logs_user_eaten_at_idx
  on public.food_logs(user_id, eaten_at desc, created_at desc);

alter table public.food_logs enable row level security;

drop policy if exists food_logs_all_own on public.food_logs;
create policy food_logs_all_own on public.food_logs
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

drop trigger if exists food_logs_touch_updated_at on public.food_logs;
create trigger food_logs_touch_updated_at
  before update on public.food_logs
  for each row execute function public.touch_updated_at();

insert into storage.buckets (id, name, public, file_size_limit, allowed_mime_types)
values (
  'food-log',
  'food-log',
  false,
  8388608,
  array['image/jpeg', 'image/png', 'image/webp', 'image/heic', 'image/heif']
)
on conflict (id) do update set
  public = excluded.public,
  file_size_limit = excluded.file_size_limit,
  allowed_mime_types = excluded.allowed_mime_types;

drop policy if exists food_log_images_select_own on storage.objects;
create policy food_log_images_select_own on storage.objects
  for select to authenticated
  using (
    bucket_id = 'food-log'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists food_log_images_insert_own on storage.objects;
create policy food_log_images_insert_own on storage.objects
  for insert to authenticated
  with check (
    bucket_id = 'food-log'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists food_log_images_update_own on storage.objects;
create policy food_log_images_update_own on storage.objects
  for update to authenticated
  using (
    bucket_id = 'food-log'
    and (storage.foldername(name))[1] = auth.uid()::text
  )
  with check (
    bucket_id = 'food-log'
    and (storage.foldername(name))[1] = auth.uid()::text
  );

drop policy if exists food_log_images_delete_own on storage.objects;
create policy food_log_images_delete_own on storage.objects
  for delete to authenticated
  using (
    bucket_id = 'food-log'
    and (storage.foldername(name))[1] = auth.uid()::text
  );
