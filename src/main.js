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
import { visibleCollectionRoutes } from './collectionPreferences.js';
import { mountBodyMetrics } from './bodyMetrics.js';
import { mountReminders, startReminderLoop } from './reminders.js';
import { mountFoodLog } from './foodLog.js';
import { registriereServiceWorker } from './pwa.js';
import { iconMarkup } from './icons.js';
import { toast } from './toast.js';
import { categoryColor, categoryIconMarkup, materialIconMarkup, mountCategoryChrome } from './categoryIcons.js';
import {
  collectionGridMarkup, deleteCollection, getCollection, loadCollections, openCollectionEditor,
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
      const { count, error } = await supabase.from(tabelle)
        .select('*', { count: 'exact', head: true })
        .abortSignal(signal);
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
    const meta = karte.querySelector('.tuck-meta');
    if (text && meta) meta.innerHTML = text;
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
          <a class="kopf-marke" href="#home" aria-label="MUSCLE-DEX – Meine Sammlungen">${headerBrandMarkup()}</a>
          <nav class="kopf-aktionen" aria-label="App-Status und Profil">
            <span class="save-dot ok" id="app-sync" role="status" aria-live="polite" title="Synchronisiert">✓</span>
            <a class="tuck-quadrat" href="#search" aria-label="MUSCLE-DEX durchsuchen">
              ${materialIconMarkup('search')}
            </a>
            <a class="nav-av nav-av-fb" href="#profile" aria-label="Profil und Einstellungen">${avatarMarkup()}</a>
          </nav>
        </div>
      </header>
      <main id="view"></main>`;
    header = app.querySelector(':scope > .app-kopf');
    view = app.querySelector(':scope > #view');
  }
  header.querySelector('[href="#search"]')?.classList.toggle('aktiv', route === 'search');
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

// Der Aufbau folgt der Ordnerkarte aus Inspirationen/IMG_5109: ein farbiger
// Reiter schaut hinter der Karte hervor, oben links die Symbolkachel in
// derselben Farbe, rechts daneben die Kennzahl, und der Name steht unten in
// Versalien.
function sammlungsKarten(daten = sammlungen, zaehler = {}) {
  return daten.map(([route, titel, , icon, farbe, status]) => {
    // Solange die Zahl laedt, steht der Stand da. So springt die Karte beim
    // Nachtragen nur um eine Zeile und nicht um ihre halbe Hoehe.
    const meta = zaehlerText(route, zaehler[route])
      || (ZAEHLQUELLEN[route] ? '<b>…</b>' : `<b>${status}</b>`);
    // Reiter und Karte sind Geschwister, nicht Kind und Elternteil: Nur so
    // deckt die Karte den Reiter zuverlaessig ab (siehe Kommentar im CSS).
    const iconInhalt = categoryIconMarkup(route, 'muscledex-sammlungsicon');
    const iconFeld = iconInhalt
      ? `<span class="tuck-icon muscledex-iconfeld" aria-hidden="true">${iconInhalt}</span>`
      : '';
    return `
    <div class="tuck-fach ${farbe}" style="--ordner:${categoryColor(route)}">
      <span class="tuck-reiter" aria-hidden="true"></span>
      <a class="tuck-karte" href="#${route}" data-sammlung="${route}">
        <span class="tuck-karte-oben">
          ${iconFeld}
          <span class="tuck-meta">${meta}</span>
        </span>
        <h2>${titel}</h2>
      </a>
    </div>`;
  }).join('');
}

function eigeneSammlungsKarten(items) {
  return items.map((item) => `
    <div class="tuck-fach eigene-sammlung" style="--ordner:${item.color}">
      <span class="tuck-reiter" aria-hidden="true"></span>
      <a class="tuck-karte" href="#collection/${item.id}" data-sammlung="collection/${item.id}">
        <span class="tuck-karte-oben">
          <span class="tuck-icon muscledex-iconfeld" aria-hidden="true">${materialIconMarkup(item.icon_key)}</span>
          <span class="tuck-meta"><b>Eigene</b><span>Sammlung</span></span>
        </span>
        <h2>${escapeHtml(item.name)}</h2>
      </a>
    </div>`).join('');
}

async function mountHome(container, signal) {
  setSeite('home');
  const sichtbar = sichtbareSammlungen();
  let eigene = [];
  try { eigene = await loadCollections(session.user.id, { rootKey: 'home', signal }); }
  catch (error) { if (!signal?.aborted) toast('Eigene Sammlungen konnten nicht geladen werden.'); }
  if (signal?.aborted) return;
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-home">
      <div class="tuck-ablage">
        <label class="tuck-ablage-feld" for="schnell-link">
          <b aria-hidden="true">#</b>
          <input id="schnell-link" type="url" inputmode="url" autocomplete="off"
                 placeholder="Link einfügen" aria-label="Link einfügen und ablegen">
          ${materialIconMarkup('bookmark_star')}
        </label>
        <button class="tuck-ablage-knopf" type="button" aria-label="Abgelegten Link speichern">
          ${materialIconMarkup('add')}
        </button>
      </div>
      <header class="tuck-titelzeile">
        <h1>Meine Sammlungen</h1>
        <button class="tuck-quadrat betont neu-sammlung" type="button" aria-label="Neue Sammlung erstellen">
          ${materialIconMarkup('create_new_folder')}
        </button>
      </header>
      <section class="tuck-grid" aria-label="Meine Sammlungen">
        ${sammlungsKarten(sichtbar, zaehlerStand)}${eigeneSammlungsKarten(eigene)}
      </section>
    </div>`;

  container.querySelector('.neu-sammlung').onclick = () => openCollectionEditor({
    userId: session.user.id,
    rootKey: 'home',
    onSaved: () => window.dispatchEvent(new HashChangeEvent('hashchange')),
  });

  // Feld und Knopf stehen, die Ablage dahinter fehlt noch: Fuer Links gibt es
  // bislang keine Tabelle (Roadmap 7 "Externe Rezeptmedien"). Bis dahin sagt
  // die App das offen, statt eine Eingabe stillschweigend zu verschlucken.
  container.querySelector('.tuck-ablage-knopf').onclick = () => {
    const feld = container.querySelector('#schnell-link');
    toast(feld.value.trim()
      ? 'Links ablegen kommt mit den externen Rezeptmedien.'
      : 'Erst einen Link einfügen.');
  };

  zaehlerLaden(signal).then((zaehler) => {
    if (signal?.aborted) return;
    zaehlerStand = zaehler;
    // Zwischenzeitlich kann eine andere Seite gemountet sein.
    if (container.isConnected) zaehlerEintragen(container, zaehler);
  });
}

