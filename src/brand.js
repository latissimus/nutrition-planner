// Das CAPBOY-Logo als SVG.
//
// 1:1 aus der LOGMAN-Vorlage uebernommen: gekruemmter Text auf einem textPath,
// Work Sans italic 700, pinke Fuellung mit Navy-Kontur und hartem 4.2px-
// Schatten, dazu zwei halbgrosse Sterne. Statt der Athleten-Silhouette sitzt
// hier ein Blatt Papier mit umgeknickter Ecke hinter dem Wort — passt zum
// CAP von "Capture / notieren". Die Papierfarbe laeuft ueber --capboy-body,
// damit sich das Blatt im Darkmode invertieren laesst.
//
// Warum SVG und nicht CSS: Gekruemmter Text laesst sich in CSS nicht setzen.

let seq = 0;

export function capboySvg() {
  const id = 'capbrand' + (++seq);
  // Bogen: identisch zum LOGMAN-Original (viewBox 0 0 380 130, Spanne 298).
  const d = `M 41,96 Q 190,74 339,96`;
  // Papier hinter dem Wort: einfache Rechteck-Silhouette mit klar sichtbarer
  // Ecke oben rechts, hand-gezeichnet statt gescaltes Noun-SVG (dort war das
  // Falt-Dreieck bei kleiner Skalierung kaum lesbar). Koerper 80x100 mittig
  // bei viewBox-Center x=194, Falt-Ecke 22 Einheiten gross — deutlich
  // erkennbar als abgeknickter Papierrand.
  const disk = `<g class="capboy-blatt">
    <path d="M 154,111 L 232,111 L 232,33 L 210,11 L 154,11 Z"
      fill="var(--capboy-body,#001454)"
      stroke="var(--brand-outline,#0A1330)" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 210,11 L 210,33 L 232,33"
      fill="none"
      stroke="var(--brand-outline,#0A1330)" stroke-width="4" stroke-linejoin="round" stroke-linecap="round"/>
  </g>`;
  // Schrift-Metriken angeglichen an das LOGMAN-Logo: Font-Groesse 64 laesst
  // die Buchstaben so gross erscheinen wie beim LOGMAN in seiner App, das
  // LOGMAN-Standard-letter-spacing -1.62 haelt sie sauber lesbar.
  // Y und der rechte Stern werden gezielt nach links gezogen: das kursive Y
  // hinterlaesst rechts eine grosse optische Luecke, deren Ausgleich einen
  // negativen dx vor dem Y und ein deutlich reduziertes dx vor dem Stern
  // braucht. So sitzt der Stern rechts wieder symmetrisch zum linken.
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-3">★</tspan>` +
    `<tspan dx="8" dy="3">CAPBO</tspan>` +
    `<tspan dx="-4">Y</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="-2" dy="-3">★</tspan>`;
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
