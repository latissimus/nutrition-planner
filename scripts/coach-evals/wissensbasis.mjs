// Nachweis der Wissensbasis: Enthält ein Vector Store genau das
// Seminarwissen, das der Code beschreibt (supabase/functions/capboy-coach/
// knowledge.ts)?
//
// KNOWLEDGE_VERSION ist der SHA-256 über alle Dokumente, verbunden mit
// TRENNER (scripts/generate-coach-knowledge.py). Der Nachweis liest den
// Inhalt jeder Datei aus dem Store zurück, vergleicht ihn Datei für Datei und
// bildet daraus denselben Hash. Dateinamen und Metadaten allein gelten nicht
// als Nachweis. Genutzt von sync-wissensbasis.mjs (anlegen und nachweisen)
// und run.mjs (Abbruch vor bezahlten Läufen, wenn Store und Code auseinander
// liegen).

import { createHash } from 'node:crypto';
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_VERSION } from '../../supabase/functions/capboy-coach/knowledge.ts';

export const TRENNER = '\n\n---\n\n';
export const sha256 = (text) => createHash('sha256').update(text, 'utf8').digest('hex');
// Dateinamen wie in ensureKnowledgeBase() der Edge Function. Die Edge Function
// verwendet hochgeladene Dateien mit gleichem Namen wieder; so nutzt sie nach
// dem Deploy dieselben Dateien, die hier nachgewiesen wurden.
export const dateiPraefix = (version = KNOWLEDGE_VERSION) => `${version.slice(0, 12)}-`;
const ohneLeerraum = (text) => String(text).replace(/\s+/g, ' ').trim();

// Was im Store stehen muss, in der Reihenfolge des Generators.
export function erwarteteWissensbasis(dokumente = KNOWLEDGE_DOCUMENTS, version = KNOWLEDGE_VERSION) {
  return {
    version,
    dateien: dokumente.map((dokument) => ({
      dateiname: `${dateiPraefix(version)}${dokument.filename}`,
      bytes: Buffer.byteLength(dokument.content, 'utf8'),
      inhalt: dokument.content,
    })),
  };
}

