import './styles.css';
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
import { supabase, supabaseKonfiguriert } from './supabase.js';
import { signIn, signUp, resetPassword, updatePassword, loadProfile } from './auth.js';
import { getTheme, applyTheme, setTheme, getSchatten, applySchatten } from './theme.js';
import { brandMarkup, headerBrandMarkup } from './brand.js';
import { mountProfile } from './profile.js';
import { customCollectionIsVisible, orderCustomCollections, visibleCollectionRoutes } from './collectionPreferences.js';
import { mountBodyMetrics } from './bodyMetrics.js';
import { mountReminders, startReminderLoop } from './reminders.js';
import { mountFoodLog } from './foodLog.js';
import { dexEntryOverviewMarkup, loadAllDexEntries, openDexEntryEditor, renderDexEntries } from './dexEntries.js';
import { mountDexEntryDetail } from './dexEntryDetail.js';
import { registriereServiceWorker } from './pwa.js';
import { iconMarkup } from './icons.js';
import { toast } from './toast.js';
import { isFresh } from './freshness.js';
import { categoryColor, categoryIconMarkup, materialIconMarkup, mountCategoryChrome } from './categoryIcons.js';
import {
  collectionGridMarkup, collectionIconMarkup, deleteCollection, getCollection, loadCollections, openCollectionEditor,
} from './collections.js';

applyTheme(getTheme());
applySchatten(getSchatten());
registriereServiceWorker().catch(() => {});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.typ === 'gehe-zu' && event.data.url) location.hash = event.data.url.replace(/^#/, '');
  });
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

function syncStatusAktualisieren() {
  const sync = document.querySelector('#app-sync');
  if (!sync) return;
  const online = navigator.onLine;
  sync.className = `save-dot ${online ? 'ok' : 'wait'}`;
  sync.textContent = online ? '✓' : '↑';
  sync.title = online ? 'Online – Synchronisierung aktiv' : 'Offline – Synchronisierung wartet';
  sync.setAttribute('aria-label', sync.title);
}

window.addEventListener('online', syncStatusAktualisieren);
window.addEventListener('offline', syncStatusAktualisieren);

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
      <div class="auth-marke">${brandMarkup()}</div>
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
        await signIn(email, password);
      } else {
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
  ['body', 'KFA-LOG', 'Gewicht, Hautfalten und Trends.', 'body', 'cyan', 'Aktiv'],
  ['reminders', 'MAHLZEITEN', 'Mahlzeiten, Supplements und Wasser.', 'reminders', 'pink', 'Aktiv'],
  ['food-log', 'Food-Log', 'Gute Mahlzeiten wiederfinden.', 'food', 'violet', 'Aktiv'],
  ['recipes', 'Rezepte', 'Eigene Rezepte und schnelle Standards.', 'recipes', 'blue', 'Bald'],
  ['habits', 'ROUTINEN', 'Kleine Routinen täglich abhaken.', 'habits', 'gelb', 'Bald'],
];
const bereiche = sammlungen.map(([route, titel]) => [route, titel]);
const sichtbareSammlungen = () => {
  const nachRoute = new Map(sammlungen.map((sammlung) => [sammlung[0], sammlung]));
  return visibleCollectionRoutes().map((route) => nachRoute.get(route)).filter(Boolean);
};

// Welche Tabelle den Zaehler einer Sammlung fuellt. Rezepte und Gewohnheiten
// haben noch keine Tabelle – ihre Karten zeigen weiter "Bald".
// Row Level Security ist auf allen Tabellen aktiv, die Zaehlung liefert also
// von sich aus nur die eigenen Zeilen; ein Filter auf die user_id waere
// doppelt gemoppelt.
// Zuletzt geladene Zahlen. Beim Zurueckspringen auf die Startseite stehen sie
// dadurch sofort da, statt erneut durch den Platzhalter zu laufen.
let zaehlerStand = {};
let neuStand = {};

