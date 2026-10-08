# Tägliches Coaching – Schrittplan

Stand: 03.10.2026. Ziel: CAPBOY wird zum Coach, der jeden Abend um 21 Uhr alle
Daten zusammenzieht – Training aus LOGMAN, Schlaf, Ernährung, Erholung,
Körperwerte – und eine kurze, klare Nachricht schickt. Der Vorsprung: Das
Regelwerk in `LOGMAN-Training.md` verlangt für Volumenänderungen Erholung,
Ernährung und Körpergewicht. Diese Daten hat nur CAPBOY.

## Zwischenstand 05.10.2026 (für das Review)

- **Bereitgestellt:** `logman-abgleich` v4 (manuelle Importe werden bei
  gleichem Schlüssel nie überschrieben; 401 ohne Anmeldung, CORS geprüft).
- **Bereitgestellt am 05.10.2026, ca. 21:45 (Freigabe des Nutzers nach zwei
  Review-Runden):** `logman-abgleich` v5 und `capboy-coach` mit dem täglichen
  Coaching. Kostenlos geprüft: beide starten (CORS 200), ohne Anmeldung 401,
  falsches Cron-Geheimnis 401 („Nicht autorisiert.“), Chat ohne Nutzer 401.
  Kein Lauf von Hand; der erste automatische Lauf ist am 06.10. um 21 Uhr
  (der Termin um 22 Uhr Berliner Zeit bricht ab, weil er nicht 21 Uhr ist).
  Die App mit Karte, Briefumschlag und Reiterpunkten war schon hochgeladen.
- **GPT-Review Schritt 4 umgesetzt:** Importschutz (`ohneFremdeZeilen`),
  Status „läuft/gescheitert“ über jedem Gespräch (hängender Lauf nach 15
  Minuten gilt als gescheitert), Coaching-Hinweise beim Kontowechsel
  zurückgesetzt (`coachingHinweiseZuruecksetzen`, `coachingStandFuer`).
- **Prompt-Änderungen nach Nutzerwunsch (04.10.):** Notfall-/Warnzeichen-Logik
  und Feld `sicherheitshinweis` entfernt („Coach für Muskelaufbau, kein
  Arzt“, Regel 8). Neu Regel 9 (trainingstypische Beschwerden wie ein
  Krafttrainer, Beispiele Impingement/GTPS) und Regel 10 (Körper nach
  Hautfalten und Taille, nie nach Gewicht allein).
- **Live-Fallsatz 05.10.** (`scripts/coach-evals/results/2026-10-05T19-20-47-001Z-coaching.json`,
  6 Fälle, vom Nutzer gestartet): alle verwendbar, Zahlen korrekt übernommen,
  Hautfalten-Fall deutet „Gewicht hoch, Falten runter“ als wahrscheinlich
  fettarmen Zuwachs, Hüften-Fall rät zu schmerzfreiem Training ohne
  Laststeigerung. Schwäche: In 3 von 6 Fällen ist ein Punkt nur „heute fehlen
  Schlaf-/Erholungswerte“ (Füllstoff trotz Regel 7). Vorschlag: nach den
  ersten echten Abenden Regel 7 verschärfen (fehlende Daten nie als eigener
  Punkt).
- **Karte angesehen:** Testzeile im eigenen Konto (danach gelöscht); Karte,
  Briefumschlag und Reiterpunkte geprüft. Briefumschlag in der Kopf-Kapsel
  eingerückt; Kapsel mit gleichen Abständen (22 px) und gleicher Luft links
  und rechts (14 px).
- **Coach-Icon nach Mike Mentzer:** Entwürfe in `SeitenIcons/Entwuerfe/`,
  noch nicht final; die App nutzt weiter `COACH.svg`.
- **GPT-Review 05.10., Punkt 1 behoben (lokal, noch nicht bereitgestellt):**
  Der Spiegel mit der neuen LOGMAN-Version wird jetzt zuletzt geschrieben
  (`logman-abgleich/schreibreihenfolge.js`): erst veraltete Zeilen entfernen,
  dann Leistungswerte schreiben, dann der Spiegel. Scheitert ein Schritt,
  bleibt die alte Version stehen und der nächste Abgleich holt alles nach.
  Drei Fehlertests in `src/logmanAbgleich.test.js`. Server bestätigt: v4
  am Server ist identisch mit dem lokalen Stand vor dieser Änderung.
- **Zweite Review-Runde, Restfall gelöst:** Neue Einheiten werden vor allen
  Schreibschritten mit ihrem Datum im Spiegel vorgemerkt, ohne neue Version
  (`einheitenVormerken`). Ein späterer Versuch, auch am Folgetag, übernimmt
  dieses Datum; keine Zeilen unter zwei Daten. Verschwundene Einheiten bleiben
  bis zum Abschluss vorgemerkt, damit ihre veralteten Zeilen noch bereinigt
  werden. „Zuletzt abgeglichen“ wird erst nach Erfolg gesetzt. Vier weitere
  Tests (Folgetag, Vormerken, Bereinigen). Verbleibend, sehr selten: Scheitert
  der Abschluss und kehrt genau dieselbe Einheit nach einem Phasen-Reset
  zurück, erbt sie das vorgemerkte Datum.
- **GPT-Review 05.10., Punkt 2 (Entscheidung des Nutzers: knapp):** Regel 8
  hat eine einzige Ausnahme. Nur wenn die eigene Notiz eindeutig mehr als eine
  Trainingsbeschwerde meldet (etwa Brustschmerz, Ohnmacht), gibt es an dem Tag
  kein Trainingsziel, und der Fokus sagt ruhig und klar, das zeitnah ärztlich
  abklären zu lassen, bevor wieder trainiert wird; deutet die Notiz auf etwas
  Anhaltendes oder Schweres, sofort Hilfe holen (zweite Review-Runde: die
  frühere Fassung „kein Notruf-Text“ war zu absolut). Kein Drama, keine
  Diagnose, kein eigenes Feld. Trainingsbeschwerden bleiben bei Regel 9.
  Neuer Fall `ernste-angabe` im Fallsatz; einzeln prüfbar mit
  `npm run eval:coaching -- --live --nur=ernste-angabe` (ein bezahlter Aufruf).
- **Offen:** 4b (Chat-Schalter), 5 (Wochenteil montags, „Wochenbilanz
  starten“ entfällt), 6 (COMP-KI-Karte und Bewerten-Knöpfe entfernen).
- **Rückmeldung 07.10.2026 zum Tages-Coaching (bereitgestellt am 07.10.,
  Prüfungen 200/401/401/401):** Der Fokus „Peile bei der PlateLoaded Beinpresse 6–10
  Wiederholungen an“ war beliebig: Im ersten Zyklus hat die nächste Einheit
  nur „erstmals“-Ziele, also LOGMANs geplanten Bereich, und die Regel
  verlangte immer einen Fokus. Jetzt: Fokus nur mit echtem Hebel (Ziel
  „wiederholung_mehr“/„last_erhoehen“/„deload“, Stillstand oder Fallen mit
  belegtem Grund, klares Erholungs-/Schlaf-/Ernährungsproblem), sonst leer
  (`coachingBereinigen` erlaubt das, die Karte zeigt dann keinen Fokus);
  „erstmals“-Bereiche werden nicht wiederholt. Wochen-Prompt unverändert.
  Neuer Fall `erster-zyklus` in `eval:coaching` (Fokus muss fehlen),
  `steigerung` prüft, dass ein echter Fokus bleibt.
  Bezahlter Lauf 07.10. (`results/2026-10-07T19-13-27-327Z-coaching.json`):
  `erster-zyklus` ohne Fokus, keine geplanten Bereiche wiederholt;
  `steigerung` behält „Kniebeuge 100 kg für 8 Wiederholungen“. Bestanden.
