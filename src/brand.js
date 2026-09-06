// Das CAPBOY-Logo als SVG.
//
// 1:1 aus der LOGMAN-Vorlage uebernommen: gekruemmter Text auf einem textPath,
// Work Sans italic 700, pinke Fuellung mit Navy-Kontur und hartem 4.2px-
// Schatten, dazu zwei halbgrosse Sterne. Statt der Athleten-Silhouette sitzt
// hier ein Blatt Papier mit umgeknickter Ecke hinter dem Wort — passt zum
// CAP von "Capture / notieren".

import paperUrl from '../SeitenIcons/Paper.svg';

let seq = 0;

export function capboySvg() {
  const id = 'capbrand' + (++seq);
  // Bogen: identisch zum LOGMAN-Original (viewBox 0 0 380 130, Spanne 298).
  const d = `M 41,96 Q 190,74 339,96`;
  // Paper.svg aus SeitenIcons direkt als <image> eingebettet — dann rendert
  // die geknickte Ecke exakt wie in der Datei entworfen (Falt-Ecke als
  // sichtbares Fenster durch nonzero + gegenlaeufige Windungen). Ein eigener
  // Stroke wuerde die Falt-Ecke ueberdecken; deshalb ohne Kontur. Position
  // 154-232 x 11-111 = 78x100 mittig bei viewBox-Center x=193.
  const disk = `<g class="capboy-blatt">
    <image href="${paperUrl}" x="154" y="11" width="78" height="100"/>
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
