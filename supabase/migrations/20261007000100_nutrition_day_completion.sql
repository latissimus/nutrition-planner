-- A completed day becomes open again whenever its food entries change.
-- This also covers edits outside the CAPBOY client, so the coach cannot rely
-- on a stale "complete" flag after an import or direct database change.
create or replace function public.reopen_nutrition_day_after_entry_change()
returns trigger
language plpgsql
as $$
begin
  if tg_op in ('UPDATE', 'DELETE') then
    update public.nutrition_day_status
      set complete = false
      where user_id = old.user_id and log_date = old.log_date and complete = true;
  end if;
  if tg_op in ('INSERT', 'UPDATE') then
    update public.nutrition_day_status
      set complete = false
      where user_id = new.user_id and log_date = new.log_date and complete = true;
  end if;
  return null;
end;
$$;

drop trigger if exists nutrition_log_reopen_day on public.nutrition_log_entries;
create trigger nutrition_log_reopen_day
after insert or update or delete on public.nutrition_log_entries
for each row execute function public.reopen_nutrition_day_after_entry_change();
