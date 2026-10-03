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

Ein Modul in `capboy-coach` (neben `context.ts`) rechnet aus dem Spiegel:
- Je Übung: letzter Wert gegen den vorherigen derselben Einheit (e1RM nach
  Epley, wie `progression.js`), gesteigert, gleich oder gefallen, sowie
  Stillstand über mehrere Einheiten.
- Ziel für die nächste Einheit nach doppelter Steigerung: oberes Ende des
  Bereichs bei passendem RIR erreicht, dann Last erhöhen, sonst eine
  Wiederholung mehr.
- Nächste Einheit der Rotation (OK-H → UK-H → OK-P → UK-P), Zyklus- und
  Deload-Stand, Level je Tag.
- Harte Sätze je Muskel und Woche über die `konten` der Vorlage.
- Offener Punkt: Bereiche und `konten` stehen in LOGMANs `template.js`
  (Fassung v4 weicht von `LOGMAN-Training.md` ab, es gilt der Code). Wie die
  Kopie in CAPBOY mit LOGMAN abgeglichen bleibt, muss noch geklärt werden.
- Abnahme: Tests mit festen Fixtures (Steigerung, Stillstand, Lastsprung,
  Deload, fehlende Daten), jeweils gegen von Hand nachgerechnete Werte.

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