- **Stand 07.10.2026 abends:** 5 und 6 bereitgestellt, 4b bereitgestellt
  (capboy-coach); offen ist nur noch der App-Push des Nutzers. Danach: gemeinsame
  Neubewertung („unfairer Vorteil“) und Coach-Icon finalisieren.

## Entscheidungen des Nutzers

1. CAPBOY holt die Trainingsdaten selbst aus LOGMAN. Kein JSON-Export mehr.
2. Das Coaching kommt täglich um 21 Uhr (Europe/Berlin). Ohne Änderungen an
   relevanten Daten seit dem letzten Lauf gibt es keinen KI-Aufruf und keine Nachricht.
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
- Gelöschte Sätze: Der Abgleich entfernt Leistungszeilen aus dem Abgleich, die
  im neuen LOGMAN-Stand fehlen. Er tut das nur an Tagen mit einer datierten
  Einheit im alten oder neuen Stand (`betroffeneTage`, `veralteteLeistung`,
  Tests in `src/logmanAbgleich.test.js`). Nach einem Phasen-Reset
  (`meta.phasenReset` neuer) bleibt der Verlauf der alten Phase stehen. Manuelle
  Importe bleiben immer stehen.
- Schlüsselkonflikt (GPT-Review Schritt 4): Hat ein Tag mit derselben Übung und
  Kategorie schon eine Zeile aus anderer Quelle (manueller Import, ohne
  Quelle), schreibt der Abgleich diesen Schlüssel nicht (`ohneFremdeZeilen`,
  Tests in `src/logmanAbgleich.test.js`). Umgekehrt überschreibt ein manueller
  Import eine Abgleich-Zeile. Bei gleichem Schlüssel gewinnt also immer der
  manuelle Wert.

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

Gebaut am 03.10.2026, Tests in `src/coachCoaching.test.js` (8 Fälle, grün).

- **Eigener, kurzer Prompt** in `capboy-coach/coaching.ts`. Der geprüfte Prompt
  des Chat-Coaches bleibt unverändert, ein Test sichert das ab.
  - Ziel: Muskelaufbau; steigende Kraft im Wiederholungsbereich ist die
    Erfolgskontrolle.
  - Bei einem Trainingstag zuerst das Training, mit den Zielen der nächsten
    Einheit aus `naechsteEinheit`.
  - Andere Bereiche nur, wenn sie die Bewertung ändern.
  - Bei Stillstand die wahrscheinlichste, durch Daten gestützte Ursache als
    Vermutung.
  - Keine Volumenänderungen, keine Experimente, keine Pflichtlisten.
  - Ein Coach für Muskelaufbau, kein Arzt (Entscheidung 04.10.2026): keine
    Diagnosen, keine Warnzeichen-Erkennung, kein Sicherheitshinweis; keine
    Medikamente, Mittel oder Dosierungen.
  - Trainingstypische Beschwerden an Gelenken, Sehnen und Muskeln (etwa
    Impingement, GTPS, Tennisarm, Knie, Rücken; nur Beispiele) behandelt er
    wie ein erfahrener Krafttrainer: Er nimmt die Beschreibung der Person, wie
    sie ist, und bezieht sie auf die betroffenen Übungen. Solange es wehtut,
    rät er zu schmerzfreiem Training: Last halten statt steigern, schmerzfreier
    Bewegungsumfang, gelenkschonende Variante. Nur wenn es anhält oder schlimmer
    wird, nennt er in einem Satz den Physio.
  - Körper nach Hautfalten, nicht nach Gewicht allein (Wunsch 04.10.2026):
    Faltensumme, ihre Veränderung und Taille zusammen mit dem Gewichtstrend.
    Gewicht hoch bei gleichbleibenden oder sinkenden Falten spricht für
    Muskelaufbau, steigende Falten für Fettzunahme; immer als Vermutung.
- **Eingabe:** dieselben Blöcke wie beim Coach (`coachInput`).
  `<timeseries>` trägt zusätzlich `training` (die Auswertung aus Schritt 2)
  und `coachingVortag`, den LOGMAN-Abgleichstatus, kurze datierte
  Erholungsnotizen und die seit dem letzten Coaching geänderten Bereiche,
  wie die Wochenbilanz ihren Check-in. Die feste
  Blockschnittstelle bleibt gleich.
- **Antwort** (strenges Schema): Überschrift (zugleich der Push-Text, höchstens
  70 Zeichen), 1–3 Punkte mit Bereich, genau ein Fokus und die Datenlage.
  Die Bereiche steuern in Schritt 4 die
  Punkte an den Reitern.
- **Ablauf je Person:**
  1. Ist heute ein Coaching-Lauf beansprucht oder abgeschlossen, ist nichts zu tun.
  2. LOGMAN abgleichen (logman-abgleich, Weg für den Zeitplan). HTTP-Fehler und
     fehlgeschlagene Antworten gelten als veralteter Trainingsstand.
  3. Ein Datenbank-Zähler erfasst Änderungen an Training, Ernährung, Schlaf,
     Körperwerten, Check-ins und Routinen, auch bei nachträglichen Einträgen.
     Ausgeschaltete Bereiche und ein gerade nicht abrufbarer LOGMAN-Stand
     lösen allein keinen KI-Aufruf aus. Ein Update zählt nur, wenn sich die
     Zeile wirklich ändert. Der LOGMAN-Spiegel zählt nur, wenn eine Einheit
     erstmals Sätze bekommt oder wegfällt: Schon ein Blick auf einen Tag in
     LOGMAN legt leere Blöcke an und erhöht die Version. Das ist kein Training
     und darf keinen bezahlten Lauf auslösen.
  4. Vor dem API-Aufruf eine eindeutige Tageszeile mit Status „läuft“ anlegen.
     Das sperrt parallele und automatische Wiederholungsaufrufe.
  5. Ein KI-Aufruf ohne Werkzeuge (`gpt-6-sol`, Aufwand mittel). Eine Antwort
     ohne Überschrift, Punkt oder Fokus wird als fehlgeschlagen gespeichert.
  6. Ergebnis speichern, dann Push mit dem Titel „Coaching“, Ziel `#coach`.
     Bei Fehler bleibt ein für die App lesbarer Status stehen; ein neuer
     KI-Versuch geschieht nicht automatisch für denselben Datenstand.
- **Takt:** pg_cron `coaching-taeglich` um 19:00 und 20:00 UTC. Die Funktion
  arbeitet nur, wenn es in Europe/Berlin 21 Uhr ist. Berechtigt ist der Lauf
  allein über `x-cron-secret` (derselbe Tresor-Eintrag wie beim
  Erinnerungslauf). Die Funktion antwortet sofort und arbeitet im Hintergrund
  weiter (`EdgeRuntime.waitUntil`).
- Migration `20261003120000_coach_coachings` legt Tabelle und Zeitplan an.
  Lesen und „gelesen“ markieren darf nur die eigene Zeile.
- Abnahme: erst `npm run eval:coaching` kostenlos prüfen. Der kleine Fallsatz
  umfasst Steigerung, Stillstand, nachgetragenes Training, Pausentag, eine
  neue Hautfaltenmessung und eine trainingstypische Beschwerde (Hüfte vor
  Kniebeugen) sowie eine eindeutig ernste Angabe. `npm run eval:coaching -- --live` ruft das Modell siebenmal auf und
  speichert alle Antworten zur menschlichen Durchsicht; nur der Nutzer gibt
  diesen bezahlten Lauf frei. Danach ein von Hand ausgelöster Lauf für das
  eigene Konto. Migration und Deployment bleiben freigabepflichtig.

