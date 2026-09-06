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
  // Bogen: LOGMAN-Spanne, Anstieg 34 (LOGMAN-Original war 22) — deutlich
  // staerker gekruemmt, damit der Text richtig schwingt.
  const d = `M 41,96 Q 190,62 339,96`;
  // Paper.svg aus SeitenIcons direkt als <image> eingebettet — dann rendert
  // die geknickte Ecke exakt wie in der Datei entworfen (Falt-Ecke als
  // sichtbares Fenster durch nonzero + gegenlaeufige Windungen). Ein eigener
  // Stroke wuerde die Falt-Ecke ueberdecken; deshalb ohne Kontur.
  // Der weisse Rechteck-Backing haelt genau die Papiergroesse — sichtbar wird
  // er nur da, wo die Falt-Ecke des Blatts durchsichtig ist. Ergebnis: der
  // Knick erscheint weiss statt "Seitenhintergrund". Im Darkmode dreht ein
  // eigener CSS-Filter das Backing auf Navy (siehe styles.css).
  // Weisser Knick sitzt exakt im inneren Falt-Dreieck des Blatts (die
  // Rueckseite des umgeknickten Zipfels). Der diagonale Eck-Schnitt daneben
  // bleibt transparent — sonst wird das Blatt optisch zum vollen Rechteck
  // "ergaenzt" und der Faltcharakter verschwindet.
  const disk = `<g class="capboy-blatt">
    <polygon class="capboy-knick" points="195,10 220,35 196,35" fill="#FFFFFF"/>
    <image href="${paperUrl}" x="156" y="8" width="68" height="86"/>
  </g>`;
  // Schrift-Metriken angeglichen an das LOGMAN-Logo: Die leicht groessere
  // Wortmarke bleibt vor dem nun kompakteren Blatt klarer Hauptdarsteller.
  // Y und der rechte Stern werden gezielt nach links gezogen: das kursive Y
  // hinterlaesst rechts eine grosse optische Luecke, deren Ausgleich einen
  // negativen dx vor dem Y und ein deutlich reduziertes dx vor dem Stern
  // braucht. So sitzt der Stern rechts wieder symmetrisch zum linken.
  const txt =
    `<tspan font-size="28" stroke-width="3.1" dy="-7">★</tspan>` +
    `<tspan dx="5" dy="7">CAPBO</tspan>` +
    `<tspan dx="-4">Y</tspan>` +
    `<tspan font-size="28" stroke-width="3.1" dx="-4" dy="-7">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  // Der ViewBox ist optisch auf die Wortmitte zentriert und vertikal enger als
  // zuvor. So verschenkt das kleinere Blatt im Header keine Leerflaeche.
  return `<svg class="brand-svg capboy-svg" viewBox="24 9 332 98" role="img" aria-label="CAPBOY">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  ${disk}
  <g font-family="'Work Sans'" font-style="italic" font-weight="700"
     font-size="66" letter-spacing="-1.72" text-anchor="middle"
     stroke="var(--brand-outline,#0A1330)" stroke-width="5" stroke-linejoin="round">
    <text transform="translate(3.8,3.8)" fill="var(--brand-outline,#0A1330)">${path}</text>
    <text fill="var(--brand-pink,#FF69AE)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}

export function capboyMarkup() {
  return `<span class="brand">${capboySvg()}</span>`;
}
