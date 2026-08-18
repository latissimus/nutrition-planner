// Nachttisch-Wecker für den SLEEP-LOG. iOS lässt keinen echten Hintergrund-
// Wecker zu, deshalb ist dies ein Vordergrund-„Nachttisch-Modus": Bildschirm per
// Screen-Wake-Lock wach halten, zur Aufsteh-Zeit aus dem Schlafplan den eigenen
// (in Schleife spielenden) Ton laut abspielen. Zuverlässig, solange die App vorn
// offen bleibt (am Ladekabel). Töne liegen im Projektordner `Wecker-Sounds/` und
// werden hier automatisch eingesammelt.

import { getPreference, setPreference } from './userPreferences.js';
import { materialIconMarkup } from './categoryIcons.js';

// Alle Audiodateien aus dem Projektordner bündeln. Neue Dateien erscheinen nach
// dem nächsten Build/Deploy automatisch – keine manuelle Registrierung nötig.
const soundModule = import.meta.glob('../Wecker-Sounds/*.{mp3,ogg,wav,m4a,aac}', {
  eager: true, query: '?url', import: 'default',
});

const DAY_KURZ = ['So', 'Mo', 'Di', 'Mi', 'Do', 'Fr', 'Sa'];
const DAY_ORDER = [1, 2, 3, 4, 5, 6, 0];
const SOUND_KEY = 'muscledex:wecker:sound';
const TAGE_KEY = 'muscledex:wecker:tage';
const pad = (value) => String(value).padStart(2, '0');
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');

function huebscherName(datei) {
  return datei.replace(/\.[^.]+$/, '')
    .replace(/[-_]+/g, ' ')
    .replace(/\s+\d{5,}\b/g, '') // lange ID-Zahlenblöcke aus Dateinamen entfernen
    .trim()
    .replace(/\b\w/g, (buchstabe) => buchstabe.toLocaleUpperCase('de')) || datei;
}

export function weckerSounds() {
  return Object.entries(soundModule)
    .map(([pfad, url]) => {
      const datei = pfad.split('/').at(-1);
      return { id: datei, label: huebscherName(datei), url };
    })
    .sort((a, b) => a.label.localeCompare(b.label, 'de'));
}

export function getWeckerConfig() {
  const sounds = weckerSounds();
  const gespeichert = getPreference(SOUND_KEY, '');
  const sound = sounds.find((item) => item.id === gespeichert) || sounds[0] || null;
  const tage = getPreference(TAGE_KEY, null);
  return {
    sound,
    // Standard: jeden Tag scharf (Nutzer kann Tage abwählen).
    tage: Array.isArray(tage) ? tage.filter((wd) => wd >= 0 && wd <= 6) : [0, 1, 2, 3, 4, 5, 6],
  };
}

export function setWeckerConfig({ sound, tage }) {
  if (sound !== undefined) setPreference(SOUND_KEY, sound);
  if (tage !== undefined) setPreference(TAGE_KEY, tage);
}

// Nächster Weckzeitpunkt aus dem Schlafplan (wake_time je Wochentag) und den
// scharfgestellten Wecker-Tagen. Liefert ein Date in der Zukunft oder null.
export function naechsterWecker(schedules, tage, now = new Date()) {
  const proTag = new Map((schedules || []).map((s) => [s.weekday, s]));
  const scharf = new Set(tage || []);
  for (let versatz = 0; versatz < 8; versatz += 1) {
    const tag = new Date(now);
    tag.setDate(now.getDate() + versatz);
    const wd = tag.getDay();
    if (!scharf.has(wd)) continue;
    const wake = String(proTag.get(wd)?.wake_time || '07:00').slice(0, 5);
    const [h, m] = wake.split(':').map(Number);
    tag.setHours(Number.isFinite(h) ? h : 7, Number.isFinite(m) ? m : 0, 0, 0);
    if (tag.getTime() > now.getTime() + 1000) return tag;
  }
  return null;
}

function tageZusammenfassung(tage) {
  const set = new Set(tage || []);
  if (set.size === 7) return 'Täglich';
  if (set.size === 0) return 'Keine Tage';
  if ([1, 2, 3, 4, 5].every((wd) => set.has(wd)) && !set.has(0) && !set.has(6)) return 'Mo–Fr';
  return DAY_ORDER.filter((wd) => set.has(wd)).map((wd) => DAY_KURZ[wd]).join(' · ');
}

