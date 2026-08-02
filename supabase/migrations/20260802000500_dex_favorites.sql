alter table public.dex_entries
  add column if not exists favorite boolean not null default false;

create index if not exists dex_entries_favorites_idx
  on public.dex_entries(user_id, favorite, created_at desc);
