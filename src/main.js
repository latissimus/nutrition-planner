import './styles.css';
import { bindLongPress } from './longPress.js';
// Figtree (SIL Open Font License). Ausgewaehlt im direkten Vergleich mit einem
// vergroesserten Ausschnitt aus Inspirationen/IMG_5112: Tuckiis Schrift hat ein
// doppelstoeckiges "a" mit Schwaenzchen, einen GERADEN "y"-Abstrich, runde
// i-Punkte und einen kurzen "r"-Arm. Figtree trifft genau diese Merkmale.
// Plus Jakarta Sans, vorher hier, hat einen gehakten "y" und eine engere
// Laufweite und lag damit sichtbar daneben.
import '@fontsource/figtree/latin-400.css';
import '@fontsource/figtree/latin-500.css';
import '@fontsource/figtree/latin-600.css';
import '@fontsource/figtree/latin-700.css';
import '@fontsource/figtree/latin-800.css';
// Dex typography is bundled locally via styles.css: Work Sans for the UI,
// JetBrains Mono (OFL 1.1) for technical values and metadata.
import { supabase, supabaseKonfiguriert } from './supabase.js';
import { signIn, signUp, resetPassword, updatePassword, loadProfile } from './auth.js';
import { getTheme, applyTheme, setTheme } from './theme.js';
import { brandMarkup, headerBrandMarkup } from './brand.js';
import {
  coinDexIsVisible, customCollectionIsVisible, orderCustomCollections, visibleCollectionRoutes,
} from './collectionPreferences.js';
import { coinHeaderMarkup, loadCoinSummary, mountCoinDex } from './coinDex.js';
import { openDexEntryEditor, renderDexEntries } from './dexEntries.js';
import { registriereServiceWorker } from './pwa.js';
import { iconMarkup } from './icons.js';
import { toast } from './toast.js';
import { getPreference, loadUserPreferences, setPreference, setPreferenceUser } from './userPreferences.js';
import { createLruCache, createRouteStack, disposeViewEntry } from './navigationState.js';
import { setupDialogAccessibility } from './accessibility.js';
import { showGestureHintOnce } from './gestureHints.js';
import { initInterfaceSounds, syncInterfaceSounds } from './uiSounds.js';
import { maybeShowPushOnboarding } from './pushOnboarding.js';
import { isAbortError, userFacingLoadError } from './errorHandling.js';
import { subscribeToTableChanges } from './realtime.js';
import {
  applyPageLook, beginPageLookDefer, categoryColor, categoryIconMarkup, commitPageLookDefer, materialIconMarkup, mountCategoryChrome, pageLook, setPageLookColor, setPageLookPattern, settingsSheet,
} from './categoryIcons.js';
import {
  collectionGridMarkup, collectionIconMarkup, deleteCollection, getCollection, loadCollections, openCollectionEditor, saveCollection,
} from './collections.js';
import { prepareSpecialDexPage } from './specialDex.js';

// Große Systembereiche werden erst geladen, wenn sie wirklich geöffnet
// werden. Vite erzeugt daraus eigene, browserseitig gecachte Chunks.
const profileModule = () => import('./profile.js');
const bodyMetricsModule = () => import('./bodyMetrics.js');
const remindersModule = () => import('./reminders.js');
const shoppingModule = () => import('./shoppingList.js');
const routinesModule = () => import('./routines.js');
const sleepModule = () => import('./sleep.js');

/* Android und andere installierte PWAs können die Displayausrichtung direkt
   sperren. iOS wertet dafür primär den orientation-Eintrag im Manifest aus;
   der erneute Versuch nach dem ersten Tipp deckt Browser ab, die zuvor eine
   Nutzerinteraktion verlangen. Fehler bleiben absichtlich lautlos, weil die
   CSS-Sperrfläche den Landschaftsmodus zusätzlich sicher abfängt. */
async function sperreHochformat() {
  const standalone = window.matchMedia?.('(display-mode: standalone)').matches
    || window.navigator.standalone === true;
  if (!standalone || typeof window.screen?.orientation?.lock !== 'function') return;
  try { await window.screen.orientation.lock('portrait-primary'); } catch {}
}
sperreHochformat();
window.addEventListener('pointerdown', sperreHochformat, { once: true, passive: true });
const routineActionsModule = () => import('./routineNotificationActions.js');
const entryDetailModule = () => import('./dexEntryDetail.js');
const selectionModule = () => import('./dexSelection.js');
const sharingModule = () => import('./sharing.js');

const startDexSelection = async (...args) => (await selectionModule()).startDexSelection(...args);
const openShareSheet = async (...args) => (await sharingModule()).openShareSheet(...args);
const resolveSharedSpace = async (...args) => (await sharingModule()).resolveSharedSpace(...args);

applyTheme(getTheme());
registriereServiceWorker().catch(() => {});

// iOS berechnet :hover/:active fuer Buttons und Links nur, wenn irgendwo im
// Dokument ein touchstart-Listener haengt – sonst ueberspringt WebKit das
// komplett (besonders ausgepraegt im Home-Bildschirm-Standalone-Modus).
// Formular-Submit-Buttons sind davon ausgenommen, alle anderen Buttons/Links
// nicht. Leerer Listener reicht, er muss nur existieren.
document.addEventListener('touchstart', () => {}, { passive: true });

// Einheitliches iOS-Schreibverhalten fuer alle dynamisch gemounteten
// App-Formulare. Safari darf die systemeigene QuickType-Leiste trotz dieser
// Attribute weiterhin anzeigen; die Webseite kann sie nicht erzwingen. Der
// blaue Fertig-Haken wird fuer einzeilige Felder jedoch explizit angefordert.
function konfiguriereSchreibfeld(element) {
  if (!(element instanceof HTMLInputElement || element instanceof HTMLTextAreaElement)) return;
  if (element instanceof HTMLInputElement) {
    const type = (element.type || 'text').toLowerCase();
    if (!['text', 'search', 'url', 'tel'].includes(type)) return;
    element.setAttribute('enterkeyhint', 'done');
    element.setAttribute('autocomplete', 'off');
    element.setAttribute('autocorrect', 'off');
    element.setAttribute('spellcheck', 'false');
    element.setAttribute('aria-autocomplete', 'none');
    if (type === 'url') element.setAttribute('autocapitalize', 'none');
    return;
  }
  // Mehrzeilige Notizen behalten die Return-Taste, damit Absätze möglich
  // bleiben. Vorschläge und Rechtschreibkorrektur werden trotzdem deaktiviert.
  element.setAttribute('autocomplete', 'off');
  element.setAttribute('autocorrect', 'off');
  element.setAttribute('spellcheck', 'false');
  element.setAttribute('aria-autocomplete', 'none');
}

function konfiguriereSchreibfelder(root) {
  if (root instanceof HTMLInputElement || root instanceof HTMLTextAreaElement) konfiguriereSchreibfeld(root);
  root.querySelectorAll?.('input,textarea').forEach(konfiguriereSchreibfeld);
}

konfiguriereSchreibfelder(document);
new MutationObserver((mutations) => mutations.forEach((mutation) => mutation.addedNodes.forEach((node) => {
  if (node instanceof Element) konfiguriereSchreibfelder(node);
}))).observe(document.body, { childList: true, subtree: true });
setupDialogAccessibility();
initInterfaceSounds();

const netzstatus = document.createElement('div');
netzstatus.className = 'netzstatus';
netzstatus.setAttribute('role', 'status');
netzstatus.setAttribute('aria-live', 'polite');
netzstatus.hidden = navigator.onLine;
netzstatus.textContent = 'Offline – Änderungen erst wieder mit Verbindung möglich';
document.body.append(netzstatus);
window.addEventListener('offline', () => { netzstatus.hidden = false; });
window.addEventListener('online', () => {
  netzstatus.hidden = true;
  if (app.querySelector('[data-route-retry]')) render();
});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.typ === 'routine-aktion' && event.data.routineId) {
      sessionStorage.setItem('muscledex:pending-routine-action', event.data.routineId);
      if (location.hash === '#habits') window.dispatchEvent(new HashChangeEvent('hashchange'));
      else location.hash = 'habits';
      return;
    }
    if (event.data?.typ === 'gehe-zu' && event.data.url) location.hash = event.data.url.replace(/^#/, '');
  });
}

const routineActionFromUrl = new URL(location.href).searchParams.get('routineAction');
if (routineActionFromUrl) {
  sessionStorage.setItem('muscledex:pending-routine-action', routineActionFromUrl);
  const bereinigteUrl = new URL(location.href);
  bereinigteUrl.searchParams.delete('routineAction');
  history.replaceState(history.state, '', `${bereinigteUrl.pathname}${bereinigteUrl.search}${bereinigteUrl.hash || '#habits'}`);
}

const app = document.querySelector('#app');
const escapeHtml = (value = '') => String(value)
  .replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;')
  .replaceAll('"', '&quot;').replaceAll("'", '&#39;');
let session = null;
let profile = null;
let profileLadePromise = null;
let recovery = false;
let authMode = 'login';
let renderGeneration = 0;
let routeAbortController = null;
let erzwungenesRueckwaertsZiel = '';
let aktiveRoute = (location.hash || '#home').slice(1) || 'home';
let appDockEigene = [];
let appDockGeladen = false;
let appDockCoinStand = null;
let preferencesLadePromise = Promise.resolve();
let preferencesLadeUserId = '';

/* Cache-Limit bewusst niedrig: drei fertige DOM-Ansichten reichen für kurze
   Rückwege. Beim Ablegen werden ihre Listener und Timer beendet; dadurch
   bleiben weder versteckte Aktualisierungen noch Hintergrundarbeit übrig. */
const ansichtsCache = createLruCache({ limit: 3, onEvict: disposeViewEntry });

// Datenänderungen machen abgelegte Ansichten ungültig. Die aktive Ansicht ist
// nicht im Cache und aktualisiert sich über ihren eigenen Listener. Nach einer
// Rückkehr aus dem Hintergrund werden ebenfalls keine alten Daten gezeigt.
['muscledex:counts-changed', 'muscledex:coins-changed', 'muscledex:appearance-changed']
  .forEach((event) => window.addEventListener(event, () => ansichtsCache.clear()));
document.addEventListener('visibilitychange', () => {
  if (document.visibilityState === 'visible') ansichtsCache.clear();
});

// Eigener Navigations-Stack, um vorwaerts (tiefer rein) von rueckwaerts
// (zurueck/schliessen) zu unterscheiden: location.hash pusht bei jeder
// Navigation einen Browser-Verlaufseintrag, egal ob per Tap oder per
// iOS-Zurueck-Wischgeste – der Stack bleibt dadurch synchron zum echten
// Verlauf. "gleich" faengt reine Refresh-Faelle ab (z. B. nach einer
// Umbenennung per Long-Press bleibt man auf derselben Route).
const routeStack = createRouteStack(aktiveRoute);
const navRichtung = (ziel) => routeStack.navigate(ziel);

