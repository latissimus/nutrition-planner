# Laufzeitprüfung

## Vergleichsbedingungen

Gleicher Testaccount, Datenbestand, Gerät, Browser und Netzwerk. Versionskennung,
iPhone-Modell und iOS-Version notieren. Entwicklungsserver-Zeiten nicht mit
Produktions-PWA-Zeiten vergleichen. Keine echten Messdaten ändern oder löschen.

## Abläufe

1. App vollständig schließen und erneut öffnen: letzter Dex, keine Suchseite.
2. Einkauf → Sleep-Log → Body-Log → Meal-Log → Routinen → Fooddex → Trainingdex.
3. Diese Folge fünfmal wiederholen. Erste Öffnung und Cache-Wechsel getrennt auswerten.
4. Während eines noch laufenden Wechsels mehrfach einen anderen Dex wählen:
   Am Ende muss ausschließlich der zuletzt gewählte Dex sichtbar sein.
5. Je Dex Eintragsmenü öffnen und ohne Speichern schließen; Scrollposition und
   Bedienbarkeit prüfen.
6. Im Safari-Web-Inspector mit langsamer Verbindung wiederholen. Header,
   Hintergrund und Inhalt dürfen keine gemischten Zwischenzustände zeigen.
7. Speicher und Netzwerkanfragen nach 10 und 50 Wechseln vergleichen. Ein begrenzter
   Cache darf wachsen; dauerhaftes Wachstum und doppelte Abonnements untersuchen.

## Messgrenzen

Das vorhandene Perf-Overlay misst Router-Laufzeit ab startRoute bis finishRoute.
Die ergänzte Historie enthält höchstens 100 Wechsel und zeigt pro Route Anzahl
und Median. Sie lebt nur im Speicher. Diese Zeit ist weder die gesamte Startzeit
noch die Zeit bis zum tatsächlich sichtbaren Bildschirmbild. Cache-Treffer und
Erstaufrufe sind anhand der angezeigten Schritte getrennt zu vergleichen.

Für tatsächliche Darstellung, blockierte Frames und JavaScript-Aufgaben zusätzlich
Safaris Timeline auf dem angeschlossenen iPhone aufnehmen. Vorher-/Nachherwerte
erst nach identischen Abläufen vergleichen. Bestehende Funktionstests ersetzen
diese Geräteprüfung nicht.

## Status

Anmeldung durch den Nutzer im lokalen Browser erfolgreich. Die zuerst geprüfte
Darstellung gehörte zu einem anderen Konto. Es war keine andere App-Version:
Farben, Tapeten, Reihenfolge, eigene Dex und Inhalte sind kontogebunden. Nach der
Anmeldung mit dem eigentlichen Konto wurden dessen letzter Dex und dessen Design
direkt geladen; die entfernte Suchseite erschien auch bei einem Kaltstart über
`#home` nicht mehr.

Erste Router-Messungen am 6. September 2026 (Entwicklungsserver, Mac, eigentliches
Konto) lagen beim vollständigen Aufbau je nach Dex ungefähr zwischen 70 und
264 ms. Ein Cache-Wechsel lag bei etwa 28 ms. Das sind Diagnosewerte und noch
kein belastbarer Vorher-/Nachhervergleich. Die Cache-Logik baut eine bereits
sichtbare Cache-Ansicht nicht mehr ein zweites Mal auf. Datenänderungen und die
Rückkehr in den Vordergrund verwerfen alte Cache-Ansichten stattdessen gezielt.
Die Historie trennt Aufbau und Cache bei der Medianberechnung. Alle genannten
Ansichten wurden im angemeldeten Endzustand geprüft; dabei waren genau eine
Ansicht, ein Header und ein Menüband aktiv und die Konsole blieb fehlerfrei.
Der nicht mehr erreichbare Renderer der früheren Startseite samt Zählerabfragen
und Aktualisierungs-Listenern wurde entfernt. Das erzeugte Hauptpaket sank dabei
von rund 576,4 kB auf 568,9 kB (unkomprimiert). Außerdem entfällt die frühere
Verzögerung um zwei Browser-Frames vor jedem Hash-Wechsel. Ein erneuter Kaltstart
über `#home` landete direkt im zuletzt verwendeten Sleep-Log; weder eine alte
Startseite noch die Suchseite befand sich anschließend im DOM.
Vollständige Wiederholungsserien, Frame-Aufnahmen, Speicherprüfung und
iPhone-Messungen stehen noch aus.