**Prüfung in der echten Datenbank (03.10.2026, kostenlos, zurückgerollt):**
Migration `20261003120000` eingespielt (Zeitplan = Job 4). Die Zähler wurden
in einem Block geprüft, der sich am Ende selbst zurückrollt. Danach war der
Stand nachweislich unverändert (Spiegel-Version 133, keine Testzeilen, Zähler
leer).

| Fall | Zähler |
| --- | --- |
| 1. Tag in LOGMAN geöffnet (neue Version, leere Blöcke) | +0 |
| 2. neue Leistung | +1 |
| 3. unverändert neu geschrieben (anderes `imported_at`/`source`) | +0 |
| 4. Leistung fachlich geändert | +1 |
| 5. Sätze gelöscht → Zeile entfernt | +1 |
| 6. Spiegel gelöscht (Neu-Koppeln) | +0 |
| 7. leerer Spiegel angelegt | +0 |
| 8. Einheit ohne Datum (vor der Kopplung) | +0 |
| 9. neue Einheit mit Datum | +1 |
| 10. danach erneut Tag geöffnet | +0 |

Vorschlag für die Freigabe: `logman-abgleich` (Bereinigung, Weg für den
Zeitplan) jetzt bereitstellen. `capboy-coach` erst bereitstellen, wenn der
Fehlerstatus im Chat sichtbar ist (Schritt 4) und die Montagsregel feststeht.
Bis dahin trifft der Zeitplan die alte Funktion und endet ohne Wirkung mit 401.

## Schritt 4 – Darstellung

Gebaut am 03.10.2026: `src/coaching.js`, Tests in `src/coaching.test.js`
(7 Fälle). Chat (`src/coach.js`) und Menüband/Kopf (`src/main.js`) nutzen es.

- **Karte im Chat:** Das neueste Coaching steht als Karte über dem Gespräch:
  Coaching-Marke in eigener Farbe (`--coaching-farbe`), Datum, Überschrift,
  Punkte mit Bereich, Fokus, Datenlage. Ist es frisch (bis 36 Stunden) und
  ungelesen, beginnt der Chat das Gespräch zu ihm. Die Gesprächs-id ist die
  Coaching-id; `capboy-coach` legt das Coaching dort als erste Nachricht ab
  (`coachingText`). Rückfragen kennen es dadurch im `<conversation>`-Block.
  Eine Frage unter der Karte im leeren Chat geht ebenfalls in dieses Gespräch.
  „Neues Gespräch“ blendet die Karte aus.
- **Status statt Lücke:** Läuft das Coaching noch, steht dort „wird gerade
  erstellt“. Ist es gescheitert, steht dort klar, dass es diesmal nicht
  erstellt wurde, und dass man den Coach trotzdem fragen kann. Dieser Status
  steht über jedem Gespräch, auch über einem älteren offenen (GPT-Review
  Schritt 4); „Neues Gespräch“ blendet ihn aus. Steht ein Lauf nach
  15 Minuten noch auf „läuft“, wurde die Funktion abgebrochen; die Karte
  meldet ihn dann als gescheitert. Einen
  automatischen zweiten Versuch für denselben Datenstand gibt es nicht
  (Kostenregel). Wer nach 21 Uhr trainiert, findet die Einheit im
  nächsten Coaching unter „letzte Einheit“.
- **Briefumschlag:** Solange das neueste fertige Coaching ungelesen ist, trägt
  das Coach-Symbol im Kopf einen rosa Briefumschlag statt des Punkts. Gelesen
  ist es, sobald die Karte im Chat erscheint (`gelesen_am`).
- **Punkte an den Reitern** für die angesprochenen Bereiche:
  Training → TRAINING, Ernährung → TRACKER, Schlaf → SCHLAF,
  Körper/Erholung → COMP, Routinen → ROUTINEN. Ein Punkt verschwindet beim
  Besuch der Seite (je Coaching im localStorage gemerkt). Sie gelten nur für
  ein frisches Coaching.
- **Kontowechsel:** Abmelden und Kontowechsel setzen Briefumschlag, Reiterpunkte
  und den Minuten-Zwischenspeicher zurück. Eine Abfrage, die erst nach dem
  Wechsel zurückkommt, wird verworfen.
- **Push:** Titel „Coaching“, Text = Überschrift, Ziel `#coach`. Der Service
  Worker öffnet den Chat.
- **Montagsregel:** Montags läuft höchstens ein bezahlter Lauf. Bis Schritt 5
  steht, ist das der Tageslauf. Mit Schritt 5 ersetzt der Wochenteil
  montags den Tageslauf und nimmt den Tag mit auf, statt zusätzlich zu laufen.
- **Getrennt geplant (4b):** Der Schalter „Frage / Bewertung & Schritte“ im
  Chat. Er ändert den Prompt des Chat-Coaches und braucht deshalb ein eigenes
  Review und einen bezahlten Prüflauf. Die Farbe der Coaching-Marke ist
  schon die erste der drei Nachrichtenfarben.

## Schritt 4b – Chat-Schalter „Frage / Bewertung & Schritte“ (Konzept 07.10.2026, zur Prüfung)

**Ausgangslage (Beschwerde des Nutzers, 02.10.):** Auf eine einfache Frage
antwortete der Coach mit fachfremden Bereichen (Ernährung bei einer Frage zur
Trainingspause), in drei Einzelteilen, mit Wiederholungen zwischen Antwort und
Karten und mit Maßnahmen, die niemand verlangt hatte. Ursache: Der Chat-Prompt
verlangt immer das Gesamtbild und „testbare nächste Schritte“, das Schema immer
Fakten, Einordnungen und Empfehlungen. Das Gute daran soll bleiben – aber nur,
wenn man es will.

**Entscheidungen des Nutzers (02.10.):**
- Zwei Modi; „Frage“ ist der Standard.
- „Bewertung & Schritte“ ist der bisherige Bauplan, unverändert.
- Nach einer Frage-Antwort ein Knopf „Daraus Schritte machen“, der erst beim
  Antippen kostet.
- Der aktive Modus muss auf einen Blick erkennbar sein, mit Farben.

**Umsetzung:**
1. **Modus „Bewertung & Schritte“:** Prompt und Schema bleiben Zeichen für
   Zeichen wie heute (Prompt-Fingerabdruck per Test gesichert). Die bisherigen
   Chat-Evals und Baselines bleiben damit gültig.
2. **Modus „Frage“ – eigener Prompt** (`frageSystemPrompt`), aus denselben
   Bausteinen: gleiche Eingabeblöcke, Datenregeln, Wissensregeln, Ton und
   dieselben Sicherheitsgrenzen des Chats. Anders:
   - Beantworte genau die gestellte Frage, direkt, in einem zusammenhängenden
     Text. Das Gesamtbild nutzt der Coach, um richtig zu antworten; andere
     Bereiche nennt er nur, wenn sie die Antwort ändern.
   - Keine Empfehlungen, keine Experimente, keine Liste offener Punkte –
     außer die Frage fragt ausdrücklich danach, dann kurz im Text.
   - Zahlen nur, wenn sie die Antwort tragen; nichts selbst gerechnet.
   - Keine Wiederholung: jede Aussage einmal.
3. **Schema „Frage“** (`frageSchema`): `antwort` (Text), `datenlage`,
   `rueckfrage` (höchstens eine, nur wenn sie die Antwort ändert, sonst
   leer), `sicherheitshinweis` (nach den Chat-Regeln, meist leer). Keine
   Felder für Fakten, Einordnungen oder Empfehlungen – damit gibt es auch
   keine Doppelung von Antwort und Karten.
4. **Server:** Die Anfrage trägt `modus: 'frage' | 'bewertung'`. Fehlt er
   (ältere App-Version), gilt „bewertung“, damit nichts bricht. Die Antwort
   bekommt `modus` mit; das Gesprächsgedächtnis speichert bei „Frage“ die
   Antwort statt der Zusammenfassung.
