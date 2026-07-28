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
- Supabase Auth, Postgres und Row-Level Security
- eigener Service Worker für Offline-Start und spätere Web-Push-Erinnerungen
- Retro-/Dark-Designsystem aus LOGMAN
- Hash-Routing, damit GitHub Pages keinen SPA-Fallback benötigt
- Körperwerte mit Gewicht, 7-Tage-Schnitt und Hautfalten-Summe
- generisches Reminder-Modell fuer Mahlzeiten, Supplements und Trinken

## Deployment

Der Workflow unter `.github/workflows/deploy.yml` baut bei einem Push auf `main`.
Im GitHub-Repository müssen `VITE_SUPABASE_URL` und
`VITE_SUPABASE_ANON_KEY` als Actions-Secrets hinterlegt werden.
