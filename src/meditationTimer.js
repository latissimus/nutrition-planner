import { supabase } from './supabase.js';
import { materialIconMarkup } from './categoryIcons.js';
import { toast } from './toast.js';
import { syncRoutineCoins } from './coinDex.js';

const today = () => new Date().toLocaleDateString('sv-SE');
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
export const meditationSounds = [
  ['off', 'Ohne Sound'],
  ['rain', 'Regen'],
  ['campfire', 'Lagerfeuer'],
  ['space', 'Space Music'],
  ['forest', 'Wald'],
  ['ocean', 'Wasser'],
  ['brown', 'Braunes Rauschen'],
  ['blue', 'Blaues Rauschen'],
];
const soundNames = Object.fromEntries(meditationSounds.map(([value, label]) => [value, value === 'off' ? 'Ohne Hintergrundsound' : label]));
const meditationTrackUrls = {
  rain: new URL('../Meditate Music/Regen.mp3', import.meta.url).href,
  campfire: new URL('../Meditate Music/Lagerfeuer.mp3', import.meta.url).href,
  space: new URL('../Meditate Music/Space.mp3', import.meta.url).href,
  forest: new URL('../Meditate Music/Wald.mp3', import.meta.url).href,
  ocean: new URL('../Meditate Music/Wasser.mp3', import.meta.url).href,
  brown: new URL('../Meditate Music/Braunes Rauschen.mp3', import.meta.url).href,
  blue: new URL('../Meditate Music/Blaues Rauschen.mp3', import.meta.url).href,
};

export async function completeRoutine(userId, routineId) {
  const date = today();
  const completedAt = new Date().toISOString();
  const [{ error: routineError }, { error: reminderError }] = await Promise.all([
    supabase.from('routine_completions').upsert({ routine_id: routineId, user_id: userId, completed_on: date }, { onConflict: 'routine_id,completed_on' }),
    supabase.from('reminder_completions').upsert({ reminder_id: routineId, user_id: userId, date, completed_at: completedAt, snoozed_until: null }, { onConflict: 'user_id,reminder_id,date' }),
  ]);
  if (routineError || reminderError) throw routineError || reminderError;
  try { await syncRoutineCoins(routineId, date, true); }
  catch { toast('Routine gespeichert – Coins konnten noch nicht synchronisiert werden.'); }
}

function audioContext() {
  const Context = window.AudioContext || window.webkitAudioContext;
  return Context ? new Context() : null;
}

function playGong(context, volume = 0.7) {
  if (!context || volume <= 0) return;
  const now = context.currentTime;
  [196, 293.66, 392].forEach((frequency, index) => {
    const oscillator = context.createOscillator();
    const gain = context.createGain();
    oscillator.type = 'sine';
    oscillator.frequency.setValueAtTime(frequency, now);
    oscillator.frequency.exponentialRampToValueAtTime(frequency * 0.985, now + 2.8);
    gain.gain.setValueAtTime(Math.max(0.0001, volume * (0.18 - index * 0.035)), now);
    gain.gain.exponentialRampToValueAtTime(0.0001, now + 3.2);
    oscillator.connect(gain).connect(context.destination);
    oscillator.start(now + index * 0.035);
    oscillator.stop(now + 3.3);
  });
}

function noiseBuffer(context, brown = false) {
  const length = context.sampleRate * 3;
  const buffer = context.createBuffer(1, length, context.sampleRate);
  const channel = buffer.getChannelData(0);
  let last = 0;
  for (let index = 0; index < length; index += 1) {
    const white = Math.random() * 2 - 1;
    last = brown ? (last + 0.02 * white) / 1.02 : white;
    channel[index] = brown ? last * 3.5 : white;
  }
  return buffer;
}

function startAmbientTrack(type, volume) {
  const url = meditationTrackUrls[type];
  if (!url || volume <= 0) return null;
  const players = [new Audio(url), new Audio(url)];
  players.forEach((player) => {
    player.preload = 'auto';
    player.loop = false;
    player.playsInline = true;
  });
  let active = 0;
  let fading = false;
  let stopped = false;
  let fadeTimer = null;
  const crossfadeSeconds = 2.4;
  players[0].volume = volume;
  players[0].play().catch(() => {});
  const monitor = window.setInterval(() => {
    const current = players[active];
    if (stopped || fading || !Number.isFinite(current.duration) || current.duration - current.currentTime > crossfadeSeconds) return;
    fading = true;
    const nextIndex = active === 0 ? 1 : 0;
    const next = players[nextIndex];
    next.currentTime = 0;
    next.volume = 0;
    next.play().catch(() => { fading = false; });
    const fadeStarted = performance.now();
    fadeTimer = window.setInterval(() => {
      const progress = Math.min(1, (performance.now() - fadeStarted) / (crossfadeSeconds * 1000));
      current.volume = volume * (1 - progress);
      next.volume = volume * progress;
      if (progress < 1) return;
      clearInterval(fadeTimer); fadeTimer = null;
      current.pause(); current.currentTime = 0; current.volume = 0;
      active = nextIndex; fading = false;
    }, 50);
  }, 180);
  return () => {
    stopped = true;
    clearInterval(monitor);
    if (fadeTimer) clearInterval(fadeTimer);
    players.forEach((player) => { player.pause(); player.removeAttribute('src'); player.load(); });
  };
}

