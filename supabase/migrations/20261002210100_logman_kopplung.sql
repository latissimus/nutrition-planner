-- LOGMAN-Kopplung: CAPBOY liest das Trainingslog des eigenen LOGMAN-Kontos
-- selbst, statt dass man einen JSON-Export einspielt.
--
-- Gegenstück in LOGMAN: Migration 20261002210000_capboy_kopplung (Projekt
-- blast-trainer). Dort erzeugt man im Profil einen Code; die Edge Function
-- logman-abgleich tauscht ihn gegen einen Lese-Token, der nur dieses eine Log
-- lesen kann.
--
-- logman_kopplung hält den Token. Keine RLS-Regeln: Nur die Edge Function
-- (Service-Rolle) liest ihn; im Browser hat er nichts zu suchen.
-- logman_spiegel hält den zuletzt gelesenen Stand. Ändert sich LOGMANs
-- version nicht, schreibt der Abgleich nichts. Der Nutzer darf seinen Spiegel
-- lesen, schreiben tut nur die Edge Function.

begin;

create table if not exists public.logman_kopplung (
  user_id                uuid primary key references auth.users(id) on delete cascade,
  token                  text not null,
  verbunden_am           timestamptz not null default now(),
  zuletzt_abgeglichen_am timestamptz
);
alter table public.logman_kopplung enable row level security;
revoke all on table public.logman_kopplung from anon, authenticated;

create table if not exists public.logman_spiegel (
  user_id        uuid primary key references auth.users(id) on delete cascade,
  payload        jsonb not null,
  logman_version bigint not null,
  logman_stand   timestamptz,
  abgerufen_am   timestamptz not null default now()
);
alter table public.logman_spiegel enable row level security;
revoke insert, update, delete on table public.logman_spiegel from anon, authenticated;
drop policy if exists logman_spiegel_select_own on public.logman_spiegel;
create policy logman_spiegel_select_own on public.logman_spiegel
  for select to authenticated
  using (user_id = auth.uid());

commit;
