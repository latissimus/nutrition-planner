import { createUISFX } from 'uisfx';
import { getPreference, setPreference } from './userPreferences.js';

const preferenceKey = 'muscledex:interface-sounds';
let interfacePlayer = null;
let routinePlayer = null;
let initialized = false;

function player(kind = 'interface') {
  if (typeof window === 'undefined') return null;
  if (kind === 'routine') {
    routinePlayer ||= createUISFX({ pack: 'arcade', volume: 0.32, enabled: true, cooldownMs: 35 });
    return routinePlayer;
  }
  interfacePlayer ||= createUISFX({
    pack: 'arcade', volume: 0.28, enabled: interfaceSoundsEnabled(), cooldownMs: 45,
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

export function playInterfaceSound(cue = 'press', options) {
  return player()?.play(cue, options) || null;
}

// Routine-Sounds sind bewusst NICHT an den Interface-Schalter gekoppelt.
// Meditationen rufen diese Funktion nicht auf und behalten ihre eigenen
// Anfangs- und Endklänge aus dem Meditate-Music-Ordner.
export async function playRoutineSound(phase, volume = 0.7) {
  const sound = player('routine');
  if (!sound) return null;
  await sound.unlock().catch(() => false);
  return sound.play(phase === 'end' ? 'complete' : 'start', {
    volume: 0.16 + Math.max(0, Math.min(1, Number(volume) || 0.7)) * 0.16,
    retrigger: 'restart',
  });
}

function cueForControl(control) {
  if (control.matches('input[type="checkbox"],input[type="radio"]')) return control.checked ? 'toggle-on' : 'toggle-off';
  const description = `${control.getAttribute('aria-label') || ''} ${control.textContent || ''}`.toLocaleLowerCase('de');
  // Schließen und Zurück verwenden appweit denselben Cue. Dadurch klingt das
  // X eines Overlays genauso vertraut wie das Schließen eines Dex.
  if (control.matches('[data-sheet-close]')) return 'back';
  if (control.matches('.kategorie-schliessen')
    || (control.matches('a[href]') && /schließen|zurück|übersicht/.test(description))) return 'back';
  if (/schließen/.test(description)) return 'back';
  if (control.matches('.btn-danger,.sheet-gefahr,.dex-entry-delete,.routine-delete,.coin-reward-delete') || /löschen|entfernen/.test(description)) return 'delete';
  if (control.matches('.kategorie-plus,.neu-sammlung,[data-category-settings]')
    || /hinzufügen|erstellen|neuer eintrag/.test(description)) return 'open';
  if (control.matches('a[href]')) return 'select';
  return 'press';
}

export function initInterfaceSounds(root = document) {
  if (initialized || !root?.addEventListener) return;
  initialized = true;
  const unlock = () => {
    player()?.unlock().catch(() => false);
    player('routine')?.unlock().catch(() => false);
  };
  root.addEventListener('pointerdown', unlock, { capture: true, passive: true, once: true });
  root.addEventListener('keydown', (event) => {
    if (event.key === 'Enter' || event.key === ' ') unlock();
  }, { capture: true, once: true });
  root.addEventListener('click', (event) => {
    const control = event.target.closest('button,a[href],summary,input[type="checkbox"],input[type="radio"],select');
    if (!control || control.disabled || control.matches('[data-no-interface-sound],[data-meditation-toggle],[data-routine-check],[data-item-check]')) return;
    playInterfaceSound(cueForControl(control));
  }, true);
}
