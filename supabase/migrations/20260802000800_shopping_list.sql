-- Einkaufsliste: eigene Kategorie mit an-/abwaehlbaren Artikeln, gruppiert
-- nach Abteilung. Die Startbefuellung passiert clientseitig ueber einen
-- Upsert (siehe DEFAULT_ITEMS in src/shoppingList.js), analog zu den
-- DEFAULT_REMINDERS in reminders.js. Der Unique-Key (user_id, section, name)
-- macht diesen Upsert wiederholbar, ohne Artikel zu verdoppeln.

create table if not exists public.shopping_items (
  id          uuid primary key default gen_random_uuid(),
  user_id     uuid not null references auth.users(id) on delete cascade,
  section     text not null default 'Sonstiges'
                check (char_length(trim(section)) between 1 and 60),
  name        text not null check (char_length(trim(name)) between 1 and 120),
  note        text check (note is null or char_length(note) <= 200),
  tags        text[] not null default '{}',
  checked     boolean not null default false,
  position    bigint generated always as identity,
  created_at  timestamptz not null default now(),
  unique (user_id, section, name)
);

create index if not exists shopping_items_user_position_idx
  on public.shopping_items(user_id, position);

alter table public.shopping_items enable row level security;

drop policy if exists shopping_items_all_own on public.shopping_items;
create policy shopping_items_all_own on public.shopping_items
  for all using (user_id = auth.uid()) with check (user_id = auth.uid());
