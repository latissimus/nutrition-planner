import { KATALOG, KONTEN } from './katalog.js';

const klein = (wert) => String(wert || '').trim().toLocaleLowerCase('de');
const eindeutige = (werte) => [...new Set(werte)];

function neueId() {
  if (globalThis.crypto?.randomUUID) return globalThis.crypto.randomUUID();
  return `eu-${Date.now()}-${Math.random().toString(36).slice(2, 9)}`;
}

export function normalisiereEigeneUebungen(liste) {
  if (!Array.isArray(liste)) return [];
  return liste.map((eintrag) => {
    const haupt = KONTEN.includes(eintrag?.haupt) ? eintrag.haupt : '';
    const typ = eintrag?.typ === 'Comp' ? 'Comp' : (eintrag?.typ === 'Iso' ? 'Iso' : '');
    const neben = eindeutige((Array.isArray(eintrag?.neben) ? eintrag.neben : [])
      .filter((konto) => KONTEN.includes(konto) && konto !== haupt));
    return {
      id: String(eintrag?.id || neueId()),
      n: String(eintrag?.n || '').trim().slice(0, 80),
      haupt,
      neben,
      typ,
      art: eintrag?.art === 'variante' ? 'variante' : 'eigen',
      basis: String(eintrag?.basis || '').trim(),
      aktiv: eintrag?.aktiv !== false,
      geloescht: eintrag?.geloescht === true,
      updatedAt: Number(eintrag?.updatedAt) || 0,
      eigen: true,
    };
  }).filter((eintrag) => eintrag.n && eintrag.haupt && eintrag.typ);
}

// Ausgeblendete und gelöschte Einträge bleiben intern als Zuordnung erhalten.
// Dadurch zählen alte Logs weiterhin korrekt und eine Löschung wird beim
// Offline-Merge nicht von einem älteren Serverstand rückgängig gemacht.
export function katalogMitEigenen(liste, { nurAktive = true, mitGeloeschten = false } = {}) {
  const eigene = normalisiereEigeneUebungen(liste)
    .filter((eintrag) => (mitGeloeschten || !eintrag.geloescht) && (!nurAktive || eintrag.aktiv))
    .map((eintrag) => ({ ...eintrag }));
  return [...KATALOG, ...eigene];
}

export function pruefeEigenenNamen(name, liste, ausnahmeId = '') {
  const sauber = String(name || '').trim();
  if (sauber.length < 2) return 'Bitte einen Namen mit mindestens 2 Zeichen eingeben.';
  if (sauber.length > 80) return 'Der Name darf höchstens 80 Zeichen lang sein.';
  const vergeben = katalogMitEigenen(liste, { nurAktive: false })
    .some((eintrag) => eintrag.id !== ausnahmeId && klein(eintrag.n) === klein(sauber));
  return vergeben ? 'Dieser Übungsname ist bereits vorhanden.' : '';
}

export function erstelleVariante(liste, basis, name, jetzt = Date.now()) {
  const fehler = pruefeEigenenNamen(name, liste);
  if (fehler) return { fehler };
  if (!basis?.n || !KONTEN.includes(basis.haupt) || !['Comp', 'Iso'].includes(basis.typ)) {
    return { fehler: 'Die Ausgangsübung konnte nicht übernommen werden.' };
  }
  const eintrag = {
    id: neueId(),
    n: String(name).trim(),
    haupt: basis.haupt,
    neben: eindeutige((basis.neben || []).filter((konto) => KONTEN.includes(konto) && konto !== basis.haupt)),
    typ: basis.typ,
    art: 'variante',
    basis: basis.n,
    aktiv: true,
    updatedAt: jetzt,
    eigen: true,
  };
  return { eintrag, liste: [...normalisiereEigeneUebungen(liste), eintrag] };
}

export function erstelleEigeneUebung(liste, daten, jetzt = Date.now()) {
  const fehler = pruefeEigenenNamen(daten?.n, liste);
  if (fehler) return { fehler };
  if (!KONTEN.includes(daten?.haupt)) return { fehler: 'Bitte eine Muskelgruppe auswählen.' };
  if (!['Comp', 'Iso'].includes(daten?.typ)) return { fehler: 'Bitte Comp oder Iso auswählen.' };
  const eintrag = {
    id: neueId(),
    n: String(daten.n).trim(),
    haupt: daten.haupt,
    neben: eindeutige((daten.neben || [])
      .filter((konto) => KONTEN.includes(konto) && konto !== daten.haupt)),
    typ: daten.typ,
    art: 'eigen',
    basis: '',
    aktiv: true,
    updatedAt: jetzt,
    eigen: true,
  };
  return { eintrag, liste: [...normalisiereEigeneUebungen(liste), eintrag] };
}

