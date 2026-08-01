# MUSCLEDEX-ICONS

Der Ordner enthält das vollständige MUSCLEDEX-Iconset. `01_Glocke_Slab.svg`
ist die verbindliche Stilvorlage für Kontur, Vorderfläche und Schlagschatten.

- Vorderfläche: `#FFFFFF`
- Kontur: `#000000`
- Schlagschatten: eigener schwarzer Vektor mit festem Versatz
- Keine Webfont, kein CSS-Filter und keine externe Bibliothek
- Alle SVGs liegen flach in diesem Ordner und sind nach Bereichen benannt
- `KATALOG.json` listet Dateiname, Kategorie und ursprünglichen Iconnamen

Die Vorderflächen sind zunächst einheitlich weiß. Sie lassen sich später im
SVG über die weißen `fill`- bzw. `stroke`-Werte umfärben, ohne Kontur oder
Schlagschatten zu verändern.

Das Set kann mit `node scripts/generate-muscledex-icons.mjs` aus den
Quellgeometrien neu erzeugt werden. Die manuell abgestimmte Masterglocke wird
dabei unverändert übernommen.
