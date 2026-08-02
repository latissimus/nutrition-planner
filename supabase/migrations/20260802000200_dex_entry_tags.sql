alter table public.dex_entries
  add column if not exists tags text[] not null default '{}';

create index if not exists dex_entries_tags_idx
  on public.dex_entries using gin(tags);
