# MUSCLEDEX

Eigenständige PWA für Ernährung, Supplements, Körperwerte, Schlaf und
Gewohnheiten. Der sichtbare Produktname ist vorläufig; die Namensfindung folgt
erst nach den Kernfunktionen.

## Lokal starten

1. `npm install`
2. `.env.local` aus `.env.example` anlegen
3. neues Supabase-Projekt erstellen
4. Migrationen aus `supabase/migrations/` in Reihenfolge im Zielprojekt anwenden
5. `npm run dev`

Ohne Supabase-Werte zeigt die App eine Einrichtungsseite, der Build funktioniert
trotzdem.

## Architektur

- Vite + Vanilla JavaScript
- Supabase Auth, Postgres, privater Storage und Row-Level Security
- eigener Service Worker für Offline-Start und echte Web-Push-Erinnerungen
- Retro-/Dark-Designsystem aus LOGMAN
- Hash-Routing, damit GitHub Pages keinen SPA-Fallback benötigt
- Körperwerte mit Gewicht, 7-Tage-Schnitt und Hautfalten-Summe
- generisches Reminder-Modell fuer Mahlzeiten, Supplements und Trinken
- Food-Log mit privater Bildergalerie, Bearbeiten und Löschen

## Deployment

Der Workflow unter `.github/workflows/deploy.yml` baut bei einem Push auf `main`.
Im GitHub-Repository müssen `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` als Actions-Secrets hinterlegt werden. Für Push kommt
`VITE_VAPID_PUBLIC_KEY` hinzu.

Für Passwort-Reset-Mails muss unter **Supabase → Authentication → URL
Configuration** als Site URL und zusätzliche Redirect URL
`https://latissimus.github.io/nutrition-planner/` eingetragen sein. Der Build
verwendet dieselbe Adresse über `VITE_PUBLIC_APP_URL`; dadurch enthalten auch
lokal ausgelöste Reset-Mails keine vom iPhone unerreichbare Localhost-Adresse.

## Web Push

1. Migration `20260728000400_web_push.sql` anwenden.
2. Ein VAPID-Schlüsselpaar erzeugen.
3. Public Key als `VITE_VAPID_PUBLIC_KEY` lokal und in GitHub hinterlegen.
4. Public/Private Key und Absender als Supabase Function-Secrets speichern.
5. `send-reminders` deployen (JWT-Prüfung eingeschaltet lassen).
6. Supabase Cron jede Minute einen POST auf
   `/functions/v1/send-reminders` senden lassen.

Auf iPhone/iPad muss die HTTPS-App zuerst zum Home-Bildschirm hinzugefügt und
von dort geöffnet werden. Erst dann kann iOS ein Push-Abo anlegen.

## Datensicherung

Git sichert den App-Code und alle Datenbankmigrationen, aber nicht die
Nutzerdaten oder hochgeladenen Medien aus Supabase. Für eine vollständige
MUSCLEDEX-Sicherung:

1. `.env.backup.example` als `.env.backup.local` kopieren.
2. Unter **Supabase → Project Settings → API Keys** den Service-Role- oder
   Secret-Key ausschließlich lokal eintragen. Er darf niemals nach GitHub
   gelangen.
3. `npm run backup:supabase` ausführen.
4. Das Ergebnis mit
   `npm run backup:verify -- backups/muscledex-<Zeitstempel>` prüfen.
5. Den erzeugten Ordner unter `backups/` zusätzlich auf einem verschlüsselten
   externen Laufwerk oder in einem verschlüsselten Cloudspeicher sichern.

Das Backup enthält Auth-Nutzer, alle MUSCLEDEX-Tabellen, Push-Abos sowie die
Dateien aus `dex-entries`, `food-log` und `link-previews`. Prüfsummen stehen in
`SHA256SUMS.json`. Lokale Backups und der Service-Role-Key sind über
`.gitignore` vom Repository ausgeschlossen. Die exportierten Auth-Daten
enthalten keine Passwörter oder Passwort-Hashes.

Wichtig: Supabase-Datenbankbackups enthalten keine Storage-Dateien. Auf
bezahlten Tarifen stehen Datenbank-Sicherungen zusätzlich unter
**Database → Backups** bereit; die lokale Sicherung bleibt dennoch sinnvoll.

## Abhängigkeiten

GitHub prüft npm-Pakete wöchentlich und bündelt kompatible Minor- und
Patch-Updates in höchstens zwei offenen Dependabot-PRs. Hauptversionen werden
nicht automatisch vorgeschlagen, weil sie bewusste Anpassungen erfordern.
Jeder Qualitätslauf führt zusätzlich `npm audit --audit-level=high` aus und
stoppt bei bekannten hohen oder kritischen Sicherheitslücken. Lokal kann
dieselbe Prüfung mit `npm run audit` gestartet werden.
