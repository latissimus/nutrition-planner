import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { getTheme, setTheme, getSchatten, setSchatten } from './theme.js';
import { toast } from './toast.js';

const initials = (name, email) => {
  const quelle = (name || email || '?').trim();
  const teile = quelle.split(/\s+/).filter(Boolean);
  return (teile.length >= 2 ? teile[0][0] + teile[1][0] : quelle.slice(0, 2)).toUpperCase();
};

function komprimiereProfilbild(file, size = 256, quality = 0.82) {
  return new Promise((resolve, reject) => {
    const reader = new FileReader();
    reader.onerror = () => reject(new Error('read'));
    reader.onload = () => {
      const img = new Image();
      img.onerror = () => reject(new Error('decode'));
      img.onload = () => {
        const faktor = Math.min(1, size / Math.max(img.width, img.height));
        const canvas = document.createElement('canvas');
        canvas.width = Math.max(1, Math.round(img.width * faktor));
        canvas.height = Math.max(1, Math.round(img.height * faktor));
        canvas.getContext('2d').drawImage(img, 0, 0, canvas.width, canvas.height);
        resolve(canvas.toDataURL('image/jpeg', quality));
      };
      img.src = reader.result;
    };
    reader.readAsDataURL(file);
  });
}

function avatar(profile, email) {
  if (profile.avatar_url) {
    const img = document.createElement('img');
    img.className = 'avatar';
    img.src = profile.avatar_url;
    img.alt = 'Profilbild';
    return img;
  }
  const ersatz = document.createElement('div');
  ersatz.className = 'avatar avatar-fallback';
  ersatz.textContent = initials(profile.full_name, email);
  return ersatz;
}

function abschnitt(wrap, titel, offen = false, klasse = '') {
  const details = document.createElement('details');
  details.className = `profile-abschnitt${klasse ? ` ${klasse}` : ''}`;
  details.open = offen;
  const summary = document.createElement('summary');
  summary.textContent = titel;
  const inhalt = document.createElement('div');
  inhalt.className = 'profile-abschnitt-inhalt';
  details.append(summary, inhalt);
  wrap.appendChild(details);
  return inhalt;
}

function downloadJson(dateiname, daten) {
  const blob = new Blob([JSON.stringify(daten, null, 2)], { type: 'application/json' });
  const url = URL.createObjectURL(blob);
  const link = document.createElement('a');
  link.href = url;
  link.download = dateiname;
  document.body.appendChild(link);
  link.click();
  link.remove();
  setTimeout(() => URL.revokeObjectURL(url), 1000);
}

