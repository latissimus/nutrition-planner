// Das CAPBOY-Logo als SVG. Wortgeometrie und Athleten-Silhouette entsprechen
// bewusst der LOGMAN-Marke: Beide Apps gehoeren sichtbar zusammen, waehrend
// der eigene Name die Marke unterscheidet.

let seq = 0;

export function capboySvg() {
  const id = 'capbrand' + (++seq);
  const d = `M 26,96 Q 175,52 324,96`;
  const txt =
    `<tspan font-size="27" stroke-width="3.1" dy="-3">★</tspan>` +
    // LOGMAN enthaelt mit dem M einen deutlich breiteren Buchstaben. Eine
    // leicht offenere Laufweite gibt CAPBOY dieselbe optische Praesenz, ohne
    // Schrift oder Silhouette horizontal zu verzerren.
    `<tspan dx="8" dy="3" letter-spacing="0.2">CAPBOY</tspan>` +
    `<tspan font-size="27" stroke-width="3.1" dx="7" dy="-3">★</tspan>`;
  const path = `<textPath href="#${id}" startOffset="50%">${txt}</textPath>`;
  return `<svg class="brand-svg capboy-svg" viewBox="18 19 318 85" role="img" aria-label="CAPBOY">
  <defs><path id="${id}" d="${d}" fill="none"/></defs>
  <g font-family="'Work Sans'" font-style="italic" font-weight="700"
     font-size="54" letter-spacing="-1.62" text-anchor="middle"
     stroke="var(--brand-outline,#0A1330)" stroke-width="5.2" stroke-linejoin="round">
    <text transform="translate(4.2,4.2)" fill="var(--brand-outline,#0A1330)">${path}</text>
    <text fill="var(--brand-pink,#FF69AE)" paint-order="stroke fill">${path}</text>
  </g>
</svg>`;
}

export function capboyMarkup() {
  return `<span class="brand">${capboySvg()}</span>`;
}