function navigationZuruecksetzen(route = 'home') {
  routeAbortController?.abort();
  routeAbortController = null;
  ansichtsCache.clear();
  routeStack.reset(route);
  aktiveRoute = route;
}

// Schliessen- und Zurueck-Knoepfe duerfen keinen neuen History-Eintrag
// erzeugen. Liegt ihr Ziel direkt hinter der aktuellen Route, verwenden wir
// den echten Browser-Stack. Das ist besonders wichtig fuer die interaktive
// iOS-Zurueck-Geste: Sie sieht dadurch dieselbe Reihenfolge wie die App.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const angefragtesZiel = link.getAttribute('href')?.slice(1) || 'home';
  const ziel = angefragtesZiel === 'home' && session
    ? appLetzteDexRoute()
    : angefragtesZiel;
  if (ziel.startsWith('entry/')) {
    document.documentElement.style.setProperty('--detail-origin-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--detail-origin-y', `${event.clientY}px`);
  }
  if (!routeStack.isPrevious(ziel)) {
    // Nach einem Reload bzw. einem eingespielten App-Update kann die PWA
    // direkt in einem Dex weiterlaufen. Der nur im Speicher liegende
    // Navigationsstapel kennt Home dann nicht mehr als vorherige Ansicht.
    // Ein Dex-X ist trotzdem semantisch immer ein Rueckweg: Home wird frisch
    // aufgebaut, waehrend der aktuelle Dex wie gewohnt nach rechts ausfaehrt.
    const istDexSchliessen = angefragtesZiel === 'home' && link.matches([
      '.neo-dex-action-close',
      '.food-dex-action-close',
      '.kategorie-schliessen',
    ].join(','));
    if (!istDexSchliessen) return;
    event.preventDefault();
    erzwungenesRueckwaertsZiel = ziel;
    routeStack.reset(ziel);
    if ((location.hash || '#home').slice(1) === ziel) render();
    else location.hash = ziel;
    return;
  }
  event.preventDefault();
  history.back();
});


function fehlertext(error) {
  const text = (error?.message || '').toLowerCase();
  if (text.includes('invalid login')) return 'E-Mail oder Passwort falsch.';
  if (text.includes('already registered')) return 'Diese E-Mail ist bereits registriert.';
  if (text.includes('password')) return 'Das Passwort muss mindestens 6 Zeichen haben.';
  if (text.includes('email')) return 'Bitte eine gültige E-Mail eintragen.';
  return error?.message || 'Etwas ist schiefgelaufen.';
}

/* Defer-Modus für setSeite: verändert sonst mitten im Mount die
   html-Attribute (data-seite, CSS-Custom-Properties für Farben/Wallpaper) —
   der Nutzer sieht dann bereits die neuen Chrome-Farben, während der
   Inhalt noch lädt (»gestückelter Aufbau«). Zwischen beginSeiteDefer und
   commitSeiteDefer wird nur der letzte Wunsch gepuffert und atomar mit
   dem Sichtbarwerden der neuen Ansicht angewendet. */
let seiteDeferAktiv = false;
let seitePuffer = null;

function beginSeiteDefer() { seiteDeferAktiv = true; seitePuffer = null; }
function commitSeiteDefer(verwerfen = false) {
  const gepuffert = seitePuffer;
  seiteDeferAktiv = false;
  seitePuffer = null;
  if (gepuffert !== null && !verwerfen) writeSeite(gepuffert);
}

function writeSeite(name) {
  document.documentElement.dataset.seite = name;
  delete document.documentElement.dataset.dexMuster;
  ['--dex-seitenfarbe', '--dex-ink', '--dex-tapete', '--bg', '--app-bg', '--app-content-bg', '--app-chrome-bg', '--food-page-purple']
    .forEach((property) => document.documentElement.style.removeProperty(property));
}

function setSeite(name) {
  if (seiteDeferAktiv) { seitePuffer = name; return; }
  writeSeite(name);
}

function dexLookAusAnsichtWiederherstellen(node) {
  if (!node) return;
  const color = node.style.getPropertyValue('--dex-seitenfarbe').trim();
  if (!color) return;
  const root = document.documentElement;
  const ink = node.style.getPropertyValue('--dex-ink').trim() || '#111111';
  root.style.setProperty('--dex-seitenfarbe', color);
  root.style.setProperty('--dex-ink', ink);
  root.style.setProperty('--bg', color);
  root.style.setProperty('--app-bg', color);
  root.style.setProperty('--app-content-bg', color);
  root.style.setProperty('--app-chrome-bg', color);
  root.style.setProperty('--food-page-purple', color);
  const wallpaper = node.style.getPropertyValue('--dex-tapete').trim();
  if (wallpaper) root.style.setProperty('--dex-tapete', wallpaper);
  else root.style.removeProperty('--dex-tapete');
  if (node.dataset.dexMuster) root.dataset.dexMuster = node.dataset.dexMuster;
}

function dexLookAufAnsichtUebertragen(node, ziel) {
  if (!node || !ziel) return;
  [
    '--dex-seitenfarbe',
    '--dex-ink',
    '--dex-tapete',
    '--bg',
    '--app-bg',
    '--app-content-bg',
    '--app-chrome-bg',
    '--food-page-purple',
  ].forEach((property) => {
    const value = node.style.getPropertyValue(property).trim();
    if (value) ziel.style.setProperty(property, value);
  });
  if (node.dataset.dexMuster) ziel.dataset.dexMuster = node.dataset.dexMuster;
  ziel.classList.toggle('dex-tapete-datei', Boolean(node.style.getPropertyValue('--dex-tapete').trim()));
}

function meldung(slot, text, art) {
  slot.replaceChildren();
  const node = document.createElement('div');
  node.className = `msg ${art}`;
  node.textContent = text;
  slot.appendChild(node);
}

function renderSetup() {
  app.classList.remove('app-shell');
  appDexShellEntfernen();
  setSeite('setup');
  app.innerHTML = `
    <main class="setup-shell wrap">
      ${brandMarkup()}
      <section class="card setup-card">
        <span class="seitenkopf-kicker">Einrichtung</span>
        <h1 class="section-title">Supabase verbinden</h1>
        <p>Die PWA-Grundlage steht. Für Login und Profil fehlen noch die Zugangsdaten des neuen Supabase-Projekts.</p>
        <ol>
          <li><code>.env.example</code> als <code>.env.local</code> kopieren.</li>
          <li>Projekt-URL und Publishable-Key eintragen.</li>
          <li>Die erste Migration im Supabase-Projekt anwenden.</li>
          <li>Den Entwicklungsserver neu starten.</li>
        </ol>
        <div class="setup-theme" aria-label="Darstellung">
          <button class="themebtn${getTheme() === 'retro' ? ' on' : ''}" type="button" data-setup-theme="retro">Retro</button>
          <button class="themebtn${getTheme() === 'dark' ? ' on' : ''}" type="button" data-setup-theme="dark">Dark</button>
        </div>
      </section>
    </main>`;
  app.querySelectorAll('[data-setup-theme]').forEach((button) => {
    button.onclick = () => {
      setTheme(button.dataset.setupTheme);
      setSeite('setup');
      app.querySelectorAll('[data-setup-theme]').forEach((item) => item.classList.toggle('on', item === button));
    };
  });
}

function renderAuth() {
  app.classList.remove('app-shell');
  appDexShellEntfernen();
  setSeite('auth');
  const login = authMode === 'login';
  app.innerHTML = `
    <div class="auth-marquee" aria-hidden="true">
      <span>ERNÄHRUNG ◆ SUPPLEMENTS ◆ SCHLAF ◆ GEWOHNHEITEN ◆ </span>
      <span>ERNÄHRUNG ◆ SUPPLEMENTS ◆ SCHLAF ◆ GEWOHNHEITEN ◆ </span>
    </div>
    <main class="auth-shell">
      <div class="auth-marke">${headerBrandMarkup()}</div>
      ${login ? '' : '<h1 class="auth-title">Registrieren</h1>'}
      <p class="auth-sub">${login ? 'Melde dich mit E-Mail und Passwort an.' : 'Erstelle deinen persönlichen Account.'}</p>
      <div data-auth-msg></div>
      <form class="card" data-auth-form>
        ${login ? '' : `
          <label class="fld-l" for="auth-name">Name</label>
          <input class="input" id="auth-name" type="text" autocomplete="name" placeholder="Dein Name">`}
        <label class="fld-l" for="auth-email">E-Mail</label>
        <input class="input" id="auth-email" type="email" autocomplete="email" required placeholder="du@mail.de">
        <label class="fld-l" for="auth-password">Passwort</label>
        <input class="input" id="auth-password" type="password" autocomplete="${login ? 'current-password' : 'new-password'}" required minlength="6" placeholder="••••••••">
        <button class="btn btn-primary btn-block" type="submit" data-auth-submit>${login ? 'Anmelden' : 'Account erstellen'}</button>
      </form>
      <div class="auth-switch">
        ${login ? 'Noch keinen Account?' : 'Schon registriert?'}
        <button type="button" data-auth-toggle>${login ? 'Registrieren' : 'Zur Anmeldung'}</button>
      </div>
      ${login ? '<div class="auth-switch"><button type="button" data-forgot>Passwort vergessen?</button></div>' : ''}
    </main>`;

  const msg = app.querySelector('[data-auth-msg]');
  app.querySelector('[data-auth-toggle]').onclick = () => {
    authMode = login ? 'signup' : 'login';
    renderAuth();
  };

  const vergessen = app.querySelector('[data-forgot]');
  if (vergessen) vergessen.onclick = async () => {
    const email = app.querySelector('#auth-email').value.trim();
    if (!email) return meldung(msg, 'Trag zuerst deine E-Mail ein.', 'err');
    vergessen.disabled = true;
    try {
      await resetPassword(email);
      meldung(msg, 'Wenn die Adresse registriert ist, ist ein Link zum Zurücksetzen unterwegs.', 'ok');
    } catch (error) {
      meldung(msg, fehlertext(error), 'err');
    } finally {
      vergessen.disabled = false;
    }
  };

  app.querySelector('[data-auth-form]').onsubmit = async (event) => {
    event.preventDefault();
    const button = app.querySelector('[data-auth-submit]');
    const email = app.querySelector('#auth-email').value.trim();
    const password = app.querySelector('#auth-password').value;
    const name = app.querySelector('#auth-name')?.value.trim() || '';
    button.disabled = true;
    try {
      if (login) {
        // Der Auth-Callback kann bereits waehrend signIn rendern. Route und
        // eigener Navigationsstack muessen deshalb vorher auf Home stehen.
        navigationZuruecksetzen('home');
        if (location.hash !== '#home') history.replaceState(null, '', '#home');
        await signIn(email, password);
        const { data: sessionData } = await supabase.auth.getSession();
        if (sessionData?.session) {
          session = sessionData.session;
          syncInterfaceSounds();
          render();
        }
      } else {
        // Auch wenn Supabase eine E-Mail-Bestätigung verlangt, soll der
        // spätere Einstieg nicht einen alten Hash (z. B. einen geöffneten
        // Dex) wiederherstellen. Ein neues Konto beginnt immer auf Home.
        navigationZuruecksetzen('home');
        if (location.hash !== '#home') history.replaceState(null, '', '#home');
        const data = await signUp(email, password, name);
        if (!data.session) {
          meldung(msg, 'Bitte bestätige deine E-Mail und melde dich danach an.', 'ok');
          button.disabled = false;
        }
      }
    } catch (error) {
      meldung(msg, fehlertext(error), 'err');
      button.disabled = false;
    }
  };
}