// Karte unter „Heute Nacht": Status + Einstellungen + „Wecker aktiv".
export function weckerCardMarkup(state) {
  const config = getWeckerConfig();
  const next = naechsterWecker(state.schedules, config.tage);
  const soundLabel = config.sound?.label || 'Kein Ton im Ordner';
  const nextLabel = next
    ? `${DAY_KURZ[next.getDay()]} ${pad(next.getHours())}:${pad(next.getMinutes())} Uhr`
    : 'Keine Tage gewählt';
  return `
    <section class="wecker-card">
      <div class="wecker-card-info">
        <div class="wecker-card-icon">${materialIconMarkup('alarm')}</div>
        <div><small>WECKER</small><strong>${escapeHtml(nextLabel)}</strong><span>${escapeHtml(soundLabel)} · ${escapeHtml(tageZusammenfassung(config.tage))}</span></div>
        <button type="button" class="wecker-einstellungen" data-wecker-settings aria-label="Wecker einstellen">${materialIconMarkup('build')}</button>
      </div>
      <button type="button" class="btn btn-primary btn-block wecker-arm" data-wecker-arm${config.sound ? '' : ' disabled'}>Wecker aktiv</button>
    </section>`;
}

// ---- Einstellungs-Sheet (Ton wählen + Wochentage) ---------------------------

let vorschauAudio = null;
function stopVorschau() { if (vorschauAudio) { vorschauAudio.pause(); vorschauAudio = null; } }

export function weckerEditor({ onSaved } = {}) {
  const config = getWeckerConfig();
  const sounds = weckerSounds();
  const gewaehlteTage = new Set(config.tage);
  const backdrop = document.createElement('div');
  backdrop.className = 'kategorie-sheet-backdrop wecker-editor-backdrop offen';
  backdrop.innerHTML = `
    <section class="kategorie-sheet wecker-editor" role="dialog" aria-modal="true" aria-label="Wecker einstellen">
      <header><h2>Wecker</h2><button type="button" data-sheet-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
      <div class="dex-entry-field"><span>Weckton <small>aus dem Ordner „Wecker-Sounds"</small></span>
        <div class="wecker-sound-liste" data-sound-liste>
          ${sounds.length ? sounds.map((sound) => `<label class="wecker-sound-zeile">
            <input type="radio" name="wecker-sound" value="${escapeHtml(sound.id)}"${config.sound?.id === sound.id ? ' checked' : ''}>
            <span>${escapeHtml(sound.label)}</span>
            <button type="button" class="wecker-vorschau" data-sound-preview="${escapeHtml(sound.id)}" aria-label="Anhören">${materialIconMarkup('play_arrow')}</button>
          </label>`).join('') : '<p class="wecker-leer">Keine Tondatei gefunden. Lege eine mp3/wav in den Ordner „Wecker-Sounds".</p>'}
        </div>
      </div>
      <div class="dex-entry-field"><span>Wecktage <small>zur Aufsteh-Zeit aus dem Schlafplan</small></span>
        <div class="wecker-tage" data-wecker-tage>
          ${DAY_ORDER.map((wd) => `<button type="button" class="wecker-tag${gewaehlteTage.has(wd) ? ' aktiv' : ''}" data-tag="${wd}" aria-pressed="${gewaehlteTage.has(wd)}">${DAY_KURZ[wd]}</button>`).join('')}
        </div>
      </div>
      <button type="button" class="btn btn-primary btn-block" data-wecker-save>Speichern</button>
    </section>`;
  const schliessen = () => { stopVorschau(); backdrop.remove(); };
  backdrop.addEventListener('click', (event) => {
    if (event.target === backdrop || event.target.closest('[data-sheet-close]')) schliessen();
  });
  backdrop.querySelector('[data-wecker-tage]').addEventListener('click', (event) => {
    const btn = event.target.closest('[data-tag]'); if (!btn) return;
    const wd = Number(btn.dataset.tag);
    if (gewaehlteTage.has(wd)) gewaehlteTage.delete(wd); else gewaehlteTage.add(wd);
    btn.classList.toggle('aktiv', gewaehlteTage.has(wd));
    btn.setAttribute('aria-pressed', String(gewaehlteTage.has(wd)));
  });
  backdrop.querySelector('[data-sound-liste]')?.addEventListener('click', (event) => {
    const btn = event.target.closest('[data-sound-preview]'); if (!btn) return;
    event.preventDefault();
    const sound = sounds.find((item) => item.id === btn.dataset.soundPreview);
    stopVorschau();
    if (!sound) return;
    vorschauAudio = new Audio(sound.url);
    vorschauAudio.volume = 0.8;
    vorschauAudio.play().catch(() => {});
    setTimeout(() => stopVorschau(), 4000);
  });
  backdrop.querySelector('[data-wecker-save]').onclick = () => {
    const soundId = backdrop.querySelector('input[name="wecker-sound"]:checked')?.value;
    setWeckerConfig({
      sound: soundId ?? config.sound?.id ?? '',
      tage: DAY_ORDER.filter((wd) => gewaehlteTage.has(wd)).concat([...gewaehlteTage].filter((wd) => !DAY_ORDER.includes(wd))),
    });
    schliessen();
    onSaved?.();
  };
  document.body.append(backdrop);
}