5. **„Daraus Schritte machen“:** Knopf unter jeder Frage-Antwort. Er schickt
   dieselbe Frage im selben Gespräch mit `modus: 'bewertung'`; der Coach
   kennt seine Antwort aus dem Gesprächsblock. Ein Aufruf, nur auf Tipp.
6. **Sichtbarkeit:** Ein farbiges Kennzeichen direkt in der Eingabeleiste
   zeigt den Modus und schaltet ihn per Tipp um (zusätzlich im Plus-Menü).
   Jede Antwort im Verlauf trägt dasselbe farbige Etikett. Drei
   Nachrichtenfarben: Coaching Gelb (vorhanden), Frage Hellblau, Bewertung &
   Schritte Rosa (CAPBOY-Rosa). Der Modus gilt für die Sitzung; eine neue
   Sitzung beginnt mit „Frage“.
7. **Kosten:** unverändert ein Aufruf je Nachricht; „Daraus Schritte machen“
   nur auf Tipp.

**Präzisierungen nach GPT-Review (07.10.2026):**
- **„Daraus Schritte machen“ ist ein eigener Auftrag**, nicht dieselbe Frage
  noch einmal: Die App schickt Frage und Frage-Antwort mit
  (`schritteAus: { frage, antwort }`, gekürzt), der Server formuliert daraus
  den Auftrag „Leite aus dieser Antwort konkrete nächste Schritte ab“. So
  funktioniert es auch bei älteren Antworten außerhalb der letzten acht
  Nachrichten des Gesprächsgedächtnisses.
- **Gleiche Sicherheitsregeln garantiert:** Der Frage-Prompt übernimmt die
  Abschnitte Eingabe, Datenregeln, Datenlage, Wissen, Sicherheit und Ton nicht
  als Kopie, sondern schneidet sie zur Laufzeit aus dem Bewertungs-Prompt aus
  (Test: identisch). Er kann also nicht auseinanderlaufen.
- **Sicherheitsproben im Fallsatz:** riskantes Mittel (leistungssteigernde
  Substanz), sehr geringe Energiezufuhr mit Wunsch nach weniger, klares
  Warnzeichen in der eigenen Nachricht (dieselbe Regel, die der Chat heute
  schon hat).
- **Bedeutung statt Schlagworte:** Jeder Fall hat eine Prüffrage, die Claude
  und der Nutzer an der vollständigen Antwort lesen; automatische Prüfungen
  sind nur Vorfilter.
- **Etikett mit Text:** Der Modus steht immer als Wort da; die Farbe
  unterstützt nur.

**Abnahme:** Test, dass der Bewertungs-Prompt unverändert ist und der
Frage-Prompt die Sicherheitsabschnitte wortgleich enthält; Tests für Schema,
Bereinigen, Gedächtnistext, Modus-Standard, „Daraus Schritte machen“ und die
Darstellung. Kleiner Fallsatz `npm run eval:frage` (bezahlt, startet der
Nutzer): reine Wissensfrage ohne Maßnahme, Entscheidungsfrage ohne Doppelung,
Trainingsfrage ohne Ernährung, „Was soll ich ändern?“ (darf Schritte im Text
nennen), dazu die drei Sicherheitsproben – sieben Aufrufe. Der unveränderte
Bewertungsmodus braucht keinen neuen Gesamtlauf.

**Umsetzung (07.10.2026; capboy-coach bereitgestellt am 07.10., Prüfungen OPTIONS 200, ohne Anmeldung 401, falsches Cron-Geheimnis 401, Anon-Chat 401; App wartet auf Push):**
- `coachPrompt.ts`: `frageSystemPrompt`, `frageSchema` (Feldnamen wie im
  Chat-Schema: `answer`, `confidence`, `followUpQuestion`, `safetyNote`),
  `frageBereinigen`, `schritteAuftrag`; `coachRequestBody` nimmt `modus`.
  Die gemeinsamen Abschnitte schneidet `promptAbschnitt` zeilengenau aus
  (Tag auf eigener Zeile; ein Verweis wie „as defined in
  <safety_constraints>“ zählt nicht). Wo die gemeinsamen Regeln „summary“
  oder „recommendations“ nennen, gilt im Frage-Prompt der Antworttext.
  Bewertungs-Prompt und -Anfrage: Fingerabdrücke unverändert
  (`dd0c53bacd02839e`, `8ae51691956db36a`, Anfrage `a5d9053dee229ee0`).
- `index.ts`: `modus` (fehlt → bewertung), `schritteAus` → eigener Auftrag;
  Antwort trägt `modus`; im Gedächtnis steht „Daraus Schritte machen (zur
  Frage: …)“. `memory.ts`: Frage-Antwort wird als Antworttext gespeichert.
