import { readdir, readFile, writeFile } from 'node:fs/promises';
import { join } from 'node:path';

const directory = join(process.cwd(), 'MUSCLEDEX-ICONS', 'Neuer Ordner');
const files = (await readdir(directory)).filter((file) => file.endsWith('.svg'));

function outlineCopy(markup, outlineWidth) {
  return markup
    .replace('data-part="face"', 'data-part="outline"')
    .replaceAll('#FFFFFF', '#000000')
    .replaceAll('#fff', '#000000')
    .replace(/stroke-width="[^"]+"/g, `stroke-width="${outlineWidth}"`);
}

for (const file of files) {
  const path = join(directory, file);
  let svg = await readFile(path, 'utf8');
  if (svg.includes('data-part="outline"')) continue;

  const large = /viewBox="0 0 64 64"/.test(svg);
  const outlineWidth = large ? 9 : 4.4;
  const faceWidth = large ? 4.5 : 2.25;
  const shadowWidth = large ? 10 : 5;
  const shadowTransform = large ? 'translate(2.3 2.6)' : 'translate(1.1 1.25)';

  svg = svg.replace(/<g data-part="shadow"[^>]*>/g, (tag) => tag
    .replace(/transform="[^"]+"/, `transform="${shadowTransform}"`)
    .replace(/stroke-width="[^"]+"/, `stroke-width="${shadowWidth}"`));

  svg = svg.replace(/(\s*)(<g data-part="face"[\s\S]*?<\/g>)/g, (all, space, face) => {
    const normalizedFace = face
      .replace(/fill="(?:#fff|#FFFFFF|#000)"/, 'fill="#FFFFFF"')
      .replace(/stroke="(?:#000000|#000|#fff|#FFFFFF)"/, 'stroke="#FFFFFF"')
      .replace(/stroke-width="[^"]+"/g, `stroke-width="${faceWidth}"`);
    return `${space}${outlineCopy(normalizedFace, outlineWidth)}${space}${normalizedFace}`;
  });

  svg = svg.replace(/(\s*)(<(?:path|rect|circle) data-part="face"[^>]*\/>)/g, (all, space, face) => {
    const normalizedFace = face
      .replace(/fill="(?:#fff|#FFFFFF|#000)"/, 'fill="#FFFFFF"')
      .replace(/stroke="(?:#000000|#000|#fff|#FFFFFF)"/, 'stroke="#FFFFFF"')
      .replace(/stroke-width="[^"]+"/g, `stroke-width="${faceWidth}"`);
    return `${space}${outlineCopy(normalizedFace, outlineWidth)}${space}${normalizedFace}`;
  });

  await writeFile(path, svg);
}

console.log(`${files.length} SVG-Dateien geprüft und fehlende Außenkonturen ergänzt.`);
