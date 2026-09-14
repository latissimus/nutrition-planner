-- Das Gewicht ist ein Eingangswert derselben YPSI-Messzeile wie Größe und
-- Faltensumme. Es wird deshalb fest mit der Hautfaltenmessung gespeichert,
-- damit historische Ergebnisse reproduzierbar bleiben.

alter table public.skinfolds
  add column if not exists gewicht_kg numeric(5,2)
    check (gewicht_kg > 0 and gewicht_kg < 500);

-- Bestehende Messungen nur dann ergänzen, wenn eine Wiegung am exakt gleichen
-- Datum vorhanden ist. Eine Wiegung aus einem ±7-Tage-Fenster wäre nicht der
-- Eingangswert der ursprünglichen Messung.
update public.skinfolds as skinfold
set gewicht_kg = weight.kg
from public.weights as weight
where skinfold.gewicht_kg is null
  and weight.user_id = skinfold.user_id
  and weight.gemessen_am = skinfold.gemessen_am;

comment on column public.skinfolds.gewicht_kg is
  'Körpergewicht in kg zum Hautfalten-Messzeitpunkt; fester Eingangswert der YPSI-Körperfettformel.';
