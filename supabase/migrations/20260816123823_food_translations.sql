create table if not exists public.food_translations (
  quelle text not null,
  richtung text not null,
  ziel text not null,
  created_at timestamptz not null default now(),
  primary key (quelle, richtung)
);
alter table public.food_translations enable row level security;;
