-- Übersetzungs-Cache für die Lebensmittelsuche. USDA FoodData Central liefert
-- englische Namen; die food-products-Edge-Function übersetzt sie ins Deutsche
-- (via MyMemory) und legt das Ergebnis hier ab, um wiederholte API-Aufrufe und
-- Latenz zu vermeiden. Zugriff nur durch die Edge-Function (service_role).
create table if not exists public.food_translations (
  quelle text not null,
  richtung text not null,
  ziel text not null,
  created_at timestamptz not null default now(),
  primary key (quelle, richtung)
);

alter table public.food_translations enable row level security;
-- Bewusst ohne Policies: anon/authenticated haben keinen Zugriff; die
-- Edge-Function nutzt den service_role-Key und umgeht RLS.
