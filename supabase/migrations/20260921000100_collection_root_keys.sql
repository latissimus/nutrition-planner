-- Alle festen Wissensseiten dürfen eigene Unterordner besitzen. Einige
-- produktive Stände haben noch die ursprüngliche Inline-Constraint aus der
-- ersten collections-Migration. Der Name wird deshalb aus pg_constraint
-- ermittelt, statt nur eine einzelne erwartete Constraint zu entfernen.
do $$
declare
  constraint_name text;
begin
  for constraint_name in
    select con.conname
    from pg_constraint con
    join pg_class rel on rel.oid = con.conrelid
    join pg_namespace nsp on nsp.oid = rel.relnamespace
    where nsp.nspname = 'public'
      and rel.relname = 'collections'
      and con.contype = 'c'
      and pg_get_constraintdef(con.oid) ilike '%root_key%'
  loop
    execute format('alter table public.collections drop constraint %I', constraint_name);
  end loop;
end $$;

alter table public.collections
  add constraint collections_root_key_check
  check (root_key in ('home', 'food-log', 'essen', 'training', 'stress', 'supps'));
