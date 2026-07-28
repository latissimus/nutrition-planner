import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';

const svg = await readFile(new URL('../public/icon.svg', import.meta.url));
for (const size of [192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`../public/icon-${size}.png`, import.meta.url), png);
}
const apple = new Resvg(svg, { fitTo: { mode: 'width', value: 180 } }).render().asPng();
await writeFile(new URL('../public/apple-touch-icon.png', import.meta.url), apple);
