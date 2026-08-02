alter table public.dex_entries
  add column if not exists preview_url text,
  add column if not exists provider text;
