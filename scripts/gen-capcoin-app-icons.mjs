import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';

// Das freigegebene App-Symbol ist die alleinige Quelle. Es enthält bereits
// Hintergrund, Motiv und Schatten und darf beim Export nicht neu komponiert werden.
const iconSvg = await readFile(new URL('../CAPCOINAPPSYMBOL.svg', import.meta.url), 'utf8');

await writeFile(new URL('../public/capboy-app-icon-v9.svg', import.meta.url), iconSvg);
for (const [name, size] of [
  ['capboy-icon-192-v9.png', 192],
  ['capboy-icon-512-v9.png', 512],
  ['capboy-apple-touch-icon-v9.png', 180],
  ['apple-touch-icon.png', 180],
]) {
  const png = new Resvg(iconSvg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`../public/${name}`, import.meta.url), png);
}