export function setzeEigeneUebungAktiv(liste, id, aktiv, jetzt = Date.now()) {
  return normalisiereEigeneUebungen(liste).map((eintrag) =>
    eintrag.id === id ? { ...eintrag, aktiv: !!aktiv, updatedAt: jetzt } : eintrag);
}

export function loescheEigeneUebung(liste, id, jetzt = Date.now()) {
  return normalisiereEigeneUebungen(liste).map((eintrag) =>
    eintrag.id === id
      ? { ...eintrag, aktiv: false, geloescht: true, updatedAt: jetzt }
      : eintrag);
}

export function aktualisiereEigeneZuordnung(liste, id, daten, jetzt = Date.now()) {
  const alle = normalisiereEigeneUebungen(liste);
  const alt = alle.find((eintrag) => eintrag.id === id);
  if (!alt) return { fehler: 'Die persönliche Übung wurde nicht gefunden.' };
  if (alt.art === 'variante') return { fehler: 'Varianten übernehmen die Zuordnung ihrer Ausgangsübung.' };
  if (!KONTEN.includes(daten?.haupt)) return { fehler: 'Bitte eine Muskelgruppe auswählen.' };
  if (!['Comp', 'Iso'].includes(daten?.typ)) return { fehler: 'Bitte Comp oder Iso auswählen.' };
  const neu = {
    ...alt,
    haupt: daten.haupt,
    typ: daten.typ,
    neben: eindeutige((daten.neben || [])
      .filter((konto) => KONTEN.includes(konto) && konto !== daten.haupt)),
    updatedAt: jetzt,
  };
  return {
    eintrag: neu,
    liste: alle.map((eintrag) => eintrag.id === id ? neu : eintrag),
  };
}

function ersetzeNamenInPayload(payload, vorher, nachher) {
  const ersetzeListe = (liste) => {
    if (!Array.isArray(liste)) return;
    liste.forEach((wert, index) => { if (wert === vorher) liste[index] = nachher; });
  };
  Object.values(payload.ex || {}).forEach((tag) =>
    Object.values(tag || {}).forEach(ersetzeListe));
  Object.values(payload.data || {}).forEach((tag) =>
    Object.values(tag || {}).forEach((cycle) =>
      Object.values(cycle || {}).forEach((block) => ersetzeListe(block?.names))));

  const neuesMem = {};
  Object.entries(payload.mem || {}).forEach(([key, wert]) => {
    const trenner = key.indexOf('|');
    const kind = trenner >= 0 ? key.slice(0, trenner) : '';
    const istTreffer = wert?.n === vorher || (trenner >= 0 && klein(key.slice(trenner + 1)) === klein(vorher));
    const zielKey = istTreffer && kind ? `${kind}|${klein(nachher)}` : key;
    neuesMem[zielKey] = istTreffer ? { ...wert, n: nachher } : wert;
  });
  payload.mem = neuesMem;
}

export function benenneEigeneUebungUm(payload, id, name, jetzt = Date.now()) {
  const liste = normalisiereEigeneUebungen(payload?.eigeneUebungen);
  const alt = liste.find((eintrag) => eintrag.id === id);
  if (!alt) return { fehler: 'Die persönliche Übung wurde nicht gefunden.' };
  const fehler = pruefeEigenenNamen(name, liste, id);
  if (fehler) return { fehler };
  const neuName = String(name).trim();
  ersetzeNamenInPayload(payload, alt.n, neuName);
  payload.eigeneUebungen = liste.map((eintrag) => eintrag.id === id
    ? { ...eintrag, n: neuName, updatedAt: jetzt }
    : eintrag);
  return { payload, eintrag: payload.eigeneUebungen.find((eintrag) => eintrag.id === id) };
}

// Beim Offline-Merge entscheidet nicht die ganze Liste auf einmal. Sonst
// könnte eine auf Gerät A angelegte Variante beim späteren Sync von Gerät B
// verschwinden. Pro stabiler ID gewinnt die zuletzt bearbeitete Fassung.
export function mergeEigeneUebungen(serverListe, lokaleListe) {
  const server = normalisiereEigeneUebungen(serverListe);
  const lokal = normalisiereEigeneUebungen(lokaleListe);
  const zusammen = new Map(server.map((eintrag) => [eintrag.id, eintrag]));
  lokal.forEach((eintrag) => {
    const alt = zusammen.get(eintrag.id);
    if (!alt || eintrag.updatedAt >= alt.updatedAt) zusammen.set(eintrag.id, eintrag);
  });
  const nachName = new Map();
  zusammen.forEach((eintrag) => {
    const key = klein(eintrag.n);
    const alt = nachName.get(key);
    if (!alt || eintrag.updatedAt >= alt.updatedAt) nachName.set(key, eintrag);
  });
  return [...nachName.values()];
}
