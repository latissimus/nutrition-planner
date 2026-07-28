# Supabase

Für diese App ein neues Supabase-Projekt verwenden. Migrationen werden in
Dateinamensreihenfolge angewendet und nach dem Ausrollen nicht mehr verändert.

## Erster Stand

`20260728000100_foundation.sql` legt an:

- `profiles`
- automatisches Profil beim Signup
- Row-Level Security
- Schutz vor eigener Rollenerhöhung
- serverseitige Löschung des eigenen Accounts

Körperwerte und das allgemeine Erinnerungssystem folgen in getrennten
Migrationen.
