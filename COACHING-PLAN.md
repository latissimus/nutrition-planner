# Tägliches Coaching – Schrittplan

Stand: 02.10.2026. Ziel: CAPBOY wird zum Coach, der jeden Abend um 21 Uhr alle
Daten zusammenzieht – Training aus LOGMAN, Schlaf, Ernährung, Erholung,
Körperwerte – und eine kurze, klare Nachricht schickt. Der Vorsprung: Das
Regelwerk in `LOGMAN-Training.md` verlangt für Volumenänderungen Erholung,
Ernährung und Körpergewicht. Diese Daten hat nur CAPBOY.

## Entscheidungen des Nutzers

1. CAPBOY holt die Trainingsdaten selbst aus LOGMAN. Kein JSON-Export mehr.
2. Das Coaching kommt täglich um 21 Uhr (Europe/Berlin). Ohne neue Daten seit dem
   letzten Lauf gibt es keinen KI-Aufruf und keine Nachricht.
3. Täglich: Bewertung der heutigen Einheit im Zusammenhang, Ziele für die
   nächste Einheit der Rotation, Warnungen. Volumen je Muskel (Level/Sätze)
   nur im Wochenteil, montags um 21 Uhr.
4. „Wochenbilanz starten“ entfällt. Ihre Angaben (Umsetzung je Maßnahme,
   Umstände, Notiz) bleiben als freiwilliges Kärtchen ohne KI-Kosten.
5. Der Chat ist die Heimat des Coaches: Das Coaching ist eine abgesetzte Karte ganz
   oben, darunter kann man direkt nachfragen. Es gibt drei farbig
   gekennzeichnete Nachrichtenarten: Coaching, „Frage“, „Bewertung & Schritte“.
6. Um 21 Uhr: Push mit der wichtigsten Erkenntnis. Am Coach-Symbol im Kopf
   erscheint ein E-Mail-Symbol, kein rosa Punkt. Rosa Punkte erscheinen an den
   Reitern, deren Bereiche das Coaching anspricht; sie verschwinden beim Besuch
   der Seite.
7. Seiten zeigen Zahlen, die KI spricht nur im Chat. Der Bewerten-Knopf auf
   COMP (und ähnliche) entfällt.
8. Kosten: automatische KI-Läufe nur im festen Takt (täglich/wöchentlich), nie
   pro Seitenaufruf.

Grundregeln aus dem Coach-Plan gelten weiter: Die App rechnet, die KI deutet
(Rechenmonopol). Nach jedem Schritt prüft GPT. Deploys und Migrationen nur mit
Freigabe. Bezahlte Prüfläufe startet der Nutzer.

## Schritt 1 – LOGMAN-Datenleitung (ohne KI)

LOGMAN (Projekt `blast-trainer`, Supabase `bjtnpmselziqpwnthukj`) speichert das
ganze Log als eine Zeile `training_logs(user_id, payload jsonb, updated_at,
version)`. Schreiben geht dort nur über RPC mit Versionsprüfung, Lesen ist per
RLS erlaubt.

Entscheidung des Nutzers: nur lesen, gekoppelt an das jeweilige LOGMAN-Konto.
Jeder CAPBOY-Nutzer verbindet sein eigenes LOGMAN, z. B. später auch die Frau
des Nutzers mit ihren Konten.

**Kopplung per Code** (keine Passwörter zwischen den Apps, kein Hauptschlüssel):
1. In LOGMAN unter Profil auf „Mit CAPBOY verbinden“ tippen. LOGMAN zeigt einen
   Code, der 10 Minuten gilt.
2. In CAPBOY unter Profil auf „LOGMAN verbinden“ tippen und den Code eingeben.
   Fertig.
3. In beiden Apps ist danach „Verbunden seit …“ mit „Trennen“ zu sehen. In LOGMAN
   getrennt, kann CAPBOY sofort nichts mehr lesen.

**LOGMAN (Migration und kleiner Profilbereich; Freigabe des Nutzers nötig):**
- Tabelle `capboy_kopplungen(id, user_id, token_hash, erstellt_am,
  zuletzt_gelesen_am, getrennt_am)` und kurzlebige
  `capboy_kopplungscodes(code_hash, user_id, gueltig_bis)`; RLS ohne direkte
  Rechte.