function collectionEmptyMarkup(hasChildren) {
  return `<section class="sammlung-alle">
    <h2>Alle Einträge (0)</h2>
    ${hasChildren ? '' : `<div class="sammlung-leer">
      ${materialIconMarkup('create_new_folder')}
      <strong>Noch keine Einträge</strong>
      <span>Tippe auf +, um den ersten Eintrag zu speichern.</span>
    </div>`}
  </section>`;
}

async function mountCustomCollection(container, item, signal) {
  setSeite('collection');
  const children = await loadCollections(session.user.id, { rootKey: item.root_key, parentId: item.id, signal });
  if (signal?.aborted) return;
  if (item.root_key === 'food-log') {
    await mountFoodLog(container, { session, profile, signal, collectionId: item.id });
  } else {
    container.innerHTML = `<div class="wrap pad-bottom sammlung-seite">
      <div class="seitenkopf"><h1>${escapeHtml(item.name)}</h1></div>
      ${collectionGridMarkup(children)}
      ${collectionEmptyMarkup(children.length > 0)}
    </div>`;
  }
  const backHref = item.parent_id ? `#collection/${item.parent_id}` : (item.root_key === 'home' ? '#home' : `#${item.root_key}`);
  const refresh = () => window.dispatchEvent(new HashChangeEvent('hashchange'));
  const entryCount = Number.parseInt(container.querySelector('[data-food-count]')?.textContent || '0', 10) || 0;
  mountCategoryChrome(container, `collection-${item.id}`, item.name, {
    backHref,
    color: item.color,
    meta: `${entryCount} Einträge · ${children.length} Unter-Sammlungen`,
    onPlus: item.root_key === 'food-log' ? () => {
      const target = container.querySelector('[data-food-panel] > summary');
      target?.click();
      target?.scrollIntoView({ behavior: 'smooth', block: 'center' });
    } : undefined,
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
      if (!confirm(`„${item.name}“ samt Unter-Sammlungen wirklich löschen?`)) return;
      try {
        await deleteCollection(session.user.id, item);
        toast('Sammlung gelöscht');
        location.hash = backHref.slice(1);
      } catch (error) { toast(error.message || 'Löschen fehlgeschlagen'); }
    },
  });
  if (item.root_key === 'food-log' && children.length) {
    container.querySelector('.kategorie-kopf')?.insertAdjacentHTML('afterend', collectionGridMarkup(children));
  }
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