function startAmbient(context, type, volume) {
  if (type === 'off' || volume <= 0) return () => {};
  const stopTrack = startAmbientTrack(type, volume);
  if (stopTrack) return stopTrack;
  if (!context) return () => {};
  if (type === 'space') {
    const master = context.createGain();
    master.gain.value = volume * 0.16;
    master.connect(context.destination);
    const oscillators = [110, 164.81, 220].map((frequency, index) => {
      const oscillator = context.createOscillator();
      const gain = context.createGain();
      oscillator.type = index === 1 ? 'triangle' : 'sine';
      oscillator.frequency.value = frequency;
      gain.gain.value = index === 0 ? 0.72 : 0.34;
      oscillator.connect(gain).connect(master);
      oscillator.start();
      return oscillator;
    });
    const lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.055;
    lfoGain.gain.value = volume * 0.045;
    lfo.connect(lfoGain).connect(master.gain);
    lfo.start();
    return () => { try { oscillators.forEach((node) => node.stop()); lfo.stop(); master.disconnect(); } catch {} };
  }
  const source = context.createBufferSource();
  source.buffer = noiseBuffer(context, type === 'brown' || type === 'campfire');
  source.loop = true;
  const filter = context.createBiquadFilter();
  const gain = context.createGain();
  gain.gain.value = volume * (type === 'rain' ? 0.19 : type === 'campfire' ? 0.15 : 0.28);
  if (type === 'rain') { filter.type = 'highpass'; filter.frequency.value = 1200; }
  else if (type === 'campfire') { filter.type = 'bandpass'; filter.frequency.value = 430; filter.Q.value = 0.7; }
  else { filter.type = 'lowpass'; filter.frequency.value = type === 'ocean' ? 850 : 520; }
  source.connect(filter).connect(gain).connect(context.destination);
  let lfo = null;
  if (type === 'ocean') {
    lfo = context.createOscillator();
    const lfoGain = context.createGain();
    lfo.frequency.value = 0.09;
    lfoGain.gain.value = volume * 0.12;
    lfo.connect(lfoGain).connect(gain.gain);
    lfo.start();
  }
  const chirps = new Set();
  let chirpTimer = null;
  if (type === 'forest') {
    chirpTimer = window.setInterval(() => {
      const oscillator = context.createOscillator();
      const chirpGain = context.createGain();
      const now = context.currentTime;
      oscillator.type = 'sine';
      oscillator.frequency.setValueAtTime(1200 + Math.random() * 700, now);
      oscillator.frequency.exponentialRampToValueAtTime(1800 + Math.random() * 800, now + 0.14);
      chirpGain.gain.setValueAtTime(volume * 0.035, now);
      chirpGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.24);
      oscillator.connect(chirpGain).connect(context.destination);
      oscillator.onended = () => chirps.delete(oscillator);
      oscillator.start(); oscillator.stop(now + 0.25); chirps.add(oscillator);
    }, 3200);
  }
  const crackles = new Set();
  let crackleTimer = null;
  if (type === 'campfire') {
    const crackleBuffer = noiseBuffer(context);
    crackleTimer = window.setInterval(() => {
      if (Math.random() < 0.42) return;
      const crackle = context.createBufferSource();
      const crackleFilter = context.createBiquadFilter();
      const crackleGain = context.createGain();
      const now = context.currentTime;
      crackle.buffer = crackleBuffer;
      crackleFilter.type = 'highpass'; crackleFilter.frequency.value = 1600 + Math.random() * 1800;
      crackleGain.gain.setValueAtTime(volume * (0.025 + Math.random() * 0.045), now);
      crackleGain.gain.exponentialRampToValueAtTime(0.0001, now + 0.055 + Math.random() * 0.08);
      crackle.connect(crackleFilter).connect(crackleGain).connect(context.destination);
      crackle.onended = () => crackles.delete(crackle);
      crackle.start(now, Math.random() * 2, 0.18); crackles.add(crackle);
    }, 170);
  }
  source.start();
  return () => {
    try { source.stop(); lfo?.stop(); chirps.forEach((node) => node.stop()); crackles.forEach((node) => node.stop()); } catch {}
    if (chirpTimer) clearInterval(chirpTimer);
    if (crackleTimer) clearInterval(crackleTimer);
  };
}