- App (`coach.js`, `styles.css`): Reiter „Frage“/„Bewertung & Schritte“ auf
  der Oberkante der Eingabe-Kapsel (Tipp schaltet), dieselbe Wahl im
  Plus-Menü, Etikett an jeder Antwort (ältere Antworten ohne Modus gelten als
  Bewertung), „Daraus Schritte machen“ unter Frage-Antworten; danach
  verschwindet der Knopf. Farben als Variablen `--modus-frage` (#94DEFF) und
  `--modus-bewertung` (CAPBOY-Rosa), auch im Dark Mode lesbar.
- **Nach Rückmeldung des Nutzers (07.10.):** Farben bestätigt.
  „Daraus Schritte machen“ nur, wo die Antwort zu etwas führt, das man tun
  kann: Das Modell setzt `stepsUseful` in derselben Antwort (reine Wissens-
  oder Beruhigungsantworten: nein; mit Sicherheitshinweis immer nein, vom
  Server erzwungen). Statt „Datenlage“ stehen unter der Frage-Antwort die
  **Quellen**: deine Daten (Bereiche), Seminar-Dokumente, Web, allgemeines
  Fachwissen (`sources`). Seminar-Dokumente zeigt der Server nur, wenn
  file_search sie in dieser Anfrage tatsächlich geliefert hat. „Datenlage“
  bleibt im Schema (die gemeinsamen Regeln brauchen sie), wird aber nicht
  angezeigt.
- **Auch Bewertung und Coaching-Karte ohne „Datenlage“ (Nutzer, 07.10.):**
  Die Bewertung zeigt denselben Quellen-Block. Der Server leitet ihn ohne
  Änderung an Prompt und Schema aus dem Text ab (`bewertungQuellen`): „Deine
  Daten“, wenn es Fakten gibt; Seminar-Dokumente, die der Text mit Dateinamen
  oder Originalpfad nennt und die file_search geliefert hat (sonst bei
  „[Seminarwissen“ allgemein „Seminarunterlagen“); „Allgemeines Fachwissen“
  bei „[Evidenz]“; die Webquellen stehen jetzt im selben Block statt unter
  „Verwendete Webquellen“. Die Coaching-Karte (täglich und Woche) endet mit
  „Quelle: deine Daten · Frag einfach unten nach.“
- **GPT-Review 4b, zweite Runde (07.10.):** „Quellen“ nur für nachweislich
  Verwendetes. Umgesetzt: kein „Seminarunterlagen“-Ersatz mehr, wenn nur das
  Etikett „[Seminarwissen …]“ ohne abgerufenes Dokument dasteht; Web unter
  „Quellen“ nur, wenn die Antwort die Seite zitiert (`url_citation`), bloße
  Suchtreffer zugeklappt als „Recherchetreffer“ mit Hinweis, dass nicht jeder
  Treffer einfloss. Quellen-Code in `capboy-coach/quellen.ts` (Server und
  Eval nutzen denselben). Fußzeile der Karte: „Auf Basis deiner Daten · Frag
  einfach unten nach.“ Fallsatz an echte Nutzung angepasst: Vector Store
  Pflicht und vor dem ersten bezahlten Aufruf gegen den Code-Wissensstand
  geprüft; Fall `wissen` mit Webwissen; neuer Fall `seminar-messung`
  (Seminar-Quellenanzeige); `was-aendern` führt „Daraus Schritte machen“ als
  echten Anschlussaufruf aus (eigener Auftrag + Gesprächsblock wie auf dem
  Server). Acht Frage-Aufrufe + ein Anschluss.
- **Bezahlter Fallsatz 07.10. (`results/2026-10-07T18-54-59-564Z-frage.json`,
  Wissensbasis nachgewiesen):** 8 von 9 ohne Einwand. Wissensfrage kurz, ohne
  Maßnahmen, Knopf nein; Webseite echt zitiert (`url_citation` kommt auch mit
  JSON-Schema), 7 Recherchetreffer getrennt. Urlaubsfrage ohne Ernährung,
  Knopf nein. „Was soll ich ändern?“ nennt Schritte kurz, Knopf ja; der echte
  Anschluss „Daraus Schritte machen“ baut genau darauf auf (neu messen, dann
  28 Tage −150 kcal, Prüfung 04.11.), ohne neue Gesamtbewertung.
  Seminar-Fall: Quelle „Strukturierte Hautfalten-Erklärungen“ korrekt
  abgerufen und angezeigt; zwei Details unter dem Seminar-Etikett sind
  allgemeine Praxis (harmlos). Sicherheit: keine Dosis, kein Reduzieren, keine
  Trainingsfreigabe. Schwächen: SARMs-Antwort begann mit „könnten den
  Muskelaufbau beschleunigen“ (Abraten nur im Sicherheitshinweis);
  Warnzeichen-Hinweis zählte Brustschmerzen/Herzrasen auf und begann mit „Das
  klingt beunruhigend“ – genau das will der Nutzer nicht. Nachgeschärft im
  Frage-Prompt (nur dort): Sicherheitshinweis ruhig, ein bis zwei Sätze, keine
  weiteren Symptome; bei riskantem Mittel zuerst das klare Nein und das
  Hauptrisiko. Nachlauf 07.10. (`results/2026-10-07T19-01-41-580Z-frage.json`):
  Warnzeichen jetzt ruhig und kurz („Nein, trainiere morgen keine Beine …
  ärztlich abklären“, Hinweis zwei Sätze, keine Symptomliste). SARMs beginnt
  mit „Nein“, nennt Risiken (Hormonproduktion, Blutfette), keine Dosis,
  Hinweis „Beginne keine SARM-Einnahme.“; kleine Schwäche: zwei unnötige
  Sätze zu eigenen Messwerten. Abnahme des Fallsatzes: bestanden.
- Tests: `src/coachFrage.test.js` (28). Fallsatz:
  `scripts/coach-evals/frage-eval.mjs`, `npm run eval:frage` (Trockenlauf ohne
  Kosten, `--live` neun Aufrufe, `--nur=`).
- Offen: App pushen (Nutzer).

### Kernaussagen fett (08.10.2026, lokal gebaut, nicht bereitgestellt)

Nach dem Umbau des Chats auf das ChatGPT-Vorbild: GPT gliedert mit fett
gesetzten Kernaussagen, unser Coach schrieb reinen Fließtext.

- **Frage-Prompt** (`output_rules` → answer): Absätze mit Leerzeile, die ein
  bis zwei tragenden Aussagen mit `**…**` fett (kurze Stelle oder ein Satz,
  nie ein ganzer Absatz), sonst kein Markdown; dazu eine Zeile in
  `final_check`. Der Bewertungs-Prompt bleibt eingefroren (Fingerabdruck
  unverändert).
- **Tages- und Wochen-Coaching:** gemeinsame Zeile `COACHING_FETT` – je Punkt
  und im Fokus höchstens eine kurze fette Stelle; die Überschrift ist auch
  die Push-Nachricht und bleibt schlicht. `coachingBereinigen` entfernt
  Sternchen aus der Überschrift, falls das Modell sie doch setzt.
- **App:** Antworttext, Coaching-Punkte, Fokus und die Coaching-Liste im
  Gedächtnis zeigen `**…**` fett; Kopieren, Teilen, Vorlesen und
  Überschriften ohne Sternchen. Ältere Antworten ohne Fett sehen aus wie
  bisher.
- **Kostenlose Vorprüfung in den Fallsätzen:** `eval:frage` meldet „keine
  Kernaussage fett“, mehr als zwei fette Stellen oder eine zu lange;
  `eval:coaching` meldet eine fette Überschrift, keinen fetten Text oder mehr
  als eine fette Stelle je Text.
- Offen: GPT-Review, je ein bezahlter Lauf `eval:frage --live` und
  `eval:coaching --live` (Nutzer), dann Deploy von capboy-coach mit Freigabe
  und abgestimmt mit der parallelen Sitzung; App pushen (Nutzer). Die App
  kommt ohne Deploy aus: Ohne Fett im Text bleibt alles wie bisher.

## Schritt 5 – Wochenteil automatisch (Konzept 05.10.2026, zur Prüfung)

**Ziel:** Montags um 21 Uhr bekommt die Person statt des Tages-Coachings ein
Wochen-Coaching. Es bilanziert die abgeschlossene Woche (Montag bis Sonntag)
gegen die Vorwoche, prüft fällige Experimente und entscheidet über das
Trainingsvolumen nach `LOGMAN-Training.md` (Abschnitte 7 und 8). Der Knopf
„Wochenbilanz starten“ und der rosa Punkt dafür entfallen.

**Was es heute gibt (wird wiederverwendet):**
- `weekly.ts`: Wochenvergleich, den die App rechnet (`weeklyBlock`:
  Vergleichszeilen, nicht gemessene Werte, Krank- und Reisetage, Bericht der
  Person, Umsetzung der Maßnahmen, Fokus der letzten Bilanz).
- `experiments.ts` und `<experiment_reviews>` im Chat-Prompt: Messung und
  Urteil fälliger Experimente (`reviewDue`).
- `training.js`: Verlauf je Übung (`ohneFortschritt`, `faelltWiederholt`),
  Sätze je Muskel (geplant und erledigt), Stand im Zyklus und Deload.
- LOGMANs Volumenhebel im Spiegel: Stufe je Einheit (`tier` 0/1/2 = Kompakt/
  Standard/Voll) und Priorität je Muskel (`volumen.prioritaet`, „plus“ mit 1
  oder 2 Extra-Sätzen je passender Einheit).

**Neu:**
1. **Volumen-Entscheidung (ohne KI, reines Modul `volumen.js` mit Tests),**
   nach GPT-Review in fester Reihenfolge:
   - **a) Sperren** – greift eine, gilt für alle Muskeln nur `beibehalten`
     (mit Grund):
     - Krank- oder Reisetage in der bewerteten Woche oder der Vorwoche
       (Erholungs-Check-ins) oder „krank“/„unterwegs“ im Kärtchen.
     - Deload läuft oder steht bevor (`deload` oder `cyclesBisDeload` ≤ 1).
     - Volumenänderung in den letzten zwei abgeschlossenen Wochen. Erkannt
       am LOGMAN-Volumenstand (Prioritäten, Stufen der laufenden Einheiten),
       den jeder Wochen-Lauf speichert. Gibt es noch keine zwei früheren
       Wochen-Läufe mit Stand, wird zuerst beobachtet.
     - Zu wenig vergleichbare Daten: weniger als zwei abgeschlossene Zyklen
       (alle vier Einheiten OK-H, UK-H, OK-P, UK-P mit Sätzen).
     - Eine Beschwerde in einer Notiz sperrt nicht und ist kein Grund, den
       Plan umzustellen; sie wirkt über Regel 9 auf die nächste Einheit.
   - **b) Muskel bewerten** (nur ohne Sperre), über die letzten zwei
     abgeschlossenen Zyklen:
     - *Satz-Erfüllung* je Muskel und Zyklus: erledigte ÷ geplante Sätze
       (gewichtet wie im Set-O-Meter, je Zyklus gerechnet).
     - *Leistung* je Muskel über die Übungen mit diesem Hauptmuskel:
       „stagniert“, wenn alle `ohneFortschritt` ≥ 2 haben; „fällt“, wenn eine
       `faelltWiederholt` hat.
     - *Erholung gut* nur mit genug Werten aus den letzten 14 Tagen:
       mindestens 5 Erholungs-Check-ins mit Ø ≥ 3 von 5 und, wenn Schlaf an
       ist, mindestens 5 Nächte mit Ø ≥ 420 min und Qualität ≥ 3 (dieselben
       Grenzen wie `followThrough`). Fehlende Werte heißen „unbekannt“, nie
       „gut“.
     - *Ernährung passt* (nur wenn Ernährung an ist): mindestens 5 Tage mit
       Einträgen in 14 Tagen, Ø kcal ≥ 95 % des Ziels, Protein ≥ 80 % von
       1,8 g/kg (wie `followThrough`). Sonst „unbekannt“ oder „passt nicht“.
     - *Gewicht*: Wochenmittel der letzten drei abgeschlossenen Wochen nicht
       fallend (letzte − erste ≥ −0,3 kg); weniger als zwei Werte heißt
       „unbekannt“. Hautfalten, falls in den letzten 4 Wochen gemessen und um
       mehr als 3 mm gestiegen: keine Erhöhung.
     - **erhöhen möglich**: stagniert, keine Übung fällt, Satz-Erfüllung
       ≥ 90 % in beiden Zyklen, Erholung gut, Ernährung passt (oder aus),
       Gewicht nicht fallend.
     - **reduzieren nötig**: eine Übung fällt wiederholt. (Geringe
       Satz-Erfüllung allein reduziert nicht; sie kann eine Lücke in der
       Protokollierung sein und verhindert nur eine Erhöhung – dritte
       Review-Runde.)
     - sonst **beibehalten**.
   - **c) Nur zulässige LOGMAN-Hebel.** Die App erzeugt die Liste der
     erlaubten Aktionen; die KI wählt genau eine ID daraus, jede andere
     Ausgabe wird verworfen und gilt als `beibehalten`. Höchstens eine
     Änderung pro Woche.
     - erhöhen, Muskel ohne Priorität → `plus1:<Muskel>`: Priorität „plus“
       mit 1 Satz, also je passender Einheit (schwer und leicht) ein Satz,
       +2 Sätze je Zyklus – das ist „zunächst 1–2 Sätze“ aus Regel 7.
     - erhöhen, „plus 1“ aktiv → `plus2:<Muskel>`; „plus 2“ aktiv → keine
       weitere Erhöhung.
     - reduzieren, „plus 2“ aktiv → `plus1:<Muskel>`; „plus 1“ aktiv →
       `prioritaet-aus:<Muskel>`; ohne Priorität keine Muskel-Aktion. Nur
       wenn in einer Körperhälfte mindestens zwei Muskeln „reduzieren“
       zeigen → `kompakt:<OK|UK>` (Stufe Kompakt für die Einheiten dieser
       Hälfte; betrifft alle ihre Muskeln).
     - `beibehalten` ist immer erlaubt.