function renderRecovery() {
  app.classList.remove('app-shell');
  appDexShellEntfernen();
  setSeite('auth');
  app.innerHTML = `
    <main class="auth-shell">
      <div class="auth-marke">${brandMarkup()}</div>
      <h1 class="auth-title">Neues Passwort</h1>
      <p class="auth-sub">Wähle ein neues Passwort für deinen Account.</p>
      <div data-recovery-msg></div>
      <form class="card" data-recovery-form>
        <label class="fld-l" for="recovery-one">Neues Passwort</label>
        <input class="input" id="recovery-one" type="password" autocomplete="new-password" required minlength="6">
        <label class="fld-l" for="recovery-two">Wiederholen</label>
        <input class="input" id="recovery-two" type="password" autocomplete="new-password" required minlength="6">
        <button class="btn btn-primary btn-block" type="submit">Passwort speichern</button>
      </form>
    </main>`;
  const msg = app.querySelector('[data-recovery-msg]');
  app.querySelector('[data-recovery-form]').onsubmit = async (event) => {
    event.preventDefault();
    const one = app.querySelector('#recovery-one').value;
    const two = app.querySelector('#recovery-two').value;
    if (one !== two) return meldung(msg, 'Die Passwörter stimmen nicht überein.', 'err');
    const button = event.currentTarget.querySelector('button');
    button.disabled = true;
    try {
      await updatePassword(one);
      recovery = false;
      await render();
    } catch (error) {
      meldung(msg, fehlertext(error), 'err');
      button.disabled = false;
    }
  };
}

