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
import { capboyMarkup } from './brand.js';
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
  collectionGridMarkup, collectionIconMarkup, deleteCollection, getCollection, loadCollections, openCollectionEditor,
} from './collections.js';
import { prepareSpecialDexPage } from './specialDex.js';
import { entryButtonMarkup, hasMenuIcon, menuIconMarkup } from './menuIcons.js';

// Große Systembereiche werden erst geladen, wenn sie wirklich geöffnet
// werden. Vite erzeugt daraus eigene, browserseitig gecachte Chunks.
const profileModule = () => import('./profile.js');
const bodyMetricsModule = () => import('./bodyMetrics.js');
const remindersModule = () => import('./reminders.js');
const shoppingModule = () => import('./shoppingList.js');
const routinesModule = () => import('./routines.js');
const sleepModule = () => import('./sleep.js');

function dexModulVorbereiten(route = '') {
  const loader = ({
    body: bodyMetricsModule,
    reminders: remindersModule,
    shopping: shoppingModule,
    habits: routinesModule,
    sleep: sleepModule,
    profile: profileModule,
  })[route];
  if (loader) void loader().catch(() => {});
}

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
const APP_START_SPLASH_MS = 2000;
const appStartSplashBeginn = performance.now();
const appLogoSchriftBereit = document.fonts
  ? document.fonts.load('italic 700 54px "Work Sans"', 'CAPBOY').catch(() => [])
  : Promise.resolve([]);
const appSchriftenBereit = document.fonts
  ? Promise.race([
      Promise.all([
        document.fonts.load('800 16px Figtree'),
        document.fonts.load('900 16px "Work Sans"'),
        document.fonts.load('italic 700 16px "Work Sans"'),
        document.fonts.load('800 16px "JetBrains Mono"'),
      ]),
      new Promise((resolve) => setTimeout(resolve, 2500)),
    ]).catch(() => [])
  : Promise.resolve([]);

/* Die Wortmarke verwendet Text innerhalb eines SVG. Ohne diese Schranke
   zeichnet Safari beim Kaltstart fuer einen Frame seine Serif-Ersatzschrift.
   Erst die nachweislich geladene Work-Sans-Italic darf sichtbar werden. */
void appLogoSchriftBereit.finally(() => {
  document.documentElement.classList.add('app-logo-font-ready');
});

/* Der Splash wird sofort nach dem Parsen des Einstiegschunks gezeichnet. Der
   violette First Paint davor kommt bereits aus index.html, sodass auch auf einem
   kalten iPhone-Start kein cremefarbener Zwischenframe mehr sichtbar ist. */
app.innerHTML = `<div class="app-start-splash" role="status" aria-label="CAPBOY wird geladen">${capboyMarkup()}</div>`;

function appStartSplashVerwerfen() {
  const ausblenden = () => {
    document.documentElement.classList.remove('app-booting');
    app.querySelector(':scope > .app-start-splash')?.remove();
  };
  if (!document.fonts || document.fonts.status === 'loaded') ausblenden();
  else void appSchriftenBereit.finally(ausblenden);
}

async function appStartSplashAbwarten() {
  const rest = Math.max(0, APP_START_SPLASH_MS - (performance.now() - appStartSplashBeginn));
  await Promise.all([
    rest ? new Promise((resolve) => setTimeout(resolve, rest)) : Promise.resolve(),
    appSchriftenBereit,
  ]);
}

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

/* Der Cache fasst die sieben gerade nicht sichtbaren Ansichten der acht
   eingebauten Haupt-Dex. So wird eine bereits besuchte Hauptseite beim
   Durchblättern nicht sofort wieder verworfen und samt Daten neu aufgebaut.
   Listener und Timer abgelegter Ansichten sind weiterhin beendet; eigene Dex
   und Detailseiten bleiben durch das feste Limit begrenzt. */
