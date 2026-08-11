alter table public.dex_entries
  add column if not exists training_class text;

comment on column public.dex_entries.training_class is
  'Einwertige Klasse für Trainingseinträge; feste Schlüssel oder ein frei vergebener Name.';

create index if not exists dex_entries_training_class_idx
  on public.dex_entries (user_id, root_key, training_class)
  where root_key = 'training';