function avatarMarkup() {
  if (profile?.avatar_url?.startsWith('data:image/')) return `<img src="${profile.avatar_url}" alt="">`;
  const quelle = (profile?.full_name || session?.user?.email || '?').trim();
  const teile = quelle.split(/\s+/).filter(Boolean);
  const zeichen = (teile.length >= 2 ? teile[0][0] + teile[1][0] : quelle.slice(0, 2))
    .toUpperCase()
    .replace(/[<>&"']/g, '');
  return `<span>${zeichen}</span>`;
}

// Eine Sammlung ist ein Bereich der App. Reihenfolge der Felder:
// Route, Name, Kurzbeschreibung (nur fuer die Suche), Symbol, Ordnerfarbe,
// Stand. Die Beschreibung steht bewusst nicht auf der Karte: Tuckii zeigt dort
// nur Symbol, Zaehler und Namen – Fliesstext wuerde das Raster zerreissen.
const sammlungen = [
  ['body', 'Body-Log', 'Gewicht, Hautfalten, Taille und Trends.', 'body', 'cyan', 'Aktiv'],
  ['reminders', 'MEAL-LOG', 'Mahlzeiten, Supplements und Wasser.', 'reminders', 'pink', 'Aktiv'],
  ['food-log', 'Fooddex', 'Cheat-Meals und Rezeptideen wiederfinden.', 'food', 'violet', 'Aktiv'],
  ['training', 'Trainingdex', 'Trainingseinheiten, Übungen und Trainingswissen.', 'training', 'orange', 'Aktiv'],
  ['shopping', 'EINKAUF', 'Alles fuer den naechsten Wocheneinkauf.', 'shopping', 'gruen', 'Aktiv'],
  ['habits', 'ROUTINEN', 'Kleine Routinen täglich abhaken.', 'habits', 'gelb', 'Aktiv'],
  ['sleep', 'SLEEP-LOG', 'Schlaf planen, einchecken und Zusammenhänge erkennen.', 'sleep', 'navy', 'Aktiv'],
];
const bereiche = sammlungen.map(([route, titel]) => [route, titel]);
const sichtbareSammlungen = () => {
  const nachRoute = new Map(sammlungen.map((sammlung) => [sammlung[0], sammlung]));
  return visibleCollectionRoutes().map((route) => nachRoute.get(route)).filter(Boolean);
};

const APP_DEX_ROUTES = new Set([...sammlungen.map(([route]) => route), 'coins']);
const LETZTER_DEX_KEY = 'muscledex:letzter-dex';

function appDexFallbackRoute() {
  const sichtbar = sichtbareSammlungen();
  return sichtbar.some(([route]) => route === 'reminders')
    ? 'reminders'
    : (sichtbar[0]?.[0] || (coinDexIsVisible() ? 'coins' : 'reminders'));
}

function appLetzteDexRoute() {
  const fallback = appDexFallbackRoute();
  const gespeichert = getPreference(LETZTER_DEX_KEY, fallback) || fallback;
  if (gespeichert.startsWith('collection/')) {
    const id = gespeichert.slice('collection/'.length);
    return id && customCollectionIsVisible(id) ? gespeichert : fallback;
  }
  if (gespeichert === 'coins') return coinDexIsVisible() ? gespeichert : fallback;
  return sichtbareSammlungen().some(([route]) => route === gespeichert) ? gespeichert : fallback;
}

function istAppHauptDex(route, view) {
  if (APP_DEX_ROUTES.has(route)) return true;
  return route.startsWith('collection/') && Boolean(view?.dataset.appDockRoute);
}

function appDexShellEntfernen() {
  app.classList.remove('dex-app-shell', 'dex-app-shell-unterdex');
  app.querySelector(':scope > .app-dex-header')?.remove();
  app.querySelector(':scope > .app-dex-dock')?.remove();
}

function appDockTitel(route) {
  if (route.startsWith('collection/')) {
    return appDockEigene.find((item) => `collection/${item.id}` === route)?.name || 'Dex';
  }
  return sammlungen.find(([key]) => key === route)?.[1]
    || (route === 'coins' ? 'Coin-Dex' : 'Dex');
}

function appMenueComputerMarkup() {
  return `<span class="app-menue-computer" aria-hidden="true">
    <svg viewBox="0 0 62 55" preserveAspectRatio="none">
      <defs>
        <mask id="app-menue-fenster-ausschnitt" maskUnits="userSpaceOnUse">
          <rect width="62" height="55" fill="#FFFFFF"/>
          <rect x="7" y="21" width="43" height="23" rx="5" fill="#000000"/>
        </mask>
      </defs>
      <rect class="app-menue-computer-schatten" x="6" y="5" width="53" height="47" rx="7" fill="#7560E6" mask="url(#app-menue-fenster-ausschnitt)"/>
      <g class="app-menue-computer-front">
        <rect x="2" y="2" width="54" height="47" rx="7" fill="#F2A5DA" stroke="#8968FF" stroke-width="2.3" mask="url(#app-menue-fenster-ausschnitt)"/>
        <path d="M9 2h40a7 7 0 0 1 7 7v8H2V9a7 7 0 0 1 7-7Z" fill="#AEEBFA"/>
        <path d="M2 17h54" fill="none" stroke="#8968FF" stroke-width="2.3"/>
        <path d="M31 11h4" fill="none" stroke="#8968FF" stroke-width="1.8" stroke-linecap="round"/>
        <rect x="38" y="7.5" width="5" height="5" fill="none" stroke="#8968FF" stroke-width="1.5"/>
        <path d="m46 7.5 5 5m0-5-5 5" fill="none" stroke="#8968FF" stroke-width="1.5" stroke-linecap="round"/>
        <rect class="app-menue-computer-innen" x="7" y="21" width="43" height="23" rx="5"/>
        <rect x="7" y="21" width="43" height="23" rx="5" fill="none" stroke="#8968FF" stroke-width="1.8"/>
        <text class="app-menue-computer-text" x="28.5" y="32.5" fill="#111111" font-family="'Work Sans'" font-size="9.6" font-style="italic" font-weight="700" text-anchor="middle" dominant-baseline="middle">MENÜ</text>
      </g>
    </svg>
  </span>`;
}

function appDockEintraegeMarkup(aktiveDockRoute) {
  const standard = sichtbareSammlungen().map(([route, titel]) => `
    <a class="app-dex-tab${aktiveDockRoute === route ? ' aktiv' : ''}" href="#${route}"
       data-sammlung="${route}" style="--app-dex-tab-color:${escapeHtml(pageLook(route, categoryColor(route), 'drops').color)}"
       aria-label="${escapeHtml(titel)}"${aktiveDockRoute === route ? ' aria-current="page"' : ''}>
      <span aria-hidden="true">${categoryIconMarkup(route, 'app-dex-tab-icon')}</span>
      <small>${escapeHtml(titel)}</small>
    </a>`).join('');
  const eigene = appDockEigene.map((item) => {
    const route = `collection/${item.id}`;
    return `
      <a class="app-dex-tab${aktiveDockRoute === route ? ' aktiv' : ''}" href="#${route}"
         data-collection-id="${item.id}" style="--app-dex-tab-color:${escapeHtml(item.color || '#FF69AE')}"
         aria-label="${escapeHtml(item.name)}"${aktiveDockRoute === route ? ' aria-current="page"' : ''}>
        <span aria-hidden="true">${collectionIconMarkup(item.icon_key)}</span>
        <small>${escapeHtml(item.name)}</small>
      </a>`;
  }).join('');
  const neu = `
    <button class="app-dex-tab app-dex-tool app-dex-create" type="button" aria-label="Neuen Dex erstellen">
      <span aria-hidden="true">${materialIconMarkup('create_new_folder')}</span>
      <small>Dex +</small>
    </button>`;
  return standard + eigene + neu;
}

function appSyncStatusAktualisieren() {
  const status = app.querySelector(':scope > .app-dex-header .app-dex-sync');
  if (!status) return;
  const online = navigator.onLine;
  status.textContent = online ? '✓' : '↑';
  status.className = `app-dex-sync save-dot ${online ? 'ok' : 'wait'}`;
  status.title = online ? 'synchronisiert' : 'auf diesem Gerät gesichert · wartet auf Verbindung';
  status.setAttribute('aria-label', status.title);
}

function appDexShellZeichnen(route, view) {
  if (!istAppHauptDex(route, view)) {
    appDexShellEntfernen();
    return;
  }
  const aktiveDockRoute = view.dataset.appDockRoute || route;
  const alterScrollstand = app.querySelector(':scope > .app-dex-dock .app-dex-tabs')?.scrollLeft || 0;
  app.classList.add('dex-app-shell');
  app.classList.toggle('dex-app-shell-unterdex', view.dataset.appDockSubdex === 'true');

  let header = app.querySelector(':scope > .app-dex-header');
  if (!header) {
    header = document.createElement('header');
    header.className = 'app-dex-header';
    app.append(header);
  }
  header.style.backgroundColor = document.documentElement.dataset.theme === 'dark'
    ? '#101A2B'
    : (getComputedStyle(document.documentElement).getPropertyValue('--dex-seitenfarbe').trim()
      || getComputedStyle(document.documentElement).getPropertyValue('--bg').trim());
  header.innerHTML = `
    <div class="app-dex-header-inner">
      <span class="app-dex-brand" aria-label="MUSCLEDEX">${headerBrandMarkup()}</span>
      <div class="app-dex-header-actions">
        ${coinDexIsVisible() ? coinHeaderMarkup(appDockCoinStand || { balance: 0 }) : ''}
        <span class="app-dex-sync save-dot" role="status"></span>
        <a class="nav-av nav-av-fb" href="#profile" aria-label="Profil und Einstellungen">${avatarMarkup()}</a>
      </div>
    </div>`;

  let dock = app.querySelector(':scope > .app-dex-dock');
  if (!dock) {
    dock = document.createElement('nav');
    dock.className = 'app-dex-dock';
    app.append(dock);
  }
  dock.setAttribute('aria-label', 'Dex wechseln und Eintrag hinzufügen');
  dock.innerHTML = `
    <div class="app-dex-dock-inner">
      <div class="app-dex-tabs">${appDockEintraegeMarkup(aktiveDockRoute)}</div>
      <button class="app-dex-menu" type="button" aria-label="Menü für ${escapeHtml(appDockTitel(aktiveDockRoute))} öffnen">
        ${appMenueComputerMarkup()}
      </button>
    </div>`;
  appSyncStatusAktualisieren();

  const tabLeiste = dock.querySelector('.app-dex-tabs');
  tabLeiste.scrollLeft = alterScrollstand;
  requestAnimationFrame(() => {
    const aktiv = tabLeiste.querySelector('.app-dex-tab.aktiv');
    if (!aktiv) return;
    const links = aktiv.offsetLeft;
    const rechts = links + aktiv.offsetWidth;
    if (links < tabLeiste.scrollLeft || rechts > tabLeiste.scrollLeft + tabLeiste.clientWidth) {
      aktiv.scrollIntoView({ behavior: 'smooth', block: 'nearest', inline: 'center' });
    }
  });

  dock.querySelector('.app-dex-create').onclick = () => openCollectionEditor({
    userId: session.user.id,
    rootKey: 'home',
    onSaved: () => {
      appDockGeladen = false;
      appDexShellDatenLaden(route, view, routeAbortController?.signal);
    },
  });
  dock.querySelector('.app-dex-menu').onclick = () => {
    /* Frühere Zwischenstation über die floating Add-Buttons ist weg –
       der Menü-Knopf löst die Add-Aktion direkt am (unsichtbaren)
       Kategoriekopf des jeweiligen Dex aus. */
    view.querySelector('.kategorie-plus')?.click();
  };
  const menueKnopf = dock.querySelector('.app-dex-menu');
  let menueDruckStart = 0;
  let menueDruckTimer = 0;
  const menueDruecken = () => {
    clearTimeout(menueDruckTimer);
    menueDruckStart = performance.now();
    menueKnopf.classList.add('ist-gedrueckt');
    menueDruckTimer = window.setTimeout(() => menueKnopf.classList.remove('ist-gedrueckt'), 900);
  };
  const menueLoslassen = () => {
    clearTimeout(menueDruckTimer);
    const rest = Math.max(0, 150 - (performance.now() - menueDruckStart));
    menueDruckTimer = window.setTimeout(() => menueKnopf.classList.remove('ist-gedrueckt'), rest);
  };
  menueKnopf.addEventListener('pointerdown', menueDruecken, { passive: true });
  menueKnopf.addEventListener('pointerup', menueLoslassen, { passive: true });
  menueKnopf.addEventListener('pointercancel', menueLoslassen, { passive: true });
  bindLongPress(tabLeiste, '.app-dex-tab', dexEinstellungenOeffner({
    userId: session.user.id,
    refresh: () => {
      appDockGeladen = false;
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    itemsById: new Map(appDockEigene.map((item) => [item.id, item])),
  }));
}

async function appDexShellDatenLaden(route, view, signal) {
  if (!istAppHauptDex(route, view) || signal?.aborted) return;
  /* Navigation und Kontostand sind App-Schalen-Daten. Sobald sie geladen
     sind, werden sie nicht bei jedem Dex-Wechsel erneut vom Server geholt und
     die bereits sichtbare Schale dadurch auch nicht ein zweites Mal gebaut. */
  if (appDockGeladen && (appDockCoinStand || !coinDexIsVisible())) return;
  try {
    const [eigene, coinStand] = await Promise.all([
      appDockGeladen ? Promise.resolve(appDockEigene) : loadCollections(session.user.id, { rootKey: 'home', signal }),
      coinDexIsVisible() ? loadCoinSummary(session.user.id, signal) : Promise.resolve(null),
    ]);
    if (signal?.aborted || view !== app.querySelector(':scope > #view')) return;
    appDockEigene = orderCustomCollections(eigene).filter((item) => customCollectionIsVisible(item.id));
    appDockGeladen = true;
    appDockCoinStand = coinStand;
    appDexShellZeichnen(route, view);
  } catch (error) {
    if (!signal?.aborted) console.warn('Dex-Menüband konnte nicht aktualisiert werden:', error.message);
  }
}

function appDexShellAktualisieren(route, view, signal) {
  appDexShellZeichnen(route, view);
  if (!istAppHauptDex(route, view)) return;
  setPreference(LETZTER_DEX_KEY, view.dataset.appDockRoute || route);
  appDexShellDatenLaden(route, view, signal);
}

window.addEventListener('muscledex:coins-changed', async () => {
  const view = app.querySelector(':scope > #view');
  if (!session || !view || !istAppHauptDex(aktiveRoute, view) || !coinDexIsVisible()) return;
  try {
    appDockCoinStand = await loadCoinSummary(session.user.id, routeAbortController?.signal);
    if (view === app.querySelector(':scope > #view')) appDexShellZeichnen(aktiveRoute, view);
  } catch (error) {
    if (!isAbortError(error)) console.warn('COIN-Stand im Header konnte nicht aktualisiert werden:', error.message);
  }
});
window.addEventListener('online', appSyncStatusAktualisieren);
window.addEventListener('offline', appSyncStatusAktualisieren);

function renderChrome() {
  app.classList.add('app-shell');
  // Die sichtbare Seite behält ihre ID und sämtliche Layoutregeln bis zum Tausch.
  const view = document.createElement('main');
  view.className = 'warten-auf-daten';
  view.hidden = true;
  app.append(view);
  return view;
}

function ansichtMerken(route, node, controller, seite) {
  if (!route || !node) return;
  // Eine abgelegte Ansicht darf keine globalen Aktualisierungs-Listener
  // behalten. Sonst löst ein Speichern nach mehreren Dex-Wechseln denselben
  // Refresh mehrfach aus. Die DOM-Ansicht bleibt als sofortige Vorschau im
  // Cache. Bei einer Datenänderung wird sie verworfen, nicht nachträglich und
  // für den Nutzer sichtbar noch einmal aufgebaut.
  controller?.abort();
  node.removeAttribute('id');
  node.classList.add('view-cache');
  // Ton darf nach einem Seitenwechsel nie unsichtbar weiterlaufen. Iframes
  // werden hier noch nicht getrennt, weil die Ansicht fuer den sofortigen
  // Rueckweg erhalten bleibt.
  node.querySelectorAll?.('audio,video').forEach((media) => {
    try { media.pause(); } catch {}
  });
  node.remove();
  ansichtsCache.set(route, { node, controller: null, seite });
}

function gemerkteAnsichtZeigen(route) {
  const gemerkt = ansichtsCache.take(route);
  if (!gemerkt) return false;
  const aktuell = app.querySelector(':scope > #view');
  const bisherigeRoute = aktiveRoute;
  const bisherigerController = routeAbortController;
  const bisherigeSeite = document.documentElement.dataset.seite || '';

  gemerkt.node.classList.remove('view-cache');
  gemerkt.node.id = 'view';
  app.insertBefore(gemerkt.node, aktuell || null);
  routeAbortController = new AbortController();
  aktiveRoute = route;
  setSeite(gemerkt.seite || (route === 'home' ? 'home' : route.startsWith('entry/') || route.startsWith('collection/') ? 'collection' : route));
  dexLookAusAnsichtWiederherstellen(gemerkt.node);
  appDexShellAktualisieren(route, gemerkt.node, routeAbortController?.signal);
  // Die ursprünglichen Listener wurden beim Ablegen beendet. Für die wieder
  // aktive Cache-Ansicht genügt ein einziger zentraler Refresh: Änderungen
  // führen atomar zu einem normalen Neuaufbau derselben Route.
  subscribeToTableChanges({
    table: 'aktive-cache-ansicht',
    signal: routeAbortController.signal,
    onChange: () => window.dispatchEvent(new HashChangeEvent('hashchange')),
    onError: () => {},
  });

  if (aktuell) ansichtMerken(bisherigeRoute, aktuell, bisherigerController, bisherigeSeite);
  return true;
}

function istDunkleOrdnerfarbe(farbe) {
  const hex = String(farbe || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 135;
}

// Baut fuer eine Kachel (eingebaute Kategorie ueber data-sammlung oder
// eigener Dex ueber data-collection-id) die passende "Dex bearbeiten"-Aktion.
function dexEinstellungenOeffner({ userId, refresh, itemsById }) {
  const infoKindFor = (route) => ({ reminders: 'meal', sleep: 'sleep', body: 'body', training: 'training', 'food-log': 'food', home: 'custom' }[route] || route);
  const titleFor = (route) => sammlungen.find(([key]) => key === route)?.[1] || 'Dex';
  return (el) => {
    const collectionId = el.dataset.collectionId;
    if (collectionId) {
      const item = itemsById?.get(collectionId);
      if (!item) return null;
      const isSubDex = Boolean(item.parent_id) || item.root_key !== 'home';
      // Kein onCreateSub hier: "Unter-Dex erstellen" gibt es bewusst nur im
      // Dex selbst (ueber dessen eigenen "+"-Knopf), nicht per Long-Press von
      // aussen auf die Kachel des uebergeordneten Dex.
      return () => settingsSheet(`collection-${item.id}`, refresh, {
        disableAppearance: isSubDex,
        appearanceLabel: isSubDex ? undefined : 'Icon ändern/umbenennen',
        infoLabel: `${item.name}-Info`,
        onInfo: () => openNeoDexInfoDialog(infoKindFor(item.root_key), item.name),
        onRename: isSubDex ? () => openCollectionEditor({ userId, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh }) : null,
        onEditAppearance: isSubDex ? null : () => openCollectionEditor({ userId, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh }),
        onDelete: async () => {
          if (!confirm(`„${item.name}“ samt Unter-Dex wirklich löschen?`)) return;
          try { await deleteCollection(userId, item); toast('Dex gelöscht'); refresh(); }
          catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
        },
      });
    }
    const route = el.dataset.sammlung;
    if (route) {
      const title = titleFor(route);
      return () => settingsSheet(route, refresh, {
        infoLabel: `${title}-Info`,
        onInfo: () => openNeoDexInfoDialog(infoKindFor(route), title),
        appearanceLabel: `${title} bearbeiten`,
      });
    }
    return null;
  };
}

async function dexSammlungsStatistik(userId, rootKey, roots, signal) {
  if (!roots.length) return new Map();
  let collectionsQuery = supabase.from('collections').select('id,parent_id').eq('user_id', userId).eq('root_key', rootKey);
  let entriesQuery = supabase.from('dex_entries').select('collection_id').eq('user_id', userId).eq('root_key', rootKey);
  if (signal) { collectionsQuery = collectionsQuery.abortSignal(signal); entriesQuery = entriesQuery.abortSignal(signal); }
  const [{ data: collections, error: collectionError }, { data: entries, error: entryError }] = await Promise.all([collectionsQuery, entriesQuery]);
  if (collectionError) throw collectionError;
  if (entryError) throw entryError;
  const childrenByParent = new Map();
  (collections || []).forEach((item) => {
    if (!item.parent_id) return;
    const list = childrenByParent.get(item.parent_id) || [];
    list.push(item.id);
    childrenByParent.set(item.parent_id, list);
  });
  const entryCount = new Map();
  (entries || []).forEach(({ collection_id: id }) => {
    if (id) entryCount.set(id, (entryCount.get(id) || 0) + 1);
  });
  const result = new Map();
  roots.forEach((root) => {
    const descendants = [];
    const queue = [...(childrenByParent.get(root.id) || [])];
    while (queue.length) {
      const id = queue.shift();
      descendants.push(id);
      queue.push(...(childrenByParent.get(id) || []));
    }
    const ids = [root.id, ...descendants];
    result.set(root.id, {
      children: descendants.length,
      entries: ids.reduce((sum, id) => sum + (entryCount.get(id) || 0), 0),
    });
  });
  return result;
}

// Neue Konten starten mit einer vollständigen Dex-Navigation sowie passenden
// Farben und Icons. Die Initialisierung ist einmalig und überschreibt keine
// bestehenden persönlichen Einstellungen.
async function initialeDexNavigationEinrichten(userId, signal, existing = []) {
  const key = 'muscledex:home-defaults-v1';
  if (getPreference(key, false) || existing.length) {
    if (!getPreference(key, false)) setPreference(key, true);
    return false;
  }
  if (signal?.aborted) return false;
  const order = ['food-log', 'reminders', 'sleep', 'shopping', 'habits', 'training', 'body'];
  setPreference('muscledex:sammlungs-reihenfolge', order);
  setPreference('muscledex:sichtbare-sammlungen', order);
  setPreference('muscledex:coin-dex-sichtbar', true);
  const looks = {
    'food-log': ['#FBE7A3', 'wallpaper-pizza', '🍕'],
    reminders: ['#525CEB', 'wallpaper-burger', '🍔'],
    sleep: ['#333D6D', 'wallpaper-moon', '😴'],
    shopping: ['#00E0BA', 'wallpaper-brokkoli', '🛒'],
    habits: ['#8C00FF', 'wallpaper-wolke', '🧠'],
    training: ['#215E61', 'wallpaper-dumbbell', '💪🏻'],
    body: ['#B1E7FF', 'wallpaper-measure', '📐'],
    coins: ['#00A8FF', 'wallpaper-game', '🎮'],
  };
  Object.entries(looks).forEach(([route, [color, pattern, emoji]]) => {
    setPreference(`muscledex:kategorie-farbe:${route}`, color);
    setPreference(`muscledex:kategorie-icon:${route}`, `emoji:${emoji}`);
    setPageLookColor(route, color);
    setPageLookPattern(route, pattern);
  });
  try {
    const neu = await saveCollection(userId, {
      rootKey: 'home', parentId: null, name: 'Neu', color: '#FF06B7', iconKey: 'emoji:🆕',
    });
    if (neu?.id) {
      setPageLookColor(`collection-${neu.id}`, '#FF06B7');
      setPageLookPattern(`collection-${neu.id}`, 'wallpaper-blitz');
    }
  } catch (error) {
    if (!signal?.aborted) console.warn('Standard-Dex konnte nicht angelegt werden:', error.message);
  }
  setPreference(key, true);
  return true;
}

const dexEntriesSlotMarkup = () => '<div class="dex-eintraege" data-dex-entries><div class="daten-laden">DEX-Einträge werden geladen …</div></div>';

function openNeoDexInfoDialog(kind = 'food', customTitle = '') {
  const training = kind === 'training';
  const custom = kind === 'custom';
  const meal = kind === 'meal';
  const sleep = kind === 'sleep';
  const body = kind === 'body';
  const shopping = kind === 'shopping';
  const habits = kind === 'habits';
  const coins = kind === 'coins';
  const title = customTitle || (custom ? 'Eigener Dex' : body ? 'Body-Log' : sleep ? 'Sleep-Log' : meal ? 'Meal-Log' : training ? 'Trainingdex' : shopping ? 'Einkauf' : habits ? 'Routinen' : coins ? 'Coin-Dex' : 'Fooddex');
  const copy = body
    ? `<p>Im <b>Body-Log</b> hältst du Gewicht, Taillenumfang und deine <b>12-Falten-Summe</b> fest.</p>
      <p>Entscheidend ist nicht ein einzelner Tageswert, sondern der <b>geglättete Verlauf</b>. Ergänzende Daten aus Training und Erholung helfen, Veränderungen sinnvoll einzuordnen.</p>
      <p>Die Auswertung zeigt beobachtete Trends, keine exakte Körperfettmessung und keine medizinische Diagnose.</p>`
    : sleep
    ? `<p>Im <b>Sleep-Log</b> planst du deinen Schlafrhythmus und hältst morgens <b>Schlafdauer</b>, <b>Qualität</b> und <b>Energie</b> fest.</p>
      <p>Abendroutinen und Erinnerungen helfen dir, deinen Plan im Alltag umzusetzen. Persönliche Trends werden erst aus mehreren vergleichbaren Check-ins abgeleitet.</p>
      <p>Die Auswertung zeigt beobachtete Zusammenhänge und ersetzt keine medizinische Diagnose.</p>`
    : meal
    ? `<p>Im <b>Meal-Log</b> planst und protokollierst du <b>Mahlzeiten</b>, <b>Supplements</b> und deine Flüssigkeitszufuhr über den Tag.</p>
      <p>Die Zeitfenster geben deinem Tagesplan Struktur. Zu jeder Mahlzeit kannst du Hinweise hinterlegen und Erinnerungen gezielt aktivieren.</p>
      <p>Über den Hinzufügen-Button erfasst du Lebensmittel oder ergänzt deine Planung.</p>`
    : shopping
    ? `<p>Im <b>Einkaufs-Dex</b> sammelst und planst du Lebensmittel für deinen nächsten Einkauf.</p><p>Gruppen und Status helfen dir, offene und bereits erledigte Besorgungen schnell zu unterscheiden.</p>`
    : habits
    ? `<p>Im <b>Routinen-Dex</b> planst du wiederkehrende Abläufe und hältst ihre Erledigung fest.</p><p>Die Übersicht zeigt dir, was heute ansteht und wie konstant du deine Routinen umsetzt.</p>`
    : coins
    ? `<p>Im <b>Coin-Dex</b> sammelst du MUSCLE-COINS für erledigte Routinen, Check-ins und Messungen.</p>
      <p>Du legst eigene Belohnungen und deren Preis fest. Sobald dein Kontostand reicht, kannst du eine Belohnung einlösen.</p>
      <p>Dein Kontostand bleibt auch im festen App-Header sichtbar.</p>`
    : custom
    ? `<p>In <b>${escapeHtml(title)}</b> sammelst du eigene Notizen, Links, Bilder und Tonaufnahmen an einem Ort.</p>
      <p>Mit <b>Tags</b> und <b>Unter-Dex</b> strukturierst du die Inhalte so, wie es für dein Thema sinnvoll ist.</p>
      <p>Die Farbe kannst du am Haupt-Dex ändern. Unter-Dex übernehmen den Look automatisch.</p>`
    : training
    ? `<p>Im <b>Trainingdex</b> sammelst du <b>Übungen</b>, <b>Trainingswissen</b>, Links, Bilder, Videos und Tonaufnahmen an einem Ort.</p>
      <p>Mit Klassen wie <b>Übungen</b>, <b>Regeneration</b>, <b>Tipps</b> oder <b>Verletzung</b> findest du relevante Inhalte schnell wieder.</p>
      <p>Unter-Dex helfen dir, Trainingsbereiche sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`
    : `<p>Im <b>Fooddex</b> sammelst du <b>eigene Rezepte</b>, <b>Rezeptideen</b>, Links, Bilder und Videos an einem Ort.</p>
      <p>Mit <b>Tags</b> wie <b>Cheat-Meals</b>, <b>Low Carb</b> oder <b>High Carb</b> sortierst du schnell, was immer geht — besonders für ideenlose Tage.</p>
      <p>Unter-Dex helfen dir, größere Bereiche sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`;
  const existing = document.querySelector('[data-food-info-dialog]');
  if (existing) existing.remove();
  const overlay = document.createElement('div');
  overlay.className = 'food-dex-info-dialog-overlay';
  overlay.setAttribute('role', 'dialog');
  overlay.setAttribute('aria-modal', 'true');
  overlay.setAttribute('data-food-info-dialog', '');
  overlay.innerHTML = `
    <section class="food-dex-info-dialog">
      <button type="button" class="food-dex-info-dialog-close" data-close aria-label="Info schließen">${materialIconMarkup('close')}</button>
      <h2>${title}</h2>
      ${copy}
    </section>`;
  const close = () => overlay.remove();
  overlay.addEventListener('click', (event) => {
    if (event.target === overlay || event.target.closest('[data-close]')) close();
  });
  document.body.append(overlay);
}

function installNeoDexChrome(view) {
  /* Die schwebende Add/Close-Leiste unten rechts wurde entfernt: der
     Menü-Button im festen Dex-Dock löst das Hinzufügen aus, ein
     Schließen-Button ist überflüssig (man ist immer in EINEM Dex).
     Aria-hidden auf die alten Header-Steuerungen, damit Screen-Reader
     sie nicht mehr ankündigen. Und noch eventuelle Reste aus dem
     Ansichtscache wegräumen, damit auf keiner Seite mehr eine solche
     Leiste aufblitzen kann. */
  const foodBar = view.querySelector('.kategorie-kopf');
  foodBar?.querySelector('.kategorie-plus')?.setAttribute('aria-hidden', 'true');
  foodBar?.querySelector('[data-category-settings]')?.setAttribute('aria-hidden', 'true');
  foodBar?.querySelector('.kategorie-schliessen')?.setAttribute('aria-hidden', 'true');
  view.querySelector('.neo-dex-floating-actions,.food-dex-floating-actions')?.remove();
}

async function mountCustomCollection(container, item, signal) {
  const customDexSkin = item.root_key === 'home';
  const neoDexSkin = ['food-log', 'training', 'home'].includes(item.root_key);
  const isSubDex = Boolean(item.parent_id) || item.root_key !== 'home';
  const foodDexSkin = item.root_key === 'food-log';
  const trainingDexSkin = item.root_key === 'training';
  let lookRoot = item;
  while (lookRoot.parent_id) {
    const parent = await getCollection(session.user.id, lookRoot.parent_id, signal);
    if (!parent || signal?.aborted) break;
    lookRoot = parent;
  }
  container.dataset.appDockRoute = `collection/${lookRoot.id}`;
  container.dataset.appDockSubdex = item.id === lookRoot.id ? 'false' : 'true';
  const inheritsSystemDexLook = item.root_key !== 'home';
  const inheritedLookScope = inheritsSystemDexLook ? item.root_key : `collection-${lookRoot.id}`;
  const inheritedColor = inheritsSystemDexLook ? categoryColor(item.root_key) : (lookRoot.color || item.color);
  let inheritedPattern = inheritsSystemDexLook
    ? pageLook(item.root_key, inheritedColor, foodDexSkin ? 'wallpaper-pizza' : trainingDexSkin ? 'wallpaper-dumbbell' : 'drops').pattern
    : 'setometer-triangles';
  if (customDexSkin) {
    // Eigene Haupt-Dex bestimmen ihre Farbe in der Datenbank. Die Tapete ist
    // absichtlich nicht personalisierbar und wird von allen Unter-Dex geerbt.
    setPageLookColor(inheritedLookScope, inheritedColor);
    inheritedPattern = setPageLookPattern(inheritedLookScope, 'setometer-triangles');
  }
  const ownerId = item.user_id || session.user.id;
  const children = await loadCollections(ownerId, { rootKey: item.root_key, parentId: item.id, signal });
  if (signal?.aborted) return;
  const childStats = await dexSammlungsStatistik(ownerId, item.root_key, children, signal);
  if (signal?.aborted) return;
  setSeite(customDexSkin ? 'custom-dex' : (neoDexSkin ? item.root_key : 'collection'));
  if (neoDexSkin) {
    container.classList.add('neo-dex-page', 'food-dex-page');
    container.classList.toggle('food-dex-dunkler-hintergrund', istDunkleOrdnerfarbe(inheritedColor));
  }
  const collectionTitleMarkup = neoDexSkin ? '' : `<div class="seitenkopf"><h1>${escapeHtml(item.name)}</h1></div>`;
  container.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
    ${collectionTitleMarkup}
    ${collectionGridMarkup(children, { inheritedColor, counts: childStats })}
    ${dexEntriesSlotMarkup()}
  </div>`;
  const backHref = item.parent_id ? `#collection/${item.parent_id}` : (item.root_key === 'home' ? '#home' : `#${item.root_key}`);
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const openEntry = (type, foodKind = null) => openDexEntryEditor({
    type, foodKind, userId: item.user_id || session.user.id, rootKey: item.root_key, collectionId: item.id, onSaved: refresh,
  });
  mountCategoryChrome(container, `collection-${item.id}`, item.name, {
    backHref,
    color: inheritedColor,
    pageLookScope: inheritedLookScope,
    inheritedPageLookScope: inheritedLookScope,
    pageLookColor: inheritedColor,
    pageLookPattern: inheritedPattern,
    meta: `${children.length} Unter-Dex`,
    onAddNote: () => openEntry('note'),
    onAddLink: () => openEntry('link'),
    onAddImage: () => openEntry('image'),
    onAddAudio: ['home', 'training'].includes(item.root_key) ? () => openEntry('audio') : null,
    onAddRecipeLink: item.root_key === 'food-log' ? () => openEntry('link', 'recipe') : null,
    onAddOwnRecipe: item.root_key === 'food-log' ? () => openEntry('note', 'recipe') : null,
    onCreateSub: () => openCollectionEditor({
      userId: item.user_id || session.user.id, rootKey: item.root_key, parentId: item.id, onSaved: refresh,
    }),
    appearanceLabel: isSubDex ? undefined : 'Icon ändern/umbenennen',
    onRename: isSubDex ? () => openCollectionEditor({
      userId: item.user_id || session.user.id, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh,
    }) : null,
    disableAppearance: isSubDex,
    onEditAppearance: isSubDex ? null : () => openCollectionEditor({
      userId: item.user_id || session.user.id, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh,
    }),
    onSelect: () => startDexSelection(container, {
      userId: ownerId, rootKey: item.root_key, currentCollectionId: item.id, onChanged: refresh,
    }),
    onDelete: async () => {
      if (!confirm(`„${item.name}“ samt Unter-Dex wirklich löschen?`)) return;
      try {
        await deleteCollection(ownerId, item);
        toast('Dex gelöscht');
        location.hash = backHref.slice(1);
      } catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
    },
  });
  if (neoDexSkin) {
    installNeoDexChrome(container, {
      title: item.name,
      meta: `0 Einträge · ${children.length} Unter-Dex`,
      closeHref: backHref,
      editLabel: `${item.name} bearbeiten`,
      infoKind: customDexSkin ? 'custom' : trainingDexSkin ? 'training' : 'food',
    });
  }
  bindLongPress(container.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', dexEinstellungenOeffner({
    userId: ownerId,
    refresh,
    itemsById: new Map(children.map((kind) => [kind.id, kind])),
  }));
  await renderDexEntries(container, {
    userId: ownerId, rootKey: item.root_key, collectionId: item.id,
    color: inheritedColor, signal, hasChildren: children.length > 0,
    onChanged: (entries, total) => {
      if (!Array.isArray(entries)) return;
      const meta = container.querySelector('.kategorie-kopftitel small');
      if (meta) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
      const scrollMeta = container.querySelector('[data-food-scroll-meta]');
      if (scrollMeta) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
    },
  });
  subscribeToTableChanges({ table: 'collections', signal, onChange: refresh, onError: () => {} });
}

async function profilLaden() {
  profile = await loadProfile(session.user.id);
  if (!profile) throw new Error('Profil konnte nicht angelegt werden.');
  const zone = Intl.DateTimeFormat().resolvedOptions().timeZone;
  if (zone && zone !== profile.zeitzone) {
    const { error } = await supabase.from('profiles').update({ zeitzone: zone }).eq('id', session.user.id);
    if (!error) profile.zeitzone = zone;
  }
}

async function profilSicherLaden() {
  if (profile) return profile;
  if (!profileLadePromise) {
    profileLadePromise = profilLaden().finally(() => { profileLadePromise = null; });
  }
  await profileLadePromise;
  return profile;
}

async function renderRoute() {
  const generation = ++renderGeneration;
  /* Safety-Net: falls ein vorheriger renderRoute-Lauf durch einen Fehler
     oder ein Redirect abgebrochen wurde, könnten setSeite/applyPageLook
     noch im Defer-Modus stehen und stumm alle folgenden Aufrufe puffern.
     Vor jedem neuen Lauf einmal committen – räumt harmlos auf, wenn
     nichts gepuffert war, und rettet den Zustand sonst. */
  commitSeiteDefer();
  commitPageLookDefer();
  if (!supabaseKonfiguriert) return renderSetup();
  if (recovery) return renderRecovery();
  if (!session) return renderAuth();
  // Farben, Tapeten, Dex-Reihenfolge und letzter Dex sind kontogebunden.
  // Der erste Bildschirm darf deshalb erst nach diesen Einstellungen gebaut
  // werden. Zuvor erschien beim Accountwechsel kurz das Standarddesign.
  await preferencesLadePromise;
  if (generation !== renderGeneration) return;
  if (!profile) {
    try { await profilSicherLaden(); }
    catch (error) {
      if (generation !== renderGeneration) return;
      throw error;
    }
  }
  if (generation !== renderGeneration) return;
  // Die Initialisierung lag früher im Mount der Startseite. Da es diese
  // Ansicht nicht mehr gibt, wird sie einmalig vor dem ersten Dex erledigt;
  // andernfalls fehlten neuen Konten Reihenfolge, Farben und Standard-Dex.
  if (!getPreference('muscledex:home-defaults-v1', false)) {
    try {
      const bestehende = await loadCollections(session.user.id, { rootKey: 'home' });
      await initialeDexNavigationEinrichten(session.user.id, undefined, bestehende);
      appDockGeladen = false;
    } catch (error) {
      if (!isAbortError(error)) console.warn('Dex-Grundeinstellung konnte nicht vorbereitet werden:', error.message);
    }
  }
  let angefragt = (location.hash || '#home').slice(1);
  // Die frühere Startseite ist durch die feste Dex-Navigation ersetzt. Ein
  // Einstieg über #home landet deshalb beim zuletzt verwendeten Haupt-Dex;
  // neue Konten beginnen im Meal-Log.
  if ((angefragt === 'home' || angefragt === 'search')) {
    angefragt = appLetzteDexRoute();
    history.replaceState(history.state, '', `#${angefragt}`);
  }
  if (angefragt === 'recipes') { location.replace('#food-log'); return; }
  const istBekannteRoute = ['profile', 'coins'].includes(angefragt)
    || bereiche.some(([ziel]) => ziel === angefragt)
    || angefragt.startsWith('collection/') || angefragt.startsWith('entry/');
  let route = istBekannteRoute ? angefragt : appDexFallbackRoute();
  if (!istBekannteRoute) {
    angefragt = route;
    history.replaceState(history.state, '', `#${route}`);
  }
  let richtung = navRichtung(angefragt);
  if (erzwungenesRueckwaertsZiel === angefragt) {
    erzwungenesRueckwaertsZiel = '';
    richtung = 'zurueck';
  }
  // Ein bereits fertig aufgebauter Dex ist unabhängig von der Richtung
  // sofort verfügbar. Die sichtbare Seite wird ohne Übergangsanimation
  // atomar getauscht.
  if (richtung !== 'gleich' && ansichtsCache.peek(route)
    && gemerkteAnsichtZeigen(route)) return;

  const vorherigeRoute = aktiveRoute;
  const vorherigerController = routeAbortController;
  const vorherigeSeite = document.documentElement.dataset.seite || '';
  if (richtung === 'gleich') vorherigerController?.abort();
  routeAbortController = new AbortController();
  const { signal } = routeAbortController;
  // Wie beim LOGMAN werden Seiten ohne Slide, Fade oder Gegenbewegung
  // gewechselt. Der alte Dex bleibt nur während des Datenladens stehen und
  // wird anschließend in einem Schritt durch die fertige Ansicht ersetzt.
  const view = renderChrome();
  /* Ab hier werden setSeite/applyPageLook nur noch gepuffert. Erst wenn
     die neue Ansicht wirklich fertig ist, wenden wir beide atomar an —
     zusammen mit dem Sichtbarwerden. Sonst sieht der Nutzer erst neue
     Farben und Wallpaper, während der Inhalt noch lädt. */
  beginSeiteDefer();
  beginPageLookDefer();
  if (route.startsWith('entry/')) {
    // Carry the rendered surface (including a selected wallpaper) over to
    // the detail view instead of briefly falling back to the neutral cream
    // collection background while the entry query is loading.
    const sourceView = app.querySelector(':scope > #view');
    dexLookAusAnsichtWiederherstellen(sourceView);
    dexLookAufAnsichtUebertragen(sourceView, view);
    if (sourceView) {
      for (const property of ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat']) {
        if (sourceView.style[property]) view.style[property] = sourceView.style[property];
      }
    }
  }
  if (route === 'profile') {
    setSeite('profile');
    // Sichtbarkeit und Reihenfolge des Menübandes werden hier bearbeitet.
    // Beim Zurückkehren muss deshalb auch die Liste eigener Dex frisch aus
    // der Datenbank kommen und darf nicht aus dem Dock-Cache stammen.
    appDockGeladen = false;
    const { mountProfile } = await profileModule();
    mountProfile(view, {
      session,
      profile,
      signal,
      onProfileUpdated: (aktuell) => {
        profile = aktuell;
        const slot = app.querySelector('.nav-av');
        if (slot) slot.innerHTML = avatarMarkup();
      },
    });
  } else if (route === 'coins') {
    setSeite('coins');
    applyPageLook('coins', categoryColor('coins'), 'wallpaper-game');
    view.classList.add('neo-dex-page', 'food-dex-page', 'coin-dex-page');
    prepareSpecialDexPage(view, 'coin-dex');
    const coinActions = await mountCoinDex(view, { userId: session.user.id, signal, mountChrome: mountCategoryChrome });
    installNeoDexChrome(view, {
      title: 'Coin-Dex',
      meta: coinActions?.meta || 'Belohnungen',
      closeHref: '#home',
    });
  } else if (route === 'body') {
    setSeite('body');
    applyPageLook('body', categoryColor('body'), 'wallpaper-measure');
    view.classList.add('neo-dex-page', 'food-dex-page', 'body-log-dex-page');
    prepareSpecialDexPage(view, 'body');
    const { mountBodyMetrics } = await bodyMetricsModule();
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    // Den Dex-Eintragsbereich beim ersten Body-Mount ergänzen. Spätere
    // Messwert-Updates erhalten seinen DOM-Knoten samt Realtime-Abo.
    let bodyDexEntriesInitialisiert = false;
    const rehydrateDexEntries = async () => {
      const wrap = view.querySelector(':scope > .wrap');
      if (!wrap) return;
      const content = wrap.querySelector(':scope > .kategorie-scrollinhalt') || wrap;
      if (!content.querySelector(':scope > [data-dex-entries]')) {
        content.insertAdjacentHTML('beforeend', dexEntriesSlotMarkup());
      }
      if (bodyDexEntriesInitialisiert) return;
      await renderDexEntries(view, { userId: session.user.id, rootKey: 'body', color: categoryColor('body'), signal, hideEmpty: true });
      bodyDexEntriesInitialisiert = true;
    };
    const bodyActions = await mountBodyMetrics(view, {
      session,
      profile,
      signal,
      onProfileUpdated: (aktuell) => { profile = aktuell; },
      onRendered: rehydrateDexEntries,
    });
    const openEntry = (type) => openDexEntryEditor({ type, userId: session.user.id, rootKey: 'body', onSaved: refresh });
    mountCategoryChrome(view, route, 'Body-Log', {
      pageLookScope: route, pageLookPattern: 'wallpaper-measure',
      onPlus: () => bodyActions?.openAddMenu?.(),
      onAddNote: () => openEntry('note'), onAddImage: () => openEntry('image'),
    });
    installNeoDexChrome(view, {
      title: 'Body-Log',
      meta: bodyActions?.meta || '0 Wiegungen',
      closeHref: '#home',
      editLabel: 'Body-Log bearbeiten',
      infoKind: 'body',
    });
  } else if (route === 'reminders') {
    setSeite('reminders');
    view.classList.add('neo-dex-page', 'food-dex-page', 'meal-log-dex-page');
    prepareSpecialDexPage(view, 'meal-log');
    const { mountReminders } = await remindersModule();
    const reminderActions = await mountReminders(view, { session, profile, signal });
    mountCategoryChrome(view, route, 'Meal-Log', {
      pageLookScope: route, pageLookPattern: 'wallpaper-burger',
      onPlus: () => reminderActions?.openAddMenu?.(),
    });
    installNeoDexChrome(view, {
      title: 'Meal-Log',
      meta: reminderActions?.meta || '5 Mahlzeiten',
      closeHref: '#home',
      editLabel: 'Meal-Log bearbeiten',
      infoKind: 'meal',
    });
  } else if (route === 'shopping') {
    setSeite('shopping');
    applyPageLook('shopping', categoryColor('shopping'), 'drops');
    view.classList.add('neo-dex-page', 'food-dex-page');
    prepareSpecialDexPage(view, 'shopping');
    view.classList.add('shopping-dex-page');
    const { mountShoppingList } = await shoppingModule();
    const shoppingActions = await mountShoppingList(view, { session, signal });
    mountCategoryChrome(view, route, 'EINKAUF', {
      pageLookScope: route, pageLookPattern: 'drops',
      // Kein Link/Notiz/Bild-Menue: Der Plus-Knopf springt direkt ins
      // eigene "Neuer Artikel"-Feld der Einkaufsliste.
      onPlus: () => shoppingActions?.openAddMenu?.(),
      onShare: shoppingActions?.isShared ? null : () => openShareSheet('shopping'),
    });
    installNeoDexChrome(view, {
      title: 'Einkauf',
      meta: 'Einkaufsliste',
      closeHref: '#home',
    });
  } else if (route === 'food-log') {
    setSeite('food-log');
    const foodSpace = await resolveSharedSpace(session.user.id, 'food-log', signal);
    const foodOwnerId = foodSpace.ownerId;
    const children = await loadCollections(foodOwnerId, { rootKey: 'food-log', signal });
    const childStats = await dexSammlungsStatistik(foodOwnerId, 'food-log', children, signal);
    if (signal?.aborted) return;
    view.classList.add('neo-dex-page', 'food-dex-page');
    view.classList.toggle('food-dex-dunkler-hintergrund', istDunkleOrdnerfarbe(pageLook('food-log', categoryColor('food-log'), 'triangles').color));
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
      ${collectionGridMarkup(children, { inheritedColor: categoryColor('food-log'), counts: childStats })}${dexEntriesSlotMarkup()}</div>`;
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type, foodKind = null) => openDexEntryEditor({
      type, foodKind, userId: foodOwnerId, rootKey: 'food-log', onSaved: refresh,
    });
    mountCategoryChrome(view, route, 'Fooddex', {
      pageLookScope: route, pageLookPattern: 'triangles',
      meta: `0 Einträge · ${children.length} Unter-Dex`,
      onAddNote: () => openEntry('note'),
      onAddLink: () => openEntry('link'),
      onAddImage: () => openEntry('image'),
      onAddRecipeLink: () => openEntry('link', 'recipe'),
      onAddOwnRecipe: () => openEntry('note', 'recipe'),
      onCreateSub: () => openCollectionEditor({ userId: foodOwnerId, rootKey: 'food-log', onSaved: refresh }),
      onSelect: () => startDexSelection(view, { userId: foodOwnerId, rootKey: 'food-log', onChanged: refresh }),
      onShare: foodSpace.isShared ? null : () => openShareSheet('food-log'),
    });
    // Food-Dex gets a compact Vozzy-inspired header: the primary actions live
    // in one small floating menu so the two-column entry grid has more room.
    installNeoDexChrome(view, {
      title: 'Fooddex',
      meta: `0 Einträge · ${children.length} Unter-Dex`,
      closeHref: '#home',
      editLabel: 'Fooddex bearbeiten',
    });
    bindLongPress(view.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', dexEinstellungenOeffner({
      userId: foodOwnerId, refresh, itemsById: new Map(children.map((kind) => [kind.id, kind])),
    }));
    await renderDexEntries(view, {
      userId: foodOwnerId, rootKey: 'food-log', color: categoryColor('food-log'), signal, hasChildren: children.length > 0,
      onChanged: (entries, total) => {
        if (!Array.isArray(entries)) return;
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
        const scrollMeta = view.querySelector('[data-food-scroll-meta]');
        if (scrollMeta) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
      },
    });
    subscribeToTableChanges({ table: 'collections', signal, onChange: refresh, onError: () => {} });
  } else if (route === 'training') {
    setSeite('training');
    // A collection mutation remounts this route while the Supabase request is
    // still pending. Paint the fixed Trainingdex surface immediately so the
    // shared template fallback (#FBE7A3) can never flash in that gap.
    applyPageLook('training', categoryColor('training'), 'wallpaper-dumbbell');
    const children = await loadCollections(session.user.id, { rootKey: 'training', signal });
    const childStats = await dexSammlungsStatistik(session.user.id, 'training', children, signal);
    if (signal?.aborted) return;
    view.classList.add('neo-dex-page', 'food-dex-page');
    view.classList.toggle('food-dex-dunkler-hintergrund', true);
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite">${collectionGridMarkup(children, { inheritedColor: categoryColor('training'), counts: childStats })}${dexEntriesSlotMarkup()}</div>`;
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type) => openDexEntryEditor({ type, userId: session.user.id, rootKey: 'training', onSaved: refresh });
    mountCategoryChrome(view, route, 'Trainingdex', {
      pageLookScope: route, pageLookPattern: 'wallpaper-dumbbell',
      meta: `${children.length} Unter-Dex`,
      onAddNote: () => openEntry('note'), onAddLink: () => openEntry('link'), onAddImage: () => openEntry('image'),
      onAddAudio: () => openEntry('audio'),
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'training', onSaved: refresh }),
      onSelect: () => startDexSelection(view, { userId: session.user.id, rootKey: 'training', onChanged: refresh }),
    });
    installNeoDexChrome(view, {
      title: 'Trainingdex',
      meta: `0 Einträge · ${children.length} Unter-Dex`,
      closeHref: '#home',
      editLabel: 'Trainingdex bearbeiten',
      infoKind: 'training',
    });
    bindLongPress(view.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', dexEinstellungenOeffner({
      userId: session.user.id, refresh, itemsById: new Map(children.map((kind) => [kind.id, kind])),
    }));
    await renderDexEntries(view, {
      userId: session.user.id, rootKey: 'training', color: categoryColor('training'), signal, hasChildren: children.length > 0,
      onChanged: (entries, total) => {
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta && Array.isArray(entries)) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
        const scrollMeta = view.querySelector('[data-food-scroll-meta]');
        if (scrollMeta && Array.isArray(entries)) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unter-Dex`;
      },
    });
  } else if (route.startsWith('collection/')) {
    const item = await getCollection(session.user.id, route.slice('collection/'.length), signal);
    if (!item) {
      const fallbackDex = appDexFallbackRoute();
      setPreference(LETZTER_DEX_KEY, fallbackDex);
      location.hash = fallbackDex;
      return;
    }
    await mountCustomCollection(view, item, signal);
  } else if (route.startsWith('entry/')) {
    // Keep the originating Dex surface during the transition. This prevents
    // both template Dex from flashing the neutral collection background or a
    // fallback wallpaper while the entry is loaded asynchronously.
    const activeTemplateDex = ['food-log', 'training', 'custom-dex'].find((dex) => (
      vorherigeRoute === dex || document.documentElement.dataset.seite === dex
    ));
    if (activeTemplateDex) {
      document.documentElement.dataset.seite = activeTemplateDex;
      dexLookAusAnsichtWiederherstellen(app.querySelector(':scope > #view'));
    }
    const { mountDexEntryDetail } = await entryDetailModule();
    await mountDexEntryDetail(view, { userId: session.user.id, id: route.slice('entry/'.length), signal });
  } else if (route === 'habits') {
    setSeite('habits');
    view.classList.add('neo-dex-page', 'food-dex-page', 'routine-dex-page');
    prepareSpecialDexPage(view, 'routines');
    const { mountRoutines } = await routinesModule();
    const routineActions = await mountRoutines(view, { session, signal });
    mountCategoryChrome(view, route, 'Routinen', {
      pageLookScope: route, pageLookPattern: 'triangles',
      onPlus: () => routineActions?.openRoutineEditor?.(),
    });
    installNeoDexChrome(view, {
      title: 'Routinen',
      meta: routineActions?.meta || '0 Routinen',
      closeHref: '#home',
      editLabel: 'Routinen bearbeiten',
      infoKind: 'habits',
    });
    await renderDexEntries(view, { userId: session.user.id, rootKey: 'habits', routineId: null, color: categoryColor('habits'), signal, hideEmpty: true });
    const pendingRoutineId = sessionStorage.getItem('muscledex:pending-routine-action');
    if (pendingRoutineId) {
      sessionStorage.removeItem('muscledex:pending-routine-action');
      queueMicrotask(async () => {
        const { openRoutineNotificationActions } = await routineActionsModule();
        openRoutineNotificationActions({
          userId: session.user.id,
          routineId: pendingRoutineId,
          onChanged: () => window.dispatchEvent(new HashChangeEvent('hashchange')),
        });
      });
    }
  } else if (route === 'sleep') {
    setSeite('sleep');
    view.classList.add('neo-dex-page', 'food-dex-page', 'sleep-log-dex-page');
    prepareSpecialDexPage(view, 'sleep');
    const { mountSleepDex } = await sleepModule();
    const sleepActions = await mountSleepDex(view, { userId: session.user.id, signal });
    mountCategoryChrome(view, route, 'Sleep-Log', {
      pageLookScope: route,
      pageLookPattern: 'wallpaper-moon',
      onPlus: () => sleepActions?.openAddMenu?.(),
    });
    installNeoDexChrome(view, {
      title: 'Sleep-Log',
      meta: sleepActions?.meta || 'Schlaf planen',
      editLabel: 'Sleep-Log bearbeiten',
      infoKind: 'sleep',
    });
  }
  // Wurde waehrend eines langsamen Mounts bereits zurueck navigiert, darf
  // die inzwischen veraltete Zielseite nicht spaeter doch noch ueber die
  // sofort wiederhergestellte Ansicht gelegt werden.
  if (generation !== renderGeneration || aktiveRoute !== vorherigeRoute && richtung === 'gleich') {
    view.remove();
    routeAbortController?.abort();
    routeAbortController = vorherigerController;
    commitSeiteDefer(true);
    commitPageLookDefer(true);
    return;
  }
  /* Chrome (html-Attribute + Custom Properties) und Shell zusammen anwenden,
     kurz bevor die neue Ansicht sichtbar wird. So sieht der Nutzer einen
     einzigen atomaren Wechsel statt Header→Hintergrund→Inhalt in Etappen. */
  commitSeiteDefer();
  commitPageLookDefer();
  const alteSeite = app.querySelector(':scope > #view');
  if (alteSeite) {
    if (richtung !== 'gleich') ansichtMerken(vorherigeRoute, alteSeite, vorherigerController, vorherigeSeite);
    else alteSeite.remove();
  }
  aktiveRoute = route;
  view.id = 'view';
  view.hidden = false;
  view.classList.remove('warten-auf-daten');
  appDexShellAktualisieren(route, view, signal);
  const dexAddButton = app.querySelector(':scope > .app-dex-dock .app-dex-menu')
    || view.querySelector('.kategorie-plus');
  if (dexAddButton) showGestureHintOnce({
    key: 'dex-hinzufuegen',
    title: 'Hier kommt Neues hinein',
    text: 'Der Menübutton passt sich jedem Dex an und zeigt die passenden Einträge.',
    gesture: 'add',
    target: dexAddButton,
    replace: true,
  });
}

function renderLadefehler(error) {
  const info = userFacingLoadError(error, { online: navigator.onLine });
  routeAbortController?.abort();
  ansichtsCache.clear();
  appDexShellEntfernen();
  app.querySelectorAll(':scope > main').forEach((node) => node.remove());
  const view = document.createElement('main');
  view.id = 'view';
  view.className = 'route-fehler-view';
  view.innerHTML = `<section class="route-fehler" role="alert">
    <span class="route-fehler-symbol" aria-hidden="true">!</span>
    <h1>${info.title}</h1>
    <p>${info.message}</p>
    <div class="route-fehler-aktionen">
      <button class="btn btn-primary" type="button" data-route-retry>Erneut versuchen</button>
      <a class="btn" href="#home">Zum letzten Dex</a>
    </div>
  </section>`;
  app.append(view);
  const retry = view.querySelector('[data-route-retry]');
  if (info.kind === 'session') {
    retry.textContent = 'Neu anmelden';
    retry.onclick = async () => {
      await supabase.auth.signOut({ scope: 'local' });
      session = null;
      profile = null;
      render();
    };
  } else retry.onclick = () => render();
  retry.focus({ preventScroll: true });
}

let dexModuleVorgeladen = false;
function dexModuleVorladen() {
  if (dexModuleVorgeladen) return;
  dexModuleVorgeladen = true;
  /* Ohne diesen Vorlauf lädt der Browser jedes Dex-Modul erst dann vom
     Netz/aus dem Service-Worker-Cache, wenn du zum ersten Mal auf die
     Kachel tippst. Das erklärt den „gestückelten“ Ersterst-Aufbau: erst
     kommt die JS-Datei, dann parst sie, dann laufen mount-Await-Ketten.
     Wir laden alle Dex-Module still im Leerlauf, sobald der erste Paint
     durch ist. Ab dann ist jeder Tap sofort. */
  const start = () => {
    remindersModule().catch(() => {});
    bodyMetricsModule().catch(() => {});
    sleepModule().catch(() => {});
    shoppingModule().catch(() => {});
    routinesModule().catch(() => {});
    entryDetailModule().catch(() => {});
  };
  if (typeof window.requestIdleCallback === 'function') {
    window.requestIdleCallback(start, { timeout: 3000 });
  } else {
    setTimeout(start, 800);
  }
}

let renderLaeuft = false;
let renderAngefordert = false;
async function render() {
  renderAngefordert = true;
  if (renderLaeuft) {
    ++renderGeneration;
    return;
  }
  renderLaeuft = true;
  try {
    while (renderAngefordert) {
      renderAngefordert = false;
      await renderRoute();
    }
    if (session) dexModuleVorladen();
  } catch (error) {
    if (isAbortError(error)) return;
    console.error('Seite konnte nicht geladen werden:', error);
    renderLadefehler(error);
  } finally {
    renderLaeuft = false;
  }
}

window.addEventListener('hashchange', () => {
  render();
});

if (!supabaseKonfiguriert) {
  renderSetup();
} else {
  supabase.auth.onAuthStateChange((event, neueSession) => {
    const bisherigeUserId = session?.user?.id;
    session = neueSession;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') {
      navigationZuruecksetzen('home');
      profile = null;
      profileLadePromise = null;
      appDockEigene = [];
      appDockGeladen = false;
      appDockCoinStand = null;
      setPreferenceUser('');
      preferencesLadeUserId = '';
      preferencesLadePromise = Promise.resolve();
    }
    if (event === 'SIGNED_IN' && !bisherigeUserId) {
      navigationZuruecksetzen('home');
      if (location.hash !== '#home') history.replaceState(null, '', '#home');
    }
    if (event === 'SIGNED_IN' && bisherigeUserId && bisherigeUserId !== session?.user?.id) {
      navigationZuruecksetzen((location.hash || '#home').slice(1) || 'home');
      profile = null;
      profileLadePromise = null;
      appDockEigene = [];
      appDockGeladen = false;
      appDockCoinStand = null;
    }
    if (session?.user?.id) {
      const aktiveUserId = session.user.id;
      setPreferenceUser(aktiveUserId);
      if (preferencesLadeUserId !== aktiveUserId) {
        preferencesLadeUserId = aktiveUserId;
        preferencesLadePromise = loadUserPreferences(aktiveUserId)
          .then(() => { syncInterfaceSounds(); })
          .catch((error) => console.warn('Einstellungen konnten nicht geladen werden:', error.message));
      }
      const reminderLoopStarten = (opts) => remindersModule()
        .then(({ startReminderLoop }) => startReminderLoop(aktiveUserId, opts)).catch(() => {});
      reminderLoopStarten();
      // Einmalige Onboarding-Karte für Benachrichtigungen. Nach dem Erlauben den
      // Loop mit forceRestart neu bewerten: sobald ein Server-Abo existiert, muss
      // der lokale 30-Sekunden-Loop abgebaut werden, sonst feuern beide (doppelt).
      maybeShowPushOnboarding(aktiveUserId, () => reminderLoopStarten({ forceRestart: true }));
    }
    // Ein still erneuertes Zugriffstoken darf die gerade benutzte Unterseite
    // nicht neu aufbauen. Auch wiederholte SIGNED_IN-Ereignisse desselben
    // Nutzers (z. B. nach Rueckkehr in die PWA) aktualisieren nur die Session.
    if (event === 'TOKEN_REFRESHED') return;
    if (event === 'SIGNED_IN' && bisherigeUserId === session?.user?.id && profile) return;
    syncInterfaceSounds();
    render();
  });
}
