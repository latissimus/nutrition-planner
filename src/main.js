import './styles.css';
import '@fontsource/archivo/latin-500.css';
import '@fontsource/archivo/latin-600.css';
import '@fontsource/archivo/latin-700.css';
import '@fontsource/archivo/latin-800.css';
import '@fontsource/archivo/latin-900.css';
import { supabase, supabaseKonfiguriert } from './supabase.js';
import { signIn, signUp, resetPassword, updatePassword, loadProfile } from './auth.js';
import { getTheme, applyTheme, setTheme } from './theme.js';
import { brandMarkup, headerBrandMarkup } from './brand.js';
import { mountProfile } from './profile.js';
import { mountBodyMetrics } from './bodyMetrics.js';
import { mountReminders, startReminderLoop } from './reminders.js';
import { mountFoodLog } from './foodLog.js';
import { registriereServiceWorker } from './pwa.js';
import { iconMarkup } from './icons.js';
import { toast } from './toast.js';

applyTheme(getTheme());
registriereServiceWorker().catch(() => {});

if ('serviceWorker' in navigator) {
  navigator.serviceWorker.addEventListener('message', (event) => {
    if (event.data?.typ === 'gehe-zu' && event.data.url) location.hash = event.data.url.replace(/^#/, '');
  });
}

const app = document.querySelector('#app');
let session = null;
let profile = null;
let recovery = false;
let authMode = 'login';

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
  applyTheme(getTheme());
}

function meldung(slot, text, art) {
  slot.replaceChildren();
  const node = document.createElement('div');
  node.className = `msg ${art}`;
  node.textContent = text;
  slot.appendChild(node);
}

