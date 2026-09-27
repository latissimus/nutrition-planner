-- CAPBOY Coach, Schritt 5: Gedächtnis.
--
-- Drei Arten von Gedächtnis, alle im Besitz des Nutzers (RLS) und auf der
-- Seite "Was CAPBOY über mich weiß" einsehbar, bearbeitbar und löschbar:
--   Gespräch     ai_coach_messages (bisher ungenutzt) bekommt eine
--                Gesprächs-ID. Der Coach sieht nur das laufende Gespräch.
--   Über mich    coach_profile_memory: feste Fakten, die der Nutzer selbst
--                einträgt (Verletzungen, Ausstattung, Zeitplan ...).
--   Maßnahmen    coach_interventions: was ausprobiert wird, seit wann, bis
--                wann es geprüft wird und mit welchem Ergebnis.
-- Die KI schreibt weder Profilfakten noch Maßnahmen selbst. Maßnahmen
-- entstehen durch den Nutzer, auf Wunsch aus einer Coach-Empfehlung.

alter table public.ai_coach_messages
  add column if not exists conversation_id uuid;

create index if not exists ai_coach_messages_conversation_idx
  on public.ai_coach_messages(user_id, conversation_id, created_at);

create table if not exists public.coach_profile_memory (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  category text not null check (category in (
    'ziel', 'verletzung', 'einschraenkung', 'ausstattung', 'zeitplan', 'vorliebe', 'belastung', 'medizinisch'
  )),
  fact text not null check (char_length(btrim(fact)) between 2 and 500),
  source text not null default 'nutzer' check (source in ('nutzer')),
  confirmed_on date not null default current_date,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_profile_memory_user_idx
  on public.coach_profile_memory(user_id, confirmed_on desc);

create table if not exists public.coach_interventions (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  action text not null check (char_length(btrim(action)) between 2 and 500),
  hypothesis text check (hypothesis is null or char_length(hypothesis) <= 1000),
  target_metric text check (target_metric is null or char_length(target_metric) <= 300),
  start_date date not null default current_date,
  review_date date check (review_date is null or review_date >= start_date),
  status text not null default 'aktiv' check (status in ('aktiv', 'abgeschlossen', 'abgebrochen')),
  adherence text not null default 'unbekannt' check (adherence in ('unbekannt', 'kaum', 'teilweise', 'ueberwiegend', 'voll')),
  outcome text check (outcome is null or char_length(outcome) <= 1000),
  source text not null default 'nutzer' check (source in ('nutzer', 'coach_empfehlung')),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

create index if not exists coach_interventions_user_idx
  on public.coach_interventions(user_id, status, start_date desc);

drop trigger if exists coach_profile_memory_touch_updated_at on public.coach_profile_memory;
create trigger coach_profile_memory_touch_updated_at
  before update on public.coach_profile_memory
  for each row execute function public.touch_updated_at();

drop trigger if exists coach_interventions_touch_updated_at on public.coach_interventions;
create trigger coach_interventions_touch_updated_at
  before update on public.coach_interventions
  for each row execute function public.touch_updated_at();

alter table public.coach_profile_memory enable row level security;
alter table public.coach_interventions enable row level security;

drop policy if exists coach_profile_memory_own on public.coach_profile_memory;
create policy coach_profile_memory_own on public.coach_profile_memory
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists coach_interventions_own on public.coach_interventions;
create policy coach_interventions_own on public.coach_interventions
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());
