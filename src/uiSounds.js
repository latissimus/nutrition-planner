import { createUISFX } from 'uisfx';
import { getPreference, setPreference } from './userPreferences.js';

const preferenceKey = 'muscledex:interface-sounds';
const soundVolume = 0.28;
let interfacePlayer = null;
let routinePlayer = null;
let initialized = false;

function player(kind = 'interface') {
  if (typeof window === 'undefined') return null;
  if (kind === 'routine') {
    routinePlayer ||= createUISFX({ pack: 'arcade', volume: soundVolume, enabled: true, cooldownMs: 35 });
    return routinePlayer;
  }
  interfacePlayer ||= createUISFX({
    pack: 'arcade', volume: soundVolume, enabled: interfaceSoundsEnabled(), cooldownMs: 45,
  });
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
  await sound.unlock().catch(() => false);
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
  if (control.matches('[data-sleep-routine-check]')) return 'hover';
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
  const unlock = () => {
    player()?.unlock().catch(() => false);
    player('routine')?.unlock().catch(() => false);
  };
  root.addEventListener('pointerdown', unlock, { capture: true, passive: true, once: true });
  root.addEventListener('input', (event) => {
    const field = event.target;
    if (field instanceof Element && isTextEntry(field) && !field.matches('[data-no-interface-sound]')) {
      playInterfaceSound('typing', { retrigger: 'overlap', cooldownMs: 35 });
    }
  }, true);
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') unlock();
  }, { capture: true, once: true });
  root.addEventListener('click', (event) => {
    const control = event.target.closest('button,a[href],summary,input[type="checkbox"],input[type="radio"],select');
    if (!control || control.disabled || control.matches('[data-no-interface-sound],[data-meditation-toggle],[data-routine-check],[data-item-check]')) return;
    const cue = cueForControl(control);
    if (cue) playInterfaceSound(cue);
  }, true);
}
