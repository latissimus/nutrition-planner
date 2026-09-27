// Legt das Seminarwissen des aktuellen Codes (knowledge.ts) als Vector Store
// bei OpenAI an und weist seinen Inhalt nach (wissensbasis.mjs).
//
//   npm run coach:wissensbasis                   anlegen oder wiederverwenden, dann nachweisen
//   npm run coach:wissensbasis -- --pruefe vs_…  nur nachweisen, nichts anlegen
//   npm run coach:wissensbasis -- --neu          neuen Store anlegen, auch wenn es für
//                                                diesen Stand schon einen (nicht nachweisbaren) gibt
//
// Auf stdout steht nur die ID des nachgewiesenen Stores, damit sie sich direkt
// übernehmen lässt:
//   COACH_VECTOR_STORE_ID=$(npm run -s coach:wissensbasis) && export COACH_VECTOR_STORE_ID
// Fortschritt und Nachweis gehen auf stderr; der Nachweis zusätzlich nach
// scripts/coach-evals/wissensbasis/<Stand>.json.
//
// Gibt es für diesen Stand schon einen Store (Metadaten knowledge_version)
// und lässt sich sein Inhalt nachweisen, wird er wiederverwendet. Lässt er
// sich nicht nachweisen, bricht das Skript mit den Gründen ab, statt still
// einen weiteren Store anzulegen (dafür --neu). Hochgeladene Dateien mit
// passendem Namen werden wiederverwendet - wie in der Edge Function.
// Kosten: keine Tokens; der Speicher liegt im Freikontingent.
// Die Datenbank (ai_knowledge_bases) bleibt unberührt: Den dort
// eingetragenen Store nutzt die noch laufende Edge Function.
//
// Exit-Codes: 0 nachgewiesen, 1 nicht nachgewiesen oder Fehler.

import { mkdir, writeFile } from 'node:fs/promises';
import { KNOWLEDGE_DOCUMENTS, KNOWLEDGE_VERSION } from '../../supabase/functions/capboy-coach/knowledge.ts';
import {
  TRENNER, alleSeiten, dateiPraefix, erwarteteWissensbasis, leseWissensbasis, nachweisZeile, openAi, sha256, vergleicheWissensbasis,
} from './wissensbasis.mjs';

const argumente = process.argv.slice(2);
const nurPruefen = argumente.includes('--pruefe') ? argumente[argumente.indexOf('--pruefe') + 1] : null;
const erzwingeNeu = argumente.includes('--neu');
const apiKey = process.env.OPENAI_API_KEY || '';
const optionen = { apiKey };
const log = (...teile) => console.error(...teile);
const schwaerze = (text) => String(text).replace(/\bsk-[A-Za-z0-9_*\-]+/g, '[geschwärzt]');

if (!apiKey) {
  log('OPENAI_API_KEY fehlt.');
  process.exit(1);
}
if (argumente.includes('--pruefe') && !/^vs_\w+$/.test(nurPruefen || '')) {
  log('Nach --pruefe fehlt die ID des Vector Stores (vs_…).');
  process.exit(1);
}
// Der Code selbst muss stimmig sein, sonst wäre jeder Nachweis wertlos.
if (sha256(KNOWLEDGE_DOCUMENTS.map((dokument) => dokument.content).join(TRENNER)) !== KNOWLEDGE_VERSION) {
  log('knowledge.ts ist in sich nicht stimmig: KNOWLEDGE_VERSION passt nicht zu den Dokumenten. Erst scripts/generate-coach-knowledge.py ausführen.');
  process.exit(1);
}

const erwartet = erwarteteWissensbasis();
const stand = KNOWLEDGE_VERSION.slice(0, 16);

async function weiseNach(vectorStoreId) {
  const gelesen = await leseWissensbasis(vectorStoreId, optionen);
  return { gelesen, ergebnis: vergleicheWissensbasis(erwartet, gelesen) };
}

async function warteBisFertig(vectorStoreId) {
  for (let versuch = 0; versuch < 150; versuch += 1) {
    const store = await openAi(`/vector_stores/${vectorStoreId}`, optionen);
    if (store.status === 'completed') return store;
    if (['expired', 'failed', 'cancelled'].includes(store.status)) throw new Error(`Vector Store ${vectorStoreId}: Status ${store.status}`);
    if (versuch % 5 === 0) log(`  Indexierung läuft … (${store.file_counts?.completed ?? '?'}/${store.file_counts?.total ?? '?'} Dateien)`);
    await new Promise((fertig) => setTimeout(fertig, 2000));
  }
  throw new Error(`Vector Store ${vectorStoreId}: Indexierung nach 5 Minuten nicht fertig`);
}