export async function previewMeditationSound(type, volume = 0.35) {
  const context = audioContext();
  if (type === 'off') return () => {};
  await context?.resume();
  const stopAmbient = startAmbient(context, type, volume);
  let stopped = false;
  return async () => {
    if (stopped) return;
    stopped = true;
    stopAmbient();
    await context?.close().catch(() => {});
  };
}

function formatTime(seconds) {
  const value = Math.max(0, Math.ceil(seconds));
  return `${String(Math.floor(value / 60)).padStart(2, '0')}:${String(value % 60).padStart(2, '0')}`;
}

export function remainingMeditationSeconds(endAt, now) {
  return Math.max(0, (endAt - now) / 1000);
}

function externalPrompt({ userId, routine, onCompleted }) {
  document.querySelector('.meditation-return-backdrop')?.remove();
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop meditation-return-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet meditation-return" role="dialog" aria-modal="true">
    <header><h2>Meditation abgeschlossen?</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <p>Hast du „${escapeHtml(routine.name)}“ beendet?</p>
    <div class="meditation-return-actions"><button class="btn btn-primary" data-return-done>Ja, erledigt</button><button class="btn" data-sheet-close>Noch nicht</button></div>
  </section>`;
  const close = () => { sessionStorage.removeItem('muscledex:external-meditation'); backdrop.remove(); };
  backdrop.onclick = async (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) return close();
    if (!event.target.closest('[data-return-done]')) return;
    const button = event.target.closest('button'); button.disabled = true;
    try {
      await completeRoutine(userId, routine.id);
      close(); toast('Meditation abgeschlossen'); await onCompleted?.();
    } catch (error) { toast(error.message || 'Abschluss konnte nicht gespeichert werden.'); button.disabled = false; }
  };
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}

export function launchExternalMeditation({ userId, routine, onCompleted }) {
  if (!routine.external_url) return;
  sessionStorage.setItem('muscledex:external-meditation', JSON.stringify({ routineId: routine.id, launchedAt: Date.now() }));
  let hidden = false;
  let prompted = false;
  const returnHandler = () => {
    if (document.visibilityState === 'hidden') { hidden = true; return; }
    if (!hidden || prompted) return;
    prompted = true;
    document.removeEventListener('visibilitychange', returnHandler);
    setTimeout(() => externalPrompt({ userId, routine, onCompleted }), 250);
  };
  document.addEventListener('visibilitychange', returnHandler);
  const anchor = document.createElement('a');
  anchor.href = routine.external_url; anchor.target = '_blank'; anchor.rel = 'noopener';
  anchor.click();
}

export function maybePromptExternalMeditation({ userId, routines, onCompleted }) {
  let pending;
  try { pending = JSON.parse(sessionStorage.getItem('muscledex:external-meditation') || 'null'); } catch { pending = null; }
  if (!pending || Date.now() - Number(pending.launchedAt || 0) > 6 * 60 * 60 * 1000) {
    sessionStorage.removeItem('muscledex:external-meditation'); return;
  }
  const routine = routines.find((item) => item.id === pending.routineId);
  if (routine) setTimeout(() => externalPrompt({ userId, routine, onCompleted }), 300);
}

export function openMeditationTimer({ userId, routine, onCompleted }) {
  const isMeditation = routine.template_type === 'meditation';
  const timerLabel = routine.template_type === 'mobility' ? 'MOBILITY'
    : routine.template_type === 'walk' ? 'SPAZIERGANG' : 'MEDITATION';
  const timerEmoji = routine.template_type === 'mobility' ? '🤸' : '🚶';
  const duration = Number(routine.duration_minutes || 5) * 60;
  let remaining = duration;
  let running = false;
  let endAt = 0;
  let timer = null;
  let wakeLock = null;
  let context = null;
  let stopAmbient = () => {};
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop meditation-timer-backdrop';
  backdrop.innerHTML = `<section class="kategorie-sheet meditation-timer${isMeditation ? '' : ' routine-countdown'}" role="dialog" aria-modal="true" aria-label="${escapeHtml(timerLabel)}-Timer">
    <header><div><small>${timerLabel}</small><h2>${escapeHtml(routine.name)}</h2></div><button type="button" data-meditation-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="meditation-atmung${isMeditation ? '' : ' routine-timer-symbol'}" aria-hidden="true">
      <span class="meditation-face">${isMeditation ? '😌' : timerEmoji}</span>
      ${isMeditation ? '<i class="meditation-stern stern-eins">✦</i><i class="meditation-stern stern-zwei">✧</i><i class="meditation-stern stern-drei">✦</i>' : ''}
    </div>
    <strong class="meditation-time" data-meditation-time>${formatTime(remaining)}</strong>
    <small class="meditation-sound-label">${isMeditation ? escapeHtml(soundNames[routine.ambient_sound] || soundNames.off) : 'Automatischer Check nach Ablauf'}</small>
    <div class="meditation-controls">
      <button class="btn btn-primary" type="button" data-meditation-toggle>${materialIconMarkup('play_arrow')}<span>Start</span></button>
      <button class="btn" type="button" data-meditation-stop>Beenden</button>
    </div>
    ${isMeditation && routine.external_url ? `<button class="btn meditation-external" type="button" data-meditation-external>${materialIconMarkup('arrow_forward')} Mit externer App starten</button>` : ''}
  </section>`;
  const timeNode = backdrop.querySelector('[data-meditation-time]');
  const toggle = backdrop.querySelector('[data-meditation-toggle]');
  const breath = backdrop.querySelector('.meditation-atmung');
  const releaseWakeLock = async () => { try { await wakeLock?.release(); } catch {} wakeLock = null; };
  const stop = async () => {
    clearInterval(timer); timer = null; running = false; stopAmbient(); stopAmbient = () => {};
    breath.classList.remove('laeuft'); await releaseWakeLock();
  };
  const visibilityHandler = async () => {
    if (document.visibilityState === 'visible' && running && !wakeLock) {
      try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    }
  };
  document.addEventListener('visibilitychange', visibilityHandler);
  const close = async () => {
    document.removeEventListener('visibilitychange', visibilityHandler);
    await stop(); await context?.close().catch(() => {}); backdrop.remove();
  };
  const finish = async () => {
    await stop(); remaining = 0; timeNode.textContent = '00:00';
    playGong(context, Number(routine.gong_volume ?? 0.7));
    try {
      await completeRoutine(userId, routine.id);
      backdrop.querySelector('.meditation-timer').classList.add('abgeschlossen');
      breath.classList.add('fertig');
      backdrop.querySelector('.meditation-controls').innerHTML = `<button class="btn btn-primary" type="button" data-meditation-finished>${materialIconMarkup('check_small')} ${escapeHtml(routine.name)} erledigt</button>`;
      await onCompleted?.();
      backdrop.querySelector('[data-meditation-finished]').onclick = close;
    } catch (error) { toast(error.message || 'Abschluss konnte nicht gespeichert werden.'); }
  };
  const update = () => {
    remaining = remainingMeditationSeconds(endAt, performance.now());
    timeNode.textContent = formatTime(remaining);
    if (remaining <= 0) finish();
  };
  const start = async () => {
    context ||= audioContext(); await context?.resume();
    if (remaining >= duration - 0.5) playGong(context, Number(routine.gong_volume ?? 0.7));
    stopAmbient = isMeditation ? startAmbient(context, routine.ambient_sound || 'off', Number(routine.ambient_volume ?? 0.35)) : () => {};
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch {}
    endAt = performance.now() + remaining * 1000; running = true; breath.classList.add('laeuft');
    toggle.innerHTML = `${materialIconMarkup('pause')}<span>Pause</span>`;
    timer = window.setInterval(update, 250); update();
  };
  const pause = async () => {
    update(); clearInterval(timer); timer = null; running = false; stopAmbient(); stopAmbient = () => {};
    breath.classList.remove('laeuft'); toggle.innerHTML = `${materialIconMarkup('play_arrow')}<span>Weiter</span>`; await releaseWakeLock();
  };
  toggle.onclick = () => running ? pause() : start();
  backdrop.querySelector('[data-meditation-stop]').onclick = close;
  backdrop.querySelector('[data-meditation-close]').onclick = close;
  backdrop.onclick = (event) => { if (event.target === backdrop) close(); };
  backdrop.querySelector('[data-meditation-external]')?.addEventListener('click', async () => {
    await close(); launchExternalMeditation({ userId, routine, onCompleted });
  });
  document.body.append(backdrop);
  requestAnimationFrame(() => backdrop.classList.add('offen'));
}
