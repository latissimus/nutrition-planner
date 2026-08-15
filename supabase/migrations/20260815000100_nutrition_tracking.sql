-- Einfaches, tagesbasiertes Kalorien- und Makroprotokoll im MAHLZEITEN-DEX.

create table if not exists public.nutrition_settings (
  user_id               uuid primary key references auth.users(id) on delete cascade,
  calculation_basis     text not null default 'male' check (calculation_basis in ('male', 'female')),
  birth_date            date,
  height_cm             numeric(5,1) check (height_cm between 100 and 250),
  body_fat_percent      numeric(4,1) check (body_fat_percent between 2 and 65),
  pal                    numeric(3,2) not null default 1.6 check (pal between 1.2 and 2.4),
  goal                   text not null default 'maintain' check (goal in ('lose', 'maintain', 'gain', 'gain_fast')),
  custom_calorie_target integer check (custom_calorie_target between 800 and 10000),
  updated_at             timestamptz not null default now()
);

create table if not exists public.nutrition_products (
  id              uuid primary key default gen_random_uuid(),
  user_id         uuid not null references auth.users(id) on delete cascade,
  barcode         text,
  name            text not null check (char_length(trim(name)) between 1 and 160),
  brand           text,
  image_url       text,
  serving_g       numeric(7,2) check (serving_g > 0 and serving_g <= 10000),
  kcal_100g       numeric(8,2) not null check (kcal_100g >= 0 and kcal_100g <= 2000),
  protein_100g    numeric(7,2) not null default 0 check (protein_100g >= 0 and protein_100g <= 1000),
  carbs_100g      numeric(7,2) not null default 0 check (carbs_100g >= 0 and carbs_100g <= 1000),
  fat_100g        numeric(7,2) not null default 0 check (fat_100g >= 0 and fat_100g <= 1000),
  source          text not null default 'manual' check (source in ('manual', 'open_food_facts')),
  source_snapshot jsonb not null default '{}'::jsonb,
  created_at      timestamptz not null default now(),
  updated_at      timestamptz not null default now(),
  unique (user_id, barcode)
);

create index if not exists nutrition_products_user_name_idx
  on public.nutrition_products(user_id, lower(name));

create table if not exists public.nutrition_log_entries (
  id               uuid primary key default gen_random_uuid(),
  user_id          uuid not null references auth.users(id) on delete cascade,
  log_date         date not null default current_date,
  period           text not null default 'morning' check (period in ('morning', 'midday', 'evening')),
  product_id       uuid references public.nutrition_products(id) on delete set null,
  name             text not null check (char_length(trim(name)) between 1 and 160),
  amount           numeric(8,2) not null default 1 check (amount > 0 and amount <= 100000),
  unit             text not null default 'g' check (unit in ('g', 'portion')),
  energy_kcal      numeric(9,2) not null check (energy_kcal >= 0 and energy_kcal <= 50000),
  protein_g        numeric(8,2) not null default 0 check (protein_g >= 0 and protein_g <= 10000),
  carbs_g          numeric(8,2) not null default 0 check (carbs_g >= 0 and carbs_g <= 10000),
  fat_g            numeric(8,2) not null default 0 check (fat_g >= 0 and fat_g <= 10000),
  product_snapshot jsonb not null default '{}'::jsonb,
  created_at       timestamptz not null default now()
);

create index if not exists nutrition_log_user_date_idx
  on public.nutrition_log_entries(user_id, log_date, created_at);
create index if not exists nutrition_log_user_recent_idx
  on public.nutrition_log_entries(user_id, created_at desc);

alter table public.nutrition_settings enable row level security;
alter table public.nutrition_products enable row level security;
alter table public.nutrition_log_entries enable row level security;

drop policy if exists nutrition_settings_all_own on public.nutrition_settings;
create policy nutrition_settings_all_own on public.nutrition_settings
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists nutrition_products_all_own on public.nutrition_products;
create policy nutrition_products_all_own on public.nutrition_products
  for all to authenticated using (user_id = auth.uid()) with check (user_id = auth.uid());

drop policy if exists nutrition_log_all_own on public.nutrition_log_entries;
create policy nutrition_log_all_own on public.nutrition_log_entries
  for all to authenticated
  using (user_id = auth.uid())
  with check (
    user_id = auth.uid()
    and (
      product_id is null
      or exists (
        select 1 from public.nutrition_products product
        where product.id = product_id and product.user_id = auth.uid()
      )
    )
  );

drop trigger if exists nutrition_settings_touch_updated_at on public.nutrition_settings;
create trigger nutrition_settings_touch_updated_at before update on public.nutrition_settings
  for each row execute function public.touch_updated_at();
drop trigger if exists nutrition_products_touch_updated_at on public.nutrition_products;
create trigger nutrition_products_touch_updated_at before update on public.nutrition_products
  for each row execute function public.touch_updated_at();

do $$
begin
  alter publication supabase_realtime add table public.nutrition_settings;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.nutrition_products;
exception when duplicate_object then null;
end $$;
do $$
begin
  alter publication supabase_realtime add table public.nutrition_log_entries;
exception when duplicate_object then null;
end $$;
