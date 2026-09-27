-- CAPBOY Coach, Schritt 7: wöchentlicher Check-in mit Bilanz.
--
-- Eine Zeile je Nutzer und abgeschlossener ISO-Woche: was der Nutzer im
-- Check-in angegeben hat (Umstände, kurze Notiz), der Wochenvergleich, den
-- die App berechnet hat, und die Bilanz des Coachs. Die Edge Function
-- schreibt die Zeile nach der Antwort (wie die Gesprächsrunden); der Nutzer
-- kann sie lesen und löschen. Ein erneuter Check-in derselben Woche ersetzt
-- sie. checkin enthält außerdem den damaligen Adhärenz-Snapshot der aktiven
-- Maßnahmen; coach_interventions hält zusätzlich deren aktuellen Stand.

create table if not exists public.coach_weekly_reviews (
  id uuid primary key default gen_random_uuid(),
  user_id uuid not null references auth.users(id) on delete cascade,
  week text not null check (week ~ '^[0-9]{4}-W[0-9]{2}$'),
  checkin jsonb not null default '{}'::jsonb,
  comparison jsonb not null default '[]'::jsonb,
  result jsonb not null,
  conversation_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (user_id, week)
);

drop trigger if exists coach_weekly_reviews_touch_updated_at on public.coach_weekly_reviews;
create trigger coach_weekly_reviews_touch_updated_at
  before update on public.coach_weekly_reviews
  for each row execute function public.touch_updated_at();

alter table public.coach_weekly_reviews enable row level security;

drop policy if exists coach_weekly_reviews_select_own on public.coach_weekly_reviews;
create policy coach_weekly_reviews_select_own on public.coach_weekly_reviews
  for select to authenticated using (user_id = auth.uid());

drop policy if exists coach_weekly_reviews_delete_own on public.coach_weekly_reviews;
create policy coach_weekly_reviews_delete_own on public.coach_weekly_reviews
  for delete to authenticated using (user_id = auth.uid());
