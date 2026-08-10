import { Resvg } from '@resvg/resvg-js';
import { readFile, writeFile } from 'node:fs/promises';

// Eine einzige Quelldatei erzeugt Browser-Favicon, PWA-Icons, Apple-Touch-Icon
// und die weiterhin von Benachrichtigungen verwendeten Kompatibilitaetsnamen.
// Die Versionsnamen verhindern, dass iOS ein altes Homescreen-Icon aus dem
// Manifest-Cache wiederverwendet.
const svg = await readFile(new URL('../App Icon 2.svg', import.meta.url));

for (const name of ['icon.svg', 'app-icon.svg', 'muscledex-app-icon-v3.svg']) {
  await writeFile(new URL(`../public/${name}`, import.meta.url), svg);
}

for (const size of [192, 512]) {
  const png = new Resvg(svg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  await writeFile(new URL(`../public/icon-${size}.png`, import.meta.url), png);
  await writeFile(new URL(`../public/muscledex-icon-${size}-v3.png`, import.meta.url), png);
}
const apple = new Resvg(svg, { fitTo: { mode: 'width', value: 180 } }).render().asPng();
await writeFile(new URL('../public/apple-touch-icon.png', import.meta.url), apple);
await writeFile(new URL('../public/muscledex-apple-touch-icon-v3.png', import.meta.url), apple);
