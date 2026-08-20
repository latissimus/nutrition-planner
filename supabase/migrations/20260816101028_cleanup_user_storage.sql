create or replace function public.cleanup_user_storage()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  delete from storage.objects where owner = old.id;
  return old;
end;
$$;

drop trigger if exists on_auth_user_deleted_cleanup_storage on auth.users;
create trigger on_auth_user_deleted_cleanup_storage
  before delete on auth.users
  for each row execute function public.cleanup_user_storage();;
