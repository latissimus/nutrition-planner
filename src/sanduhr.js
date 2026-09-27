// Sanduhr und Wartetext aller Coach-Seiten.
//
// Die Sanduhr ist das frühere GIF als Pixel-SVG (30 × 40 Raster): Der Sand
// rieselt gleichmäßig nach unten, dann dreht sich die Uhr sanft um. Sie ist
// punktsymmetrisch, und der volle untere Sand liegt nach der Drehung genau
// vier Pixel über dem Sand im Trichter. Jede Runde beginnt deshalb damit, dass
// der Sand diese vier Pixel in den Trichter fällt; so schließt die Schleife
// ohne Sprung. Eine SMIL-Zeitleiste hält Sand und Drehung im Takt und läuft
// auch in Safari. Bei "Bewegung reduzieren" steht die Sanduhr still.

import { escapeHtml } from './coachFenster.js';

const DAUER = '2.8s';
const KONTUR = 'M0 0h30v2h-30zM0 2h4v2h-4zM26 2h4v2h-4zM0 4h30v2h-30zM2 6h2v4h-2zM26 6h2v4h-2zM2 10h3v1h-3zM25 10h3v1h-3zM3 11h2v1h-2zM25 11h2v1h-2zM3 12h4v1h-4zM23 12h4v1h-4zM5 13h2v1h-2zM23 13h2v1h-2zM5 14h4v1h-4zM21 14h4v1h-4zM7 15h2v1h-2zM21 15h2v1h-2zM7 16h4v1h-4zM19 16h4v1h-4zM9 17h2v1h-2zM19 17h2v1h-2zM9 18h4v1h-4zM17 18h4v1h-4zM11 19h2v2h-2zM17 19h2v2h-2zM9 21h4v1h-4zM17 21h4v1h-4zM9 22h2v1h-2zM19 22h2v1h-2zM7 23h4v1h-4zM19 23h4v1h-4zM7 24h2v1h-2zM21 24h2v1h-2zM5 25h4v1h-4zM21 25h4v1h-4zM5 26h2v1h-2zM23 26h2v1h-2zM3 27h4v1h-4zM23 27h4v1h-4zM3 28h2v1h-2zM25 28h2v1h-2zM2 29h3v1h-3zM25 29h3v1h-3zM2 30h2v4h-2zM26 30h2v4h-2zM0 34h30v2h-30zM0 36h4v2h-4zM26 36h4v2h-4zM0 38h30v2h-30z';
const SAND_OBEN = 'M8 10h2v2h-2zM12 10h2v2h-2zM16 10h2v2h-2zM20 10h2v2h-2zM10 12h2v2h-2zM14 12h2v2h-2zM18 12h2v2h-2zM12 14h2v2h-2zM16 14h2v2h-2zM14 16h2v2h-2z';
const SAND_UNTEN = 'M14 26h2v2h-2zM12 28h2v2h-2zM16 28h2v2h-2zM10 30h2v2h-2zM14 30h2v2h-2zM18 30h2v2h-2zM8 32h2v2h-2zM12 32h2v2h-2zM16 32h2v2h-2zM20 32h2v2h-2z';

let nummer = 0;
const wenigerBewegung = () => typeof matchMedia === 'function' && matchMedia('(prefers-reduced-motion: reduce)').matches;

export function sanduhrMarkup(klasse = '') {
  const kopf = `<svg class="sanduhr${klasse ? ` ${klasse}` : ''}" viewBox="0 0 30 40" fill="currentColor" shape-rendering="crispEdges" aria-hidden="true" focusable="false">`;
  if (wenigerBewegung()) return `${kopf}<path d="${KONTUR}${SAND_OBEN}"/></svg>`;
  nummer += 1;
  const id = `sanduhr-${nummer}`;
  const zeit = `dur="${DAUER}" repeatCount="indefinite"`;
  // Takt einer Runde: 0–0,1 Sand fällt in den Trichter, 0,1–0,72 rieselt er
  // durch, 0,75–1 dreht sich die Uhr.
  return `${kopf}<defs>`
    + `<clipPath id="${id}-oben"><rect x="0" y="6" width="30" height="12">`
    + `<animate attributeName="y" values="6;6;10;18;18" keyTimes="0;0.1;0.101;0.72;1" ${zeit}/>`
    + `<animate attributeName="height" values="12;12;8;0;0" keyTimes="0;0.1;0.101;0.72;1" ${zeit}/></rect></clipPath>`
    + `<clipPath id="${id}-unten"><rect x="0" y="34" width="30" height="0">`
    + `<animate attributeName="y" values="34;34;26;26" keyTimes="0;0.1;0.72;1" ${zeit}/>`
    + `<animate attributeName="height" values="0;0;8;8" keyTimes="0;0.1;0.72;1" ${zeit}/></rect></clipPath></defs>`
    + `<g><animateTransform attributeName="transform" type="rotate" values="0 15 20;0 15 20;180 15 20" keyTimes="0;0.75;1" calcMode="spline" keySplines="0 0 1 1;0.45 0 0.2 1" ${zeit}/>`
    + `<path d="${KONTUR}"/>`
    + `<g clip-path="url(#${id}-oben)"><path d="${SAND_OBEN}"><animateTransform attributeName="transform" type="translate" values="0 -4;0 0;0 0" keyTimes="0;0.1;1" calcMode="spline" keySplines="0.55 0 1 0.45;0 0 1 1" ${zeit}/></path></g>`
    + `<g clip-path="url(#${id}-unten)"><path d="${SAND_UNTEN}"/></g>`
    + `<line x1="15" y1="18" x2="15" y2="34" stroke="currentColor" stroke-width="2" stroke-dasharray="2 2" opacity="0">`
    + `<animate attributeName="opacity" values="0;0;1;1;0;0" keyTimes="0;0.1;0.12;0.7;0.72;1" ${zeit}/>`
    + `<animate attributeName="y2" values="34;34;26;26" keyTimes="0;0.1;0.72;1" ${zeit}/>`
    + `<animate attributeName="stroke-dashoffset" values="4;0" dur="0.32s" repeatCount="indefinite"/></line></g></svg>`;
}

// Wartetext, der sanft pulsiert und nach einer Weile in den zweiten Text
// übergeht ("… denkt noch ein bisschen nach"). Beide liegen übereinander, so
// ändert das Fenster seine Breite beim Wechsel nicht. Vorgelesen wird nur der
// erste Text.
export function wartetextMarkup(text, spaeter) {
  return `<span class="wartetext"><span>${escapeHtml(text)}</span><span aria-hidden="true">${escapeHtml(spaeter)}</span></span>`;
}
