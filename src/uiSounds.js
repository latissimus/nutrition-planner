import { createUISFX } from 'uisfx';
import { getPreference, setPreference } from './userPreferences.js';

const preferenceKey = 'muscledex:interface-sounds';
const soundVolume = 0.28;
let interfacePlayer = null;
let routinePlayer = null;
let initialized = false;
let audioContext = null;
let freigegeben = null;
let neuAnlegen = false;

// Ein gemeinsamer, selbst verwalteter AudioContext für beide Player. Dadurch
// können wir seinen Zustand prüfen und ihn wieder aufwecken.
function ensureContext() {
  if (typeof window === 'undefined') return null;
  if (audioContext?.state === 'closed') kontextVerwerfen();
  if (!audioContext) {
    const Ctx = window.AudioContext || window.webkitAudioContext;
    if (Ctx) { try { audioContext = new Ctx({ latencyHint: 'interactive' }); } catch { audioContext = null; } }
  }
  return audioContext;
}

// iOS lässt den Kontext nach Hintergrund, Anruf, Siri oder Ton aus einer
// anderen App oft stumm, auch wenn er „running“ meldet. Er wird deshalb nach
// jeder Rückkehr beim nächsten Tippen neu angelegt; die Player entstehen mit
// dem neuen Kontext neu.
function kontextVerwerfen() {
  const alt = audioContext;
  interfacePlayer?.stopAll();
  routinePlayer?.stopAll();
  interfacePlayer = null;
  routinePlayer = null;
  audioContext = null;
  freigegeben = null;
  if (alt && alt.state !== 'closed') alt.close().catch(() => {});
}

// Gibt den Ton frei. Wirkt nur innerhalb einer echten Geste: iOS zählt
// touchend, pointerup, click und keydown, aber nicht pointerdown beim Tippen.
// Neben "suspended" meldet iOS nach Unterbrechungen auch "interrupted".
function tonFreigeben() {
  if (neuAnlegen) {
    neuAnlegen = false;
    kontextVerwerfen();
  }
  const ctx = ensureContext();
  if (!ctx) return;
  if (ctx.state !== 'running') ctx.resume().catch(() => {});
  // Ein stiller Puffer in der Geste weckt die Ausgabe auf iOS zuverlässig.
  if (freigegeben !== ctx) {
    freigegeben = ctx;
    try {
      const source = ctx.createBufferSource();
      source.buffer = ctx.createBuffer(1, 1, ctx.sampleRate);
      source.connect(ctx.destination);
      source.start(0);
    } catch { /* ohne Ton bleibt die App bedienbar */ }
  }
}

/* Die Töne werden beim ersten Abspielen auf dem Hauptthread berechnet und erst
   danach zwischengespeichert – gemessen bis zu 29 ms je Ton am Desktop, auf
   dem iPhone ein Mehrfaches. Das fiel genau in den Moment des Tippens und
   verzögerte den ersten Frame. Die häufigen Töne werden deshalb in einer
   ruhigen Phase vorberechnet, sobald ein Player entsteht. */
const HAEUFIGE_TOENE = ['forward', 'back', 'hover', 'expand', 'collapse', 'check', 'uncheck',
  'typing', 'skip-next', 'skip-previous', 'achievement'];
function vorladen(neuerPlayer) {
  const start = () => { neuerPlayer?.preload?.(HAEUFIGE_TOENE)?.catch?.(() => {}); };
  if (typeof window.requestIdleCallback === 'function') window.requestIdleCallback(start, { timeout: 2000 });
  else setTimeout(start, 400);
}

function player(kind = 'interface') {
  if (typeof window === 'undefined') return null;
  const context = ensureContext() || undefined;
  if (kind === 'routine') {
    routinePlayer ||= createUISFX({ pack: 'arcade', volume: soundVolume, enabled: true, cooldownMs: 35, context });
    return routinePlayer;
  }
  if (!interfacePlayer) {
    interfacePlayer = createUISFX({
      pack: 'arcade', volume: soundVolume, enabled: interfaceSoundsEnabled(), cooldownMs: 45, context,
    });
    vorladen(interfacePlayer);
  }
  return interfacePlayer;
}

export function interfaceSoundsEnabled() {
  return Boolean(getPreference(preferenceKey, true));
}

export function syncInterfaceSounds() {
  player()?.setEnabled(interfaceSoundsEnabled());
}

export function setInterfaceSoundsEnabled(enabled) {
  const value = Boolean(enabled);
  setPreference(preferenceKey, value);
  player()?.setEnabled(value);
}

export function playInterfaceSound(cue = 'snap', options) {
  return player()?.play(cue, { ...(options || {}), volume: soundVolume }) || null;
}

// Routine-Sounds sind bewusst NICHT an den Interface-Schalter gekoppelt.
// Meditationen rufen diese Funktion nicht auf und behalten ihre eigenen
// Anfangs- und Endklänge aus dem Meditate-Music-Ordner.
export async function playRoutineSound(phase) {
  const sound = player('routine');
  if (!sound) return null;
  // Der Routine-Ton kommt am Ende eines Timers, oft ohne Geste. Ein
  // unterbrochener Kontext wird trotzdem angestoßen.
  if (audioContext && audioContext.state !== 'running') await audioContext.resume().catch(() => {});
  return sound.play(phase === 'end' ? 'complete' : 'notification', {
    volume: soundVolume,
    retrigger: 'restart',
  });
}