- RPC `capboy_code_erstellen()` (als angemeldeter LOGMAN-Nutzer) erzeugt den
  Code. Er wird nur gehasht gespeichert und gilt 10 Minuten.
- RPC `capboy_code_einloesen(code)` (aufgerufen von CAPBOYs Server) verbraucht
  den Code und gibt einmalig einen langen Lese-Token zurück. Gespeichert wird
  nur sein Hash.
- RPC `capboy_training_log(token)` liefert für eine gültige Kopplung genau
  `payload`, `version` und `updated_at` dieses einen Kontos. Es gibt keinen
  Schreibweg.
- RPCs `capboy_kopplung_status()` und `capboy_kopplung_trennen()` für den
  Profilbereich.

**CAPBOY:**
- Tabelle `logman_kopplung(user_id, token, verbunden_am)`, nur für den Server
  lesbar.
- Tabelle `logman_spiegel(user_id, payload, logman_version, logman_stand,
  abgerufen_am)`. Bei gleicher `version` passiert nichts.
- Edge Function `logman-abgleich` mit den Aktionen koppeln, abgleichen und
  trennen. LOGMANs öffentlicher Schlüssel steht ohnehin im LOGMAN-Code, deshalb
  muss niemand ein Geheimnis eintragen.
- `logman_performance` wird aus dem Spiegel neu befüllt, mit derselben Umrechnung
  wie der heutige Import (`parseLogmanExport`). COMP und Coach funktionieren
  dadurch unverändert.
- Auslöser: beim Öffnen von CAPBOY (höchstens alle 30 Minuten, wegen des
  Log-Volumens) und vor jedem Coaching-Lauf. Der manuelle Import bleibt als
  Rückfall.

Abnahme:
- Nach dem Koppeln erscheinen neue Sätze in CAPBOY ohne Export.
- Ein unveränderter Stand löst keine Schreibvorgänge aus.
- Nach dem Trennen in LOGMAN schlägt der Abgleich fehl, und CAPBOY zeigt
  „nicht verbunden“.
- Zwei Konten sehen nur ihre eigenen Daten.
- LOGMANs Trainingslog wird nie verändert.

## Schritt 2 – Trainingsauswertung (ohne KI, reines Modul mit Tests)

Gebaut am 03.10.2026: `supabase/functions/capboy-coach/training.js`, Tests in
`src/coachTraining.test.js` (18 Fälle, alle grün).

- **LOGMAN rechnet mit:** LOGMANs reine Rechenmodule liegen als unveränderte
  Kopie in `capboy-coach/logman/`: Vorlage, Katalog, eigene Übungen, Sätze,
  Prioritäten, Set-O-Meter, Fortschritt und Sprungwarnung.
  `scripts/logman-module-uebernehmen.mjs` holt sie neu. Ein Test meldet lokal,
  wenn die Kopie von LOGMAN abweicht. So klärt sich der offene Punkt: Es gilt
  der Code von LOGMAN (Vorlage v4), CAPBOY rechnet nichts davon nach.
- **Je Einheit:** Sätze, bester e1RM, Vergleich zum letzten Mal derselben
  Einheit (gesteigert, gleich, gefallen, erstmals), e1RM-Differenz,
  Lastsprung nach LOGMANs Regel (mehr als 10 % und mehr als 2,5 kg) und RIR über
  dem Ziel.
- **Je Übung über die Cycles:** Verlauf und die Zahl der Vergleiche ohne
  Fortschritt. 2 heißt drei Einheiten auf demselben Stand. Dazu ein Merker,
  wenn die Leistung wiederholt fällt (LOGMAN-Training.md, Abschnitt 7).
- **Nächste Einheit:** LOGMANs Stand (`week`/`day`). Hat sie schon Sätze, gilt
  die nächste der Rotation. Nach Cycle 7 kommt der Deload, danach ist die
  Phase zu Ende.
- **Ziel je HEAVYS-/MIDDLES-Übung (doppelte Steigerung):** Haben alle Sätze mit
  dem schwersten Gewicht das obere Ende erreicht, steigt die Last um 2,5 kg und
  es geht am unteren Ende neu los. Sonst bleibt das Gewicht, plus eine
  Wiederholung. Im Deload gelten halbe Sätze und 3–5 RIR.
