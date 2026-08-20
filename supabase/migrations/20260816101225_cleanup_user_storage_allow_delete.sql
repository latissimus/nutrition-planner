create or replace function public.cleanup_user_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  perform set_config('storage.allow_delete_query', 'true', true);
  delete from storage.objects where owner = old.id;
  return old;
end;
$$;;
