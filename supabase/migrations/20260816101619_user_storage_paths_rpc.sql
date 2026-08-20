create or replace function public.user_storage_paths(ziel uuid)
returns table(bucket_id text, name text)
language sql
security definer
set search_path = ''
as $$
  select o.bucket_id, o.name from storage.objects o where o.owner = ziel;
$$;

revoke all on function public.user_storage_paths(uuid) from public;
grant execute on function public.user_storage_paths(uuid) to service_role;;
