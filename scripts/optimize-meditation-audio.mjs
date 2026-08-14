import { access, mkdir, readdir, rename, stat } from 'node:fs/promises';
import { basename, dirname, extname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const musicDir = join(root, 'Meditate Music');
const originalsDir = join(musicDir, '.originals');
const cueNames = new Set([
  'Meditation Beginn.mp3', 'Meditation Ende.mp3',
  'Routine Beginn.mp3', 'Routine Ende.mp3',
]);

async function ffmpegPath() {
  if (process.env.FFMPEG_PATH) return process.env.FFMPEG_PATH;
  try { return (await import('ffmpeg-static')).default; }
  catch {
    throw new Error('FFmpeg fehlt. Vorübergehend mit „npm install --no-save ffmpeg-static“ installieren.');
  }
}

function run(command, args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(command, args, { stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('exit', (code) => code === 0 ? resolveRun() : rejectRun(new Error(`FFmpeg endete mit Code ${code}.`)));
  });
}

const argumentsList = process.argv.slice(2);
const requested = argumentsList.length ? argumentsList : (await readdir(musicDir))
  .filter((name) => extname(name).toLowerCase() === '.mp3' && !cueNames.has(name))
  .map((name) => join('Meditate Music', name));
if (!requested.length) {
  console.log('Keine neuen Meditations-MP3-Dateien gefunden.');
  process.exit(0);
}
await mkdir(originalsDir, { recursive: true });
const ffmpeg = await ffmpegPath();

for (const relative of requested) {
  const input = resolve(root, relative);
  if (!input.startsWith(`${musicDir}/`) || extname(input).toLowerCase() !== '.mp3') {
    throw new Error(`Keine gültige Musikdatei: ${relative}`);
  }
  const name = basename(input);
  if (cueNames.has(name)) {
    console.log(`Übersprungen (Start-/Endklang): ${name}`);
    continue;
  }
  await access(input);
  const output = input.slice(0, -4) + '.m4a';
  const temporary = `${output}.tmp.m4a`;
  await run(ffmpeg, [
    '-hide_banner', '-loglevel', 'error', '-y', '-i', input,
    '-map_metadata', '-1', '-vn', '-c:a', 'aac', '-b:a', '96k',
    '-movflags', '+faststart', temporary,
  ]);
  const result = await stat(temporary);
  if (result.size < 1024) throw new Error(`Ausgabedatei ist unvollständig: ${name}`);
  await rename(temporary, output);
  await rename(input, join(originalsDir, name));
  console.log(`Optimiert: ${name} → ${basename(output)}`);
}
