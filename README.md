# Nutrition Planner

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

## Web Push

1. Migration `20260728000400_web_push.sql` anwenden.
2. Ein VAPID-Schlüsselpaar erzeugen.
3. Public Key als `VITE_VAPID_PUBLIC_KEY` lokal und in GitHub hinterlegen.
4. Public/Private Key und Absender als Supabase Function-Secrets speichern.
5. `send-reminders` mit `--no-verify-jwt` deployen. Die Function prüft
   Testaufrufe selbst gegen das Nutzer-JWT und Cron-Aufrufe gegen `CRON_SECRET`.
6. Supabase Cron jede Minute einen POST auf
   `/functions/v1/send-reminders` senden lassen.

Auf iPhone/iPad muss die HTTPS-App zuerst zum Home-Bildschirm hinzugefügt und
von dort geöffnet werden. Erst dann kann iOS ein Push-Abo anlegen.