- **Sätze je Muskel im Cycle:** geplant (Set-O-Meter) und erledigt, mit
  derselben Gewichtung, Nebenspieler zählen halb.
- **Datum der Einheit:** LOGMAN speichert ein Datum nur, wenn man es
  einstellt oder „Diese Einheit ist vollständig“ tippt. Deshalb trägt der
  Abgleich je Einheit den Tag ein, an dem er sie erstmals mit Sätzen sah
  (`logman_spiegel.einheiten_gesehen`, Migration 20261003090000). Ein
  LOGMAN-Datum hat Vorrang. Einheiten von vor der Kopplung bleiben ohne Datum.
  Daraus kommen „heute trainiert“ und „Tage seit der letzten Einheit“, und die
  Leistungszeilen in COMP bekommen so überhaupt erst ein Datum.
- Offen für Schritt 3: `capboy-coach` muss beim Deploy die Dateien
  `training.js` und `logman/*.js` mitnehmen.

## Schritt 3 – Coaching-Lauf (KI)

- Neuer Modus `coaching` in `capboy-coach`, analog zu `weekly`. Eingabe: die
  bisherigen Blöcke plus die Trainingsauswertung aus Schritt 2 und das
  Coaching vom Vortag (damit es nachfasst und sich nicht wiederholt).
- Antwort kurz: Überschrift, höchstens drei Punkte, ein Fokus für die nächste
  Einheit, die angesprochenen Bereiche (für die Punkte an den Reitern). Keine
  erzwungenen Maßnahmen; Experimente bleiben im Wochenteil.
- Takt: pg_cron um 19:00 und 20:00 UTC, die Funktion läuft nur, wenn es in
  Europe/Berlin 21 Uhr ist (Sommer- und Winterzeit). Davor ein
  Abgleich aus Schritt 1, danach der Vergleich „neu seit dem letzten Lauf?“.
  Gibt es nichts Neues, endet der Lauf ohne KI-Aufruf.
- Neue Tabelle `coach_coachings` (Tag bzw. Woche, Inhalt, Bereiche,
  gelesen_am), höchstens ein Tageslauf je Nutzer und Datum.
- Push über die bestehende Erinnerungs-Infrastruktur.
- Abnahme: eigener Fallsatz (`--faelle coaching`). Darin unter anderem:
  Trainingstag mit Steigerung, Stillstand bei schlechtem Schlaf, Pausentag ohne
  Neues (kein Aufruf), kein Vermischen fachfremder Bereiche ohne Bezug.

## Schritt 4 – Darstellung

- Coaching-Karte ganz oben im Chat, ältere im Verlauf, Nachfragen direkt darunter.
- E-Mail-Symbol am Coach-Symbol, solange ein Coaching ungelesen ist.
- Rosa Punkte an den angesprochenen Reitern, die beim Besuch der Seite
  verschwinden.
- Der Push öffnet den Chat.
- Farben der drei Nachrichtenarten. Hier wird auch der Schalter „Frage /
  Bewertung & Schritte“ eingebaut, weil er dasselbe Farbsystem nutzt
  (siehe Antwortstil-Entscheidung).

## Schritt 5 – Wochenteil automatisch

- Montags um 21 Uhr läuft statt des Tageslaufs der Wochenteil: Vergleich mit der
  Vorwoche, fällige Experimente, Volumen je Muskel nach dem LOGMAN-Regelwerk.
- Der Knopf „Wochenbilanz starten“ entfällt. Die Angaben bleiben als
  freiwilliges Kärtchen (Umsetzung, Umstände, Notiz).

## Schritt 6 – Aufräumen

- Bewerten-Knopf auf COMP entfernen, ebenso auf weiteren Seiten.
- Doppelte Wege entfernen. Der manuelle LOGMAN-Import bleibt nur als Rückfall.

## Kosten

Höchstens ein KI-Aufruf pro Tag mit neuen Daten und einer pro Woche. Die
Abgleiche und Auswertungen aus den Schritten 1 und 2 kosten nichts außer
Supabase-Aufrufen.
