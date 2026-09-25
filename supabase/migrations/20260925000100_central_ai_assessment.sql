-- Eine kanonische, gecachte COMP-Auswertung pro unverändertem Datensatz und
-- eine serverseitig verwaltete OpenAI-Wissensbasis für die Seminarquellen.

alter table public.ai_coach_analyses
  add column if not exists input_fingerprint text,
  add column if not exists source_manifest jsonb not null default '[]'::jsonb,
  add column if not exists knowledge_hash text;

create unique index if not exists ai_coach_analyses_user_scope_fingerprint_idx
  on public.ai_coach_analyses(user_id, scope, input_fingerprint);

create table if not exists public.ai_knowledge_bases (
  key text primary key,
  vector_store_id text,
  content_hash text not null,
  status text not null default 'pending'
    check (status in ('pending', 'ready', 'failed')),
  source_manifest jsonb not null default '[]'::jsonb,
  last_error text,
  updated_at timestamptz not null default now()
);

alter table public.ai_knowledge_bases enable row level security;

-- Absichtlich keine Client-Policy: Nur die Edge Function mit Service Role
-- darf die globale Wissensbasis lesen oder verändern.
