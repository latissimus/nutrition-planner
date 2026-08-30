// Der MUSCLEDEX-Schriftzug als SVG.
//
// 1:1 aus der LOGMAN-Vorlage (blast-trainer/src/brand.js) uebernommen: gekruemmter
// Text auf einem textPath, Work Sans italic 700, pinke Fuellung mit Navy-Kontur
// und hartem 4.2px-Schatten, dazu zwei halbgrosse Sterne. Statt der Athleten-
// Silhouette sitzt hier eine Navy-Karte (mit kleinem Abwaerts-Dreieck) hinter dem
// Wort – wie im gewuenschten Logo.
//
// Warum SVG und nicht CSS: Gekruemmter Text laesst sich in CSS nicht setzen.
//
// WICHTIG (aus der LOGMAN-Erfahrung): textPath streckt oder bricht Text nicht um –
// Zeichen, die ueber das Pfadende hinausragen, werden ERSATZLOS NICHT gezeichnet.
// "MUSCLEDEX" ist deutlich breiter als "LOGMAN", deshalb ist der Bogen entsprechend
// laenger. Die Masse stammen aus einer echten Work-Sans-Messung (font-size 54,
// letter-spacing -1.62): Wort-Vorschub 322.8, Stern (27) 30.0 -> Gesamtvorschub
// "★ MUSCLEDEX ★" ~397.8. Der Bogen ist auf ~406 Einheiten Laenge ausgelegt (Puffer),
// die Kruemmung proportional zur LOGMAN-Kurve skaliert, damit der Bogen gleich wirkt.
const LIFT = 3;      // wie hoch die Sterne ueber der Grundlinie sitzen
const DX_L = 8;      // Luecke linker Stern -> M
const DX_R = 7;      // Luecke X -> rechter Stern

let seq = 0;

export function brandSvg() {
  const id = 'brandpath' + (++seq);   // mehrere Logos gleichzeitig moeglich
  // Bogen: x 26..426 (Spanne 400), Grundlinie y0=96, Kontrollpunkt hebt die
  // Bogenmitte auf y=37 (Anstieg 29.5, proportional zu LOGMANs 22/298).
  const y0 = 96;
  const d = `M 26,${y0} Q 226,37 426,${y0}`;
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-${LIFT}">★</tspan>` +
    `<tspan dx="${DX_L}" dy="${LIFT}">MUSCLEDEX</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="${DX_R}" dy="-${LIFT}">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  // Karte hinter dem Schriftzug, mittig bei x=226. Navy-Fuellung, dunkle Kontur,
  // unten ein kleines helles Abwaerts-Dreieck (wie im Referenz-Logo).
  const card = `<g class="brand-card">
    <rect x="184" y="6" width="84" height="94" rx="19"
      fill="var(--brand-card-bg,#17224C)" stroke="var(--brand-outline)" stroke-width="4" stroke-linejoin="round"/>
    <path d="M 214,74 H 238 L 226,88 Z" fill="var(--brand-card-mark,#F1ECDE)"/>
  </g>`;
  // viewBox eng am Inhalt: x 18..440, y 3..105 (Karte, Bogen, Schatten).
  // Farben ueber CSS-Variablen, damit das Logo den Theme-Wechsel mitmacht.
  return `<svg class="brand-svg" viewBox="18 3 422 102" role="img" aria-label="MUSCLEDEX">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  ${card}
  <g font-family="'Work Sans'" font-style="italic" font-weight="700"
     font-size="54" letter-spacing="-1.62" text-anchor="middle"
     stroke="var(--brand-outline)" stroke-width="5.2" stroke-linejoin="round">
    <text transform="translate(4.2,4.2)" fill="var(--brand-outline)">${path}</text>
    <text fill="var(--brand-pink,#FF69AE)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}

export function brandMarkup() {
  return `<span class="brand">${brandSvg()}</span>`;
}

export function headerBrandMarkup() {
  return `<span class="brand">${brandSvg()}</span>`;
}