// ---- Nachttisch-Modus (Overlay + Wecker-Engine) -----------------------------

let aktiv = null;

export function starteNachttisch(state) {
  if (aktiv) return;
  const config = getWeckerConfig();
  if (!config.sound) return;
  let ziel = naechsterWecker(state.schedules, config.tage);
  if (!ziel) return;

  // Audio schon jetzt (in der Nutzergeste) stumm in Schleife starten, damit iOS
  // den Ton später ohne neue Geste hörbar schalten lässt.
  const audio = new Audio(config.sound.url);
  audio.loop = true;
  audio.volume = 1;
  audio.muted = true;
  audio.play().catch(() => {});

  const overlay = document.createElement('div');
  overlay.className = 'wecker-overlay';
  overlay.innerHTML = `
    <div class="wecker-overlay-inner" data-phase="warten">
      <button type="button" class="wecker-aus" data-wecker-off aria-label="Wecker beenden">${materialIconMarkup('close')}</button>
      <div class="wecker-uhr" data-uhr>––:––</div>
      <div class="wecker-next" data-next></div>
      <div class="wecker-alarm-aktionen">
        <button type="button" class="btn btn-block wecker-snooze" data-wecker-snooze>Schlummern · 9 min</button>
        <button type="button" class="btn btn-primary btn-block wecker-stop" data-wecker-stop>Aufstehen</button>
      </div>
      <p class="wecker-hinweis">Bildschirm bleibt an – Handy bitte am Ladekabel lassen.</p>
    </div>`;
  document.body.append(overlay);

  let wakeLock = null;
  const holeWakeLock = async () => {
    try { wakeLock = await navigator.wakeLock?.request('screen'); } catch { wakeLock = null; }
  };
  holeWakeLock();
  const beiSichtbar = () => { if (document.visibilityState === 'visible') holeWakeLock(); };
  document.addEventListener('visibilitychange', beiSichtbar);

  const inner = overlay.querySelector('.wecker-overlay-inner');
  const uhrEl = overlay.querySelector('[data-uhr]');
  const nextEl = overlay.querySelector('[data-next]');
  const zeigeNext = () => {
    nextEl.textContent = ziel
      ? `Weckruf ${DAY_KURZ[ziel.getDay()]} ${pad(ziel.getHours())}:${pad(ziel.getMinutes())} Uhr`
      : '';
  };
  zeigeNext();

  let klingelt = false;
  const laeuten = () => {
    if (klingelt) return;
    klingelt = true;
    inner.dataset.phase = 'alarm';
    audio.muted = false;
    audio.currentTime = 0;
    audio.play().catch(() => {});
    try { navigator.vibrate?.([600, 400, 600, 400, 600]); } catch { /* iOS ignoriert vibrate */ }
  };

  const tick = () => {
    const jetzt = new Date();
    uhrEl.textContent = `${pad(jetzt.getHours())}:${pad(jetzt.getMinutes())}`;
    if (!klingelt && ziel && jetzt.getTime() >= ziel.getTime()) laeuten();
  };
  tick();
  const timer = setInterval(tick, 1000);

  const beenden = () => {
    clearInterval(timer);
    audio.pause();
    audio.muted = true;
    document.removeEventListener('visibilitychange', beiSichtbar);
    wakeLock?.release?.().catch(() => {});
    overlay.remove();
    aktiv = null;
  };

  overlay.querySelector('[data-wecker-off]').onclick = beenden;
  overlay.querySelector('[data-wecker-stop]').onclick = beenden;
  overlay.querySelector('[data-wecker-snooze]').onclick = () => {
    audio.pause();
    audio.muted = true;
    klingelt = false;
    ziel = new Date(Date.now() + 9 * 60 * 1000);
    inner.dataset.phase = 'warten';
    zeigeNext();
    // Stumm-Loop wieder anwerfen, damit das spätere Läuten ohne Geste klappt.
    audio.play().catch(() => {});
  };

  aktiv = { beenden };
}

export function nachttischAktiv() { return Boolean(aktiv); }