async function legeAn() {
  // 1. Vorhandenen Store für diesen Stand wiederverwenden, wenn nachweisbar.
  const kandidaten = (await alleSeiten('/vector_stores?limit=100', optionen))
    .filter((store) => store.metadata?.knowledge_version === KNOWLEDGE_VERSION && store.status === 'completed');
  let letzter = null;
  for (const store of kandidaten) {
    log(`Vorhandener Store für Stand ${stand}: ${store.id} – prüfe Inhalt …`);
    const nachweis = await weiseNach(store.id);
    if (nachweis.ergebnis.nachgewiesen) return { ...nachweis, neu: false };
    log(`  nicht verwendbar: ${nachweis.ergebnis.gruende.join('; ')}`);
    letzter = nachweis;
  }
  // Vorhanden, aber nicht nachweisbar: erst den Grund klären.
  if (letzter && !erzwingeNeu) return { ...letzter, neu: false };

  // 2. Dateien hochladen, soweit nicht schon vorhanden (gleicher Name).
  const vorhanden = new Map((await alleSeiten('/files?purpose=assistants&limit=100', optionen)).map((datei) => [datei.filename, datei.id]));
  const dateiIds = [];
  let wiederverwendet = 0;
  for (const [index, dokument] of KNOWLEDGE_DOCUMENTS.entries()) {
    const dateiname = `${dateiPraefix()}${dokument.filename}`;
    if (vorhanden.has(dateiname)) {
      dateiIds.push(vorhanden.get(dateiname));
      wiederverwendet += 1;
      continue;
    }
    const form = new FormData();
    form.append('purpose', 'assistants');
    form.append('file', new Blob([dokument.content], { type: 'text/plain;charset=utf-8' }), dateiname);
    const hochgeladen = await openAi('/files', { ...optionen, method: 'POST', form });
    dateiIds.push(hochgeladen.id);
    log(`  hochgeladen ${index + 1}/${KNOWLEDGE_DOCUMENTS.length}: ${dokument.filename}`);
  }
  log(`${dateiIds.length} Dateien bereit, davon ${wiederverwendet} schon vorhanden.`);

  // 3. Store anlegen und warten, bis er fertig indexiert ist.
  const store = await openAi('/vector_stores', {
    ...optionen, method: 'POST', json: { name: 'CAPBOY Seminarwissen', file_ids: dateiIds, metadata: { knowledge_version: KNOWLEDGE_VERSION } },
  });
  log(`Vector Store angelegt: ${store.id} – warte auf Indexierung …`);
  await warteBisFertig(store.id);
  return { ...(await weiseNach(store.id)), neu: true };
}

try {
  log(`Code-Wissensstand ${stand}: ${erwartet.dateien.length} Dokumente, ${erwartet.dateien.reduce((summe, datei) => summe + datei.bytes, 0)} Bytes.`);
  const { gelesen, ergebnis, neu } = nurPruefen ? { ...(await weiseNach(nurPruefen)), neu: false } : await legeAn();
  const nachweis = {
    zeitpunkt: new Date().toISOString(),
    ...ergebnis,
    neuAngelegt: neu,
    store: gelesen.store,
    // Je Datei, was tatsächlich aus dem Store kam (nur Hashes, kein Inhalt).
    gelesen: gelesen.dateien.map((datei) => ({
      id: datei.id, dateiname: datei.dateiname, bytes: datei.bytes, status: datei.status, methode: datei.methode,
      inhaltSha256: datei.inhalt == null ? null : sha256(datei.inhalt).slice(0, 16),
    })),
  };
  const ordner = new URL('./wissensbasis/', import.meta.url);
  await mkdir(ordner, { recursive: true });
  await writeFile(new URL(`${stand}.json`, ordner), `${JSON.stringify(nachweis, null, 2)}\n`);

  if (!ergebnis.nachgewiesen) {
    log(`\nNICHT nachgewiesen (${ergebnis.vectorStoreId}):\n- ${ergebnis.gruende.join('\n- ')}`);
    log(`Nachweis: scripts/coach-evals/wissensbasis/${stand}.json`);
    process.exit(1);
  }
  log([
    '',
    `Nachgewiesen${neu ? ' (neu angelegt)' : ' (vorhanden)'}: ${nachweisZeile(ergebnis)}`,
    `- ${ergebnis.dateien.bytegenau} Dateien bytegenau, ${ergebnis.dateien.gleichBisAufLeerraum} gleich bis auf Leerraum`,
    `- Nachweis: scripts/coach-evals/wissensbasis/${stand}.json`,
  ].join('\n'));
  console.log(ergebnis.vectorStoreId);
} catch (fehler) {
  log(`Abgebrochen: ${schwaerze(fehler.message)}`);
  process.exit(1);
}
