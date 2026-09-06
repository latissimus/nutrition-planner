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
  // Papier-Silhouette (noun_Paper_8203947): 459x563 Ausgangsgroesse. Mit
  // scale(0.19) ~72x102 im Ziel, per translate mittig bei x=190. Ecke oben
  // rechts ist umgeknickt — das einzige Detail, sonst ruhige Flaeche.
  // vector-effect:non-scaling-stroke haelt die Kontur bei allen App-Groessen
  // gleich stark, statt sie mit dem scale(0.19) mitzuschrumpfen.
  const disk = `<g class="capboy-blatt" transform="translate(150.29 8.72) scale(0.19)">
    <path fill-rule="evenodd"
      fill="var(--capboy-body,#001454)"
      stroke="var(--brand-outline,#0A1330)" stroke-width="4" stroke-linejoin="round"
      vector-effect="non-scaling-stroke"
      d="M430.208,169.784c-0.099,-0.697 -0.298,-1.294 -0.597,-1.891c-0.398,-1.195 -1.194,-2.289 -2.189,-3.285l-149.188,-149.187c-1.891,-1.891 -4.479,-2.886 -7.067,-2.886l-233.284,-0c-5.474,-0 -9.953,4.478 -9.953,9.952l0,517.526c0,5.474 4.479,9.952 9.953,9.952l382.568,0c5.474,0 9.952,-4.478 9.952,-9.952l0,-368.338c0,-0.697 0,-1.294 -0.199,-1.891l0.004,-0Zm-158.939,11.843c-5.474,0 -9.953,-4.478 -9.953,-9.952l0,-139.232l5.773,-0l143.417,143.417l-0,5.772l-139.237,-0.005Z"/>
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
