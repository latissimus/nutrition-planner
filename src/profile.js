import { supabase } from './supabase.js';
import { signOut } from './auth.js';
import { getTheme, setTheme } from './theme.js';
import { toast } from './toast.js';
import {
  coinDexIsVisible, collectionIsVisible, collectionOrder, customCollectionIsVisible, moveCollection,
  moveCustomCollection, orderCustomCollections, setCoinDexVisible, setCollectionVisible,
  setCustomCollectionVisible,
} from './collectionPreferences.js';
import { loadCollections } from './collections.js';
import { materialIconMarkup } from './categoryIcons.js';
import { createFullDataExport, exportFileName } from './dataExport.js';
import {
  interfaceSoundsEnabled, playInterfaceSound, setInterfaceSoundsEnabled,
} from './uiSounds.js';

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

export function mountProfile(container, { session, profile, signal, onProfileUpdated }) {
  const email = session.user.email || '';
  container.innerHTML = '';
  container.classList.add('profil-fixkopf-view');
  const wrap = document.createElement('div');
  wrap.className = 'wrap pad-bottom profil-fixkopf';
  wrap.innerHTML = `
    <nav class="kategorie-kopf profil-kopf" aria-label="Mein Konto bedienen">
      <div class="kategorie-kopftitel"><strong>MEIN KONTO</strong></div>
      <a class="kategorie-kopfknopf kategorie-schliessen" href="#home" aria-label="Mein Konto schließen">${materialIconMarkup('close')}</a>
    </nav>
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
  const interfaceSoundLabel = document.createElement('label');
  interfaceSoundLabel.className = 'switchline interface-sound-setting';
  const interfaceSoundCheckbox = document.createElement('input');
  interfaceSoundCheckbox.type = 'checkbox';
  interfaceSoundCheckbox.checked = interfaceSoundsEnabled();
  const interfaceSoundText = document.createElement('span');
  interfaceSoundText.innerHTML = '<b>Interface-Sounds</b><small>Retro-Arcade-Klänge bei der Bedienung</small>';
  interfaceSoundCheckbox.onchange = () => {
    setInterfaceSoundsEnabled(interfaceSoundCheckbox.checked);
    if (interfaceSoundCheckbox.checked) playInterfaceSound('success');
    toast(`Interface-Sounds ${interfaceSoundCheckbox.checked ? 'eingeschaltet' : 'ausgeschaltet'}.`);
  };
  interfaceSoundLabel.append(interfaceSoundCheckbox, interfaceSoundText);
  darstellung.appendChild(interfaceSoundLabel);

  const startseite = abschnitt(wrap, 'Startseite anpassen');
  const startHinweis = document.createElement('p');
  startHinweis.className = 'profile-hinweis';
  startHinweis.textContent = 'Lege fest, welche Dex-Einträge auf der Startseite und in der Suche erscheinen.';
  startseite.appendChild(startHinweis);
  const sammlungsNamen = new Map([
    ['body', 'KFA-LOG'], ['reminders', 'MAHLZEITEN'], ['food-log', 'FOOD-LOG'],
    ['training', 'TRAINING'], ['shopping', 'EINKAUF'], ['habits', 'ROUTINEN'],
    ['sleep', 'SLEEP-DEX'],
  ]);
  const sammlungsListe = document.createElement('div');
  sammlungsListe.className = 'sammlungs-sortierung';
  const renderSammlungen = () => {
    const order = collectionOrder();
    const coinZeile = document.createElement('div');
    coinZeile.className = 'sammlung-sichtbarkeit';
    const coinLabel = document.createElement('label');
    coinLabel.className = 'switchline';
    const coinCheckbox = document.createElement('input');
    coinCheckbox.type = 'checkbox';
    coinCheckbox.checked = coinDexIsVisible();
    coinCheckbox.onchange = () => {
      setCoinDexVisible(coinCheckbox.checked);
      toast(`COIN-DEX ${coinCheckbox.checked ? 'eingeblendet' : 'ausgeblendet'}.`);
    };
    const coinText = document.createElement('span');
    coinText.textContent = 'COIN-DEX';
    coinLabel.append(coinCheckbox, coinText);
    coinZeile.append(coinLabel);
    sammlungsListe.replaceChildren(coinZeile, ...order.map((route, index) => {
      const title = sammlungsNamen.get(route);
      const zeile = document.createElement('div');
      zeile.className = 'sammlung-sichtbarkeit';
      const label = document.createElement('label');
      label.className = 'switchline';
      const checkbox = document.createElement('input');
      checkbox.type = 'checkbox';
      checkbox.checked = collectionIsVisible(route);
      checkbox.onchange = () => {
        setCollectionVisible(route, checkbox.checked);
        toast(`${title} ${checkbox.checked ? 'eingeblendet' : 'ausgeblendet'}.`);
      };
      const text = document.createElement('span');
      text.textContent = title;
      label.append(checkbox, text);
      const tasten = document.createElement('span');
      tasten.className = 'sortier-tasten';
      [['↑', -1, 'nach oben'], ['↓', 1, 'nach unten']].forEach(([zeichen, richtung, beschreibung]) => {
        const taste = document.createElement('button');
        taste.type = 'button';
        taste.textContent = zeichen;
        taste.disabled = richtung < 0 ? index === 0 : index === order.length - 1;
        taste.setAttribute('aria-label', `${title} ${beschreibung}`);
        taste.onclick = () => {
          if (moveCollection(route, richtung)) renderSammlungen();
        };
        tasten.appendChild(taste);
      });
      zeile.append(label, tasten);
      return zeile;
    }));
  };
  renderSammlungen();
  startseite.appendChild(sammlungsListe);

  const eigeneTitel = document.createElement('h3');
  eigeneTitel.className = 'profile-untertitel';
  eigeneTitel.textContent = 'Eigene Dex';
  startseite.appendChild(eigeneTitel);
  const eigeneListe = document.createElement('div');
  eigeneListe.className = 'sammlungs-sortierung';
  eigeneListe.innerHTML = '<p class="profile-hinweis">Eigene Dex werden geladen …</p>';
  startseite.appendChild(eigeneListe);
  loadCollections(session.user.id, { rootKey: 'home', signal }).then((items) => {
    if (signal?.aborted) return;
    const renderEigene = () => {
      const ordered = orderCustomCollections(items);
      if (!ordered.length) {
        eigeneListe.innerHTML = '<p class="profile-hinweis">Noch keine eigenen Dex angelegt.</p>';
        return;
      }
      eigeneListe.replaceChildren(...ordered.map((item, index) => {
        const zeile = document.createElement('div');
        zeile.className = 'sammlung-sichtbarkeit';
        const label = document.createElement('label');
        label.className = 'switchline';
        const checkbox = document.createElement('input');
        checkbox.type = 'checkbox';
        checkbox.checked = customCollectionIsVisible(item.id);
        checkbox.onchange = () => {
          setCustomCollectionVisible(item.id, checkbox.checked);
          toast(`${item.name} ${checkbox.checked ? 'eingeblendet' : 'ausgeblendet'}.`);
        };
        const text = document.createElement('span');
        text.textContent = item.name;
        label.append(checkbox, text);
        const tasten = document.createElement('span');
        tasten.className = 'sortier-tasten';
        [['↑', -1, 'nach oben'], ['↓', 1, 'nach unten']].forEach(([zeichen, richtung, beschreibung]) => {
          const taste = document.createElement('button');
          taste.type = 'button';
          taste.textContent = zeichen;
          taste.disabled = richtung < 0 ? index === 0 : index === ordered.length - 1;
          taste.setAttribute('aria-label', `${item.name} ${beschreibung}`);
          taste.onclick = () => { if (moveCustomCollection(items, item.id, richtung)) renderEigene(); };
          tasten.appendChild(taste);
        });
        zeile.append(label, tasten);
        return zeile;
      }));
    };
    renderEigene();
  }).catch(() => {
    if (!signal?.aborted) eigeneListe.innerHTML = '<p class="profile-hinweis">Eigene Dex konnten nicht geladen werden.</p>';
  });

  const daten = abschnitt(wrap, 'Meine Daten');
  daten.innerHTML = `
    <p class="profile-hinweis">Exportiert Profil, Messwerte, Erinnerungen, Routinen, Dex, Einträge, Einkaufsliste, Einstellungen, Freigaben und MUSCLE-COINS als JSON-Datei. Private Medien werden als Speicherpfade aufgeführt.</p>
    <button class="btn btn-block" type="button" data-export>Daten exportieren</button>
    <div class="profile-daten-status" aria-live="polite"></div>`;
  daten.querySelector('[data-export]').onclick = async (event) => {
    const button = event.currentTarget;
    const status = daten.querySelector('.profile-daten-status');
    button.disabled = true;
    status.textContent = 'Datenexport wird vorbereitet …';
    try {
      const exportData = await createFullDataExport({
        session, profile, theme: getTheme(), signal,
        onProgress: ({ current, total }) => {
          if (status.isConnected) status.textContent = `Daten werden gesammelt: ${current} von ${total}`;
        },
      });
      downloadJson(exportFileName(), exportData);
      status.textContent = 'Vollständiger Export heruntergeladen.';
    } catch (error) {
      status.textContent = `Export fehlgeschlagen: ${error.message || 'Daten konnten nicht geladen werden.'}`;
    } finally {
      if (button.isConnected) button.disabled = false;
    }
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

  const kopf = wrap.querySelector(':scope > .profil-kopf');
  const inhalt = document.createElement('div');
  inhalt.className = 'profil-scrollinhalt';
  while (kopf?.nextSibling) inhalt.appendChild(kopf.nextSibling);
  wrap.appendChild(inhalt);
  container.appendChild(wrap);
}