const ZAEHLQUELLEN = {
  body: { tabelle: 'weights', eins: 'Messung', viele: 'Messungen' },
  reminders: { tabelle: 'reminders', eins: 'Erinnerung', viele: 'Erinnerungen' },
  'food-log': { tabelle: 'food_logs', eins: 'Eintrag', viele: 'Einträge' },
};

// head:true holt nur den Zaehler, keine Zeilen – fuenf Karten kosten so fuenf
// leere Antworten statt der kompletten Tabellen.
async function zaehlerLaden(signal) {
  const paare = await Promise.all(Object.entries(ZAEHLQUELLEN).map(async ([route, { tabelle }]) => {
    try {
      const countQuery = supabase.from(tabelle)
        .select('*', { count: 'exact', head: true }).abortSignal(signal);
      const latestQuery = supabase.from(tabelle)
        .select('created_at').order('created_at', { ascending: false }).limit(1).abortSignal(signal);
      const [{ count, error }, { data: latest }] = await Promise.all([countQuery, latestQuery]);
      neuStand[route] = isFresh(latest?.[0]?.created_at);
      return [route, error ? null : (count ?? 0)];
    } catch (e) {
      neuStand[route] = false;
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
    karte.querySelector('.dex-neu-stern')?.toggleAttribute('hidden', !neuStand[karte.dataset.sammlung]);
  });
}

function renderChrome(route) {
  app.classList.add('app-shell');
  let header = app.querySelector(':scope > .app-kopf');
  let view = app.querySelector(':scope > #view');
  if (!header || !view) {
    app.innerHTML = `
      <header class="topbar app-kopf">
        <div class="wrap">
          <a class="kopf-marke" href="#home" aria-label="MUSCLE-DEX – Meine Dex-Einträge">${headerBrandMarkup()}</a>
          <nav class="kopf-aktionen" aria-label="App-Status und Profil">
            <span class="save-dot ok" id="app-sync" role="status" aria-live="polite" title="Synchronisiert">✓</span>
            <a class="nav-av nav-av-fb" href="#profile" aria-label="Profil und Einstellungen">${avatarMarkup()}</a>
          </nav>
        </div>
      </header>
      <main id="view"></main>`;
    header = app.querySelector(':scope > .app-kopf');
    view = app.querySelector(':scope > #view');
  }
  header.querySelector('[href="#profile"]')?.classList.toggle('aktiv', route === 'profile');
  view.replaceChildren();
  view.className = '';
  view.removeAttribute('style');
  // Jede Route beginnt in ihrem eigenen, einzigen Scrollcontainer oben. Das
  // Dokument selbst bewegt sich nie; dadurch muss iOS keinen Sticky-Header
  // gegen eine alte Dokument-Scrollposition neu zusammensetzen.
  view.scrollTop = 0;
  syncStatusAktualisieren();
  return view;
}

function istDunkleOrdnerfarbe(farbe) {
  const hex = String(farbe || '').trim().replace('#', '');
  if (!/^[0-9a-f]{6}$/i.test(hex)) return false;
  const [r, g, b] = [0, 2, 4].map((start) => Number.parseInt(hex.slice(start, start + 2), 16));
  return (r * 299 + g * 587 + b * 114) / 1000 < 135;
}

function dexOrdnerKarte({ href, titel, meta, iconInhalt, farbe, route = '', neu = false, eigene = false }) {
  return `
  <div class="tuck-fach dex-ordner-testfach${istDunkleOrdnerfarbe(farbe) ? ' dex-ordner-dunkel' : ''}${route ? ` dex-ordner-${route}` : ''}${eigene ? ' eigene-sammlung' : ''}" style="--ordner:${farbe}">
    <a class="tuck-karte dex-datensatz-karte dex-ordner-test" href="${href}"${route ? ` data-sammlung="${route}"` : ''}>
      <svg class="dex-ordner-form" viewBox="0 0 512 450" aria-hidden="true">
        <g transform="translate(.016 13.463)">
          <g transform="matrix(1.6455 0 0 1.04448 -198.199 50)">
            <path class="dex-ordner-rueckblatt" d="M400 40.19C400 18.009 388.569 0 374.489 0H155.511C141.431 0 130 18.009 130 40.19v124.557c0 22.182 11.431 40.191 25.511 40.191h218.978c14.08 0 25.511-18.009 25.511-40.191V40.19Z"/>
          </g>
          <g transform="matrix(.981481 0 0 1.01546 7.407 10)">
            <path class="dex-ordner-farbblatt" d="M400 40.19C400 18.009 381.368 0 358.418 0H171.582C148.632 0 130 18.009 130 40.19v124.557c0 22.182 18.632 40.191 41.582 40.191h186.836c22.95 0 41.582-18.009 41.582-40.191V40.19Z"/>
          </g>
          <path class="dex-ordner-front" d="M60 153.744s172.262.297 220-.071c26.551-.206 38.281-36.535 70-38.013l110-.013c19.077-.457 36.626 15.931 36.246 34.353l-.477 210c-.833 23.409-23.198 45.854-45.769 46.537l-380-.552c-27.553 1.004-53.616-20.966-54.284-45.985l.016-170c1.739-24.913 22.434-36.723 44.268-36.256Z"/>
        </g>
      </svg>
      <span class="dex-neu-stern"${neu ? '' : ' hidden'} aria-label="Neuer Eintrag">★</span>
      <span class="dex-ordner-inhalt">
        <span class="dex-datensatz-meta">${meta}</span>
        <h2>${titel}</h2>
      </span>
      <span class="dex-ordner-kartenicon" aria-hidden="true">${iconInhalt}</span>
    </a>
  </div>`;
}

// Alle DEX-Eintraege teilen dieselbe dreilagige Ordnerform.
function sammlungsKarten(daten = sammlungen, zaehler = {}) {
  return daten.map(([route, titel, , icon, farbe, status]) => {
    // Solange die Zahl laedt, steht der Stand da. So springt die Karte beim
    // Nachtragen nur um eine Zeile und nicht um ihre halbe Hoehe.
    const meta = zaehlerText(route, zaehler[route])
      || (ZAEHLQUELLEN[route] ? '<b>…</b>' : `<b>${status}</b>`);
    const iconInhalt = categoryIconMarkup(route, 'muscledex-sammlungsicon');
    return dexOrdnerKarte({
      href: `#${route}`, route, titel, meta, iconInhalt,
      farbe: categoryColor(route), neu: Boolean(neuStand[route]),
    });
  }).join('');
}

function eigeneSammlungsKarten(items) {
  return items.map((item) => dexOrdnerKarte({
    href: `#collection/${item.id}`,
    titel: escapeHtml(item.name),
    meta: '<b>Eigener</b><span>Dex</span>',
    iconInhalt: collectionIconMarkup(item.icon_key),
    farbe: item.color,
    neu: isFresh(item.created_at),
    eigene: true,
  })).join('');
}

async function mountHome(container, signal) {
  setSeite('home');
  const sichtbar = sichtbareSammlungen();
  let eigene = [];
  try { eigene = await loadCollections(session.user.id, { rootKey: 'home', signal }); }
  catch (error) { if (!signal?.aborted) toast('Eigene Dex-Einträge konnten nicht geladen werden.'); }
  if (signal?.aborted) return;
  eigene = orderCustomCollections(eigene).filter((item) => customCollectionIsVisible(item.id));
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-home">
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
        <button class="tuck-quadrat betont neu-sammlung" type="button" aria-label="Neuen Dex erstellen">
          ${materialIconMarkup('create_new_folder')}
        </button>
      </header>
      <section class="tuck-grid" aria-label="Meine Dex-Einträge">
        ${sammlungsKarten(sichtbar, zaehlerStand)}${eigeneSammlungsKarten(eigene)}
      </section>
    </div>`;

  container.querySelector('.neu-sammlung').onclick = () => openCollectionEditor({
    userId: session.user.id,
    rootKey: 'home',
    onSaved: () => window.dispatchEvent(new HashChangeEvent('hashchange')),
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
}

const dexEntriesSlotMarkup = () => '<div class="dex-eintraege" data-dex-entries><div class="daten-laden">DEX-Einträge werden geladen …</div></div>';

async function mountCustomCollection(container, item, signal) {
  setSeite('collection');
  const children = await loadCollections(session.user.id, { rootKey: item.root_key, parentId: item.id, signal });
  if (signal?.aborted) return;
  if (item.root_key === 'food-log') {
    await mountFoodLog(container, { session, profile, signal, collectionId: item.id });
    container.querySelector(':scope > .wrap')?.insertAdjacentHTML('beforeend', dexEntriesSlotMarkup());
  } else {
    container.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
      <div class="seitenkopf"><h1>${escapeHtml(item.name)}</h1></div>
      ${collectionGridMarkup(children)}
      ${dexEntriesSlotMarkup()}
    </div>`;
  }
  const backHref = item.parent_id ? `#collection/${item.parent_id}` : (item.root_key === 'home' ? '#home' : `#${item.root_key}`);
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const openEntry = (type) => openDexEntryEditor({
    type, userId: session.user.id, rootKey: item.root_key, collectionId: item.id, onSaved: refresh,
  });
  mountCategoryChrome(container, `collection-${item.id}`, item.name, {
    backHref,
    color: item.color,
    meta: `${children.length} Unter-Dex`,
    onAddLink: () => openEntry('link'),
    onAddImage: () => openEntry('image'),
    onCreateSub: () => openCollectionEditor({
      userId: session.user.id, rootKey: item.root_key, parentId: item.id, onSaved: refresh,
    }),
    onRename: () => openCollectionEditor({
      userId: session.user.id, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh,
    }),
    onEditAppearance: () => openCollectionEditor({
      userId: session.user.id, rootKey: item.root_key, parentId: item.parent_id, existing: item, onSaved: refresh,
    }),
    onDelete: async () => {
      if (!confirm(`„${item.name}“ samt Unter-Dex wirklich löschen?`)) return;
      try {
        await deleteCollection(session.user.id, item);
        toast('Dex gelöscht');
        location.hash = backHref.slice(1);
      } catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
    },
  });
  if (item.root_key === 'food-log' && children.length) {
    container.querySelector('.kategorie-kopf')?.insertAdjacentHTML('afterend', collectionGridMarkup(children));
  }
  await renderDexEntries(container, {
    userId: session.user.id, rootKey: item.root_key, collectionId: item.id,
    color: item.color, signal,
    onChanged: (entries) => {
      if (!Array.isArray(entries)) return;
      const meta = container.querySelector('.kategorie-kopftitel small');
      if (meta) meta.textContent = `${entries.length} Einträge · ${children.length} Unter-Dex`;
    },
  });
}

async function addFixedSubcollections(container, rootKey, signal) {
  const children = await loadCollections(session.user.id, { rootKey, signal });
  if (signal?.aborted) return [];
  const wrap = container.querySelector(':scope > .wrap');
  const chrome = wrap?.querySelector('.kategorie-kopf');
  const anchor = chrome || wrap?.querySelector(':scope > .seitenkopf');
  if (wrap && children.length) anchor?.insertAdjacentHTML('afterend', collectionGridMarkup(children));
  return children;
}

async function mountSearch(container, signal) {
  setSeite('search');
  const sichtbar = sichtbareSammlungen();
  const aktiv = sichtbar.filter(([, , , , , status]) => status === 'Aktiv').length;
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-suche-seite">
      <div class="tuck-suchzeile">
        <label class="tuck-suchfeld" for="global-search">
          ${iconMarkup('search')}
          <input id="global-search" type="search" autocomplete="off" placeholder="Dex-Einträge durchsuchen …">
        </label>
        <a class="seiten-x" href="#home" aria-label="Suche schließen">×</a>
      </div>
      <section class="such-tags" data-search-tags hidden></section>
      <section class="tuck-bibliothek">
        <span>Deine Bibliothek</span>
        <div class="tuck-bibliothek-werte">
          <div><b>${sichtbar.length}</b><small>Dex-Einträge</small></div>
          <div><b data-summe>…</b><small>Einträge</small></div>
          <div><b>${sichtbar.length - aktiv}</b><small>Geplant</small></div>
        </div>
      </section>
      <h2 class="tuck-abschnittstitel">Dex-Treffer</h2>
      <section class="dex-inhaltsgrid such-eintraege" data-search-results><div class="daten-laden">DEX-Einträge werden geladen …</div></section>
      <div class="tuck-leer" data-search-empty hidden>
        ${iconMarkup('search')}
        <b>Nichts gefunden</b>
        <span>Kein Titel, keine Beschreibung und kein Tag passen zu deiner Suche.</span>
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
  requestAnimationFrame(() => input.focus({ preventScroll: true }));

  zaehlerLaden(signal).then((zaehler) => {
    if (signal?.aborted) return;
    zaehlerStand = zaehler;
    if (!container.isConnected) return;
    zaehlerEintragen(container, zaehler);
    const summe = Object.values(zaehler).filter((n) => typeof n === 'number');
    const feld = container.querySelector('[data-summe]');
    // Nur zeigen, wenn alle Zaehler da sind – eine Teilsumme waere schlicht falsch.
    if (feld) feld.textContent = summe.length === Object.keys(ZAEHLQUELLEN).length
      ? summe.reduce((a, b) => a + b, 0)
      : '–';
  });
}

function mountComingSoon(container, route) {
  const recipes = route === 'recipes';
  setSeite(route);
  container.innerHTML = `
    <div class="wrap pad-bottom bereich-vorschau">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">${recipes ? 'Sammlung' : 'Routine'}</span>
          <h1 class="section-title">${recipes ? 'REZEPTE' : 'ROUTINEN'}</h1>
        </div>
      </div>
      <section class="seiten-einstieg">
        <b>${recipes ? 'Deine Standards an einem Ort' : 'Kleine Schritte, die bleiben'}</b>
        <span>${recipes
          ? 'Eigene Rezepte, Cheat-Code-Mahlzeiten und gespeicherte Videos folgen hier.'
          : 'Tägliche Routinen, Serien und Fortschritt werden hier aufgebaut.'}</span>
      </section>
      <section class="card vorschau-karte">
        <span aria-hidden="true">${iconMarkup(recipes ? 'recipes' : 'habits')}</span>
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

async function render() {
  const generation = ++renderGeneration;
  if (!supabaseKonfiguriert) return renderSetup();
  if (recovery) return renderRecovery();
  if (!session) return renderAuth();
  if (!profile) {
    try { await profilSicherLaden(); }
    catch (error) {
      if (generation !== renderGeneration) return;
      app.replaceChildren();
      const main = document.createElement('main');
      main.className = 'setup-shell wrap';
      const box = document.createElement('div');
      box.className = 'msg err';
      box.textContent = fehlertext(error);
      main.appendChild(box);
      app.appendChild(main);
      return;
    }
  }
  if (generation !== renderGeneration) return;
  const angefragt = (location.hash || '#home').slice(1);
  const route = ['home', 'search', 'profile'].includes(angefragt) || bereiche.some(([ziel]) => ziel === angefragt)
    || angefragt.startsWith('collection/') || angefragt.startsWith('entry/')
    ? angefragt
    : 'home';
  routeAbortController?.abort();
  routeAbortController = new AbortController();
  const { signal } = routeAbortController;
  const view = renderChrome(route);
  if (route === 'home') {
    await mountHome(view, signal);
  } else if (route === 'search') {
    await mountSearch(view, signal);
  } else if (route === 'profile') {
    setSeite('profile');
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
  } else if (route === 'body') {
    setSeite('body');
    mountBodyMetrics(view, {
      session,
      profile,
      signal,
      onProfileUpdated: (aktuell) => { profile = aktuell; },
    });
    mountCategoryChrome(view, route, 'KFA-LOG');
  } else if (route === 'reminders') {
    setSeite('reminders');
    mountReminders(view, { session, profile, signal });
    mountCategoryChrome(view, route, 'MAHLZEITEN');
  } else if (route === 'food-log') {
    setSeite('food-log');
    await mountFoodLog(view, { session, profile, signal });
    // Erst Inhalte und Unter-Sammlungen aufbauen, dann genau eine Kopfzeile.
    const children = await addFixedSubcollections(view, 'food-log', signal);
    view.querySelector(':scope > .wrap')?.insertAdjacentHTML('beforeend', dexEntriesSlotMarkup());
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type) => openDexEntryEditor({
      type, userId: session.user.id, rootKey: 'food-log', onSaved: refresh,
    });
    mountCategoryChrome(view, route, 'Food-Log', {
      meta: `${children.length} Unter-Dex`,
      onAddLink: () => openEntry('link'),
      onAddImage: () => openEntry('image'),
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'food-log', onSaved: refresh }),
    });
    await renderDexEntries(view, {
      userId: session.user.id, rootKey: 'food-log', color: categoryColor('food-log'), signal,
      onChanged: (entries) => {
        if (!Array.isArray(entries)) return;
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta) meta.textContent = `${entries.length} Einträge · ${children.length} Unter-Dex`;
      },
    });
  } else if (route === 'recipes') {
    setSeite('recipes');
    const children = await loadCollections(session.user.id, { rootKey: 'recipes', signal });
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite"><div class="seitenkopf"><h1>REZEPTE</h1></div>${collectionGridMarkup(children)}${dexEntriesSlotMarkup()}</div>`;
    const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
    const openEntry = (type) => openDexEntryEditor({ type, userId: session.user.id, rootKey: 'recipes', onSaved: refresh });
    mountCategoryChrome(view, route, 'REZEPTE', {
      meta: `${children.length} Unter-Dex`,
      onAddLink: () => openEntry('link'),
      onAddImage: () => openEntry('image'),
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'recipes', onSaved: refresh }),
    });
    await renderDexEntries(view, {
      userId: session.user.id, rootKey: 'recipes', color: categoryColor('recipes'), signal,
      onChanged: (entries) => {
        if (!Array.isArray(entries)) return;
        const meta = view.querySelector('.kategorie-kopftitel small');
        if (meta) meta.textContent = `${entries.length} Einträge · ${children.length} Unter-Dex`;
      },
    });
  } else if (route.startsWith('collection/')) {
    const item = await getCollection(session.user.id, route.slice('collection/'.length), signal);
    if (!item) { location.hash = 'home'; return; }
    await mountCustomCollection(view, item, signal);
  } else if (route.startsWith('entry/')) {
    setSeite('collection');
    await mountDexEntryDetail(view, { userId: session.user.id, id: route.slice('entry/'.length), signal });
  } else if (route === 'habits') {
    mountComingSoon(view, route);
    mountCategoryChrome(view, route, route === 'recipes' ? 'REZEPTE' : 'ROUTINEN');
  } else {
    mountHome(view, signal);
  }
}

window.addEventListener('hashchange', () => render());

if (!supabaseKonfiguriert) {
  renderSetup();
} else {
  supabase.auth.onAuthStateChange((event, neueSession) => {
    const bisherigeUserId = session?.user?.id;
    session = neueSession;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') {
      profile = null;
      profileLadePromise = null;
    }
    if (event === 'SIGNED_IN' && bisherigeUserId && bisherigeUserId !== session?.user?.id) {
      profile = null;
      profileLadePromise = null;
    }
    if (session?.user?.id) startReminderLoop(session.user.id);
    // Ein still erneuertes Zugriffstoken darf die gerade benutzte Unterseite
    // nicht neu aufbauen. Auch wiederholte SIGNED_IN-Ereignisse desselben
    // Nutzers (z. B. nach Rueckkehr in die PWA) aktualisieren nur die Session.
    if (event === 'TOKEN_REFRESHED') return;
    if (event === 'SIGNED_IN' && bisherigeUserId === session?.user?.id && profile) return;
    setTimeout(() => render(), 0);
  });
}
