-- CAPBOY Coach: gespeicherte, nachvollziehbare KI-Analysen und Chatverlauf.

create table if not exists public.ai_coach_analyses (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('sleep', 'comp', 'skinfold', 'overall')),
  result jsonb not null,
  model text not null default 'gpt-6-sol',
  data_from date,
  data_to date,
  created_at timestamptz not null default now()
);

create index if not exists ai_coach_analyses_user_scope_idx
  on public.ai_coach_analyses(user_id, scope, created_at desc);

create table if not exists public.ai_coach_messages (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  role text not null check (role in ('user', 'assistant')),
  content text not null check (char_length(content) between 1 and 12000),
  context jsonb not null default '{}'::jsonb,
  created_at timestamptz not null default now()
);

create index if not exists ai_coach_messages_user_created_idx
  on public.ai_coach_messages(user_id, created_at desc);

alter table public.ai_coach_analyses enable row level security;
alter table public.ai_coach_messages enable row level security;

drop policy if exists ai_coach_analyses_own on public.ai_coach_analyses;
create policy ai_coach_analyses_own on public.ai_coach_analyses
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists ai_coach_messages_own on public.ai_coach_messages;
create policy ai_coach_messages_own on public.ai_coach_messages
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