function renderSetup() {
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

const sammlungen = [
  ['body', 'Körperwerte', 'Gewicht, Hautfalten und Trends.', 'body', 'cyan', 'Aktiv'],
  ['reminders', 'Erinnerungen', 'Mahlzeiten, Supplements und Wasser.', 'reminders', 'pink', 'Aktiv'],
  ['food-log', 'Food-Log', 'Gute Mahlzeiten wiederfinden.', 'food', 'violet', 'Aktiv'],
  ['recipes', 'Rezepte', 'Eigene Rezepte und schnelle Standards.', 'recipes', 'blue', 'Bald'],
  ['habits', 'Gewohnheiten', 'Kleine Routinen täglich abhaken.', 'habits', 'cream', 'Bald'],
];
const bereiche = sammlungen.map(([route, titel]) => [route, titel]);

function renderChrome(route) {
  app.innerHTML = `
    <header class="topbar app-kopf">
      <div class="wrap">
        <a class="kopf-marke" href="#home" aria-label="MUSCLE-DEX – Meine Sammlungen">${headerBrandMarkup()}</a>
        <nav class="kopf-aktionen" aria-label="App-Status und Profil">
          <span class="save-dot ok" id="app-sync" role="status" aria-live="polite" title="Synchronisiert">✓</span>
          <a class="kopf-quadrat kopf-suche${route === 'search' ? ' aktiv' : ''}" href="#search" aria-label="MUSCLEDEX durchsuchen">
            ${iconMarkup('search')}
          </a>
          <a class="nav-av nav-av-fb kopf-quadrat${route === 'profile' ? ' aktiv' : ''}" href="#profile" aria-label="Profil und Einstellungen">${avatarMarkup()}</a>
        </nav>
      </div>
    </header>
    <main id="view"></main>`;
  syncStatusAktualisieren();
}

function sammlungsKarten(daten = sammlungen) {
  return daten.map(([route, titel, text, icon, farbe, status]) => `
    <a class="sammlungskarte ${farbe}" href="#${route}" data-sammlung="${route}">
      <span class="sammlungs-tab" aria-hidden="true"></span>
      <span class="sammlungs-icon" aria-hidden="true">${iconMarkup(icon)}</span>
      <span class="sammlungs-status">${status}</span>
      <h2>${titel}</h2>
      <p>${text}</p>
    </a>`).join('');
}

function mountHome(container) {
  setSeite('home');
  container.innerHTML = `
    <div class="wrap pad-bottom tuckii-home">
      <header class="sammlungs-kopf">
        <div>
          <span>Bibliothek</span>
          <h1>Meine Sammlungen</h1>
        </div>
        <button class="tuckii-quadrat neu-sammlung" type="button" aria-label="Neue Sammlung erstellen">
          ${iconMarkup('folderPlus')}
        </button>
      </header>
      <section class="sammlungs-grid" aria-label="Meine Sammlungen">
        ${sammlungsKarten()}
      </section>
    </div>`;

  container.querySelector('.neu-sammlung').onclick = () => {
    toast('Eigene Sammlungen ergänzen wir im nächsten Schritt.');
  };
}

function mountSearch(container) {
  setSeite('search');
  container.innerHTML = `
    <div class="wrap pad-bottom tuckii-suche-seite">
      <div class="tuckii-suchzeile">
        <label class="tuckii-suchfeld" for="global-search">
          ${iconMarkup('search')}
          <input id="global-search" type="search" autocomplete="off" placeholder="Sammlungen durchsuchen …">
        </label>
        <a href="#home">Abbrechen</a>
      </div>
      <section class="such-bibliothek">
        <span>Deine Bibliothek</span>
        <div><b>${sammlungen.length}</b><small>Sammlungen</small></div>
        <div><b>3</b><small>Aktiv</small></div>
        <div><b>2</b><small>Geplant</small></div>
      </section>
      <h1 class="such-ergebnis-titel">Bereiche</h1>
      <section class="such-ergebnisse" data-search-results>${sammlungsKarten()}</section>
      <div class="such-leer" data-search-empty hidden>
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
    const treffer = sammlungen.filter(([, titel, text]) => `${titel} ${text}`.toLocaleLowerCase('de').includes(query));
    results.innerHTML = sammlungsKarten(treffer);
    empty.hidden = treffer.length > 0;
  };
  requestAnimationFrame(() => input.focus({ preventScroll: true }));
}

function mountComingSoon(container, route) {
  const recipes = route === 'recipes';
  setSeite(route);
  container.innerHTML = `
    <div class="wrap pad-bottom bereich-vorschau">
      <div class="seitenkopf">
        <div class="seitenkopf-text">
          <span class="seitenkopf-kicker">${recipes ? 'Sammlung' : 'Routine'}</span>
          <h1 class="section-title">${recipes ? 'Rezepte' : 'Gewohnheiten'}</h1>
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

async function render() {
  if (!supabaseKonfiguriert) return renderSetup();
  if (recovery) return renderRecovery();
  if (!session) return renderAuth();
  if (!profile) {
    try { await profilLaden(); }
    catch (error) {
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
  const angefragt = (location.hash || '#home').slice(1);
  const route = ['home', 'search', 'profile'].includes(angefragt) || bereiche.some(([ziel]) => ziel === angefragt)
    ? angefragt
    : 'home';
  renderChrome(route);
  const view = app.querySelector('#view');
  if (route === 'home') {
    mountHome(view);
  } else if (route === 'search') {
    mountSearch(view);
  } else if (route === 'profile') {
    setSeite('profile');
    mountProfile(view, {
      session,
      profile,
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
      onProfileUpdated: (aktuell) => { profile = aktuell; },
    });
  } else if (route === 'reminders') {
    setSeite('reminders');
    mountReminders(view, { session, profile });
  } else if (route === 'food-log') {
    setSeite('food-log');
    mountFoodLog(view, { session, profile });
  } else if (route === 'recipes' || route === 'habits') {
    mountComingSoon(view, route);
  } else {
    mountHome(view);
  }
}

window.addEventListener('hashchange', () => render());

if (!supabaseKonfiguriert) {
  renderSetup();
} else {
  supabase.auth.onAuthStateChange((event, neueSession) => {
    session = neueSession;
    if (event === 'PASSWORD_RECOVERY') recovery = true;
    if (event === 'SIGNED_OUT') profile = null;
    if (session?.user?.id) startReminderLoop(session.user.id);
    setTimeout(() => render(), 0);
  });
  supabase.auth.getSession().then(({ data }) => {
    session = data.session;
    if (session?.user?.id) startReminderLoop(session.user.id);
    render();
  });
}
