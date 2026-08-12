# Supabase

## Sammlungen und Unter-Sammlungen

Nach den bisherigen Migrationen zusätzlich
`migrations/20260801000100_collections.sql` im SQL Editor ausführen. Die
Migration legt private, verschachtelbare Sammlungen an und ergänzt das
Food-Log um eine optionale Sammlungszuordnung.
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

`20260728000400_web_push.sql` legt private Geräte-Abos und eine idempotente
Versandhistorie an. Die Edge Function `send-reminders` versendet Test- und
fällige Erinnerungen.

## Backup und Wiederherstellung

`npm run backup:supabase` erzeugt ohne Docker eine Sicherung der
Anwendungsdaten als JSON plus sämtliche Storage-Dateien. Das ist für
regelmäßige persönliche Sicherungen gedacht. Vor einer Wiederherstellung in
ein neues Projekt werden zuerst alle Migrationen angewendet, anschließend die
JSON-Daten in Abhängigkeitsreihenfolge importiert und zuletzt die Storage-
Dateien hochgeladen. Auth-Nutzer müssen über die Admin-API wiederhergestellt
werden; Passwörter sind nicht exportierbar, daher ist danach ein Passwortreset
der Nutzer erforderlich.

Nach jeder Sicherung validiert
`npm run backup:verify -- backups/muscledex-<Zeitstempel>` alle gespeicherten
Dateien gegen ihre SHA-256-Prüfsummen. Erst eine erfolgreich geprüfte und
extern kopierte Sicherung gilt als belastbares Backup.
