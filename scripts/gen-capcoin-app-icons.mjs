import { Resvg } from '@resvg/resvg-js';
import ffmpegPath from 'ffmpeg-static';
import { execFile } from 'node:child_process';
import { readFile, unlink, writeFile } from 'node:fs/promises';
import { fileURLToPath } from 'node:url';
import { promisify } from 'node:util';

const run = promisify(execFile);

const source = await readFile(new URL('../SeitenIcons/CAPCOIN.svg', import.meta.url));
const coinPng = new Resvg(source, { fitTo: { mode: 'width', value: 800 } }).render().asPng();
const coinData = coinPng.toString('base64');

// Vollflächiger Hintergrund: Betriebssysteme dürfen ihre eigene Icon-Maske
// anwenden, ohne dass transparente oder doppelt gerundete Ecken entstehen.
const iconSvg = `<svg xmlns="http://www.w3.org/2000/svg" width="1024" height="1024" viewBox="0 0 1024 1024">
  <defs>
    <filter id="capcoin-shadow" x="-30%" y="-30%" width="180%" height="180%" color-interpolation-filters="sRGB">
      <feDropShadow dx="28" dy="28" stdDeviation="0" flood-color="#000000" flood-opacity="1"/>
    </filter>
  </defs>
  <rect width="1024" height="1024" fill="#432C5E"/>
  <image href="data:image/png;base64,${coinData}" x="152" y="142" width="720" height="720" filter="url(#capcoin-shadow)"/>
</svg>`;

await writeFile(new URL('../public/capboy-app-icon-v7.svg', import.meta.url), iconSvg);
for (const [name, size] of [
  ['capboy-icon-192-v7.png', 192],
  ['capboy-icon-512-v7.png', 512],
  ['capboy-apple-touch-icon-v7.png', 180],
  ['apple-touch-icon.png', 180],
]) {
  const png = new Resvg(iconSvg, { fitTo: { mode: 'width', value: size } }).render().asPng();
  const outputUrl = new URL(`../public/${name}`, import.meta.url);
  const rgbaUrl = new URL(`../public/.${name}.rgba.png`, import.meta.url);
  await writeFile(rgbaUrl, png);
  await run(ffmpegPath, [
    '-y',
    '-i', fileURLToPath(rgbaUrl),
    '-frames:v', '1',
    '-pix_fmt', 'rgb24',
    '-update', '1',
    fileURLToPath(outputUrl),
  ]);
  await unlink(rgbaUrl);
}