export function mountProfile(container, { session, profile, onProfileUpdated }) {
  const email = session.user.email || '';
  container.innerHTML = '';
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom';
  wrap.innerHTML = `
    <div class="seitenkopf">
      <div class="seitenkopf-text">
        <span class="seitenkopf-kicker">Konto</span>
        <h1 class="section-title">Mein Profil</h1>
      </div>
      <a class="zurueck" href="#home"><span class="pf">←</span> Übersicht</a>
    </div>
    <section class="seiten-einstieg">
      <b>Alles zu deinem Konto</b>
      <span>Profil, Darstellung und Daten übersichtlich verwalten.</span>
    </section>`;

  const konto = abschnitt(wrap, 'Konto', true);
  const top = document.createElement('div');
  top.className = 'profile-top';
  const avatarSlot = document.createElement('div');
  avatarSlot.appendChild(avatar(profile, email));
  const meta = document.createElement('div');
  meta.className = 'profile-meta';
  const profilname = document.createElement('div');
  profilname.className = 'profile-name';
  profilname.textContent = profile.full_name || '—';
  const profilemail = document.createElement('div');
  profilemail.className = 'profile-email';
  profilemail.textContent = email;
  const rolle = document.createElement('span');
  rolle.className = `role-tag${profile.role === 'admin' ? ' admin' : ''}`;
  rolle.textContent = profile.role === 'admin' ? 'Admin' : 'Nutzer';
  meta.append(profilname, profilemail, rolle);
  top.append(avatarSlot, meta);
  konto.appendChild(top);

  const bildWrap = document.createElement('div');
  bildWrap.innerHTML = '<label class="fld-l">Profilbild ändern</label>';
  const fileLabel = document.createElement('label');
  fileLabel.className = 'profile-datei';
  const fileInput = document.createElement('input');
  fileInput.type = 'file';
  fileInput.accept = 'image/png,image/jpeg,image/webp,image/gif';
  const fileButton = document.createElement('span');
  fileButton.className = 'profile-datei-knopf';
  fileButton.textContent = 'Bild wählen';
  const fileName = document.createElement('span');
  fileName.className = 'profile-dateiname';
  fileName.textContent = 'Kein Bild gewählt';
  fileLabel.append(fileButton, fileName, fileInput);
  bildWrap.appendChild(fileLabel);
  konto.appendChild(bildWrap);

  fileInput.onchange = async () => {
    const file = fileInput.files?.[0];
    if (!file) return;
    fileName.textContent = file.name;
    if (!file.type.startsWith('image/') || file.size > 15 * 1024 * 1024) {
      toast('Bitte ein Bild bis 15 MB wählen');
      fileInput.value = '';
      fileName.textContent = 'Kein Bild gewählt';
      return;
    }
    try {
      toast('Verarbeite Bild…');
      const dataUrl = await komprimiereProfilbild(file);
      const { error } = await supabase.from('profiles').update({ avatar_url: dataUrl }).eq('id', session.user.id);
      if (error) throw error;
      profile.avatar_url = dataUrl;
      avatarSlot.replaceChildren(avatar(profile, email));
      onProfileUpdated?.(profile);
      toast('Profilbild aktualisiert');
    } catch (e) {
      toast('Bild konnte nicht gespeichert werden');
    } finally {
      fileInput.value = '';
      fileName.textContent = 'Kein Bild gewählt';
    }
  };

  const nameWrap = document.createElement('div');
  nameWrap.innerHTML = '<label class="fld-l" for="pf-name">Name</label>';
  const nameInput = document.createElement('input');
  nameInput.id = 'pf-name';
  nameInput.className = 'input';
  nameInput.value = profile.full_name || '';
  nameInput.placeholder = 'Dein Name';
  nameWrap.appendChild(nameInput);
  konto.appendChild(nameWrap);

  const emailWrap = document.createElement('div');
  emailWrap.innerHTML = '<label class="fld-l" for="pf-email">E-Mail (nicht änderbar)</label>';
  const emailInput = document.createElement('input');
  emailInput.id = 'pf-email';
  emailInput.className = 'input';
  emailInput.value = email;
  emailInput.disabled = true;
  emailWrap.appendChild(emailInput);
  konto.appendChild(emailWrap);

  const zone = document.createElement('p');
  zone.className = 'profile-hinweis';
  zone.textContent = `Zeitzone für Erinnerungen: ${profile.zeitzone || 'Europe/Berlin'}`;
  konto.appendChild(zone);

  const speichern = document.createElement('button');
  speichern.className = 'btn btn-primary btn-block';
  speichern.textContent = 'Profil speichern';
  speichern.onclick = async () => {
    speichern.disabled = true;
    const name = nameInput.value.trim() || null;
    const { error } = await supabase.from('profiles').update({ full_name: name }).eq('id', session.user.id);
    speichern.disabled = false;
    if (error) return toast('Speichern fehlgeschlagen');
    profile.full_name = name;
    profilname.textContent = name || '—';
    if (!profile.avatar_url) avatarSlot.replaceChildren(avatar(profile, email));
    onProfileUpdated?.(profile);
    toast('Profil gespeichert');
  };
  konto.appendChild(speichern);

  const passwort = abschnitt(wrap, 'Passwort ändern');
  passwort.innerHTML = `
    <div data-pw-msg></div>
    <label class="fld-l" for="pf-pw1">Neues Passwort</label>
    <input class="input" id="pf-pw1" type="password" autocomplete="new-password" minlength="6" placeholder="••••••••">
    <label class="fld-l" for="pf-pw2">Wiederholen</label>
    <input class="input" id="pf-pw2" type="password" autocomplete="new-password" minlength="6" placeholder="••••••••">
    <button class="btn btn-block" type="button" data-pw-save>Passwort speichern</button>`;
  passwort.querySelector('[data-pw-save]').onclick = async (event) => {
    const p1 = passwort.querySelector('#pf-pw1').value;
    const p2 = passwort.querySelector('#pf-pw2').value;
    const msg = passwort.querySelector('[data-pw-msg]');
    if (p1.length < 6) return void (msg.innerHTML = '<div class="msg err">Mindestens 6 Zeichen.</div>');
    if (p1 !== p2) return void (msg.innerHTML = '<div class="msg err">Die Passwörter stimmen nicht überein.</div>');
    const button = event.currentTarget;
    button.disabled = true;
    const { error } = await supabase.auth.updateUser({ password: p1 });
    if (button.isConnected) button.disabled = false;
    if (error) {
      msg.replaceChildren();
      const fehler = document.createElement('div');
      fehler.className = 'msg err';
      fehler.textContent = error.message;
      msg.appendChild(fehler);
      return;
    }
    passwort.querySelector('#pf-pw1').value = '';
    passwort.querySelector('#pf-pw2').value = '';
    msg.innerHTML = '<div class="msg ok">Passwort geändert.</div>';
  };

  const darstellung = abschnitt(wrap, 'Darstellung');
  const seg = document.createElement('div');
  seg.className = 'themeseg';
  [['retro', 'Retro'], ['dark', 'Dark']].forEach(([wert, label]) => {
    const button = document.createElement('button');
    button.className = `themebtn${getTheme() === wert ? ' on' : ''}`;
    button.textContent = label;
    button.onclick = () => {
      setTheme(wert);
      seg.querySelectorAll('.themebtn').forEach((item) => item.classList.toggle('on', item === button));
    };
    seg.appendChild(button);
  });
  darstellung.appendChild(seg);

  // Der harte Versatzschatten ist Geschmackssache und in jedem Theme einzeln
  // sinnvoll – deshalb ein eigener Schalter statt zusaetzlicher Themes.
  const schattenzeile = document.createElement('label');
  schattenzeile.className = 'switchline schattenschalter';
  const schattenbox = document.createElement('input');
  schattenbox.type = 'checkbox';
  schattenbox.checked = getSchatten();
  schattenbox.onchange = () => setSchatten(schattenbox.checked);
  const schattentext = document.createElement('span');
  schattentext.textContent = 'Schlagschatten';
  schattenzeile.append(schattenbox, schattentext);
  darstellung.appendChild(schattenzeile);

  const daten = abschnitt(wrap, 'Meine Daten');
  daten.innerHTML = `
    <p class="profile-hinweis">Exportiert die derzeit gespeicherten Kontodaten als JSON-Datei.</p>
    <button class="btn btn-block" type="button" data-export>Daten exportieren</button>
    <div class="profile-daten-status" aria-live="polite"></div>`;
  daten.querySelector('[data-export]').onclick = () => {
    const heute = new Date().toISOString().slice(0, 10);
    downloadJson(`nutrition-export-${heute}.json`, {
      exportiert_am: new Date().toISOString(),
      profil: {
        id: session.user.id,
        email,
        name: profile.full_name || '',
        rolle: profile.role,
        zeitzone: profile.zeitzone,
        darstellung: getTheme(),
        hautfalten_erinnerung: profile.falten_erinnerung,
        hautfalten_intervall_wochen: profile.falten_intervall_wochen,
        hautfalten_uhrzeit: profile.falten_uhrzeit,
      },
    });
    daten.querySelector('.profile-daten-status').textContent = 'Export heruntergeladen.';
  };

  const gefahr = abschnitt(wrap, 'Account löschen', false, 'gefahr');
  gefahr.innerHTML = `
    <p class="profile-hinweis">Entfernt den Account und alle zugehörigen Daten endgültig.</p>
    <button class="btn btn-block btn-danger" type="button" data-delete>Account und Daten löschen</button>
    <div class="profile-daten-status" aria-live="polite"></div>`;
  gefahr.querySelector('[data-delete]').onclick = async (event) => {
    const bestaetigung = prompt('Der Account und alle Daten werden endgültig gelöscht.\n\nTippe LÖSCHEN zum Bestätigen:');
    if (bestaetigung !== 'LÖSCHEN') return;
    const button = event.currentTarget;
    button.disabled = true;
    const status = gefahr.querySelector('.profile-daten-status');
    status.textContent = 'Account wird gelöscht…';
    const { error } = await supabase.rpc('delete_own_account', { nur_pruefen: false });
    if (error) {
      if (button.isConnected) button.disabled = false;
      status.textContent = 'Löschen fehlgeschlagen. Es wurden keine Daten entfernt.';
      return;
    }
    await supabase.auth.signOut({ scope: 'local' });
    location.hash = '';
    location.reload();
  };

  const logoutWrap = document.createElement('div');
  logoutWrap.className = 'profile-ausloggen';
  const logout = document.createElement('button');
  logout.className = 'btn btn-block';
  logout.textContent = 'Abmelden';
  logout.onclick = () => signOut().catch(() => toast('Abmelden fehlgeschlagen'));
  logoutWrap.appendChild(logout);
  wrap.appendChild(logoutWrap);

  const version = document.createElement('p');
  version.className = 'buildinfo';
  version.textContent = `Version ${__BUILD_COMMIT__} · ${__BUILD_TIME__}`;
  wrap.appendChild(version);
  container.appendChild(wrap);
}
