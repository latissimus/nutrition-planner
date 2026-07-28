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

`20260728000200_body_and_reminders.sql` legt Körperwerte und das allgemeine
Erinnerungssystem an.

`20260728000300_food_log.sql` legt das private Food-Log sowie den privaten
Storage-Bucket `food-log` mit nutzerbezogenen Policies an.
