-- The current nutrition goal/target may not be projected backwards onto days
-- before the last change. Existing accounts start a new, known phase now;
-- older target history cannot be reconstructed reliably.
alter table public.nutrition_settings
  add column if not exists target_changed_at timestamptz not null default now();

create or replace function public.mark_nutrition_target_phase()
returns trigger language plpgsql set search_path = '' as $$
begin
  if row(new.goal, new.custom_calorie_target, new.adaptive_target,
         new.calculation_basis, new.birth_date, new.height_cm, new.pal)
     is distinct from
     row(old.goal, old.custom_calorie_target, old.adaptive_target,
         old.calculation_basis, old.birth_date, old.height_cm, old.pal) then
    new.target_changed_at := now();
  else
    new.target_changed_at := old.target_changed_at;
  end if;
  return new;
end;
$$;

drop trigger if exists nutrition_settings_mark_target_phase on public.nutrition_settings;
create trigger nutrition_settings_mark_target_phase
  before update on public.nutrition_settings
  for each row execute function public.mark_nutrition_target_phase();
