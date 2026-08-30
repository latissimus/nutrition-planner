const BOUNDS = { left: 34, right: 8, top: 10, bottom: 18 };

const pathFrom = (points) =>
  points.map((point, index) => `${index ? 'L' : 'M'}${point.x.toFixed(1)},${point.y.toFixed(1)}`).join(' ');

export function curveSvg(series, { height = 130, unit = '' } = {}) {
  const all = series.flatMap((item) => item.values);
  const longest = Math.max(0, ...series.map((item) => item.values.length));
  if (longest < 2) {
    return `<div class="kurve-leer">Noch zu wenig Daten für einen Verlauf.<br>
      <span>Ab der zweiten Messung erscheint hier die Kurve.</span></div>`;
  }

  const width = 300;
  const time = (point) => new Date(`${point.datum}T12:00:00`).getTime();
  const t0 = Math.min(...all.map(time));
  const t1 = Math.max(...all.map(time));
  let min = Math.min(...all.map((point) => point.wert));
  let max = Math.max(...all.map((point) => point.wert));
  const span = max - min || Math.max(1, max * 0.02);
  min -= span * 0.15;
  max += span * 0.15;

  const x = (point) =>
    BOUNDS.left + (t1 === t0
      ? (width - BOUNDS.left - BOUNDS.right) / 2
      : ((time(point) - t0) / (t1 - t0)) * (width - BOUNDS.left - BOUNDS.right));
  const y = (value) =>
    BOUNDS.top + (1 - (value - min) / (max - min)) * (height - BOUNDS.top - BOUNDS.bottom);
  const format = (value) => (Math.round(value * 10) / 10).toString().replace('.', ',');
  const date = (timestamp) => new Date(timestamp).toLocaleDateString('de-DE', { day: '2-digit', month: '2-digit' });

  const lines = series.filter((item) => item.values.length >= 2).map((item) => {
    const points = item.values.map((point) => ({ x: x(point), y: y(point.wert) }));
    const circles = item.points
      ? points.map((point) => `<circle cx="${point.x.toFixed(1)}" cy="${point.y.toFixed(1)}" r="2.5" class="k-pt ${item.className}"/>`).join('')
      : '';
    return `<path d="${pathFrom(points)}" class="k-linie ${item.className}"/>${circles}`;
  }).join('');

  return `<svg class="kurve" viewBox="0 0 ${width} ${height}" preserveAspectRatio="none" role="img"
    aria-label="Verlauf von ${format(all[0].wert)} bis ${format(all[all.length - 1].wert)} ${unit}">
    <line x1="${BOUNDS.left}" y1="${y(max)}" x2="${width - BOUNDS.right}" y2="${y(max)}" class="k-raster"/>
    <line x1="${BOUNDS.left}" y1="${y(min)}" x2="${width - BOUNDS.right}" y2="${y(min)}" class="k-raster"/>
    <text x="${BOUNDS.left - 4}" y="${y(max) + 3}" class="k-achse" text-anchor="end">${format(max)}</text>
    <text x="${BOUNDS.left - 4}" y="${y(min) + 3}" class="k-achse" text-anchor="end">${format(min)}</text>
    <text x="${BOUNDS.left}" y="${height - 5}" class="k-achse">${date(t0)}</text>
    <text x="${width - BOUNDS.right}" y="${height - 5}" class="k-achse" text-anchor="end">${date(t1)}</text>
    ${lines}
  </svg>`;
}