const ansichtsCache = createLruCache({ limit: 8, onEvict: disposeViewEntry });

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
  ['--dex-seitenfarbe', '--dex-ink', '--dex-accent', '--dex-accent-ink', '--ordner', '--ordner-ink', '--dex-tapete', '--bg', '--app-bg', '--app-content-bg', '--app-chrome-bg', '--food-page-purple']
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
  ['--dex-accent', '--dex-accent-ink', '--ordner', '--ordner-ink'].forEach((property) => {
    const value = node.style.getPropertyValue(property).trim();
    if (value) root.style.setProperty(property, value);
  });
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
    '--dex-accent',
    '--dex-accent-ink',
    '--ordner',
    '--ordner-ink',
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
  appStartSplashVerwerfen();
  app.classList.remove('app-shell');
  appDexShellEntfernen();
  setSeite('setup');
  app.innerHTML = `
    <main class="setup-shell wrap">
      ${capboyMarkup()}
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
  appStartSplashVerwerfen();
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
      <div class="auth-marke">${capboyMarkup()}</div>
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
  appStartSplashVerwerfen();
  app.classList.remove('app-shell');
  appDexShellEntfernen();
  setSeite('auth');
  app.innerHTML = `
    <main class="auth-shell">
      <div class="auth-marke">${capboyMarkup()}</div>
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
  ['body', 'COMP', 'Gewicht, Hautfalten, Taille und Trends.', 'body', 'cyan', 'Aktiv'],
  ['reminders', 'TRACKER', 'Mahlzeiten, Supplements und Wasser.', 'reminders', 'pink', 'Aktiv'],
  ['food-log', 'REZEPTE', 'Cheat-Meals und Rezeptideen wiederfinden.', 'food', 'violet', 'Aktiv'],
  ['essen', 'ESSEN', 'Ernährungswissen, Lebensmittel und Essverhalten.', 'essen', 'burgundy', 'Aktiv'],
  ['supps', 'SUPPS', 'Supplement-Wissen, Wirkung und Dosierung.', 'supps', 'coral', 'Aktiv'],
  ['training', 'TRAINING', 'Trainingseinheiten, Übungen und Trainingswissen.', 'training', 'orange', 'Aktiv'],
  ['shopping', 'EINKAUF', 'Alles fuer den naechsten Wocheneinkauf.', 'shopping', 'gruen', 'Aktiv'],
  ['habits', 'ROUTINEN', 'Kleine Routinen täglich abhaken.', 'habits', 'gelb', 'Aktiv'],
  ['sleep', 'SCHLAF', 'Schlaf planen, einchecken und Zusammenhänge erkennen.', 'sleep', 'navy', 'Aktiv'],
  ['stress', 'MIND', 'Motivation, mentale Stärke und Stressmanagement.', 'stress', 'periwinkle', 'Aktiv'],
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
  if (route === 'profile') return true;
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
    return appDockEigene.find((item) => `collection/${item.id}` === route)?.name || 'Seite';
  }
  return sammlungen.find(([key]) => key === route)?.[1]
    || (route === 'coins' ? 'CAPSTARS' : 'Seite');
}

