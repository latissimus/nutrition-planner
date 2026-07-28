-- Fundament der Ernaehrungs-App: Konto und Profil.
--
-- Die App bekommt ein eigenes Supabase-Projekt. Deshalb bleibt diese Migration
-- unabhaengig von LOGMAN und darf dort nicht angewendet werden.

create table if not exists public.profiles (
  id          uuid primary key references auth.users(id) on delete cascade,
  role        text not null default 'customer' check (role in ('admin', 'customer')),
  full_name   text,
  avatar_url  text,
  zeitzone    text not null default 'Europe/Berlin',
  created_at  timestamptz not null default now(),
  updated_at  timestamptz not null default now()
);

alter table public.profiles enable row level security;

-- Das Profil wird direkt nach der Registrierung angelegt. raw_user_meta_data
-- enthaelt nur den Namen, den die App beim Signup mitsendet.
create or replace function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  insert into public.profiles (id, full_name)
  values (new.id, nullif(new.raw_user_meta_data->>'full_name', ''))
  on conflict (id) do nothing;
  return new;
end;
$$;

drop trigger if exists on_auth_user_created on auth.users;
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Kunden duerfen die Rolle nicht ueber einen normalen Profil-Update zu admin
-- aendern. Die Funktion vermeidet dabei eine rekursive RLS-Abfrage.
create or replace function public.is_admin()
returns boolean
language sql
stable
security definer
set search_path = public, pg_temp
as $$
  select exists (
    select 1 from public.profiles
    where id = auth.uid() and role = 'admin'
  );
$$;

create or replace function public.profiles_update_guard()
returns trigger
language plpgsql
security definer
set search_path = public, pg_temp
as $$
begin
  if new.role is distinct from old.role and not public.is_admin() then
    new.role := old.role;
  end if;
  new.updated_at := now();
  return new;
end;
$$;

drop trigger if exists profiles_update_guard on public.profiles;
create trigger profiles_update_guard
  before update on public.profiles
  for each row execute function public.profiles_update_guard();

drop policy if exists profiles_select_own_or_admin on public.profiles;
create policy profiles_select_own_or_admin on public.profiles
  for select to authenticated
  using (id = auth.uid() or public.is_admin());

drop policy if exists profiles_update_own on public.profiles;
create policy profiles_update_own on public.profiles
  for update to authenticated
  using (id = auth.uid())
  with check (id = auth.uid());

-- Nutzer koennen ihren eigenen Auth-Account loeschen. Alle spaeteren
-- Fachtabellen verweisen mit ON DELETE CASCADE auf auth.users.
create or replace function public.delete_own_account(nur_pruefen boolean default false)
returns boolean
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  eigene_id uuid := auth.uid();
begin
  if eigene_id is null then
    raise exception 'Nicht angemeldet';
  end if;
  if nur_pruefen then
    return true;
  end if;
  delete from auth.users where id = eigene_id;
  return true;
end;
$$;

revoke all on function public.delete_own_account(boolean) from public, anon;
grant execute on function public.delete_own_account(boolean) to authenticated;
