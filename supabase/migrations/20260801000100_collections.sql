-- Eigene Sammlungen und verschachtelte Unter-Sammlungen.

create table if not exists public.collections (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  parent_id   uuid references public.collections(id) on delete cascade,
  root_key    text not null check (root_key in ('home', 'food-log', 'recipes')),
  name        text not null check (char_length(trim(name)) between 1 and 40),
  color       text not null check (color ~ '^#[0-9A-Fa-f]{6}$'),
  icon_key    text not null default 'create_new_folder' check (char_length(icon_key) between 1 and 100),
  position    integer not null default 0,
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now(),
  constraint collections_not_own_parent check (parent_id is null or parent_id <> id)
);

create index if not exists collections_user_parent_position_idx
  on public.collections(user_id, parent_id, root_key, position, created_at);

alter table public.collections enable row level security;

create or replace function public.owns_collection(collection_id uuid)
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.collections
    where id = collection_id and user_id = auth.uid()
  );
$$;

revoke all on function public.owns_collection(uuid) from public, anon;
grant execute on function public.owns_collection(uuid) to authenticated;

drop policy if exists collections_all_own on public.collections;
create policy collections_all_own on public.collections
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      parent_id is null
      or public.owns_collection(parent_id)
    )
  );

drop trigger if exists collections_touch_updated_at on public.collections;
create trigger collections_touch_updated_at
  before update on public.collections
  for each row execute function public.touch_updated_at();

-- Food-Log-Eintraege koennen spaeter einer Unter-Sammlung zugeordnet werden.
alter table public.food_logs
  add column if not exists collection_id uuid references public.collections(id) on delete set null;

create index if not exists food_logs_collection_idx
  on public.food_logs(user_id, collection_id, eaten_at desc);