// Vergleicht den gelesenen Store mit der Erwartung. "gelesen" hat die Form,
// die leseWissensbasis() liefert:
//   { store: { id, status }, dateien: [{ id, dateiname, bytes, status, inhalt, methode }] }
// methode "roh": Originalbytes über /files/{id}/content; "geparst": Text, den
// der Vector Store selbst aus der Datei gelesen hat. Geparster Text darf sich
// nur im Leerraum unterscheiden, und nur, wenn die Bytezahl der Datei stimmt.
export function vergleicheWissensbasis(erwartet, gelesen) {
  const gruende = [];
  const store = gelesen?.store || {};
  const dateien = gelesen?.dateien || [];
  if (store.status !== 'completed') gruende.push(`Vector Store ${store.id || '?'} ist nicht bereit (Status ${store.status || 'unbekannt'})`);
  // Was der Store selbst über seine Dateien meldet, muss zur gelesenen Liste passen.
  const zaehler = store.fileCounts;
  if (zaehler && (zaehler.total !== dateien.length || zaehler.completed !== dateien.length)) {
    gruende.push(`Der Store meldet ${zaehler.total ?? '?'} Dateien (${zaehler.completed ?? '?'} fertig, ${zaehler.failed ?? 0} fehlgeschlagen), die Dateiliste enthält ${dateien.length}`);
  }

  const erwarteteNamen = new Set(erwartet.dateien.map((datei) => datei.dateiname));
  const gezaehlt = new Map();
  for (const datei of dateien) gezaehlt.set(datei.dateiname, (gezaehlt.get(datei.dateiname) || 0) + 1);
  const doppelt = [...gezaehlt].filter(([, anzahl]) => anzahl > 1).map(([name]) => name);
  if (doppelt.length) gruende.push(`doppelt im Store: ${doppelt.join(', ')}`);
  const fremd = dateien.filter((datei) => !erwarteteNamen.has(datei.dateiname)).map((datei) => datei.dateiname || datei.id);
  if (fremd.length) gruende.push(`${fremd.length} Datei(en) im Store, die nicht zum Code-Wissensstand gehören: ${fremd.slice(0, 3).join(', ')}${fremd.length > 3 ? ' …' : ''}`);

  const fehlend = erwartet.dateien.filter((soll) => !dateien.some((datei) => datei.dateiname === soll.dateiname)).map((soll) => soll.dateiname);
  if (fehlend.length) gruende.push(`${fehlend.length} von ${erwartet.dateien.length} Datei(en) des Code-Wissensstands fehlen im Store: ${fehlend.slice(0, 3).join(', ')}${fehlend.length > 3 ? ' …' : ''}`);

  let exakt = 0;
  let leerraum = 0;
  const inhalte = [];
  for (const soll of erwartet.dateien) {
    const ist = dateien.find((datei) => datei.dateiname === soll.dateiname);
    if (!ist) {
      inhalte.push(null);
      continue;
    }
    if (ist.status !== 'completed') gruende.push(`${soll.dateiname}: im Store nicht fertig verarbeitet (Status ${ist.status || 'unbekannt'})`);
    if (ist.bytes !== soll.bytes) gruende.push(`${soll.dateiname}: ${ist.bytes ?? '?'} Bytes statt ${soll.bytes}`);
    inhalte.push(ist.inhalt ?? null);
    if (ist.inhalt == null) gruende.push(`${soll.dateiname}: Inhalt aus dem Store nicht lesbar`);
    else if (ist.inhalt === soll.inhalt) exakt += 1;
    else if (ist.methode === 'geparst' && ist.bytes === soll.bytes && ohneLeerraum(ist.inhalt) === ohneLeerraum(soll.inhalt)) leerraum += 1;
    else gruende.push(`${soll.dateiname}: Inhalt weicht vom Code ab`);
  }

  // Derselbe Hash wie im Generator, aber über den Inhalt aus dem Store.
  const lesbar = inhalte.every((inhalt) => inhalt != null);
  const storeHash = lesbar ? sha256(inhalte.join(TRENNER)) : null;
  const storeHashOhneLeerraum = lesbar ? sha256(ohneLeerraum(inhalte.join(TRENNER))) : null;
  const codeHashOhneLeerraum = sha256(ohneLeerraum(erwartet.dateien.map((datei) => datei.inhalt).join(TRENNER)));
  if (lesbar && !gruende.length) {
    if (exakt === erwartet.dateien.length && storeHash !== erwartet.version) gruende.push(`Hash über den Store-Inhalt ${storeHash.slice(0, 16)} ≠ Code ${erwartet.version.slice(0, 16)}`);
    if (leerraum && storeHashOhneLeerraum !== codeHashOhneLeerraum) gruende.push('Hash über den Store-Inhalt (ohne Leerraum) weicht vom Code ab');
  }

  const nachgewiesen = !gruende.length;
  return {
    nachgewiesen,
    gruende,
    vectorStoreId: store.id || null,
    codeStand: erwartet.version.slice(0, 16),
    // Nur ein nachgewiesener Store bekommt einen Wissensstand.
    stand: nachgewiesen ? erwartet.version.slice(0, 16) : null,
    methode: !nachgewiesen ? null : (leerraum ? 'Inhalt aus dem Store, gleich bis auf Leerraum; Bytezahl exakt' : 'Inhalt aus dem Store, bytegenau'),
    storeHash: storeHash ? storeHash.slice(0, 16) : null,
    storeHashOhneLeerraum: storeHashOhneLeerraum ? storeHashOhneLeerraum.slice(0, 16) : null,
    codeHashOhneLeerraum: codeHashOhneLeerraum.slice(0, 16),
    dateien: { erwartet: erwartet.dateien.length, imStore: dateien.length, bytegenau: exakt, gleichBisAufLeerraum: leerraum },
  };
}

// Eine Zeile für Bericht und Terminal.
export function nachweisZeile(ergebnis) {
  if (!ergebnis?.nachgewiesen) return `nicht nachgewiesen (${(ergebnis?.gruende || []).join('; ') || 'kein Ergebnis'})`;
  const hash = ergebnis.dateien.gleichBisAufLeerraum
    ? `Hash ohne Leerraum: Store ${ergebnis.storeHashOhneLeerraum} = Code ${ergebnis.codeHashOhneLeerraum}`
    : `Hash über den Store-Inhalt ${ergebnis.storeHash} = Code-Wissensstand ${ergebnis.codeStand}`;
  return `${ergebnis.vectorStoreId}, ${ergebnis.dateien.imStore}/${ergebnis.dateien.erwartet} Dateien, ${hash} (${ergebnis.methode})`;
}

// --------------------------------------------------------------------------
// OpenAI
// --------------------------------------------------------------------------

