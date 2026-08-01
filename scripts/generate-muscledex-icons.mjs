import fs from 'node:fs';
import path from 'node:path';

const project = process.cwd();
const sourceRoot = path.join(project, 'public', 'icons');
const outputRoot = path.join(project, 'MUSCLEDEX-ICONS');
const manifest = JSON.parse(fs.readFileSync(path.join(sourceRoot, 'manifest.json'), 'utf8'));
const masterBell = fs.readFileSync(path.join(outputRoot, '01_Glocke_Slab.svg'), 'utf8');

const groupLabels = {
  categories: 'Kategorie',
  food: 'Essen',
  health: 'Gesundheit',
  ui: 'UI',
};

function escapeXml(value) {
  return value.replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;');
}

function titleFrom(svg, fallback) {
  return svg.match(/<title>([^<]+)<\/title>/)?.[1] || fallback;
}

function graphicFrom(svg) {
  return svg
    .replace(/^.*?<svg[^>]*>/s, '')
    .replace(/<\/svg>\s*$/s, '')
    .replace(/<title>.*?<\/title>/s, '')
    .trim();
}

function paintPaths(markup, color) {
  return markup.replace(/<path\s+d="([^"]+)"([^>]*)\/>/g, (_, d, rest) => {
    const fill = /z/i.test(d) ? color : 'none';
    return `<path d="${d}" fill="${fill}"${rest}/>`;
  });
}

function slabSvg(sourceSvg, title) {
  const graphic = graphicFrom(sourceSvg);
  const shadow = paintPaths(graphic, '#000000');
  const face = paintPaths(graphic, '#FFFFFF');
  const hasClosedGraphic = /<(circle|rect)\b/i.test(graphic)
    || /<path\s+d="[^"]*[zZ][^"]*"/i.test(graphic);

  if (!hasClosedGraphic) {
    return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-3 -3 31 31" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <g data-part="shadow" transform="translate(1.1 1.25)" fill="none" stroke="#000000" stroke-width="5" stroke-linecap="round" stroke-linejoin="round">
    ${graphic}
  </g>
  <g data-part="outline" fill="none" stroke="#000000" stroke-width="4.4" stroke-linecap="round" stroke-linejoin="round">
    ${graphic}
  </g>
  <g data-part="face" fill="none" stroke="#FFFFFF" stroke-width="2.25" stroke-linecap="round" stroke-linejoin="round">
    ${graphic}
  </g>
</svg>
`;
  }

  return `<svg xmlns="http://www.w3.org/2000/svg" viewBox="-2 -2 29 29" role="img" aria-label="${escapeXml(title)}">
  <title>${escapeXml(title)}</title>
  <g data-part="shadow" transform="translate(1.1 1.25)" fill="#000000" stroke="#000000" stroke-width="3.4" stroke-linecap="round" stroke-linejoin="round">
    ${shadow}
  </g>
  <g data-part="face" fill="#FFFFFF" stroke="#000000" stroke-width="2.6" stroke-linecap="round" stroke-linejoin="round">
    ${face}
  </g>
</svg>
`;
}

const catalog = [];
for (const [group, names] of Object.entries(manifest.groups)) {
  for (const name of names) {
    const sourcePath = path.join(sourceRoot, group, `${name}.svg`);
    const sourceSvg = fs.readFileSync(sourcePath, 'utf8');
    const title = titleFrom(sourceSvg, name);
    const fileName = `${groupLabels[group]}_${name}.svg`;
    const targetPath = path.join(outputRoot, fileName);
    const isBell = name === 'bell' || (group === 'categories' && name === 'reminders');
    fs.writeFileSync(targetPath, isBell ? masterBell : slabSvg(sourceSvg, title));
    catalog.push({ group, name, title, file: fileName });
  }
}

const catalogData = {
  version: 1,
  style: 'slab-shadow',
  face: '#FFFFFF',
  shadow: '#000000',
  icons: catalog,
};
fs.writeFileSync(path.join(outputRoot, 'KATALOG.json'), `${JSON.stringify(catalogData, null, 2)}\n`);
console.log(`${catalog.length} MUSCLEDEX-Icons erzeugt.`);