function isSwitch(control) {
  return Boolean(control.closest('.switchline,.rem-switch,.sleep-mini-switch,.sleep-setting-switch,.mahl-mini-switch,.nutrition-tracking-toggle,.mess-zeile'));
}

function controlDescription(control) {
  return `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`.toLocaleLowerCase('de');
}

function isDeleteControl(control) {
  return control.matches('.btn-danger,.sheet-gefahr,.dex-entry-delete,.routine-delete,.coin-reward-delete,[data-entry-delete],[data-reward-delete]')
    || /\blöschen\b/.test(controlDescription(control));
}

function isTextEntry(control) {
  if (control.matches('textarea,[contenteditable="true"]')) return true;
  if (!control.matches('input')) return false;
  return !['button', 'checkbox', 'color', 'date', 'file', 'hidden', 'image', 'month', 'radio', 'range', 'reset', 'submit', 'time', 'week']
    .includes((control.getAttribute('type') || 'text').toLowerCase());
}

function cueForControl(control) {
  if (control.matches('summary')) return control.closest('details')?.open ? 'collapse' : 'expand';
  if (control.matches('[aria-expanded]')) return control.getAttribute('aria-expanded') === 'true' ? 'collapse' : 'expand';
  if (control.matches('input[type="checkbox"]')) {
    if (isSwitch(control)) return control.checked ? 'skip-next' : 'skip-previous';
    return 'hover';
  }
  if (control.matches('input[type="radio"],select')) return 'hover';
  const description = controlDescription(control);
  // Der COIN-DEX ist die Belohnungszentrale und erhält deshalb den eigenen
  // Arcade-Achievement-Cue statt des gewöhnlichen Navigationsklangs.
  if (control.matches('a[href="#coins"]')) return 'achievement';
  // Schließen und Zurück verwenden appweit denselben Cue. Dadurch klingt das
  // X eines Overlays genauso vertraut wie das Schließen eines Dex.
  if (control.matches('[data-sheet-close]')) return 'back';
  if (control.matches('.kategorie-schliessen')
    || (control.matches('a[href]') && /schließen|zurück|übersicht/.test(description))) return 'back';
  if (/schließen/.test(description)) return 'back';
  // Die Aktualisierung startet ihren eigenen laufenden Streaming-Cue im
  // Handler. Der globale Click-Listener darf hier keinen zweiten Sound
  // darüberlegen.
  if (control.matches('[data-entry-refresh]')) return null;
  // Destruktive Aktionen erklingen bereits beim Pointerdown. Das ist vor allem
  // auf iOS wichtig, weil window.confirm() die Audiowiedergabe beim Click sonst
  // blockiert, bis der native Dialog wieder geschlossen wurde.
  if (isDeleteControl(control)) return null;
  if (control.matches('.tuck-ablage-knopf')) return 'forward';
  if (control.matches('.dex-inhaltskarte-oeffnen,.dex-ordner-test a,a[href^="#"]')) return 'forward';
  return 'hover';
}

export function initInterfaceSounds(root = document) {
  if (initialized || !root?.addEventListener) return;
  initialized = true;
  // Bei jeder Geste prüfen (billig, solange der Kontext läuft). Die Geste
  // kommt vor dem click, der den eigentlichen Klang auslöst.
  for (const typ of ['touchend', 'pointerup', 'click', 'keydown']) {
    root.addEventListener(typ, tonFreigeben, { capture: true, passive: true });
  }
  // Nach Hintergrund oder Rückkehr aus dem Seitenspeicher mit frischem Kontext
  // weiter. Neu angelegt wird schon beim Zurückkommen, nicht erst beim
  // nächsten Tippen: So sind die Töne vorberechnet, bevor getippt wird. Der
  // neue Kontext ist bis zur nächsten Geste angehalten; tonFreigeben weckt ihn.
  const frischAnlegen = () => {
    neuAnlegen = false;
    kontextVerwerfen();
    if (interfaceSoundsEnabled()) player();
  };
  document.addEventListener('visibilitychange', () => {
    if (document.visibilityState === 'hidden') neuAnlegen = true;
    else if (neuAnlegen) frischAnlegen();
  });
  window.addEventListener('pageshow', (event) => { if (event.persisted) frischAnlegen(); });
  // Gleich zum Start anlegen und vorberechnen, damit schon der erste Tipp
  // nicht rechnen muss.
  if (interfaceSoundsEnabled()) player();
  root.addEventListener('input', (event) => {
    const field = event.target;
    if (field instanceof Element && isTextEntry(field) && !field.matches('[data-no-interface-sound]')) {
      playInterfaceSound('typing', { retrigger: 'overlap', cooldownMs: 35 });
    }
  }, true);
  root.addEventListener('click', (event) => {
    const control = event.target.closest('button,a[href],summary,input[type="checkbox"],input[type="radio"],select');
    if (!control || control.disabled || control.matches('[data-no-interface-sound],[data-meditation-toggle],[data-routine-check],[data-item-check]')) return;
    const cue = cueForControl(control);
    if (cue) playInterfaceSound(cue);
  }, true);
}