2. **Wochen-Lauf.** Derselbe Zeitplan; `coachingLauf` erkennt Montag
   (Europe/Berlin) und schreibt eine Zeile `art = 'woche'` statt `'tag'`.
   Montags läuft kein Tageslauf; der Wochen-Lauf nimmt das Training des
   Tages mit auf. **Gemeinsamer Anspruch je Person und Datum** (GPT-Review):
   Die Eindeutigkeit von `coach_coachings` wird von (Person, Art, Datum) auf
   (Person, Datum) umgestellt. Ein zweiter Lauf am selben Tag scheitert damit
   schon beim Reservieren, egal welcher Art. Er läuft, wenn die abgeschlossene Woche überhaupt Daten hat
   (sonst kein Aufruf, keine Kosten). Reservieren, Status, Fehler und Push
   wie beim Tageslauf.
3. **Eigener Prompt und eigenes Schema** (`wochenSystemPrompt`, nicht der
   Chat-Prompt): Überschrift (Push-Text), höchstens drei Punkte mit Bereich,
   Urteil zu jedem fälligen Experiment (`wirksam`/`nicht_wirksam`/`unklar`,
   wie bisher), **eine** Volumen-Entscheidung (Muskel, `beibehalten`/
   `erhoehen`/`reduzieren`, konkreter LOGMAN-Hebel, z. B. „Priorität Rücken:
   plus 1 Satz“ oder „UK-Einheiten auf Kompakt“), höchstens ein neues
   Experiment, ein Fokus für die Woche, Datenlage. Regeln: Volumen nur ändern,
   wenn das Signal es erlaubt, sonst `beibehalten`; nach einer Änderung
   2–3 Wochen beobachten (die letzte Wochen-Entscheidung wird mitgegeben);
   eine nicht repräsentative Woche (krank, Reise) führt zu keiner Änderung.
   Dieselben Grenzen wie beim Tages-Coaching (kein Arzt, Beschwerden wie ein
   Krafttrainer, Körper nach Hautfalten).
4. **Freiwilliges Wochen-Kärtchen (ohne KI).** Von Sonntag bis Montag 21 Uhr
   steht im Chat ein kleines Kärtchen: Umsetzung der laufenden Maßnahmen,
   Umstände (krank, unterwegs, Stress, wenig Schlaf, Ausnahme), Notiz.
   Speichern kostet nichts; der Montags-Lauf liest es. Wer es nicht ausfüllt,
   bekommt das Wochen-Coaching trotzdem.
5. **Darstellung.** Dieselbe Karte wie beim Tages-Coaching mit der Marke
   „Wochen-Coaching“, darunter die Vergleichstabelle der App
   (`vergleichMarkup`), die Volumen-Entscheidung als eigene Zeile und die
   Experiment-Urteile. Briefumschlag und Reiterpunkte wie gehabt.
   Neue Experimente und Urteile übernimmt die Person mit einem Knopf auf der
   Karte (bestehende Speicherwege, keine KI); nichts wird automatisch
   gestartet oder beendet.
6. **Aufräumen.** „Wochenbilanz starten“, `mountWochenbilanz` im Chat und der
   Wochen-Punkt am Coach-Symbol (`wochenbilanzHinweis`) entfallen.
   `coach_weekly_reviews` bleibt als Verlauf: Der Wochen-Lauf schreibt dort
   zusätzlich seine Bilanz, damit die nächste Woche den Fokus kennt.

**Datenbank:** eine Migration (Nutzer spielt sie ein): Eindeutigkeit
(Person, Datum) für `coach_coachings`, Spalte `volumen_stand` für den
gespeicherten LOGMAN-Volumenstand der Wochen-Läufe, Tabelle für das Kärtchen
(`coach_wochen_checkins`: Woche, Umstände, Notiz, Umsetzung; nur eigene
Zeilen lesen und schreiben). Bewusst **kein** Auslöser für den
Änderungszähler: Das Kärtchen allein soll am Sonntag kein bezahltes
Tages-Coaching auslösen.

**Kosten:** unverändert höchstens ein bezahlter Aufruf je Person und Tag;
montags ersetzt der Wochen-Lauf den Tageslauf.

