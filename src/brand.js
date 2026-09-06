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
  // Bogen: LOGMAN-Spanne, Anstieg 28 (statt LOGMAN-Original 22) — spuerbar
  // staerker gekruemmt, damit der Text mehr Charakter hat.
  const d = `M 41,96 Q 190,68 339,96`;
  // Paper.svg aus SeitenIcons direkt als <image> eingebettet — dann rendert
  // die geknickte Ecke exakt wie in der Datei entworfen (Falt-Ecke als
  // sichtbares Fenster durch nonzero + gegenlaeufige Windungen). Ein eigener
  // Stroke wuerde die Falt-Ecke ueberdecken; deshalb ohne Kontur.
  // Der weisse Rechteck-Backing haelt genau die Papiergroesse — sichtbar wird
  // er nur da, wo die Falt-Ecke des Blatts durchsichtig ist. Ergebnis: der
  // Knick erscheint weiss statt "Seitenhintergrund". Im Darkmode dreht ein
  // eigener CSS-Filter das Backing auf Navy (siehe styles.css).
  // Weisses Backing sitzt nur unter der Falt-Ecke oben rechts (die einzige
  // Stelle, an der das Paper.svg transparent ist). Vollflaechig-Backing hatte
  // sub-pixel ueber die abgerundeten Papierkanten geleuchtet.
  const disk = `<g class="capboy-blatt">
    <rect class="capboy-knick" x="209" y="4" width="30" height="34" fill="#FFFFFF"/>
    <image href="${paperUrl}" x="160" y="2" width="86" height="108"/>
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
