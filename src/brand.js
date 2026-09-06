// Das CAPBOY-Logo als SVG.
//
// 1:1 aus der LOGMAN-Vorlage uebernommen: gekruemmter Text auf einem textPath,
// Work Sans italic 700, pinke Fuellung mit Navy-Kontur und hartem 4.2px-
// Schatten, dazu zwei halbgrosse Sterne. Statt der Athleten-Silhouette sitzt
// hier eine flache Diskette hinter dem Wort. Alle Diskettenfarben laufen ueber
// eigene CSS-Variablen, damit sich Koerper und Etikett im Darkmode invertieren
// lassen, ohne das SVG anzufassen. Werte stammen aus dem CAPBOY-Editor.
//
// Warum SVG und nicht CSS: Gekruemmter Text laesst sich in CSS nicht setzen.

let seq = 0;

export function capboySvg() {
  const id = 'capbrand' + (++seq);
  // Bogen: identisch zum LOGMAN-Original (viewBox 0 0 380 130, Spanne 298).
  const d = `M 41,96 Q 190,74 339,96`;
  const disk = `<g class="capboy-diskette">
    <path d="M 164,11 L 240,11 L 240,111 L 152,111 L 152,23 Z"
      fill="var(--capboy-body,#001454)"
      stroke="var(--brand-outline,#0A1330)" stroke-width="4" stroke-linejoin="round"/>
    <rect x="169" y="18" width="53" height="24" rx="2" fill="var(--capboy-shutter,#FFFFFF)"/>
    <rect x="210" y="24" width="7" height="14" rx="1" fill="var(--capboy-slot,#001454)"/>
    <rect x="160" y="56" width="72" height="46" rx="3" fill="var(--capboy-label,#FFFFFF)"/>
  </g>`;
  // Schrift-Metriken angeglichen an das LOGMAN-Logo: Font-Groesse 64 laesst
  // die Buchstaben so gross erscheinen wie beim LOGMAN in seiner App, das
  // LOGMAN-Standard-letter-spacing -1.62 haelt sie sauber lesbar (nicht wie
  // beim ersten Editor-Wert -4 aneinandergeklebt), symmetrische Sternluecken
  // 8/7 wie im Original.
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-3">★</tspan>` +
    `<tspan dx="8" dy="3">CAPBOY</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="7" dy="-3">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  // viewBox eng am Inhalt: LOGMAN nutzt 318x85, wir liegen bei 332x106 (die
  // Diskette ist im SVG statt via CSS-::before, deshalb etwas hoeher). Vorher
  // stand hier 380x130 — die Luft skalierte die Buchstaben bei fester CSS-
  // Breite (5.3em) sichtbar kleiner als beim LOGMAN.
  return `<svg class="brand-svg capboy-svg" viewBox="28 9 332 106" role="img" aria-label="CAPBOY">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  ${disk}
  <g font-family="'Work Sans'" font-style="italic" font-weight="700"
     font-size="64" letter-spacing="-1.62" text-anchor="middle"
     stroke="var(--brand-outline,#0A1330)" stroke-width="5.2" stroke-linejoin="round">
    <text transform="translate(4.2,4.2)" fill="var(--brand-outline,#0A1330)">${path}</text>
    <text fill="var(--brand-pink,#FF69AE)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}

export function capboyMarkup() {
  return `<span class="brand">${capboySvg()}</span>`;
}