function mountSearch(container, signal) {
  setSeite('search');
  const sichtbar = sichtbareSammlungen();
  const aktiv = sichtbar.filter(([, , , , , status]) => status === 'Aktiv').length;
  container.innerHTML = `
    <div class="wrap pad-bottom tuck-suche-seite">
      <div class="tuck-suchzeile">
        <label class="tuck-suchfeld" for="global-search">
          ${iconMarkup('search')}
          <input id="global-search" type="search" autocomplete="off" placeholder="Sammlungen durchsuchen …">
        </label>
        <a href="#home">Abbrechen</a>
      </div>
      <section class="tuck-bibliothek">
        <span>Deine Bibliothek</span>
        <div class="tuck-bibliothek-werte">
          <div><b>${sichtbar.length}</b><small>Sammlungen</small></div>
          <div><b data-summe>…</b><small>Einträge</small></div>
          <div><b>${sichtbar.length - aktiv}</b><small>Geplant</small></div>
        </div>
      </section>
      <h2 class="tuck-abschnittstitel">Bereiche</h2>
      <section class="tuck-grid" data-search-results>${sammlungsKarten(sichtbar, zaehlerStand)}</section>
      <div class="tuck-leer" data-search-empty hidden>
        ${iconMarkup('search')}
        <b>Nichts gefunden</b>
        <span>Die Suche in einzelnen Einträgen ergänzen wir später.</span>
      </div>
    </div>`;

  const input = container.querySelector('#global-search');
  const results = container.querySelector('[data-search-results]');
  const empty = container.querySelector('[data-search-empty]');
  input.oninput = () => {
    const query = input.value.trim().toLocaleLowerCase('de');
    const treffer = sichtbar.filter(([, titel, text]) => `${titel} ${text}`.toLocaleLowerCase('de').includes(query));
    results.innerHTML = sammlungsKarten(treffer, zaehlerStand);
    empty.hidden = treffer.length > 0;
  };
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
    || angefragt.startsWith('collection/')
    ? angefragt
    : 'home';
  routeAbortController?.abort();
  routeAbortController = new AbortController();
  const { signal } = routeAbortController;
  const view = renderChrome(route);
  if (route === 'home') {
    await mountHome(view, signal);
  } else if (route === 'search') {
    mountSearch(view, signal);
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
    const entryCount = Number.parseInt(view.querySelector('[data-food-count]')?.textContent || '0', 10) || 0;
    mountCategoryChrome(view, route, 'Food-Log', {
      meta: `${entryCount} Einträge · ${children.length} Unter-Sammlungen`,
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'food-log', onSaved: () => window.dispatchEvent(new HashChangeEvent('hashchange')) }),
    });
  } else if (route === 'recipes') {
    setSeite('recipes');
    const children = await loadCollections(session.user.id, { rootKey: 'recipes', signal });
    view.innerHTML = `<div class="wrap pad-bottom sammlung-seite"><div class="seitenkopf"><h1>REZEPTE</h1></div>${collectionGridMarkup(children)}${collectionEmptyMarkup(children.length > 0)}</div>`;
    mountCategoryChrome(view, route, 'REZEPTE', {
      meta: `0 Einträge · ${children.length} Unter-Sammlungen`,
      onCreateSub: () => openCollectionEditor({ userId: session.user.id, rootKey: 'recipes', onSaved: () => window.dispatchEvent(new HashChangeEvent('hashchange')) }),
    });
  } else if (route.startsWith('collection/')) {
    const item = await getCollection(session.user.id, route.slice('collection/'.length), signal);
    if (!item) { location.hash = 'home'; return; }
    await mountCustomCollection(view, item, signal);
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