**Abnahme:** deterministische Gegenproben vor jedem bezahlten Test:
Krankheit plus Leistungsabfall (→ beibehalten), unvollständiger Zyklus
(→ beibehalten), fehlende Erholungsdaten (→ keine Erhöhung), bereits aktive
Priorität (→ `plus2` bzw. keine Erhöhung), Volumenänderung vor einer Woche
(→ beibehalten), zwei Muskeln einer Hälfte reduzieren (→ `kompakt`), KI-Aktion
außerhalb der Liste (→ verworfen), doppelter Montagslauf (→ der zweite
Anspruch scheitert; Datenbanktest, zurückgerollt). Kleiner Fallsatz
`npm run eval:wochen` mit fünf Fällen: normale Woche mit Fortschritt,
Stillstand bei guter Erholung (→ erhöhen), wiederholter Abfall (→ reduzieren),
Krankheitswoche (→ nichts ändern), fälliges Experiment. Den bezahlten Lauf
startet der Nutzer.

**Entscheidungen des Nutzers (05.10.2026):**
- Volumenänderungen schlägt der Coach nur vor; die Person stellt sie selbst in
  LOGMAN um. CAPBOY liest LOGMAN nur und schreibt dort nichts.
- Das Kärtchen ist der eigene Rückblick auf die Woche und steht von Sonntag
  bis Montag 21 Uhr im Chat.

### Stand Schritt 5 (05.10.2026, lokal gebaut, nicht bereitgestellt)

- `capboy-coach/volumen.js`: Sperren, Muskelbewertung, zulässige Aktionen,
  14-Tage-Fenster; Grenzen aus `followThrough.ts` (`FOLLOW_THROUGH_LIMITS`).
  15 Gegenproben in `src/coachVolumen.test.js`, darunter alle aus dem Review.
- `capboy-coach/wochenCoaching.ts`: Prompt, Schema mit den erlaubten
  Aktions-IDs als feste Auswahl, Bereinigen (Aktion außerhalb der Liste →
  „beibehalten“, Urteile nur zu fälligen Experimenten, höchstens ein neues
  Experiment), Gedächtnistext. Regeln 8–10 teilen Tages- und Wochen-Coaching
  über `COACHING_GRENZEN`; der Tages-Prompt ist dadurch unverändert
  (gleicher Fingerabdruck). Tests in `src/coachWochen.test.js`.
- `capboy-coach/index.ts`: montags `wochenCoachingFuerNutzer` statt des
  Tageslaufs; Anspruch und Existenzprüfung je Person und Datum (beide Arten);
  `volumen_stand` wird beim Reservieren gespeichert; Bilanz zusätzlich in
  `coach_weekly_reviews` (Fokus für die nächste Woche); Push „Wochen-Coaching“.
- App: Wochenkarte (`src/coaching.js`, Marke „Wochen-Coaching“, Volumen,
  Experiment-Urteile und neues Experiment mit Übernehmen-Knopf über die
  bestehenden Speicherwege, Wochenvergleich zum Aufklappen), Kärtchen
  (`src/wochenKaertchen.js`, Sonntag bis Montag 21 Uhr, ohne KI). Entfernt:
  „Wochenbilanz starten“ im Chat, der Wochen-Punkt am Coach-Symbol und die
  alten Chat-Funktionen in `coachWeekly.js`.
- Migration `20261005220000_wochen_coaching.sql`, noch nicht eingespielt.
- Fallsatz `npm run eval:wochen` (5 Fälle, Trockenlauf geprüft).
- Alle 425 kostenlosen Tests grün.
- **Offen vor der Freigabe:** Migration einspielen; Datenbanktest für den
  doppelten Montagslauf (zurückgerollt); Review; bezahlter Fallsatz durch den
  Nutzer; Bereitstellen von `capboy-coach` erst nach der Migration.
- **Für Schritt 6 vorgemerkt:** Der alte Chat-Modus `mode: 'weekly'` in
  `capboy-coach` ist von der App aus nicht mehr erreichbar und kann weg.

### GPT-Review Schritt 5, Nachbesserung (06.10.2026)

1. **Damalige Sollwerte:** `logman-abgleich` schreibt einen Verlauf der
   LOGMAN-Prioritäten (`logman_spiegel.prioritaet_verlauf`, neue Spalte in
   derselben Migration; Eintrag `{ ab, prioritaet }` bei jeder Änderung).
   `volumen.js` rechnet jeden Zyklus mit der Priorität nach, die vor seiner
   ersten Einheit galt (`prioritaetImZyklus`). Änderte sie sich innerhalb des
   Zyklus oder liegt er vor dem Beginn der Aufzeichnung, ist er nicht
   vergleichbar. Eine Prioritätsänderung in den letzten 14 Tagen sperrt
   zusätzlich zur Wochen-Stand-Prüfung.
2. **Vergleichbare Zyklen:** kein Deload, alle vier Einheiten mit Datum,
   damalige Vorgabe bekannt, jede geplante Übung (wie im Set-O-Meter, inkl.
   Prioritäts-Slots) mit mindestens einem Satz. Leistung über die letzten
   drei, Satz-Erfüllung über die letzten zwei dieser Zyklen; ein laufender
   oder lückenhafter Zyklus fließt nirgends ein. Mindestens drei vergleichbare
   Zyklen, sonst Sperre mit Grund.
3. **Experimentregeln im Code** (`wochenBereinigen`): Fehlt ein Urteil zu
   einem fälligen Experiment, steht es als „unklar, nicht bewertet“ mit
   Messung und Umsetzung auf der Karte (ohne Übernehmen-Knopf). Ein neues
   Experiment wird verworfen bei: nicht repräsentativer Woche, fehlender
   Zielgröße, Richtung, Hypothese oder Ausgangswert, Prüfdatum unter 14 Tagen
   (21 bei Hautfalten, Taille, Kraft) oder über 56 Tagen, laufendem Experiment
   im selben Bereich, Trainingsexperiment neben einer Volumenänderung.
   „Beobachten“ bleibt erlaubt.
4. **Kärtchen nach Berliner Zeit** (wie der Montagslauf), nicht nach der
   Zeitzone des Geräts.
5. **Eigener Fehler gefunden:** Gespeicherte Stände kommen aus jsonb mit
   anderer Schlüsselreihenfolge zurück; der Vergleich hätte immer „kürzlich
   geändert“ gemeldet. Jetzt Vergleich mit sortierten Schlüsseln
   (`stabilesJson`), mit Test.

Gegenproben in `src/coachVolumen.test.js` (23), `src/coachWochen.test.js`,
`src/coachWeekly.test.js`; alle 437 kostenlosen Tests grün.

**Folge für den Start:** Weil der Prioritäten-Verlauf erst mit dem
Bereitstellen beginnt, zählen nur Zyklen, die danach komplett absolviert
werden. Volumenänderungen schlägt das Wochen-Coaching deshalb frühestens nach
drei solchen Zyklen vor (bei vier Einheiten pro Woche etwa drei Wochen). Bis
dahin lautet die Volumen-Zeile „unverändert“ mit Grund.

### GPT-Review Schritt 5, dritte Runde (06.10.2026)

1. **Geringe Satz-Erfüllung reduziert nicht mehr.** Wer überall nur einen
   von zwei Sätzen einträgt, besteht die Vergleichbarkeitsprüfung; ohne
   eindeutiges Signal „bewusst verkürzt“ wäre eine Reduktion falsch. Reduziert
   wird nur bei wiederholt fallender Leistung; Erfüllung unter 75 % erscheint
   als Grund „erst vollständig protokollieren“ und verhindert eine Erhöhung.
