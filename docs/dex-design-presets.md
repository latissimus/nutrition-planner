# CAPBOY: Farbaufbau der Systemseiten

## Verbindliche Entscheidung

Jede Systemseite erhält ein kuratiertes Farbpaar:

- **Seitenfarbe**: großflächiger Hintergrund der Seite
- **Druckfarbe**: individuelle Schrift-, Tapeten- und Inhaltsfarbe

Die beiden Farben bilden die Identität der Inhaltsseite. Schwarze oder weiße
Systemfarben bleiben davon bewusst getrennt. Dadurch darf eine Seite markant
sein, ohne dass Navigation und Overlays unruhig oder uneinheitlich wirken.

Eigene, frei konfigurierbare Seiten gehören nicht mehr zum Produkt. Neue Seiten
werden als feste Systemseiten einem der beiden folgenden Typen zugeordnet.

## Gemeinsame Farbebenen

| Ebene | Farbregel |
| --- | --- |
| Seitenhintergrund | Seitenfarbe |
| Inhaltsüberschriften und Metadaten | Druckfarbe |
| Tapete | Druckfarbe mit geringer Deckkraft |
| Konstruktive Konturen | Schwarz |
| Harte Retro-Schlagschatten | Schwarz |
| Kontextmenü-Fläche | Weiß |
| Kontextmenü-Überschrift, Einträge und Icons | Schwarz |
| Primäre Aktion im Kontextmenü | Seitenfarbe mit Druckfarbe als Schrift/Icon |
| App-Header und unteres Menü | neutrale Kontrastfarbe, nicht die Druckfarbe |

Schwarz ist die konstruktive Farbe des Systems: Kartenrahmen, Chiprahmen,
Ordnerkonturen, Buttonrahmen und plastische Schlagschatten bleiben schwarz.
Die individuelle Druckfarbe ersetzt diese Konturen nicht.

## Grid-Seiten

Grid-Seiten sind Sammlungen für Videos, Bilder, Links und Notizen, zum Beispiel
TRAINING, ESSEN, SUPPS und STRESS.

### Inhaltsseite

- Der Hintergrund verwendet die Seitenfarbe.
- Sammlungsüberschrift, Zähler, Abschnittsüberschriften und Tapete verwenden die
  Druckfarbe.
- Die Tapetensymbole werden groß genug dargestellt, dass sie als ruhiges Muster
  und nicht als kleinteilige Textur erscheinen.
- Das Tapetenmotiv bleibt kontrastarm; es darf Inhalte niemals überlagern.

### Chips und Filter

- Inaktive Chips: Druckfarbe als Fläche, Seitenfarbe als Schrift.
- Aktiver Chip: Seitenfarbe als Fläche, Druckfarbe als Schrift.
- Jeder Zustand besitzt eine schwarze Kontur und einen schwarzen harten
  Schlagschatten.
- Der Chip-Scrollport darf bis an den Displayrand laufen. Der erste normale Chip
  beginnt trotzdem auf der gemeinsamen Inhaltsachse.

### Infoelement

- Kreisfläche in Druckfarbe, Icon in Seitenfarbe.
- Kontur schwarz, ohne weißen oder farbigen Ersatzrahmen.
- Position und Seitenabstand folgen dem Grid und der Sammlungsüberschrift.

### Beitragskarten

- Kartenfläche in Druckfarbe, Kartentext in Seitenfarbe.
- Außenkontur und Trennkante unter dem Vorschaubild schwarz.
- Bilder und Videos behalten ihre Originalfarben.
- Die individuelle Zweifarbigkeit endet nicht vor den Karten; dadurch wirken
  sie wie zusammengehörige Retro-Sammelkarten statt wie fremde Standardkarten.

### Unterordner

- Ordnerfläche folgt der Druckfarbe; ein farbiger Einsatz darf die Seitenfarbe
  aufgreifen.
- Text verwendet die Seitenfarbe.
- Formkontur und harter Schlagschatten sind immer schwarz.
- Longpress-Menüs folgen den neutralen Kontextmenüregeln.

### Beitragsdetails

- Detailkarte: Druckfarbe als Fläche, Seitenfarbe als Inhaltsschrift.
- Medien behalten ihre Originalfarben und erhalten eine schwarze Trennkontur.
- Hervorgehobene Informationsfelder verwenden die Seitenfarbe als Fläche und
  die Druckfarbe für sämtliche Texte und Icons.
- Primäre Detailaktionen verwenden ebenfalls Seitenfarbe plus Druckfarbe;
  Kontur und Schlagschatten bleiben schwarz.
- Schließen- und Mehr-Aktionen sind neutrale, rahmenlose Kartenaktionen.

### Referenz TRAINING

- Seitenfarbe: `#013E37`
- Druckfarbe: `#FCEFBB`
- Karten: Creme mit grüner Schrift
- Chips, Infoelement und Detailfelder: invertieren dasselbe Farbpaar
- Sämtliche Konturen und Retro-Schatten: Schwarz

### Referenz REZEPTE

- Seitenfarbe: `#F1DF71`
- Druckfarbe: `#552626`
- Übersichtskarten und Rezeptdetails: Warmweiß mit brauner Schrift
- Unterordner: Warmweiß mit brauner Schrift und gelbem Einsatz
- Inaktive Chips: Braun mit gelber Schrift
- Aktiver Chip und hervorgehobene Detailfelder: Gelb mit brauner Schrift
- Zutatenflächen: Warmweiß mit brauner Schrift für längere, gut lesbare Listen
- Sämtliche Konturen und Retro-Schatten: Schwarz

## Hero-Seiten

Hero-Seiten stellen einen aktuellen Zustand oder eine Kennzahl in den
Mittelpunkt, zum Beispiel TRACKER, SCHLAF, ROUTINEN und COMP.