// Fehler im selben Format wie run.mjs ("OpenAI <Status>: <Meldung>"), damit
// dessen Abbrucherkennung (Schlüssel, Budget) auch hier greift.
// Die Vector-Store-Endpunkte verlangen laut API-Referenz den Beta-Header;
// ohne ihn kam die Dateiliste eines fertigen Stores leer zurück (27.09.2026).
export async function openAi(pfad, { apiKey, fetchImpl = fetch, method = 'GET', json, form, roh = false } = {}) {
  const response = await fetchImpl(`https://api.openai.com/v1${pfad}`, {
    method,
    headers: {
      Authorization: `Bearer ${apiKey}`,
      ...(pfad.startsWith('/vector_stores') ? { 'OpenAI-Beta': 'assistants=v2' } : {}),
      ...(json ? { 'Content-Type': 'application/json' } : {}),
    },
    body: json ? JSON.stringify(json) : form,
    signal: AbortSignal.timeout(120_000),
  });
  if (!response.ok) {
    const payload = await response.json().catch(() => null);
    throw new Error(`OpenAI ${response.status}: ${payload?.error?.message || 'Anfrage fehlgeschlagen'}`);
  }
  return roh ? Buffer.from(await response.arrayBuffer()).toString('utf8') : response.json();
}

// Alle Seiten einer Liste mit after-Cursor.
export async function alleSeiten(pfad, optionen) {
  const eintraege = [];
  let after = null;
  for (let seite = 0; seite < 100; seite += 1) {
    const trenn = pfad.includes('?') ? '&' : '?';
    const antwort = await openAi(`${pfad}${after ? `${trenn}after=${encodeURIComponent(after)}` : ''}`, optionen);
    eintraege.push(...(antwort.data || []));
    if (!antwort.has_more || !antwort.data?.length) return eintraege;
    after = antwort.last_id || antwort.data.at(-1).id;
  }
  throw new Error('Liste zu lang');
}

// Inhalt einer Datei im Store: zuerst die Originalbytes, sonst der Text, den
// der Vector Store aus der Datei gelesen hat. null, wenn beides scheitert.
async function leseInhalt(vectorStoreId, dateiId, optionen) {
  try {
    return { inhalt: await openAi(`/files/${dateiId}/content`, { ...optionen, roh: true }), methode: 'roh' };
  } catch (fehler) {
    if (/^OpenAI (401|429):/.test(fehler.message)) throw fehler;
  }
  try {
    const teile = [];
    let seite = null;
    for (let schritt = 0; schritt < 50; schritt += 1) {
      const antwort = await openAi(`/vector_stores/${vectorStoreId}/files/${dateiId}/content${seite ? `?page=${encodeURIComponent(seite)}` : ''}`, optionen);
      teile.push(...(antwort.data || antwort.content || []).map((teil) => teil.text ?? ''));
      if (!antwort.has_more || !antwort.next_page || antwort.next_page === seite) {
        return antwort.has_more ? { inhalt: null, methode: 'geparst' } : { inhalt: teile.join(''), methode: 'geparst' };
      }
      seite = antwort.next_page;
    }
  } catch (fehler) {
    if (/^OpenAI (401|429):/.test(fehler.message)) throw fehler;
  }
  return { inhalt: null, methode: null };
}

// Liest Status, Dateiliste, Dateinamen, Bytezahlen und Inhalte eines Stores.
// Meldet der Store mehr Dateien, als die Liste enthält, wird die Liste
// einige Male neu gelesen (sie kann kurz nach dem Anlegen nachhinken).
export async function leseWissensbasis(vectorStoreId, { warten = (ms) => new Promise((fertig) => setTimeout(fertig, ms)), ...optionen } = {}) {
  const store = await openAi(`/vector_stores/${vectorStoreId}`, optionen);
  let eintraege = await alleSeiten(`/vector_stores/${vectorStoreId}/files?limit=100`, optionen);
  for (let versuch = 0; versuch < 5 && eintraege.length < (store.file_counts?.total ?? 0); versuch += 1) {
    await warten(3000);
    eintraege = await alleSeiten(`/vector_stores/${vectorStoreId}/files?limit=100`, optionen);
  }
  const dateien = [];
  for (const eintrag of eintraege) {
    const datei = await openAi(`/files/${eintrag.id}`, optionen);
    dateien.push({
      id: eintrag.id, dateiname: datei.filename, bytes: datei.bytes, status: eintrag.status,
      ...(await leseInhalt(vectorStoreId, eintrag.id, optionen)),
    });
  }
  return {
    store: { id: store.id, status: store.status, name: store.name, metadata: store.metadata || {}, fileCounts: store.file_counts || null },
    dateien,
  };
}

export async function pruefeWissensbasis(vectorStoreId, optionen) {
  return vergleicheWissensbasis(erwarteteWissensbasis(), await leseWissensbasis(vectorStoreId, optionen));
}