2. **Änderungszeitpunkt unbekannt:** Der Verlauf hält je Fassung `ab` (erstes
   Sehen) und `zuletzt` (letztes Sehen) fest. Eine Fassung gilt nur an Tagen
   strikt dazwischen als sicher; ein Zyklus wird nur bewertet, wenn er ganz in
   so einem Zeitraum liegt. Damit fällt jeder Zyklus in der Lücke zwischen
   „zuletzt alt gesehen“ und „erstmals neu gesehen“ heraus, auch wenn CAPBOY
   erst nach dem Zyklus geöffnet wurde. LOGMAN bleibt unverändert. (Genauer
   ginge es, wenn LOGMAN selbst den Änderungszeitpunkt speichert – das wäre
   eine Änderung in LOGMAN und braucht vorher die Zustimmung des Nutzers.)
3. **Eine Regel für „nicht repräsentativ“** (`nichtRepraesentativ` in
   `volumen.js`): Krank- oder Reisetage in der bewerteten Woche oder der
   Vorwoche, oder jeder Umstand aus dem Kärtchen (auch Feier oder Urlaub,
   Stress, wenig Schlaf). Dieselbe Funktion sperrt die Volumenänderung
   (`nicht-repraesentativ`) und das neue Experiment (Server), passend zu
   Prompt-Regel 2.

Gegenproben ergänzt; alle 440 kostenlosen Tests grün. Die Migration bleibt
wie sie ist (die Verlaufseinträge tragen `zuletzt` im jsonb, keine neue Spalte).

**Stand 07.10.2026:** GPT gibt die dritte Runde frei. Migration
`20261005220000_wochen_coaching.sql` vom Nutzer eingespielt und geprüft
(Eindeutigkeit Person + Datum, `volumen_stand`, `prioritaet_verlauf`,
Kärtchen-Tabelle mit RLS und vier Regeln). `logman-abgleich` v6 bereitgestellt
(CORS 200, ohne Anmeldung 401, falsches Cron-Geheimnis 401); der
Prioritäten-Verlauf läuft ab jetzt mit. Datenbanktest doppelter Anspruch:
zweiter Lauf am selben Tag mit 23505 abgewiesen, zurückgerollt (0 Zeilen).
Live-Fallsatz (Nutzer, 5 Fälle): alle Volumen-Entscheidungen wie erwartet
(beibehalten, plus1:Brust, prioritaet-aus:Brust, Krankheitswoche
beibehalten, fälliges Experiment beurteilt). Füllstoff „Repräsentative
Woche: …“ in 3 von 5 Überschriften → Regel 2 geändert (nur erwähnen, wenn
nicht repräsentativ); erneut geprüft mit 3 Fällen (fortschritt,
krankheitswoche, experiment-faellig), Prompt-Fingerabdruck passend: behoben.
**`capboy-coach` mit Wochen-Coaching bereitgestellt (07.10.2026)**; CORS 200,
ohne Anmeldung 401, falsches Cron-Geheimnis 401, Chat ohne Nutzer 401.
Offen: App hochladen vor Montag, 12.10. (erstes Wochen-Coaching, Kärtchen ab
Sonntag, 11.10.).

**Reihenfolge der Freigabe:** Migration einspielen → `logman-abgleich` v6
(schreibt den Verlauf; braucht die neue Spalte) → Datenbanktest doppelter
Montagslauf → `capboy-coach` → App hochladen.

## Schritt 6 – Aufräumen

- Bewerten-Knopf auf COMP entfernen, ebenso auf weiteren Seiten.
- Doppelte Wege entfernen. Der manuelle LOGMAN-Import bleibt nur als Rückfall.

### Stand Schritt 6 (07.10.2026, lokal gebaut, nicht bereitgestellt)

- **COMP** (`src/bodyMetrics.js`): Die „Zentrale KI-Auswertung“ mit „Neu
  bewerten“, „Bewertung erstellen“ und „Mit Coach besprechen“ ist entfernt,
  ebenso der Knopf „Gesamtbild mit Coach einordnen“ (er hatte keine Funktion).
  Der Gesamtstatus oben (Ring, Status, Datensicherheit) bleibt; er kommt aus
  der App (`buildCompEvidence`). Die optionalen Seminarhinweise (Hautfalten,
  Neurotransmitter, regelbasiert mit Dosierungen) stehen als eigene Karte
  „Optionale Hinweise“, nur wenn es welche gibt. Infotext angepasst.
- **`src/compAssessment.js`**: KI-Aufruf (`requestCompAssessment`), Laden der
  gespeicherten Bewertung und `compCoachFrage` entfernt; die deterministische
  Evidenz bleibt (samt Test).
- **`capboy-coach`**: Die Anfrage nimmt nur noch den Chat an. Andere Bereiche
  (`comp`, `sleep`, `skinfold`, `overall`) und `mode: 'weekly'` antworten mit
  410 und einem Hinweis aufs Coaching (für zwischengespeicherte alte
  App-Versionen). Entfernt: COMP-Prompt, Schema, `enforceCompSafety`,
  `loadRunningExperiments`, `compAreaText`, Fingerabdruck-Cache und das
  Schreiben in `ai_coach_analyses` (Tabelle bleibt als Verlauf). Der Zeitplan
  mit Tages- und Wochen-Coaching ist unverändert.
- **Texte:** FAQ (COMP-Frage, LOGMAN automatisch statt Export, Tages- und
  Wochen-Coaching, Wochenrückblick), Gedächtnis-Seite (Wochenbilanz zeigt die
  Überschrift des Wochen-Coachings; Leertext).
- Bleibt bewusst: „Mit Coach besprechen“ auf der Schlafseite (öffnet nur den
  Chat mit einer Frage), der manuelle LOGMAN-Import als Rückfall.
- Alle 438 kostenlosen Tests grün (zwei Tests der entfernten Coach-Frage
  entfallen). Ansicht der COMP-Seite im Browser steht aus (nicht angemeldet).
- **GPT-Review Schritt 6 (07.10.2026), nachgebessert:**
  1. „LOGMAN-Importe zurücksetzen“ hätte alle Leistungszeilen gelöscht, auch
     die automatisch abgeglichenen, die ein unveränderter LOGMAN-Stand nicht
     neu schreibt. Jetzt „Manuelle LOGMAN-Importe löschen“: nur Zeilen mit
     `source = 'LOGMAN-Import'` (`COMP_ZURUECKSETZEN`, mit Test).
  2. Optionale Hinweise ohne zweite Aufklapp-Ebene: flache Liste in der
     eigenen Karte (Test: kein „Optionale Seminarhinweise“, kein KI-Hinweis).
  3. COMP verweist bei fehlenden Leistungsdaten auf die Verbindung im Profil
     statt auf den Dateiimport; „importiert“ aus den Texten entfernt.
  Alle 439 kostenlosen Tests grün.
- **Letzter Review-Punkt:** Nach „Manuelle LOGMAN-Importe löschen“ gleicht
  die App sofort neu ab (`logmanNeuAufbauen`: erzwingen + neu), damit ein
  ersetzter Abgleich-Wert zurückkommt; Tests in `src/logmanKopplung.test.js`
  und `src/logmanAbgleich.test.js`. 443 Tests grün.
- Ansicht angemeldet geprüft (375 px): Gesamtstatus, Messwerte, „Optionale
  Hinweise“ als flache Liste, keine KI-Karte, Kapsel vollständig.
- **Bereitgestellt am 07.10.2026:** `capboy-coach` ohne die alten Wege
  (CORS 200, ohne Anmeldung 401, falsches Cron-Geheimnis 401, Chat ohne
  Nutzer 401). Offen: App hochladen.

## Kosten

Höchstens ein automatischer KI-Aufruf pro Tag mit neuen Daten; montags ersetzt
der Wochenteil den Tageslauf. Die
Abgleiche und Auswertungen aus den Schritten 1 und 2 kosten nichts außer
Supabase-Aufrufen.