### Inhaltsseite und Tapete

- Hintergrund und Tapete folgen demselben Seitenfarbe-/Druckfarbe-Prinzip wie
  Grid-Seiten.
- Hero-Zahl, Titel, Trends und inhaltliche Hervorhebungen verwenden die
  Druckfarbe.
- Die Tapete bleibt groß, leise und kontrastarm.

### Kartenhierarchie

- Hero, zweite Karte und Kopfzeilen weiterer Karten dürfen eine leichte, aus
  Seitenfarbe und Druckfarbe gemischte Tönung erhalten.
- Längere Inhaltskarten verwenden eine ruhige helle Grundfläche, damit Daten,
  Formulare und Fließtext klar lesbar bleiben.
- Kontur, Schrift, Diagramme und hervorgehobene Werte greifen die Druckfarbe
  auf, sofern die Seite nicht ausdrücklich eine schwarze Systemkontur nutzt.
- Eine Farbtönung darf Hierarchie erzeugen, aber keine zusätzliche dritte
  Akzentfarbe einführen.

### Steuerelemente

- Info-Icons, Toggles, Auswahlzustände und Seitenbuttons verwenden die
  Seitenfarbe als Fläche und die Druckfarbe für Schrift oder Icon.
- Buttons mit hartem Retro-Schatten behalten eine schwarze Kontur und einen
  schwarzen Schatten.
- Eingabefelder und große Textflächen bleiben ruhig und kontrastreich.

### Referenz ROUTINEN

- Seitenfarbe: Blueberry `#4B125C`
- Druckfarbe: warmes Creme `#FCEFBB`
- Hero und Kartenköpfe: leicht aufgehelltes Blueberry mit cremefarbener Schrift
- Längere Routinenkarten: Warmweiß mit violetter Schrift
- Kartenkonturen: Creme
- Infoelement und primäre Aktionen: Blueberry mit cremefarbener Schrift
- Ausgewählte Wochentage und Dauern: Blueberry mit cremefarbener Schrift
- App-Header und Dock: Creme statt Reinweiß; Iconschatten bleiben Schwarz
- Kontextmenüs: neutral Weiß/Schwarz; nur Primäraktionen verwenden das Farbpaar

## App-Header und unteres Menü

Header und Dock bilden eine globale Bedienebene und übernehmen nicht die
individuelle Druckfarbe der Inhaltsseite.

- Auf hellen Seiten: nahezu schwarze Schrift, Kontur und Bedienelemente.
- Auf dunklen Seiten: weiße Schrift, Kontur und Bedienelemente.
- Das CAPBOY-Wortzeichen bleibt unverändert. Nur die Silhouette darf auf dunklen
  Seiten weiß werden.
- Originalfarbige Seitenicons behalten ihre Farben.
- Wird ein Icon oder seine Beschriftung weiß dargestellt, bleibt sein harter
  Drop-Shadow trotzdem schwarz. Ein weißer Schatten erzeugt eine unerwünschte
  Doppelkontur.
- Der MENÜ-Button behält sein eigenes originales Farbsystem.

## Kontextmenüs und Formulare

Kontextmenüs sind eine neutrale Systemebene, unabhängig vom Seitentyp.

- Fläche weiß, Kontur schwarz, kein Schlagschatten an der Menükarte.
- Überschrift, Schließen-Icon, Menüeinträge, Beschreibungen und Eintragsicons
  schwarz beziehungsweise neutrales Grau.
- Nur echte primäre Aktionsbuttons wie „Link speichern“, „Notiz speichern“ oder
  „Änderungen speichern“ verwenden das Seitenpaar.
- Diese Aktionsbuttons haben eine Fläche in Seitenfarbe, Schrift und Icons in
  Druckfarbe sowie schwarze Kontur und schwarzen Schlagschatten.
- Sekundäre Menüzeilen werden nicht als farbige Buttons behandelt.

## Technische Zuordnung

Die semantischen Werte werden zentral über die Seiten-Presets gesetzt:

- `--dex-seitenfarbe`: Seitenfarbe
- `--dex-ink`: Druckfarbe der Inhaltsseite
- `--dex-accent`: Fläche primärer Aktionen
- `--dex-accent-ink`: Schrift und Icons auf der Aktionsfläche
- `--cap-card`: Kartenfläche
- `--cap-tint`: leichte Karten- oder Kopfzeilentönung
- `--cap-card-border`: Kartenkontur

Lokale Header- oder Dock-Regeln dürfen `--dex-ink` für die neutrale Bedienebene
überschreiben. Diese lokale Überschreibung darf nicht in Inhaltskarten oder
Kontextmenü-Aktionsbuttons durchsickern.

## Prüfliste für neue Seiten

1. Seite als Grid- oder Hero-Seite klassifizieren.
2. Seitenfarbe und Druckfarbe festlegen und den Textkontrast prüfen.
3. Tapete in Druckfarbe, passender Größe und niedriger Deckkraft einbinden.
4. Inhaltsflächen nach dem passenden Seitentyp gestalten.
5. Konturen und harte Schatten auf Schwarz kontrollieren.
6. Header und Dock anhand der Helligkeit neutral schwarz oder weiß setzen.
7. Kontextmenüs weiß/schwarz halten; nur ihre echten Aktionsbuttons einfärben.
8. Karten, Chips, Ordner, Infoelement, Detailansicht und Speichern-Formulare auf
   verschachtelte Schrift- und Iconfarben prüfen.
9. Mobile Breiten, seitliche Abstände, horizontale Chip-Scrollports und Safe
   Areas kontrollieren.
10. Tests, Produktions-Build und PWA-Build ausführen.
