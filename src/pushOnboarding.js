import { activatePush, pushSupport } from './push.js';
import { toast } from './toast.js';

// Einmalige Onboarding-Karte für Benachrichtigungen (wie bei LOGMAN eine kleine
// gelbe Karte am oberen Rand). Erscheint nur in der installierten PWA, solange
// die Erlaubnis noch nicht erteilt/abgelehnt wurde und die Karte nicht schon
// weggetippt wurde. Der Merker ist bewusst geräteweit (localStorage) – die
// Erlaubnis selbst gilt pro Installation, nicht pro Konto.
const MERKER = 'muscledex-push-onboarding-erledigt';

function bereitsEntschieden() {
  try { return localStorage.getItem(MERKER) === '1'; } catch { return false; }
}
function merkeEntschieden() {
  try { localStorage.setItem(MERKER, '1'); } catch { /* privater Modus o. Ä. */ }
}

export function maybeShowPushOnboarding(userId, onActivated) {
  if (!userId) return;
  const support = pushSupport();
  if (!support.ready) return; // z. B. iOS-Safari ohne „Zum Home-Bildschirm“
  if (!('Notification' in window) || Notification.permission !== 'default') return; // schon entschieden
  if (bereitsEntschieden()) return;
  if (document.querySelector('.push-onboarding')) return;

  const karte = document.createElement('div');
  karte.className = 'push-onboarding';
  karte.setAttribute('role', 'status');
  karte.innerHTML = `
    <div class="push-onboarding-text">
      <span class="push-onboarding-icon" aria-hidden="true">🔔</span>
      <span><b>Benachrichtigungen erlauben?</b><small>Damit dich Mahlzeiten, Supplements und Routinen auch bei geschlossener App erinnern.</small></span>
    </div>
    <div class="push-onboarding-aktionen">
      <button type="button" class="push-onboarding-nein">Später</button>
      <button type="button" class="push-onboarding-ja">Erlauben</button>
    </div>`;

  const schliessen = () => {
    karte.classList.remove('offen');
    setTimeout(() => karte.remove(), 220);
  };

  karte.querySelector('.push-onboarding-nein').onclick = () => {
    merkeEntschieden();
    schliessen();
  };

  karte.querySelector('.push-onboarding-ja').onclick = async () => {
    // iOS/Safari zeigt den System-Dialog nur, wenn requestPermission SYNCHRON
    // als erstes await in der Nutzergeste läuft – vor jedem anderen await.
    let permission = 'denied';
    try { permission = await Notification.requestPermission(); }
    catch { permission = 'denied'; }
    merkeEntschieden();
    if (permission !== 'granted') { schliessen(); return; }
    schliessen();
    try {
      await activatePush(userId);
      await onActivated?.();
      toast('Benachrichtigungen aktiviert');
    } catch (error) {
      toast(error.message || 'Benachrichtigungen konnten nicht aktiviert werden');
    }
  };

  document.body.append(karte);
  requestAnimationFrame(() => karte.classList.add('offen'));
}
