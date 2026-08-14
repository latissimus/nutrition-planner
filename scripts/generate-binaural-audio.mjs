import { mkdir } from 'node:fs/promises';
import { dirname, join, resolve } from 'node:path';
import { spawn } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const root = resolve(dirname(fileURLToPath(import.meta.url)), '..');
const outputDir = join(root, 'Meditate Music');
const ffmpeg = (await import('ffmpeg-static')).default;
const duration = 300;

const tracks = [
  {
    filename: 'Binaural Theta Ruhe.m4a',
    left: 174,
    right: 180,
    noise: 'pink',
    tremolo: 0.1,
  },
  {
    filename: 'Binaural Alpha Fokus.m4a',
    left: 210,
    right: 220,
    noise: 'brown',
    tremolo: 0.12,
  },
];

function run(args) {
  return new Promise((resolveRun, rejectRun) => {
    const child = spawn(ffmpeg, args, { stdio: 'inherit' });
    child.once('error', rejectRun);
    child.once('exit', (code) => code === 0
      ? resolveRun()
      : rejectRun(new Error(`FFmpeg endete mit Code ${code}.`)));
  });
}

await mkdir(outputDir, { recursive: true });

for (const track of tracks) {
  const leftSub = track.left / 2;
  const rightSub = track.right / 2;
  const filter = [
    `[0:a]volume=0.075,tremolo=f=${track.tremolo}:d=0.18[lc]`,
    `[1:a]volume=0.075,tremolo=f=${track.tremolo}:d=0.18[rc]`,
    '[2:a]volume=0.022[ls]',
    '[3:a]volume=0.022[rs]',
    '[4:a]highpass=f=45,lowpass=f=1200,volume=0.025,asplit=2[nl][nr]',
    '[lc][ls][nl]amix=inputs=3:normalize=0,alimiter=limit=0.45,aformat=sample_fmts=fltp:channel_layouts=mono[l]',
    '[rc][rs][nr]amix=inputs=3:normalize=0,alimiter=limit=0.45,aformat=sample_fmts=fltp:channel_layouts=mono[r]',
    '[l][r]amerge=inputs=2,pan=stereo|c0=c0|c1=c1[out]',
  ].join(';');

  await run([
    '-hide_banner', '-loglevel', 'error', '-y',
    '-f', 'lavfi', '-i', `sine=frequency=${track.left}:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `sine=frequency=${track.right}:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `sine=frequency=${leftSub}:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `sine=frequency=${rightSub}:duration=${duration}:sample_rate=44100`,
    '-f', 'lavfi', '-i', `anoisesrc=color=${track.noise}:amplitude=0.12:duration=${duration}:sample_rate=44100`,
    '-filter_complex', filter,
    '-map', '[out]', '-vn', '-c:a', 'aac', '-b:a', '96k', '-movflags', '+faststart',
    join(outputDir, track.filename),
  ]);
  console.log(`Erstellt: ${track.filename}`);
}
