-- Food-Log und Einkauf koennen gezielt mit einem zweiten MUSCLE-DEX-Profil
-- geteilt werden. Freigaben werden vom Eigentuemer per E-Mail verwaltet.

create table if not exists public.shared_spaces (
  id uuid primary key default gen_random_uuid(),
  owner_id uuid not null references auth.users(id) on delete cascade,
  partner_id uuid not null references auth.users(id) on delete cascade,
  scope text not null check (scope in ('food-log', 'shopping')),
  created_at timestamptz not null default now(),
  unique (owner_id, partner_id, scope),
  check (owner_id <> partner_id)
);

alter table public.shared_spaces enable row level security;

drop policy if exists shared_spaces_visible on public.shared_spaces;
create policy shared_spaces_visible on public.shared_spaces for select to authenticated
  using (owner_id = auth.uid() or partner_id = auth.uid());

drop policy if exists shared_spaces_owner_delete on public.shared_spaces;
create policy shared_spaces_owner_delete on public.shared_spaces for delete to authenticated
  using (owner_id = auth.uid());

create or replace function public.can_access_shared_space(space_owner uuid, space_scope text)
returns boolean language sql stable security definer set search_path = public, pg_temp as $$
  select space_owner = auth.uid() or exists (
    select 1 from public.shared_spaces
    where owner_id = space_owner and partner_id = auth.uid() and scope = space_scope
  );
$$;

revoke all on function public.can_access_shared_space(uuid,text) from public, anon;
grant execute on function public.can_access_shared_space(uuid,text) to authenticated;

create or replace function public.share_space_with_email(space_scope text, partner_email text)
returns uuid language plpgsql security definer set search_path = public, auth, pg_temp as $$
declare partner uuid;
begin
  if space_scope not in ('food-log','shopping') then raise exception 'Unbekannter Bereich'; end if;
  select id into partner from auth.users where lower(email) = lower(trim(partner_email));
  if partner is null then raise exception 'Zu dieser E-Mail gibt es noch kein MUSCLE-DEX-Konto'; end if;
  if partner = auth.uid() then raise exception 'Du kannst den Bereich nicht mit dir selbst teilen'; end if;
  insert into public.shared_spaces(owner_id,partner_id,scope)
  values(auth.uid(),partner,space_scope) on conflict(owner_id,partner_id,scope) do nothing;
  return partner;
end;
$$;

revoke all on function public.share_space_with_email(text,text) from public, anon;
grant execute on function public.share_space_with_email(text,text) to authenticated;

create or replace function public.list_owned_space_shares(space_scope text)
returns table(id uuid, partner_id uuid, partner_email text, created_at timestamptz)
language sql stable security definer set search_path = public, auth, pg_temp as $$
  select s.id,s.partner_id,u.email::text,s.created_at
  from public.shared_spaces s join auth.users u on u.id=s.partner_id
  where s.owner_id=auth.uid() and s.scope=space_scope order by s.created_at;
$$;

revoke all on function public.list_owned_space_shares(text) from public, anon;
grant execute on function public.list_owned_space_shares(text) to authenticated;

drop policy if exists dex_entries_shared_food_select on public.dex_entries;
create policy dex_entries_shared_food_select on public.dex_entries for select to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists dex_entries_shared_food_insert on public.dex_entries;
create policy dex_entries_shared_food_insert on public.dex_entries for insert to authenticated
  with check (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists dex_entries_shared_food_update on public.dex_entries;
create policy dex_entries_shared_food_update on public.dex_entries for update to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'))
  with check (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists dex_entries_shared_food_delete on public.dex_entries;
create policy dex_entries_shared_food_delete on public.dex_entries for delete to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));

drop policy if exists collections_shared_food_select on public.collections;
create policy collections_shared_food_select on public.collections for select to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists collections_shared_food_insert on public.collections;
create policy collections_shared_food_insert on public.collections for insert to authenticated
  with check (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists collections_shared_food_update on public.collections;
create policy collections_shared_food_update on public.collections for update to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'))
  with check (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));
drop policy if exists collections_shared_food_delete on public.collections;
create policy collections_shared_food_delete on public.collections for delete to authenticated
  using (root_key='food-log' and public.can_access_shared_space(user_id,'food-log'));

drop policy if exists shopping_items_shared_select on public.shopping_items;
create policy shopping_items_shared_select on public.shopping_items for select to authenticated
  using (public.can_access_shared_space(user_id,'shopping'));
drop policy if exists shopping_items_shared_insert on public.shopping_items;
create policy shopping_items_shared_insert on public.shopping_items for insert to authenticated
  with check (public.can_access_shared_space(user_id,'shopping'));
drop policy if exists shopping_items_shared_update on public.shopping_items;
create policy shopping_items_shared_update on public.shopping_items for update to authenticated
  using (public.can_access_shared_space(user_id,'shopping'))
  with check (public.can_access_shared_space(user_id,'shopping'));
drop policy if exists shopping_items_shared_delete on public.shopping_items;
create policy shopping_items_shared_delete on public.shopping_items for delete to authenticated
  using (public.can_access_shared_space(user_id,'shopping'));

-- Bestehende Medienpfade beginnen mit der User-ID des Eigentuemers. Partner
-- duerfen diese Dateien fuer ein geteiltes Food-Log lesen und verwalten.
drop policy if exists dex_entry_images_shared_food_select on storage.objects;
create policy dex_entry_images_shared_food_select on storage.objects for select to authenticated using (
  bucket_id='dex-entries' and public.can_access_shared_space(((storage.foldername(name))[1])::uuid,'food-log')
);
drop policy if exists dex_entry_images_shared_food_insert on storage.objects;
create policy dex_entry_images_shared_food_insert on storage.objects for insert to authenticated with check (
  bucket_id='dex-entries' and public.can_access_shared_space(((storage.foldername(name))[1])::uuid,'food-log')
);
drop policy if exists dex_entry_images_shared_food_delete on storage.objects;
create policy dex_entry_images_shared_food_delete on storage.objects for delete to authenticated using (
  bucket_id='dex-entries' and public.can_access_shared_space(((storage.foldername(name))[1])::uuid,'food-log')
);
