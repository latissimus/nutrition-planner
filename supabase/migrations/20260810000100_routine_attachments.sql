-- Bild- und Link-Einträge können einer konkreten Routine zugeordnet werden.

alter table public.dex_entries
  add column if not exists routine_id uuid references public.routines(id) on delete cascade;

-- Icon-Dateinamen dürfen länger als ein Emoji sein.
alter table public.routines drop constraint if exists routines_icon_check;
alter table public.routines
  add constraint routines_icon_check check (char_length(icon) between 1 and 80);

create index if not exists dex_entries_routine_created_idx
  on public.dex_entries(routine_id, created_at desc)
  where routine_id is not null;

drop policy if exists dex_entries_all_own on public.dex_entries;
create policy dex_entries_all_own on public.dex_entries
  for all using (auth.uid() = user_id)
  with check (
    auth.uid() = user_id
    and (collection_id is null or public.owns_collection(collection_id))
    and (
      routine_id is null
      or exists (
        select 1 from public.routines r
        where r.id = public.dex_entries.routine_id and r.user_id = auth.uid()
      )
    )
  );
