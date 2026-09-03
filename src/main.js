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
import { dexEntryOverviewMarkup, loadAllDexEntries, openDexEntryEditor, renderDexEntries, vorschaubilderEinblenden } from './dexEntries.js';
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
  applyPageLook, categoryColor, categoryIconMarkup, materialIconMarkup, mountCategoryChrome, pageLook, setPageLookColor, setPageLookPattern, settingsSheet,
} from './categoryIcons.js';
import {
  collectionGridMarkup, collectionIconMarkup, deleteCollection, getCollection, loadCollections, mainDexFolderSvg, openCollectionEditor, saveCollection,
} from './collections.js';
import { foodDexActionsMarkup } from './foodDexActions.js';
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
let vorgemerkteSuche = '';
let browserRueckwaerts = false;
let appRueckwaerts = false;
let popstateNavigation = false;
let aktiveRoute = (location.hash || '#home').slice(1) || 'home';

const ansichtsCache = createLruCache({ limit: 10, onEvict: disposeViewEntry });

// Die Startseite wird fuer den schnellen Rueckweg als abgetrennte DOM-Ansicht
// zwischengespeichert. Aendert sich die Darstellung eines Dex auf einer
// Unterseite, darf diese Kopie nicht mit alter Farbe bzw. altem Icon wieder
// eingeblendet werden. Beim Zurueckkehren wird sie dann frisch aufgebaut.
window.addEventListener('muscledex:appearance-changed', () => {
  if (aktiveRoute !== 'home') ansichtsCache.delete('home');
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

// Bei der interaktiven iOS-Zurueck-Geste malt Safari die vorige History-Seite
// bereits selbst. Der folgende App-Render darf die weggewischte Ansicht nicht
// noch einmal darueberlegen.
window.addEventListener('popstate', () => {
  popstateNavigation = true;
  browserRueckwaerts = !appRueckwaerts;
  appRueckwaerts = false;
});

// Schliessen- und Zurueck-Knoepfe duerfen keinen neuen History-Eintrag
// erzeugen. Liegt ihr Ziel direkt hinter der aktuellen Route, verwenden wir
// den echten Browser-Stack. Das ist besonders wichtig fuer die interaktive
// iOS-Zurueck-Geste: Sie sieht dadurch dieselbe Reihenfolge wie die App.
document.addEventListener('click', (event) => {
  const link = event.target.closest('a[href^="#"]');
  if (!link || event.defaultPrevented || event.metaKey || event.ctrlKey || event.shiftKey || event.altKey) return;
  const ziel = link.getAttribute('href')?.slice(1) || 'home';
  if (ziel.startsWith('entry/')) {
    document.documentElement.style.setProperty('--detail-origin-x', `${event.clientX}px`);
    document.documentElement.style.setProperty('--detail-origin-y', `${event.clientY}px`);
  }
  if (!routeStack.isPrevious(ziel)) return;
  event.preventDefault();
  appRueckwaerts = true;
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

function setSeite(name) {
  document.documentElement.dataset.seite = name;
  delete document.documentElement.dataset.dexMuster;
  ['--dex-seitenfarbe', '--dex-ink', '--dex-tapete', '--bg', '--app-bg', '--app-content-bg', '--app-chrome-bg', '--food-page-purple']
    .forEach((property) => document.documentElement.style.removeProperty(property));
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

// Welche Tabelle den Zaehler einer Sammlung fuellt. Routinen haben noch keine
// Tabelle – ihre Karte zeigt weiter "Bald".
// Row Level Security ist auf allen Tabellen aktiv, die Zaehlung liefert also
// von sich aus nur die eigenen Zeilen; ein Filter auf die user_id waere
// doppelt gemoppelt.
// Zuletzt geladene Zahlen. Beim Zurueckspringen auf die Startseite stehen sie
// dadurch sofort da, statt erneut durch den Platzhalter zu laufen.
let zaehlerStand = {};

const ZAEHLQUELLEN = {
  body: { tabelle: 'weights', eins: 'Messung', viele: 'Messungen' },
  reminders: { tabelle: 'reminders', filters: [['active', true]], filterIn: ['type', ['meal', 'supplement', 'drink']], eins: 'Erinnerung', viele: 'Erinnerungen' },
  'food-log': { tabelle: 'dex_entries', filter: ['root_key', 'food-log'], eins: 'Eintrag', viele: 'Einträge' },
  training: { tabelle: 'dex_entries', filter: ['root_key', 'training'], eins: 'Eintrag', viele: 'Einträge' },
  // Gezaehlt wird, was fuer den naechsten Einkauf ausgewaehlt (angehakt) ist –
  // die Karte beantwortet damit direkt "Wie viele Lebensmittel muss ich noch
  // besorgen?" statt "Wie viele koennte ich theoretisch besorgen?".
  shopping: { tabelle: 'shopping_items', filter: ['checked', true], eins: 'Lebensmittel', viele: 'Lebensmittel' },
  habits: { tabelle: 'routines', eins: 'Routine', viele: 'Routinen' },
  sleep: { tabelle: 'sleep_logs', eins: 'Nacht', viele: 'Nächte' },
};

// head:true holt nur den Zaehler, keine Zeilen – fuenf Karten kosten so fuenf
// leere Antworten statt der kompletten Tabellen.
async function zaehlerLaden(signal) {
  const paare = await Promise.all(Object.entries(ZAEHLQUELLEN).map(async ([route, { tabelle, filter, filters = [], filterIn }]) => {
    try {
      if (route === 'reminders') {
        // Der MEAL-LOG zeigt die belegten Tageszeit-Kategorien, nicht jede
        // einzelne Mahlzeit oder jedes Supplement. Ein Frühstück plus ein
        // Supplement bleibt dadurch genau eine Kategorie.
        let reminderQuery = supabase.from(tabelle)
          .select('type,label,time,metadata')
          .eq('active', true)
          .in('type', ['meal', 'supplement', 'drink']);
        reminderQuery = reminderQuery.abortSignal(signal);
        const { data, error } = await reminderQuery;
        if (error) return [route, null];
        const kategorien = new Set();
        (data || []).forEach((reminder) => {
          if (reminder.type === 'drink') { kategorien.add('drink'); return; }
          const label = String(reminder.label || '').toLocaleLowerCase('de');
          const slot = reminder.metadata?.meal_slot
            || (label.includes('frühstück') ? 'breakfast'
              : label.includes('vormittag') ? 'snack_morning'
                : label.includes('mittagessen') ? 'lunch'
                  : label.includes('nachmittag') ? 'snack_afternoon'
                    : label.includes('abend') ? 'dinner' : null);
          if (slot) { kategorien.add(slot); return; }
          const [hours, minutes] = String(reminder.time || '00:00').split(':').map(Number);
          const total = (Number(hours) || 0) * 60 + (Number(minutes) || 0);
          kategorien.add(total < 585 ? 'breakfast' : total < 720 ? 'snack_morning'
            : total < 900 ? 'lunch' : total < 1080 ? 'snack_afternoon' : 'dinner');
        });
        return [route, kategorien.size];
      }
      let countQuery = supabase.from(tabelle).select('*', { count: 'exact', head: true });
      if (filter) countQuery = countQuery.eq(filter[0], filter[1]);
      filters.forEach(([field, value]) => { countQuery = countQuery.eq(field, value); });
      if (filterIn) countQuery = countQuery.in(filterIn[0], filterIn[1]);
      countQuery = countQuery.abortSignal(signal);
      const { count, error } = await countQuery;
      return [route, error ? null : (count ?? 0)];
    } catch (e) {
      return [route, null];   // offline: die Karte behaelt ihren Platzhalter
    }
  }));
  return Object.fromEntries(paare);
}

function zaehlerText(route, anzahl) {
  const quelle = ZAEHLQUELLEN[route];
  if (!quelle || anzahl === null || anzahl === undefined) return null;
  return `<b>${anzahl}</b><span>${anzahl === 1 ? quelle.eins : quelle.viele}</span>`;
}

// Traegt geladene Zahlen in bereits gezeichnete Karten nach. Die Karten
// erscheinen dadurch sofort und fuellen sich, sobald die Antwort da ist.
function zaehlerEintragen(container, zaehler) {
  container.querySelectorAll('[data-sammlung]').forEach((karte) => {
    const text = zaehlerText(karte.dataset.sammlung, zaehler[karte.dataset.sammlung]);
    const meta = karte.querySelector('.dex-datensatz-meta');
    if (text && meta) meta.innerHTML = text;
  });
}

function renderChrome(transition = 'hart') {
  app.classList.add('app-shell');
  // Kein globaler Kopf mehr: jede Seite ist Vollbild, Home traegt Logo und
  // Avatar als normalen Seiteninhalt (siehe mountHome).
  const bisher = app.querySelector(':scope > #view');
  let view;
  if (bisher?.hasChildNodes()) {
    const hintergrund = getComputedStyle(document.body);
    const bisherigeSeite = document.documentElement.dataset.seite || '';
    bisher.removeAttribute('id');
    // Seitenbezogene Klassen (vor allem `hat-kategoriefarbe`) muessen auf
    // der ausgehenden Ansicht erhalten bleiben. Wird die Klassenliste hier
    // komplett ersetzt, faellt ihr Plus-Knopf waehrend eines Ruecksprungs
    // fuer einen Frame auf das pinke Standarddesign zurueck.
    bisher.classList.remove('view-neu', 'seite-vor-warten', 'seite-vor');
    bisher.classList.add('view-alt');
    bisher.classList.toggle('system-dex-view', ['body', 'reminders', 'shopping', 'habits'].includes(bisherigeSeite));
    bisher.classList.toggle('view-alt-hart', transition === 'hart');
    bisher.style.backgroundColor = hintergrund.backgroundColor;
    bisher.style.backgroundImage = hintergrund.backgroundImage;
    bisher.style.backgroundSize = hintergrund.backgroundSize;
    bisher.style.backgroundPosition = hintergrund.backgroundPosition;
    bisher.style.backgroundRepeat = hintergrund.backgroundRepeat;
    view = document.createElement('main');
    view.id = 'view';
    view.className = `view-neu${transition === 'vor' ? ' seite-vor-warten' : transition === 'detail' ? ' seite-detail-warten' : ''}`;
    app.append(view);
  } else {
    app.replaceChildren();
    view = document.createElement('main');
    view.id = 'view';
    app.append(view);
  }
  // Jede Route beginnt in ihrem eigenen, einzigen Scrollcontainer oben. Das
  // Dokument selbst bewegt sich nie; dadurch muss iOS keinen Sticky-Header
  // gegen eine alte Dokument-Scrollposition neu zusammensetzen.
  view.scrollTop = 0;
  return view;
}

function ansichtMerken(route, node, controller, seite) {
  if (!route || !node) return;
  node.removeAttribute('id');
  node.classList.remove('view-alt', 'view-alt-hart', 'view-neu', 'seite-vor', 'seite-detail', 'seite-raus-rechts');
  node.classList.add('view-cache');
  // Ton darf nach einem Seitenwechsel nie unsichtbar weiterlaufen. Iframes
  // werden hier noch nicht getrennt, weil die Ansicht fuer den sofortigen
  // Rueckweg erhalten bleibt.
  node.querySelectorAll?.('audio,video').forEach((media) => {
    try { media.pause(); } catch {}
  });
  node.remove();
  ansichtsCache.set(route, { node, controller, seite });
}

function gemerkteAnsichtZeigen(route, richtung, ohneAnimation = false) {
  const gemerkt = ansichtsCache.take(route);
  if (!gemerkt) return false;
  const aktuell = app.querySelector(':scope > #view');
  const bisherigeRoute = aktiveRoute;
  const bisherigerController = routeAbortController;
  const bisherigeSeite = document.documentElement.dataset.seite || '';

  gemerkt.node.classList.remove('view-cache', 'view-alt', 'view-alt-hart', 'view-alt-zurueck', 'seite-raus-rechts');
  gemerkt.node.id = 'view';
  app.insertBefore(gemerkt.node, aktuell || null);
  routeAbortController = gemerkt.controller;
  aktiveRoute = route;
  setSeite(gemerkt.seite || (route === 'home' ? 'home' : route.startsWith('entry/') || route.startsWith('collection/') ? 'collection' : route));
  dexLookAusAnsichtWiederherstellen(gemerkt.node);

  if (!aktuell) return true;
  aktuell.removeAttribute('id');
  aktuell.classList.add('view-alt', 'view-alt-zurueck');
  let abgeschlossen = false;
  const fertig = () => {
    if (abgeschlossen) return;
    abgeschlossen = true;
    ansichtMerken(bisherigeRoute, aktuell, bisherigerController, bisherigeSeite);
    gemerkt.node.classList.remove('seite-zurueck');
  };
  if (ohneAnimation) {
    fertig();
  } else {
    gemerkt.node.classList.add('seite-zurueck');
    aktuell.classList.add('seite-raus-rechts');
    aktuell.addEventListener('animationend', fertig, { once: true });
    setTimeout(fertig, 540);
  }
  // Die gespeicherte Ansicht bleibt bewusst stabil. Ein nachgelagerter
  // Voll-Render hat auf iOS den inneren Home-Scroller kurz ersetzt und konnte
  // dadurch direkt nach dem Zurückkehren eine Berührung verschlucken.
  // Aktualisierungen kommen über Realtime bzw. beim nächsten echten Öffnen.
  return true;
}

function istDunkleOrdnerfarbe(farbe) {
  const hex = String(farbe || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 135;
}

function dexOrdnerKarte({ href, titel, meta, iconInhalt, farbe, route = '', eigene = false, collectionId = '' }) {
  return `
  <div class="tuck-fach dex-ordner-testfach${istDunkleOrdnerfarbe(farbe) ? ' dex-ordner-dunkel' : ''}${route ? ` dex-ordner-${route}` : ''}${eigene ? ' eigene-sammlung' : ''}" style="--ordner:${farbe}">
    <a class="tuck-karte dex-datensatz-karte dex-ordner-test" href="${href}"${route ? ` data-sammlung="${route}"` : ''}${collectionId ? ` data-collection-id="${collectionId}"` : ''}>
      ${mainDexFolderSvg}
      <span class="dex-ordner-inhalt">
        <span class="dex-datensatz-meta">${meta}</span>
        <h2>${titel}</h2>
      </span>
      <span class="dex-ordner-kartenicon" aria-hidden="true">${iconInhalt}</span>
    </a>
  </div>`;
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

// Alle DEX-Eintraege teilen dieselbe dreilagige Ordnerform.
function sammlungsKarten(daten = sammlungen, zaehler = {}) {
  return daten.map(([route, titel, , icon, farbe, status]) => {
    // Solange die Zahl laedt, steht der Stand da. So springt die Karte beim
    // Nachtragen nur um eine Zeile und nicht um ihre halbe Hoehe.
    const meta = zaehlerText(route, zaehler[route])
      || (ZAEHLQUELLEN[route] ? '<b>…</b>' : `<b>${status}</b>`);
    const iconInhalt = categoryIconMarkup(route, 'muscledex-sammlungsicon');
    const dexFarbe = pageLook(route, categoryColor(route), 'drops').color || categoryColor(route);
    return dexOrdnerKarte({
      href: `#${route}`, route, titel, meta, iconInhalt,
      farbe: dexFarbe,
    });
  }).join('');
}

function eigeneSammlungsKarten(items, stats = new Map()) {
  return items.map((item) => {
    const count = stats.get(item.id)?.entries || 0;
    return dexOrdnerKarte({
      href: `#collection/${item.id}`,
      titel: escapeHtml(item.name),
      meta: `<b>${count}</b><span>${count === 1 ? 'Eintrag' : 'Einträge'}</span>`,
      iconInhalt: collectionIconMarkup(item.icon_key),
      farbe: item.color,
      eigene: true,
      collectionId: item.id,
    });
  }).join('');
}

async function eigeneDexStatistik(userId, roots, signal) {
  if (!roots.length) return new Map();
  let collectionsQuery = supabase.from('collections').select('id,parent_id').eq('user_id', userId).eq('root_key', 'home');
  let entriesQuery = supabase.from('dex_entries').select('collection_id').eq('user_id', userId).eq('root_key', 'home');
  if (signal) { collectionsQuery = collectionsQuery.abortSignal(signal); entriesQuery = entriesQuery.abortSignal(signal); }
  const [{ data: collections, error: collectionError }, { data: entries, error: entryError }] = await Promise.all([collectionsQuery, entriesQuery]);
  if (collectionError) throw collectionError;
  if (entryError) throw entryError;
  const childrenByParent = new Map();
  (collections || []).forEach((item) => {
    if (!item.parent_id) return;
    const list = childrenByParent.get(item.parent_id) || [];
    list.push(item.id); childrenByParent.set(item.parent_id, list);
  });
  const entryCount = new Map();
  (entries || []).forEach(({ collection_id: id }) => { if (id) entryCount.set(id, (entryCount.get(id) || 0) + 1); });
  const result = new Map();
  roots.forEach((root) => {
    const descendants = [];
    const queue = [...(childrenByParent.get(root.id) || [])];
    while (queue.length) {
      const id = queue.shift(); descendants.push(id); queue.push(...(childrenByParent.get(id) || []));
    }
    const ids = [root.id, ...descendants];
    result.set(root.id, { children: descendants.length, entries: ids.reduce((sum, id) => sum + (entryCount.get(id) || 0), 0) });
  });
  return result;
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

// Neue Konten starten mit derselben klaren Reihenfolge und Farb-/Emoji-Sprache
// wie die aktuelle MUSCLE-DEX-Startseite. Die Initialisierung ist bewusst
// einmalig und überschreibt keine bestehenden persönlichen Einstellungen.
async function initialeStartseiteEinrichten(userId, signal, existing = []) {
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

async function mountHome(container, signal, { setzeSeite = true } = {}) {
  if (setzeSeite) setSeite('home');
  let sichtbar = sichtbareSammlungen();
  let eigene = [];
  let eigeneStats = new Map();
  try {
    eigene = await loadCollections(session.user.id, { rootKey: 'home', signal });
    const seeded = await initialeStartseiteEinrichten(session.user.id, signal, eigene);
    if (seeded) eigene = await loadCollections(session.user.id, { rootKey: 'home', signal });
    sichtbar = sichtbareSammlungen();
  }
  catch (error) { if (!signal?.aborted) toast('Eigene Dex-Einträge konnten nicht geladen werden.'); }
  if (signal?.aborted) return;
  eigene = orderCustomCollections(eigene).filter((item) => customCollectionIsVisible(item.id));
  try { eigeneStats = await eigeneDexStatistik(session.user.id, eigene, signal); }
  catch (error) { if (!signal?.aborted) toast('Dex-Zähler konnten nicht geladen werden.'); }
  const coinSichtbar = coinDexIsVisible();
  const coinSummary = coinSichtbar ? await loadCoinSummary(session.user.id, signal) : null;
  if (signal?.aborted) return;
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-home home-fixkopf">
      <div class="tuck-kopfzeile">
        <a class="kopf-marke" href="#home" aria-label="MUSCLE-DEX – Meine Dex-Einträge">${headerBrandMarkup()}</a>
        <div class="tuck-kopf-aktionen">
          ${coinSichtbar ? coinHeaderMarkup(coinSummary) : ''}
          <button class="tuck-quadrat betont neu-sammlung" type="button" aria-label="Neuen Dex erstellen">
            ${materialIconMarkup('create_new_folder')}
          </button>
          <a class="nav-av nav-av-fb" href="#profile" aria-label="Profil und Einstellungen">${avatarMarkup()}</a>
        </div>
      </div>
      <div class="home-scrollinhalt">
      <div class="tuck-ablage">
        <label class="tuck-ablage-feld" for="schnell-suche">
          ${materialIconMarkup('search')}
          <input id="schnell-suche" type="search" autocomplete="off"
                 placeholder="MUSCLE-DEX durchsuchen" aria-label="MUSCLE-DEX durchsuchen">
        </label>
        <button class="tuck-ablage-knopf" type="button" aria-label="Suche öffnen">
          ${materialIconMarkup('search')}
        </button>
      </div>
      <header class="tuck-titelzeile">
        <h1>Meine Dex-Einträge</h1>
      </header>
      <section class="tuck-grid" aria-label="Meine Dex-Einträge">
        ${sammlungsKarten(sichtbar, zaehlerStand)}${eigeneSammlungsKarten(eigene, eigeneStats)}
      </section>
      </div>
    </div>`;

  // Einstellungen und neue Dex werden auf der Startseite bewusst hart neu
  // gerendert. Die Startansicht kann im Navigationscache liegen; ein reines
  // Hashchange würde dann gelegentlich nur die alte DOM-Kopie stehen lassen.
  const homeNeuLaden = () => {
    navigationZuruecksetzen('home');
    render();
  };

  container.querySelector('.neu-sammlung').onclick = () => openCollectionEditor({
    userId: session.user.id,
    rootKey: 'home',
    onSaved: homeNeuLaden,
  });

  bindLongPress(container.querySelector('.tuck-grid'), '.dex-ordner-test', dexEinstellungenOeffner({
    userId: session.user.id,
    refresh: homeNeuLaden,
    itemsById: new Map(eigene.map((item) => [item.id, item])),
  }));
  if (container.querySelector('.dex-ordner-test')) showGestureHintOnce({
    key: 'dex-langer-tipp',
    title: 'Dex-Info und Bearbeiten',
    text: 'Halte einen Dex länger gedrückt, um die Info oder Bearbeitung zu öffnen.',
    gesture: 'hold',
  });

  const sucheOeffnen = () => {
    vorgemerkteSuche = container.querySelector('#schnell-suche').value.trim();
    location.hash = 'search';
  };
  container.querySelector('.tuck-ablage-knopf').onclick = sucheOeffnen;
  container.querySelector('#schnell-suche').onkeydown = (event) => {
    if (event.key === 'Enter') { event.preventDefault(); sucheOeffnen(); }
  };

  zaehlerLaden(signal).then((zaehler) => {
    if (signal?.aborted) return;
    zaehlerStand = zaehler;
    // Zwischenzeitlich kann eine andere Seite gemountet sein.
    if (container.isConnected) zaehlerEintragen(container, zaehler);
  });

  const aktualisiereHomeZaehler = async () => {
    // `container` darf hier bewusst vom Dokument getrennt sein: Genau so wird
    // die Startseite im Navigationscache gehalten. Das Aktualisieren einer
    // abgetrennten DOM-Struktur ist gueltig und sorgt dafuer, dass beim
    // Zurueckkehren sofort der aktuelle Stand sichtbar ist.
    if (signal?.aborted) return;
    const [zaehler, stats] = await Promise.all([
      zaehlerLaden(signal),
      eigeneDexStatistik(session.user.id, eigene, signal).catch(() => new Map()),
    ]);
    if (signal?.aborted) return;
    zaehlerStand = zaehler;
    eigeneStats = stats;
    zaehlerEintragen(container, zaehler);
    container.querySelectorAll('[data-collection-id]').forEach((karte) => {
      const meta = karte.querySelector('.dex-datensatz-meta');
      const stat = stats.get(karte.dataset.collectionId);
      if (meta && stat) meta.innerHTML = `<b>${stat.entries}</b><span>${stat.entries === 1 ? 'Eintrag' : 'Einträge'}</span>`;
    });
  };
  const lokaleZaehlungsAenderung = () => { aktualisiereHomeZaehler().catch(() => {}); };
  window.addEventListener('muscledex:counts-changed', lokaleZaehlungsAenderung);
  signal?.addEventListener('abort', () => window.removeEventListener('muscledex:counts-changed', lokaleZaehlungsAenderung), { once: true });
  ['weights', 'reminders', 'dex_entries', 'shopping_items', 'routines', 'sleep_logs']
    .forEach((table) => subscribeToTableChanges({ table, signal, onChange: aktualisiereHomeZaehler, onError: () => {} }));
  const aktualisiereCoinStand = async () => {
    // Wie die Kartenzaehler muss auch der Kopfstand aktualisiert werden,
    // waehrend Home als abgetrennte Ansicht im Navigationscache liegt.
    if (signal?.aborted || !coinSichtbar) return;
    const summary = await loadCoinSummary(session.user.id, signal);
    if (signal?.aborted) return;
    const kopf = container.querySelector('.coin-kopfstand');
    if (!kopf) return;
    const stand = kopf.querySelector('strong');
    if (stand) stand.textContent = String(summary.balance);
    kopf.setAttribute('aria-label', `MUSCLE-COINS öffnen, aktueller Kontostand ${summary.balance}`);
  };
  const lokaleCoinAenderung = () => { aktualisiereCoinStand().catch(() => {}); };
  window.addEventListener('muscledex:coins-changed', lokaleCoinAenderung);
  signal?.addEventListener('abort', () => window.removeEventListener('muscledex:coins-changed', lokaleCoinAenderung), { once: true });
  subscribeToTableChanges({
    table: 'muscle_coin_ledger', signal, onChange: aktualisiereCoinStand, onError: () => {},
  });
  subscribeToTableChanges({
    table: 'collections', signal,
    onChange: () => {
      if (aktiveRoute !== 'home') ansichtsCache.delete('home');
      window.dispatchEvent(new HashChangeEvent('hashchange'));
    },
    onError: () => {},
  });
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
  const title = customTitle || (custom ? 'Eigener Dex' : body ? 'Body-Log' : sleep ? 'Sleep-Log' : meal ? 'Meal-Log' : training ? 'Trainingdex' : shopping ? 'Einkauf' : habits ? 'Routinen' : 'Fooddex');
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

function installNeoDexChrome(view, {
  title = 'Fooddex',
  meta = '0 Einträge · 0 Unter-Dex',
  closeHref = '#home',
} = {}) {
  const foodBar = view.querySelector('.kategorie-kopf');
  const foodAdd = foodBar?.querySelector('.kategorie-plus');
  const foodSettings = foodBar?.querySelector('[data-category-settings]');
  const foodActions = document.createElement('div');
  foodActions.innerHTML = foodDexActionsMarkup({
    primaryContent: materialIconMarkup('place_item'),
    primaryAttributes: 'data-food-action="add"',
    primaryLabel: `Eintrag in ${escapeHtml(title)} hinzufügen`,
    closeHref: escapeHtml(closeHref),
    closeLabel: 'Zurück',
  });
  const foodActionBar = foodActions.firstElementChild;
  foodActionBar.querySelector('[data-food-action="add"]').onclick = () => {
    foodAdd?.click();
  };
  foodBar?.querySelector('.kategorie-plus')?.setAttribute('aria-hidden', 'true');
  foodBar?.querySelector('[data-category-settings]')?.setAttribute('aria-hidden', 'true');
  foodBar?.querySelector('.kategorie-schliessen')?.setAttribute('aria-hidden', 'true');
  view.querySelector('.neo-dex-floating-actions,.food-dex-floating-actions')?.remove();
  view.appendChild(foodActionBar);

  const foodContent = view.querySelector('.kategorie-scrollinhalt');
  const existingTitle = foodContent?.querySelector(':scope > .neo-dex-scroll-title, :scope > .food-dex-scroll-title');
  if (existingTitle) {
    const titleNode = existingTitle.querySelector('strong');
    const metaNode = existingTitle.querySelector('[data-food-scroll-meta]');
    if (titleNode) titleNode.textContent = title;
    if (metaNode) metaNode.textContent = meta;
  } else if (foodContent) {
    const titleBlock = document.createElement('section');
    titleBlock.className = 'neo-dex-scroll-title food-dex-scroll-title';
    titleBlock.innerHTML = `
      <strong>${escapeHtml(title)}</strong>
      <small data-food-scroll-meta>${escapeHtml(meta)}</small>`;
    foodContent.prepend(titleBlock);
  }
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

async function mountSearch(container, signal) {
  setSeite('search');
  container.classList.add('dex-fixkopf', 'such-fixkopf-view');
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-suche-seite such-fixkopf">
      <div class="tuck-suchzeile">
        <label class="tuck-suchfeld" for="global-search">
          ${iconMarkup('search')}
          <input id="global-search" type="search" autocomplete="off" placeholder="Dex-Einträge durchsuchen …">
        </label>
        <a class="seiten-x" href="#home" aria-label="Suche schließen">${materialIconMarkup('close')}</a>
      </div>
      <div class="such-scrollinhalt">
      <section class="such-tags" data-search-tags hidden></section>
      <h2 class="tuck-abschnittstitel">Dex-Treffer</h2>
      <section class="dex-inhaltsgrid such-eintraege" data-search-results><div class="daten-laden">DEX-Einträge werden geladen …</div></section>
      <div class="tuck-leer" data-search-empty hidden>
        ${iconMarkup('search')}
        <b>Nichts gefunden</b>
        <span>Kein Titel, keine Beschreibung und kein Tag passen zu deiner Suche.</span>
      </div>
      </div>
    </div>`;

  const input = container.querySelector('#global-search');
  const results = container.querySelector('[data-search-results]');
  const empty = container.querySelector('[data-search-empty]');
  const tagsSlot = container.querySelector('[data-search-tags]');
  let entries = [];
  let activeTag = '';
  const renderResults = () => {
    const query = input.value.trim().toLocaleLowerCase('de');
    const treffer = entries.filter((entry) => {
      const tags = entry.tags || [];
      const haystack = `${entry.title || ''} ${entry.note || ''} ${tags.join(' ')}`.toLocaleLowerCase('de');
      const tagMatch = !activeTag || tags.some((tag) => tag.toLocaleLowerCase('de') === activeTag.toLocaleLowerCase('de'));
      return tagMatch && (!query || haystack.includes(query));
    });
    results.innerHTML = treffer.map((entry) => dexEntryOverviewMarkup(entry, categoryColor(entry.root_key))).join('');
    vorschaubilderEinblenden(results);
    empty.hidden = treffer.length > 0;
  };
  input.oninput = renderResults;
  try {
    entries = await loadAllDexEntries(session.user.id, signal);
    if (signal?.aborted) return;
    const tags = [...new Set(entries.flatMap((entry) => entry.tags || []).map((tag) => tag.trim()).filter(Boolean))]
      .sort((a, b) => a.localeCompare(b, 'de'));
    if (tags.length) {
      const limit = 8;
      tagsSlot.hidden = false;
      tagsSlot.innerHTML = `<div class="such-tag-liste" data-tag-list>${tags.map((tag, index) => `<button type="button" data-search-tag="${escapeHtml(tag)}"${index >= limit ? ' hidden' : ''}>#${escapeHtml(tag)}</button>`).join('')}</div>
        ${tags.length > limit ? `<button class="such-tags-mehr" type="button" data-tags-toggle aria-expanded="false" aria-label="Weitere Tags anzeigen">⌄</button>` : ''}`;
      tagsSlot.onclick = (event) => {
        const tagButton = event.target.closest('[data-search-tag]');
        if (tagButton) {
          activeTag = activeTag === tagButton.dataset.searchTag ? '' : tagButton.dataset.searchTag;
          tagsSlot.querySelectorAll('[data-search-tag]').forEach((button) => button.classList.toggle('aktiv', button === tagButton && Boolean(activeTag)));
          renderResults();
          return;
        }
        const toggle = event.target.closest('[data-tags-toggle]');
        if (!toggle) return;
        const expanded = toggle.getAttribute('aria-expanded') === 'true';
        toggle.setAttribute('aria-expanded', String(!expanded));
        toggle.textContent = expanded ? '⌄' : '⌃';
        tagsSlot.querySelectorAll('[data-search-tag]').forEach((button, index) => { button.hidden = expanded && index >= limit; });
      };
    }
    renderResults();
  } catch (error) {
    if (!signal?.aborted) results.innerHTML = `<div class="msg err">Suche konnte nicht geladen werden: ${escapeHtml(error.message || 'Unbekannter Fehler')}</div>`;
  }
  if (vorgemerkteSuche) {
    input.value = vorgemerkteSuche;
    vorgemerkteSuche = '';
    renderResults();
  }
}

function mountComingSoon(container, route) {
  setSeite(route);
  container.innerHTML = `
    <div class="wrap pad-bottom bereich-vorschau">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">Routine</span>
          <h1 class="section-title">ROUTINEN</h1>
        </div>
      </div>
      <section class="seiten-einstieg">
        <b>Kleine Schritte, die bleiben</b>
        <span>Tägliche Routinen, Serien und Fortschritt werden hier aufgebaut.</span>
      </section>
      <section class="card vorschau-karte">
        <span aria-hidden="true">${iconMarkup('habits')}</span>
        <strong>Dieser Bereich kommt als Nächstes.</strong>
        <p>Die Navigation ist bereits aktiv, die Funktionen ergänzen wir im nächsten Schritt.</p>
      </section>
    </div>`;
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
  if (!supabaseKonfiguriert) return renderSetup();
  if (recovery) return renderRecovery();
  if (!session) return renderAuth();
  if (!profile) {
    try { await profilSicherLaden(); }
    catch (error) {
      if (generation !== renderGeneration) return;
      throw error;
    }
  }
  if (generation !== renderGeneration) return;
  const angefragt = (location.hash || '#home').slice(1);
  if (angefragt === 'recipes') { location.replace('#food-log'); return; }
  const route = ['home', 'search', 'profile', 'coins'].includes(angefragt) || bereiche.some(([ziel]) => ziel === angefragt)
    || angefragt.startsWith('collection/') || angefragt.startsWith('entry/')
    ? angefragt
    : 'home';
  const richtung = navRichtung(angefragt);
  const warBrowserRueckwaerts = browserRueckwaerts;
  browserRueckwaerts = false;

  // Eine schon besuchte Zielseite ist sofort da. Beim nativen iOS-Swipe hat
  // WebKit die Bewegung bereits interaktiv gezeichnet; wir tauschen dann nur
  // noch lautlos auf dieselbe, erhaltene DOM-Ansicht. Beim X-/Zurueck-Tap
  // zeichnet die App selbst den Rueckwaerts-Slide.
  if (richtung === 'zurueck' && gemerkteAnsichtZeigen(route, richtung, warBrowserRueckwaerts)) return;

  const vorherigeRoute = aktiveRoute;
  const vorherigerController = routeAbortController;
  const vorherigeSeite = document.documentElement.dataset.seite || '';
  if (richtung === 'gleich') vorherigerController?.abort();
  routeAbortController = new AbortController();
  const { signal } = routeAbortController;
  const transition = richtung === 'vor' && route.startsWith('entry/')
    ? 'detail'
    : richtung === 'vor' && route !== 'home'
      ? 'vor'
      : richtung === 'zurueck'
        ? 'zurueck'
        : 'hart';
  const view = renderChrome(transition);
  if (route.startsWith('entry/')) {
    // Carry the rendered surface (including a selected wallpaper) over to
    // the detail view instead of briefly falling back to the neutral cream
    // collection background while the entry query is loading.
    const sourceView = app.querySelector(':scope > .view-alt');
    dexLookAusAnsichtWiederherstellen(sourceView);
    dexLookAufAnsichtUebertragen(sourceView, view);
    if (sourceView) {
      for (const property of ['backgroundColor', 'backgroundImage', 'backgroundSize', 'backgroundPosition', 'backgroundRepeat']) {
        if (sourceView.style[property]) view.style[property] = sourceView.style[property];
      }
    }
  }
  if (richtung === 'vor') {
    const ausgehend = app.querySelector(':scope > .view-alt');
    if (ausgehend) ansichtsCache.set(vorherigeRoute, {
      node: ausgehend,
      controller: vorherigerController,
      seite: vorherigeSeite,
    });
  }
  // Beim Schliessen eines Vollbild-DEX bleibt dessen alte Ansicht bis zum
  // fertigen Home-Mount sichtbar. `data-seite="home"` darf deshalb erst im
  // selben Takt wie das Entfernen dieser Ansicht gesetzt werden; andernfalls
  // verliert sie vorher kurz ihre seitenspezifische Typografie.
  const homeStilBeimTauschSetzen = route === 'home' && Boolean(app.querySelector(':scope > .view-alt'));
  if (homeStilBeimTauschSetzen) view.classList.add('home-transition-view');
  // Die neue Seite bleibt unsichtbar, bis wirklich ALLES gemountet ist –
  // sonst blitzt der fertige Inhalt kurz an seiner Endposition auf, bevor
  // die Animation ihn zurueck an den Start reisst.
  if (transition === 'vor') view.classList.add('seite-vor-warten');
  if (transition === 'detail') view.classList.add('seite-detail-warten');
  if (route === 'home') {
    await mountHome(view, signal, { setzeSeite: !homeStilBeimTauschSetzen });
  } else if (route === 'search') {
    await mountSearch(view, signal);
  } else if (route === 'profile') {
    setSeite('profile');
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
    prepareSpecialDexPage(view, 'coin-dex');
    await mountCoinDex(view, { userId: session.user.id, signal, mountChrome: mountCategoryChrome });
  } else if (route === 'body') {
    setSeite('body');
    applyPageLook('body', categoryColor('body'), 'wallpaper-measure');
    view.classList.add('neo-dex-page', 'food-dex-page', 'body-log-dex-page');
    prepareSpecialDexPage(view, 'body');
    const { mountBodyMetrics } = await bodyMetricsModule();
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    // Nach jedem bodyMetrics-Re-Render (jede DB-Änderung wischt das gesamte
    // view.innerHTML weg) den dex-eintraege-Slot wieder anhängen und neu
    // laden, sonst verschwindet der Bereich mit den eigenen Body-Log-Notizen
    // nach der ersten Wiegung dauerhaft.
    const rehydrateDexEntries = async () => {
      const wrap = view.querySelector(':scope > .wrap');
      if (!wrap) return;
      if (!wrap.querySelector(':scope > [data-dex-entries]')) {
        wrap.insertAdjacentHTML('beforeend', dexEntriesSlotMarkup());
      }
      await renderDexEntries(view, { userId: session.user.id, rootKey: 'body', color: categoryColor('body'), signal, hideEmpty: true });
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
    if (!item) { location.hash = 'home'; return; }
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
      dexLookAusAnsichtWiederherstellen(app.querySelector(':scope > .view-alt'));
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
  } else {
    mountHome(view, signal);
  }
  // Wurde waehrend eines langsamen Mounts bereits zurueck navigiert, darf
  // die inzwischen veraltete Zielseite nicht spaeter doch noch ueber die
  // sofort wiederhergestellte Ansicht gelegt werden.
  if (generation !== renderGeneration || aktiveRoute !== vorherigeRoute && richtung === 'gleich') {
    view.remove();
    return;
  }
  // Nur animieren, wenn wirklich eine spuerbare Ladeluecke da war (z. B.
  // Supabase-Roundtrip). War alles praktisch sofort da – etwa nach der
  // iOS-Zurueck-Wischgeste, die den Inhalt oft schon zeigt, bevor unser
  // eigener Reload durch ist –, wirkt eine erzwungene Animation haerter als
  // gar keine: Der Inhalt war ja "schon da" und wuerde nochmal auf- und
  // abblenden. Direkt sichtbar machen faengt dieses doppelte Aufblitzen ab.
  const neuerHintergrund = getComputedStyle(document.body);
  const neueAnsicht = getComputedStyle(view);
  const lookFarbe = homeStilBeimTauschSetzen
    ? (document.documentElement.dataset.theme === 'dark' ? '#101A2B' : '#F2EBE0')
    // Bei einer SVG-Tapete sind body, #app und #view absichtlich transparent,
    // damit das Muster im fertigen Dex bis in die iOS-Safe-Area reicht. Für
    // den Einschub darf deshalb nicht `body.backgroundColor` verwendet werden:
    // das wäre transparent und ließe den bereits umgeschalteten Root-Hintergrund
    // stehen, während nur der Inhalt hereinfährt. Die Dex-Farbe liegt schon vor
    // dem ersten Animationsframe als Custom Property auf der Zielansicht.
    : neueAnsicht.getPropertyValue('--dex-seitenfarbe').trim()
      || neueAnsicht.getPropertyValue('--bg').trim()
      || getComputedStyle(document.documentElement).backgroundColor
      || neuerHintergrund.backgroundColor;
  // Die Tapete liegt im scrollbaren Dex-Inhalt und ist damit Teil derselben
  // animierten Ebene wie Karten und Texte. Auf #view selbst bleibt nur die
  // unveraenderte App-Hintergrundfarbe; sonst wuerde das Muster beim Slide
  // einen Frame vor oder hinter dem Inhalt erscheinen.
  const musterBild = 'none';
  // Die normale Seite ist absichtlich transparent, damit die Tapete auf
  // html/body bis unter die iOS-Statusleiste reicht. Während des Slides muss
  // die neue Seite aber eine EIGENE, deckende Kopie dieser Tapete tragen.
  // `important` ist hier nötig, weil die Transparenzregel für #view selbst
  // ebenfalls important ist.
  view.style.setProperty('background-color', lookFarbe, 'important');
  view.style.setProperty('background-image', musterBild, 'important');
  view.style.setProperty('background-size', 'auto', 'important');
  view.style.setProperty('background-position', neuerHintergrund.backgroundPosition, 'important');
  view.style.setProperty('background-repeat', neuerHintergrund.backgroundRepeat, 'important');
  view.style.setProperty('background-attachment', 'scroll', 'important');
  const entferneUebergangshintergrund = () => {
    ['background-color', 'background-image', 'background-size', 'background-position', 'background-repeat', 'background-attachment']
      .forEach((property) => view.style.removeProperty(property));
  };
  // Zwei Frames: erst die komplett gemountete neue Seite samt Tapete
  // rasterisieren, dann die Bewegung starten. So kann WebKit nicht erst den
  // Inhalt und einen Frame spaeter den Hintergrund in die Ebene aufnehmen.
  await new Promise((resolve) => requestAnimationFrame(() => requestAnimationFrame(resolve)));
  aktiveRoute = route;
  if (transition === 'vor' || transition === 'detail') {
    view.classList.remove('seite-vor-warten', 'seite-detail-warten');
    view.classList.add(transition === 'detail' ? 'seite-detail' : 'seite-vor');
    const alteSeite = app.querySelector(':scope > .view-alt');
    let abgeschlossen = false;
    const aufraeumen = () => {
      if (abgeschlossen) return;
      abgeschlossen = true;
      if (aktiveRoute !== route) return;
      if (richtung === 'vor' && alteSeite) ansichtMerken(vorherigeRoute, alteSeite, vorherigerController, vorherigeSeite);
      else alteSeite?.remove();
      view.classList.remove('view-neu', 'seite-vor', 'seite-detail');
      if (homeStilBeimTauschSetzen) setSeite('home');
      entferneUebergangshintergrund();
    };
    view.addEventListener('animationend', aufraeumen, { once: true });
    setTimeout(aufraeumen, 520);
  } else if (transition === 'zurueck') {
    const alteSeite = app.querySelector(':scope > .view-alt');
    view.classList.add('seite-zurueck');
    alteSeite?.classList.add('view-alt-zurueck', 'seite-raus-rechts');
    const aufraeumen = () => {
      alteSeite?.remove();
      vorherigerController?.abort();
      view.classList.remove('view-neu', 'seite-zurueck');
      if (homeStilBeimTauschSetzen) setSeite('home');
      entferneUebergangshintergrund();
    };
    alteSeite?.addEventListener('animationend', aufraeumen, { once: true });
    setTimeout(aufraeumen, 540);
  } else {
    app.querySelector(':scope > .view-alt')?.remove();
    if (richtung === 'gleich') vorherigerController?.abort();
    if (homeStilBeimTauschSetzen) setSeite('home');
    view.classList.remove('view-neu');
    entferneUebergangshintergrund();
  }
  const dexAddButton = route !== 'coins' ? view.querySelector('.kategorie-plus') : null;
  if (dexAddButton) showGestureHintOnce({
    key: 'dex-hinzufuegen',
    title: 'Hier kommt Neues hinein',
    text: 'Der Hinzufügen-Button oben passt sich jedem Dex an und zeigt die passenden Einträge.',
    gesture: 'add',
    target: dexAddButton,
    replace: true,
  });
}

function renderLadefehler(error) {
  const info = userFacingLoadError(error, { online: navigator.onLine });
  routeAbortController?.abort();
  ansichtsCache.clear();
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
      <a class="btn" href="#home">Zur Startseite</a>
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

async function render() {
  try {
    await renderRoute();
  } catch (error) {
    if (isAbortError(error)) return;
    console.error('Seite konnte nicht geladen werden:', error);
    renderLadefehler(error);
  }
}

// Zwei rAF, damit der Browser den :active-Druckeffekt eines getippten Links
// noch zeichnet, bevor render() den kompletten Seiteninhalt ersetzt – ohne
// Verzoegerung verschwindet das gedrueckte Element vor dem ersten Paint.
window.addEventListener('hashchange', () => {
  if (popstateNavigation) {
    popstateNavigation = false;
    render();
    return;
  }
  requestAnimationFrame(() => requestAnimationFrame(() => render()));
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
      setPreferenceUser('');
    }
    if (event === 'SIGNED_IN' && !bisherigeUserId) {
      navigationZuruecksetzen('home');
      if (location.hash !== '#home') history.replaceState(null, '', '#home');
    }
    if (event === 'SIGNED_IN' && bisherigeUserId && bisherigeUserId !== session?.user?.id) {
      navigationZuruecksetzen((location.hash || '#home').slice(1) || 'home');
      profile = null;
      profileLadePromise = null;
    }
    if (session?.user?.id) {
      const aktiveUserId = session.user.id;
      setPreferenceUser(aktiveUserId);
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
    const preferenceUserId = session?.user?.id || '';
    syncInterfaceSounds();
    render();
    if (preferenceUserId) {
      loadUserPreferences(preferenceUserId)
        .then(() => { syncInterfaceSounds(); })
        .catch(() => {});
    }
  });
}