function appDockEintraegeMarkup(aktiveDockRoute) {
  const standard = sichtbareSammlungen().map(([route, titel]) => `
    <a class="app-dex-tab${aktiveDockRoute === route ? ' aktiv' : ''}" href="#${route}"
       data-sammlung="${route}" style="--app-dex-tab-color:${escapeHtml(pageLook(route, categoryColor(route), 'drops').color)}"
       aria-label="${escapeHtml(titel)}"${aktiveDockRoute === route ? ' aria-current="page"' : ''}>
      <span aria-hidden="true">${hasMenuIcon(route) ? menuIconMarkup(route, 'app-dex-tab-icon') : categoryIconMarkup(route, 'app-dex-tab-icon')}</span>
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
  return standard + eigene;
}

function appSyncStatusAktualisieren() {
  const status = app.querySelector(':scope > .app-dex-header .app-dex-sync');
  if (!status) return;
  const online = navigator.onLine;
  /* Der erfolgreiche Normalzustand bleibt still. Ein permanenter Haken war
     mehrdeutig (online, gespeichert oder erledigt?) und konkurrierte mit den
     CAPSTARS. Sichtbar wird der Platz nur, wenn wirklich Aufmerksamkeit nötig
     ist. Die Offline-Fähigkeit und der Service Worker bleiben davon unberührt. */
  status.hidden = online;
  status.textContent = online ? '' : 'OFFLINE';
  status.className = `app-dex-sync save-dot${online ? '' : ' wait'}`;
  if (online) {
    status.removeAttribute('title');
    status.removeAttribute('aria-label');
    return;
  }
  status.title = 'Offline · Verbindung zum Synchronisieren erforderlich';
  status.setAttribute('aria-label', status.title);
}

function appDexShellZeichnen(route, view) {
  if (!istAppHauptDex(route, view)) {
    appDexShellEntfernen();
    return;
  }
  const aktiveDockRoute = view.dataset.appDockRoute || route;
  const istProfil = route === 'profile';
  const istCoins = route === 'coins';
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
      <span class="app-dex-brand" aria-label="CAPBOY">${capboyMarkup()}</span>
      <div class="app-dex-header-actions">
        ${coinDexIsVisible() ? coinHeaderMarkup(appDockCoinStand || { balance: 0 }, { aktiv: istCoins }) : ''}
        <span class="app-dex-sync save-dot" role="status"></span>
        <a class="nav-av nav-av-fb${istProfil ? ' aktiv' : ''}" href="#profile"
           aria-label="Profil und Einstellungen"${istProfil ? ' aria-current="page"' : ''}>${avatarMarkup()}</a>
      </div>
    </div>`;

  let dock = app.querySelector(':scope > .app-dex-dock');
  if (!dock) {
    dock = document.createElement('nav');
    dock.className = 'app-dex-dock';
    app.append(dock);
  }
  dock.setAttribute('aria-label', 'Seite wechseln und Eintrag hinzufügen');
  dock.innerHTML = `
    <div class="app-dex-dock-inner">
      <div class="app-dex-tabs">${appDockEintraegeMarkup(aktiveDockRoute)}</div>
      <button class="app-dex-menu" type="button" aria-label="${istProfil
        ? `Zurück zu ${escapeHtml(appDockTitel(aktiveDockRoute))}`
        : `Menü für ${escapeHtml(appDockTitel(aktiveDockRoute))} öffnen`}">
        ${entryButtonMarkup()}
      </button>
    </div>`;
  appSyncStatusAktualisieren();

  const tabLeiste = dock.querySelector('.app-dex-tabs');
  tabLeiste.scrollLeft = alterScrollstand;
  // Zwischen pointerdown und click kann WebKit den noch nicht ausgewerteten
  // Modul-Chunk des angetippten System-Dex bereits vorbereiten. Dabei werden
  // keine Daten geladen und keine sichtbare Ansicht verändert.
  tabLeiste.addEventListener('pointerdown', (event) => {
    const ziel = event.target.closest?.('.app-dex-tab')?.getAttribute('href')?.replace(/^#/, '');
    if (ziel) dexModulVorbereiten(ziel);
  }, { passive: true });
  requestAnimationFrame(() => {
    const aktiv = tabLeiste.querySelector('.app-dex-tab.aktiv');
    if (!aktiv) return;
    const links = aktiv.offsetLeft;
    const rechts = links + aktiv.offsetWidth;
    const istAusserhalb = links < tabLeiste.scrollLeft
      || rechts > tabLeiste.scrollLeft + tabLeiste.clientWidth;
    const maximal = Math.max(0, tabLeiste.scrollWidth - tabLeiste.clientWidth);
    const gewuenscht = istAusserhalb
      ? links - ((tabLeiste.clientWidth - aktiv.offsetWidth) / 2)
      : tabLeiste.scrollLeft;
    const rasterpunkte = [...tabLeiste.querySelectorAll('.app-dex-tab')]
      .map((tab) => Math.min(tab.offsetLeft, maximal));
    const eingerastet = rasterpunkte.reduce((naechster, punkt) => (
      Math.abs(punkt - gewuenscht) < Math.abs(naechster - gewuenscht) ? punkt : naechster
    ), 0);
    tabLeiste.scrollTo({ left: eingerastet, behavior: istAusserhalb ? 'smooth' : 'auto' });
  });

  dock.querySelector('.app-dex-menu').onclick = () => {
    if (istProfil) {
      location.hash = aktiveDockRoute;
      return;
    }
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
  // Während eines schnellen Durchblätterns zählt nur der zuletzt erreichte
  // Dex. Lokal ist er sofort gespeichert; die Serverkopie folgt gesammelt,
  // sobald die Navigation fünf Sekunden ruht.
  if (route !== 'profile') {
    setPreference(LETZTER_DEX_KEY, view.dataset.appDockRoute || route, { syncDelay: 5000 });
  }
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

// Unterordner behalten ihre Verwaltungsaktionen per Longpress. Die allgemeine
// Seiteninfo gehoert dagegen nur zur Hauptseite und wird hier bewusst nicht
// angeboten: Das kompakte Menue enthaelt ausschliesslich Umbenennen/Loeschen.
function unterordnerEinstellungenOeffner({ userId, refresh, itemsById }) {
  return (element) => {
    const item = itemsById?.get(element.dataset.collectionId);
    if (!item) return null;
    return () => settingsSheet(`collection-${item.id}`, refresh, {
      title: 'Ordner bearbeiten',
      disableAppearance: true,
      onRename: () => openCollectionEditor({
        userId,
        rootKey: item.root_key,
        parentId: item.parent_id,
        existing: item,
        onSaved: refresh,
      }),
      onDelete: async () => {
        if (!confirm(`„${item.name}“ samt Unterordnern wirklich löschen?`)) return;
        try {
          await deleteCollection(userId, item);
          toast('Ordner gelöscht');
          refresh();
        } catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
      },
      deleteLabel: 'Ordner löschen',
    });
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
  const order = ['food-log', 'essen', 'reminders', 'supps', 'sleep', 'shopping', 'habits', 'training', 'body', 'stress'];
  setPreference('muscledex:sammlungs-reihenfolge', order);
  setPreference('muscledex:sichtbare-sammlungen', order);
  setPreference('muscledex:coin-dex-sichtbar', true);
  const looks = {
    'food-log': ['#F0C987', 'wallpaper-pizza', '🍕'],
    essen: ['#945B39', 'wallpaper-essen', '🍽️'],
    reminders: ['#FFEDE3', 'wallpaper-burger', '🍔'],
    supps: ['#D8BFD8', 'wallpaper-supps', '💊'],
    sleep: ['#0E1D47', 'wallpaper-moon', '😴'],
    shopping: ['#FFEDE3', 'wallpaper-brokkoli', '🛒'],
    habits: ['#3C153B', 'wallpaper-wolke', '🧠'],
    training: ['#203C3D', 'wallpaper-dumbbell', '💪🏻'],
    body: ['#94DEFF', 'wallpaper-comp', '📐'],
    stress: ['#E36887', 'wallpaper-stress', '⚡'],
    coins: ['#F9DC5C', 'wallpaper-game', '🎮'],
  };
  Object.entries(looks).forEach(([route, [color, pattern, emoji]]) => {
    setPreference(`muscledex:kategorie-farbe:${route}`, color);
    setPreference(`muscledex:kategorie-icon:${route}`, `emoji:${emoji}`);
    setPageLookColor(route, color);
    setPageLookPattern(route, pattern);
  });
  setPreference(key, true);
  return true;
}

const dexEntriesSlotMarkup = () => '<div class="dex-eintraege" data-dex-entries><div class="daten-laden">Einträge werden geladen …</div></div>';

const GRID_COLLECTION_ROOTS = new Set(['food-log', 'essen', 'supps', 'training', 'stress']);

function gridCollectionMetaText(entries = 0, folders = 0) {
  const entryLabel = entries === 1 ? 'Eintrag' : 'Einträge';
  const folderLabel = folders === 1 ? 'Unterordner' : 'Unterordner';
  return `${entries} ${entryLabel} · ${folders} ${folderLabel}`;
}

function gridCollectionMastheadMarkup(title, folders = 0) {
  return `<section class="dex-sammlungskopf" data-grid-collection-header>
    <div class="dex-sammlungskopf-text">
      <span>Wissenssammlung</span>
      <h1>${escapeHtml(title)}</h1>
      <small data-grid-collection-meta>${gridCollectionMetaText(0, folders)}</small>
    </div>
    <button class="som-info-knopf" type="button" data-grid-collection-info aria-label="Info zur Sammlung">i</button>
  </section>`;
}

function mountGridCollectionMasthead(root, { infoKind, title }) {
  root.querySelector('[data-grid-collection-info]')?.addEventListener('click', () => {
    openNeoDexInfoDialog(infoKind, title);
  });
}

function updateGridCollectionMasthead(root, entries, folders) {
  const meta = root.querySelector('[data-grid-collection-meta]');
  if (meta) meta.textContent = gridCollectionMetaText(entries, folders);
}

function openNeoDexInfoDialog(kind = 'food', customTitle = '') {
  const training = kind === 'training';
  const supps = kind === 'supps';
  const essen = kind === 'essen';
  const custom = kind === 'custom';
  const meal = kind === 'meal';
  const sleep = kind === 'sleep';
  const body = kind === 'body';
  const shopping = kind === 'shopping';
  const habits = kind === 'habits';
  const coins = kind === 'coins';
  const stress = kind === 'stress';
  const title = customTitle || (custom ? 'Eigene Seite' : body ? 'COMP' : sleep ? 'SCHLAF' : meal ? 'TRACKER' : training ? 'TRAINING' : supps ? 'SUPPS' : essen ? 'ESSEN' : shopping ? 'EINKAUF' : habits ? 'ROUTINEN' : stress ? 'MIND' : coins ? 'CAPSTARS' : 'REZEPTE');
  const copy = body
    ? `<p>In <b>COMP</b> hältst du Gewicht, Taillenumfang und deine <b>12-Falten-Summe</b> fest.</p>
      <p>Entscheidend ist nicht ein einzelner Tageswert, sondern der <b>geglättete Verlauf</b>. Ergänzende Daten aus Training und Erholung helfen, Veränderungen sinnvoll einzuordnen.</p>
      <p>Die Auswertung zeigt beobachtete Trends, keine exakte Körperfettmessung und keine medizinische Diagnose.</p>`
    : sleep
    ? `<p>Im <b>SCHLAF</b> planst du deinen Schlafrhythmus und hältst morgens <b>Schlafdauer</b>, <b>Qualität</b> und <b>Energie</b> fest.</p>
      <p>Abendroutinen und Erinnerungen helfen dir, deinen Plan im Alltag umzusetzen. Persönliche Trends werden erst aus mehreren vergleichbaren Check-ins abgeleitet.</p>
      <p>Die Auswertung zeigt beobachtete Zusammenhänge und ersetzt keine medizinische Diagnose.</p>`
    : meal
    ? `<p>Auf der Seite <b>TRACKER</b> planst und protokollierst du <b>Mahlzeiten</b>, <b>Supplements</b> und deine Flüssigkeitszufuhr über den Tag.</p>
      <p>Die Zeitfenster geben deinem Tagesplan Struktur. Zu jeder Mahlzeit kannst du Hinweise hinterlegen und Erinnerungen gezielt aktivieren.</p>
      <p>Über den Hinzufügen-Button erfasst du Lebensmittel oder ergänzt deine Planung.</p>`
    : shopping
    ? `<p>Auf der Seite <b>EINKAUF</b> sammelst und planst du Lebensmittel für deinen nächsten Einkauf.</p><p>Gruppen und Status helfen dir, offene und bereits erledigte Besorgungen schnell zu unterscheiden.</p>`
    : habits
    ? `<p>Auf der Seite <b>ROUTINEN</b> planst du wiederkehrende Abläufe und hältst ihre Erledigung fest.</p><p>Die Übersicht zeigt dir, was heute ansteht und wie konstant du deine Routinen umsetzt.</p>`
    : stress
    ? `<p>Auf der Seite <b>MIND</b> sammelst du <b>Motivation</b>, mentale Stärke und Strategien für den Umgang mit Stress.</p><p>Mit <b>Tags</b> und <b>Unterordnern</b> ordnest du Impulse, Belastungen, Auslöser und Entspannung so, dass du hilfreiche Muster schnell wiederfindest.</p>`
    : coins
    ? `<p>Auf der Seite <b>CAPSTARS</b> sammelst du CAPSTARS für erledigte Routinen, Check-ins und Messungen.</p>
      <p>Du legst eigene Belohnungen und deren Preis fest. Sobald dein Kontostand reicht, kannst du eine Belohnung einlösen.</p>
      <p>Dein Kontostand bleibt auch im festen App-Header sichtbar.</p>`
    : custom
    ? `<p>In <b>${escapeHtml(title)}</b> sammelst du eigene Notizen, Links, Bilder und Tonaufnahmen an einem Ort.</p>
      <p>Mit <b>Tags</b> und <b>Unterordnern</b> strukturierst du die Inhalte so, wie es für dein Thema sinnvoll ist.</p>
      <p>Die Farbe kannst du an der Hauptseite ändern. Unterordner übernehmen den Look automatisch.</p>`
    : training
    ? `<p>In <b>TRAINING</b> sammelst du <b>Übungen</b>, <b>Trainingswissen</b>, Links, Bilder, Videos und Tonaufnahmen an einem Ort.</p>
      <p>Mit Klassen wie <b>Übungen</b>, <b>Regeneration</b>, <b>Tipps</b> oder <b>Verletzung</b> findest du relevante Inhalte schnell wieder.</p>
      <p>Unterordner helfen dir, Trainingsbereiche sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`
    : supps
    ? `<p>In <b>SUPPS</b> sammelst du Wissen zu <b>Supplements</b>, Wirkung, Dosierung, Produkten und Studien an einem Ort.</p>
      <p>Mit Themen wie <b>Grundlagen</b>, <b>Wirkung</b>, <b>Dosierung</b> oder <b>Studien</b> findest du relevante Inhalte schnell wieder.</p>
      <p>Unterordner helfen dir, Supplement-Gruppen sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`
    : essen
    ? `<p>In <b>ESSEN</b> sammelst du Wissen zu <b>Ernährung</b>, Lebensmitteln, Mahlzeiten und Essverhalten an einem Ort.</p>
      <p>Mit Themen wie <b>Ernährung</b>, <b>Lebensmittel</b>, <b>Mahlzeiten</b> oder <b>Studien</b> findest du Videos und Einträge schnell wieder.</p>
      <p>Unterordner helfen dir, Ernährungsbereiche sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`
    : `<p>In <b>REZEPTE</b> sammelst du <b>eigene Rezepte</b>, <b>Rezeptideen</b>, Links, Bilder und Videos an einem Ort.</p>
      <p>Mit <b>Tags</b> wie <b>Cheat-Meals</b>, <b>Low Carb</b> oder <b>High Carb</b> sortierst du schnell, was immer geht — besonders für ideenlose Tage.</p>
      <p>Unterordner helfen dir, größere Bereiche sauber zu trennen, ohne den schnellen Zugriff zu verlieren.</p>`;
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
  const gridDexSkin = GRID_COLLECTION_ROOTS.has(item.root_key);
  const neoDexSkin = gridDexSkin || customDexSkin;
  const isSubDex = Boolean(item.parent_id) || item.root_key !== 'home';
  const foodDexSkin = item.root_key === 'food-log';
  const trainingDexSkin = item.root_key === 'training';
  const suppsDexSkin = item.root_key === 'supps';
  const essenDexSkin = item.root_key === 'essen';
  const stressDexSkin = item.root_key === 'stress';
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
    ? pageLook(item.root_key, inheritedColor, foodDexSkin ? 'wallpaper-pizza' : essenDexSkin ? 'wallpaper-essen' : trainingDexSkin ? 'wallpaper-dumbbell' : suppsDexSkin ? 'wallpaper-supps' : stressDexSkin ? 'wallpaper-stress' : 'drops').pattern
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
  const collectionTitleMarkup = gridDexSkin
    ? gridCollectionMastheadMarkup(item.name, children.length)
    : neoDexSkin ? '' : `<div class="seitenkopf"><h1>${escapeHtml(item.name)}</h1></div>`;
  container.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
    ${collectionTitleMarkup}
    ${collectionGridMarkup(children, { inheritedColor, counts: childStats })}
    ${dexEntriesSlotMarkup()}
  </div>`;
  if (gridDexSkin) {
    mountGridCollectionMasthead(container, {
      infoKind: foodDexSkin ? 'food' : item.root_key,
      title: item.name,
    });
  }
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
    meta: `${children.length} Unterordner`,
    onAddNote: () => openEntry('note'),
    onAddLink: () => openEntry('link'),
    onAddImage: () => openEntry('image'),
    onAddAudio: ['home', 'essen', 'training', 'supps', 'stress'].includes(item.root_key) ? () => openEntry('audio') : null,
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
      if (!confirm(`„${item.name}“ samt Unterordnern wirklich löschen?`)) return;
      try {
        await deleteCollection(ownerId, item);
        toast(isSubDex ? 'Ordner gelöscht' : 'Seite gelöscht');
        location.hash = backHref.slice(1);
      } catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
    },
    title: isSubDex ? 'Ordner bearbeiten' : 'Seite bearbeiten',
    deleteLabel: isSubDex ? 'Ordner löschen' : 'Seite löschen',
  });
  if (neoDexSkin) {
    installNeoDexChrome(container, {
      title: item.name,
      meta: `0 Einträge · ${children.length} Unterordner`,
      closeHref: backHref,
      editLabel: `${item.name} bearbeiten`,
      infoKind: customDexSkin ? 'custom' : foodDexSkin ? 'food' : item.root_key,
    });
  }
  bindLongPress(container.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', unterordnerEinstellungenOeffner({
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
      if (meta) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
      const scrollMeta = container.querySelector('[data-food-scroll-meta]');
      if (scrollMeta) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
      updateGridCollectionMasthead(container, total ?? entries.length, children.length);
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
  // neue Konten beginnen im TRACKER-Dex.
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
    applyPageLook('profile', categoryColor('profile'), 'drops');
    // Das Profil bleibt Teil derselben festen App-Schale. Im Menüband bleibt
    // deshalb die zuletzt geöffnete Inhaltsseite markiert.
    view.dataset.appDockRoute = appLetzteDexRoute();
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
      title: 'CAPSTARS',
      meta: coinActions?.meta || 'Belohnungen',
      closeHref: '#home',
    });
  } else if (route === 'body') {
    setSeite('body');
    applyPageLook('body', categoryColor('body'), 'wallpaper-comp');
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
    mountCategoryChrome(view, route, 'COMP', {
      pageLookScope: route, pageLookPattern: 'wallpaper-comp',
      onPlus: () => bodyActions?.openAddMenu?.(),
      onAddNote: () => openEntry('note'), onAddImage: () => openEntry('image'),
    });
    installNeoDexChrome(view, {
      title: 'COMP',
      meta: bodyActions?.meta || '0 Wiegungen',
      closeHref: '#home',
      editLabel: 'COMP bearbeiten',
      infoKind: 'body',
    });
  } else if (route === 'reminders') {
    setSeite('reminders');
    view.classList.add('neo-dex-page', 'food-dex-page', 'meal-log-dex-page');
    prepareSpecialDexPage(view, 'meal-log');
    const { mountReminders } = await remindersModule();
    const reminderActions = await mountReminders(view, { session, profile, signal });
    mountCategoryChrome(view, route, 'TRACKER', {
      pageLookScope: route, pageLookPattern: 'wallpaper-burger',
      onPlus: () => reminderActions?.openAddMenu?.(),
    });
    installNeoDexChrome(view, {
      title: 'TRACKER',
      meta: reminderActions?.meta || '5 Mahlzeiten',
      closeHref: '#home',
      editLabel: 'TRACKER bearbeiten',
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
      title: 'EINKAUF',
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
      ${gridCollectionMastheadMarkup('REZEPTE', children.length)}
      ${collectionGridMarkup(children, { inheritedColor: categoryColor('food-log'), counts: childStats })}${dexEntriesSlotMarkup()}</div>`;
    mountGridCollectionMasthead(view, { infoKind: 'food', title: 'REZEPTE' });
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type, foodKind = null) => openDexEntryEditor({
      type, foodKind, userId: foodOwnerId, rootKey: 'food-log', onSaved: refresh,
    });
    mountCategoryChrome(view, route, 'REZEPTE', {
      pageLookScope: route, pageLookPattern: 'triangles',
      meta: `0 Einträge · ${children.length} Unterordner`,
      onAddNote: () => openEntry('note'),
      onAddLink: () => openEntry('link'),
      onAddImage: () => openEntry('image'),
      onAddRecipeLink: () => openEntry('link', 'recipe'),
      onAddOwnRecipe: () => openEntry('note', 'recipe'),
      onCreateSub: () => openCollectionEditor({ userId: foodOwnerId, rootKey: 'food-log', onSaved: refresh }),
      onSelect: () => startDexSelection(view, { userId: foodOwnerId, rootKey: 'food-log', onChanged: refresh }),
      onShare: foodSpace.isShared ? null : () => openShareSheet('food-log'),
    });
    // REZEPTE bekommt einen kompakten Vozzy-inspirierten Header: die
    // wichtigsten Aktionen liegen in einem kleinen Floating-Menü, damit das
    // zweispaltige Eintragsraster mehr Platz hat.
    installNeoDexChrome(view, {
      title: 'REZEPTE',
      meta: `0 Einträge · ${children.length} Unterordner`,
      closeHref: '#home',
      editLabel: 'REZEPTE bearbeiten',
    });
    bindLongPress(view.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', unterordnerEinstellungenOeffner({
      userId: foodOwnerId,
      refresh,
      itemsById: new Map(children.map((kind) => [kind.id, kind])),
    }));
    await renderDexEntries(view, {
      userId: foodOwnerId, rootKey: 'food-log', color: categoryColor('food-log'), signal, hasChildren: children.length > 0,
      onChanged: (entries, total) => {
        if (!Array.isArray(entries)) return;
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        const scrollMeta = view.querySelector('[data-food-scroll-meta]');
        if (scrollMeta) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        updateGridCollectionMasthead(view, total ?? entries.length, children.length);
      },
    });
    subscribeToTableChanges({ table: 'collections', signal, onChange: refresh, onError: () => {} });
  } else if (['essen', 'training', 'supps'].includes(route)) {
    const pageConfig = {
      essen: { title: 'ESSEN', pattern: 'wallpaper-essen' },
      training: { title: 'TRAINING', pattern: 'wallpaper-dumbbell' },
      supps: { title: 'SUPPS', pattern: 'wallpaper-supps' },
    }[route];
    const { title, pattern } = pageConfig;
    const routeColor = categoryColor(route);
    setSeite(route);
    // A collection mutation remounts this route while the Supabase request is
    // still pending. Paint the fixed Wissensseite immediately so the
    // shared template fallback (#F0C987) can never flash in that gap.
    applyPageLook(route, routeColor, pattern);
    const children = await loadCollections(session.user.id, { rootKey: route, signal });
    const childStats = await dexSammlungsStatistik(session.user.id, route, children, signal);
    if (signal?.aborted) return;
    view.classList.add('neo-dex-page', 'food-dex-page');
    view.classList.toggle('food-dex-dunkler-hintergrund', istDunkleOrdnerfarbe(routeColor));
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
      ${gridCollectionMastheadMarkup(title, children.length)}
      ${collectionGridMarkup(children, { inheritedColor: routeColor, counts: childStats })}${dexEntriesSlotMarkup()}</div>`;
    mountGridCollectionMasthead(view, { infoKind: route, title });
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type) => openDexEntryEditor({ type, userId: session.user.id, rootKey: route, onSaved: refresh });
    mountCategoryChrome(view, route, title, {
      pageLookScope: route, pageLookPattern: pattern,
      meta: `${children.length} Unterordner`,
      onAddNote: () => openEntry('note'), onAddLink: () => openEntry('link'), onAddImage: () => openEntry('image'),
      onAddAudio: () => openEntry('audio'),
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: route, onSaved: refresh }),
      onSelect: () => startDexSelection(view, { userId: session.user.id, rootKey: route, onChanged: refresh }),
    });
    installNeoDexChrome(view, {
      title,
      meta: `0 Einträge · ${children.length} Unterordner`,
      closeHref: '#home',
      editLabel: `${title} bearbeiten`,
      infoKind: route,
    });
    bindLongPress(view.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', unterordnerEinstellungenOeffner({
      userId: session.user.id,
      refresh,
      itemsById: new Map(children.map((kind) => [kind.id, kind])),
    }));
    await renderDexEntries(view, {
      userId: session.user.id, rootKey: route, color: routeColor, signal, hasChildren: children.length > 0,
      onChanged: (entries, total) => {
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta && Array.isArray(entries)) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        const scrollMeta = view.querySelector('[data-food-scroll-meta]');
        if (scrollMeta && Array.isArray(entries)) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        if (Array.isArray(entries)) updateGridCollectionMasthead(view, total ?? entries.length, children.length);
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
    const activeTemplateDex = ['food-log', 'essen', 'training', 'supps', 'stress', 'custom-dex'].find((dex) => (
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
    mountCategoryChrome(view, route, 'ROUTINEN', {
      pageLookScope: route, pageLookPattern: 'triangles',
      onPlus: () => routineActions?.openRoutineEditor?.(),
    });
    installNeoDexChrome(view, {
      title: 'ROUTINEN',
      meta: routineActions?.meta || '0 Routinen',
      closeHref: '#home',
      editLabel: 'ROUTINEN bearbeiten',
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
    mountCategoryChrome(view, route, 'SCHLAF', {
      pageLookScope: route,
      pageLookPattern: 'wallpaper-moon',
      onPlus: () => sleepActions?.openAddMenu?.(),
    });
    installNeoDexChrome(view, {
      title: 'SCHLAF',
      meta: sleepActions?.meta || 'Schlaf planen',
      editLabel: 'SCHLAF bearbeiten',
      infoKind: 'sleep',
    });
  } else if (route === 'stress') {
    setSeite('stress');
    // Fixierte Farbe und Tapete zuerst setzen, damit waehrend des Ladens
    // (siehe TRAINING-Muster) niemals der neutrale Sammlungs-Look aufblitzt.
    applyPageLook('stress', categoryColor('stress'), 'wallpaper-stress');
    const children = await loadCollections(session.user.id, { rootKey: 'stress', signal });
    const childStats = await dexSammlungsStatistik(session.user.id, 'stress', children, signal);
    if (signal?.aborted) return;
    view.classList.add('neo-dex-page', 'food-dex-page');
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
      ${gridCollectionMastheadMarkup('MIND', children.length)}
      ${collectionGridMarkup(children, { inheritedColor: categoryColor('stress'), counts: childStats })}${dexEntriesSlotMarkup()}</div>`;
    mountGridCollectionMasthead(view, { infoKind: 'stress', title: 'MIND' });
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type) => openDexEntryEditor({ type, userId: session.user.id, rootKey: 'stress', onSaved: refresh });
    mountCategoryChrome(view, route, 'MIND', {
      pageLookScope: route, pageLookPattern: 'wallpaper-stress',
      meta: `${children.length} Unterordner`,
      onAddNote: () => openEntry('note'), onAddLink: () => openEntry('link'), onAddImage: () => openEntry('image'),
      onAddAudio: () => openEntry('audio'),
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'stress', onSaved: refresh }),
      onSelect: () => startDexSelection(view, { userId: session.user.id, rootKey: 'stress', onChanged: refresh }),
    });
    installNeoDexChrome(view, {
      title: 'MIND',
      meta: `0 Einträge · ${children.length} Unterordner`,
      closeHref: '#home',
      editLabel: 'MIND bearbeiten',
      infoKind: 'stress',
    });
    bindLongPress(view.querySelector('.unter-sammlungen-grid'), '.dex-ordner-test', unterordnerEinstellungenOeffner({
      userId: session.user.id,
      refresh,
      itemsById: new Map(children.map((kind) => [kind.id, kind])),
    }));
    await renderDexEntries(view, {
      userId: session.user.id, rootKey: 'stress', color: categoryColor('stress'), signal, hasChildren: children.length > 0,
      onChanged: (entries, total) => {
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta && Array.isArray(entries)) meta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        const scrollMeta = view.querySelector('[data-food-scroll-meta]');
        if (scrollMeta && Array.isArray(entries)) scrollMeta.textContent = `${total ?? entries.length} Einträge · ${children.length} Unterordner`;
        if (Array.isArray(entries)) updateGridCollectionMasthead(view, total ?? entries.length, children.length);
      },
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
  if (app.querySelector(':scope > .app-start-splash')) await appStartSplashAbwarten();
  if (generation !== renderGeneration) {
    view.remove();
    commitSeiteDefer(true);
    commitPageLookDefer(true);
    return;
  }
  commitSeiteDefer();
  commitPageLookDefer();
  appStartSplashVerwerfen();
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
    text: 'Der Menübutton passt sich jeder Seite an und zeigt die passenden Einträge.',
    gesture: 'add',
    target: dexAddButton,
    replace: true,
  });
}

function renderLadefehler(error) {
  appStartSplashVerwerfen();
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
      <a class="btn" href="#home">Zur letzten Seite</a>
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
