create table if not exists public.user_preferences (
  user_id    uuid not null references auth.users(id) on delete cascade,
  key        text not null check (char_length(key) between 1 and 120),
  value      jsonb not null default 'null'::jsonb,
  updated_at timestamptz not null default now(),
  primary key (user_id, key)
);

alter table public.user_preferences enable row level security;

drop policy if exists user_preferences_all_own on public.user_preferences;
create policy user_preferences_all_own on public.user_preferences
  for all to authenticated
  using (user_id = auth.uid())
  with check (user_id = auth.uid());

create index if not exists user_preferences_user_updated_idx
  on public.user_preferences(user_id, updated_at desc);
