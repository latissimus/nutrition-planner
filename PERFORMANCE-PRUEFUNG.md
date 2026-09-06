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

Für tatsächliche Darstellung, blockierte Frames und JavaScript-Aufgaben Safaris
Timeline auf dem angeschlossenen iPhone aufnehmen. Vorher-/Nachherwerte
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
Alle genannten Ansichten wurden im angemeldeten Endzustand geprüft; dabei waren genau eine
Ansicht, ein Header und ein Menüband aktiv und die Konsole blieb fehlerfrei.
Der nicht mehr erreichbare Renderer der früheren Startseite samt Zählerabfragen
und Aktualisierungs-Listenern wurde entfernt. Das erzeugte Hauptpaket sank dabei
von rund 576,4 kB auf 568,9 kB (unkomprimiert). Außerdem entfällt die frühere
Verzögerung um zwei Browser-Frames vor jedem Hash-Wechsel. Ein erneuter Kaltstart
über `#home` landete direkt im zuletzt verwendeten Sleep-Log; weder eine alte
Startseite noch die Suchseite befand sich anschließend im DOM.
Eine erste Safari-Timeline wurde anschließend direkt in der Home-Screen-PWA auf
einem iPhone 14 mit iOS 26.5.2 aufgenommen (31,73 Sekunden, gegen 11:15 Uhr).
Sie enthält 18 Dex-Wechsel. Die CPU-Auslastung lag im Mittel bei rund 8 % und
maximal bei rund 22 %. Es gab keine JavaScript-Aufgabe ab 50 ms; die längste
JavaScript-Aufgabe dauerte rund 48 ms, der längste Layout-Eintrag rund 40 ms.
Die Aufnahme zeigt damit keine dauerhafte CPU-Sättigung.

Auffällig waren dagegen 88 Netzwerkanfragen, darunter genau 18 Schreibzugriffe
auf `user_preferences` – zuvor wurde bei jedem Dex-Wechsel der zuletzt geöffnete
Dex sofort einzeln zum Server geschrieben. Diese Einstellung wird nun lokal
sofort aktualisiert und serverseitig gebündelt. Mehrere schnelle
Wechsel erzeugen dadurch nur noch einen Schreibzugriff mit dem endgültigen Dex.
Nicht übertragene Änderungen bleiben lokal als ausstehend markiert und werden
beim nächsten Laden erneut synchronisiert. Drei gezielte Synchronisationstests
sowie die vollständige Prüfung mit 122 Tests und Produktions-Build sind
erfolgreich.

Die zweite iPhone-Aufnahme dauerte 22,17 Sekunden und enthielt 16 Dex-Wechsel.
Die Zahl der Preference-Schreibzugriffe sank von einem Zugriff pro Wechsel auf
7 Zugriffe, also um rund 56 % bezogen auf die Wechsel. Insgesamt wurden 64
Netzwerkanfragen erfasst. Die längste JavaScript-Aufgabe sank von rund 48 auf
41,8 ms; erneut gab es keine Aufgabe ab 50 ms. Der längste Layout-Eintrag lag bei
rund 38 ms. Die CPU lag im Mittel bei rund 10,6 % und maximal bei 36 %; die
Aufnahmen sind wegen unterschiedlicher Länge und Bediengeschwindigkeit nur
eingeschränkt als CPU-Vorher-/Nachhervergleich geeignet. Weil die Wechselpausen
mehrfach länger als die zunächst gewählten 1,5 Sekunden waren, wurde die
Synchronisationsruhe anschließend auf 5 Sekunden erhöht. Die Navigation und
lokale Speicherung bleiben dabei unmittelbar.

Als Nächstes sind die wiederholten Daten-Lesezugriffe und eine Speicheraufnahme
zu prüfen. In der zweiten Aufnahme wurden 57 GET-Anfragen erfasst; der langsamste
Abruf dauerte rund 395 ms. Erst diese Messungen entscheiden, ob ein größerer
Daten-Cache oder weitere Paketaufteilung die iPhone-Laufzeit tatsächlich
verbessert.
