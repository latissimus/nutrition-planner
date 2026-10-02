import { supabase } from './supabase.js';
import { blsSuche } from './blsFoods.js';

// Aufrufe der Edge Function ki-werkzeuge: Sprachnachrichten verschriftlichen
// und Rezeptzutaten aus einer Beschreibung anlegen.

async function aufrufen(body) {
  const { data, error } = await supabase.functions.invoke('ki-werkzeuge', { body });
  if (error) {
    let message = error.message;
    try {
      const payload = await error.context?.clone?.().json();
      if (payload?.error) message = payload.error;
      // Noch nicht bereitgestellt: verständlich sagen statt „non-2xx status“.
      else if (payload?.code === 'NOT_FOUND') message = 'Die KI-Funktion ist noch nicht eingerichtet.';
    } catch {}
    // Keine Antwort (offline oder Funktion noch nicht bereitgestellt): Die
    // Bibliothek meldet das englisch, die App sagt es auf Deutsch.
    if (error.name === 'FunctionsFetchError' || /failed to send/i.test(String(message))) message = 'Die KI ist gerade nicht erreichbar.';
    throw new Error(message);
  }
  if (data?.error) throw new Error(data.error);
  return data;
}

export async function spracheVerschriftlichen(datei) {
  const form = new FormData();
  form.append('aktion', 'transkribieren');
  form.append('audio', datei, datei.name || 'aufnahme.m4a');
  const { text } = await aufrufen(form);
  return String(text || '').trim();
}

/* Rezept aus einer Beschreibung: Die KI zerlegt sie in Zutaten, die App sucht
   jede mit derselben Lebensmittelsuche wie „Zutat suchen“, und die KI wählt
   danach aus diesen Treffern. So landet nur, was es in der Datenbank wirklich
   gibt, mit deren Nährwerten im Rezept. Ergebnis je Zutat: { name, produkt,
   gramm, portion } – produkt ist null, wenn nichts passte. */
export async function zutatenAusBeschreibung(beschreibung) {
  const { zutaten = [] } = await aufrufen({ aktion: 'zutaten-verstehen', beschreibung });
  if (!zutaten.length) return [];
  const mitKandidaten = await Promise.all(zutaten.map(async (zutat) => {
    const gefunden = new Map();
    for (const begriff of [...(zutat.suchbegriffe || []), zutat.name]) {
      for (const produkt of await blsSuche(begriff, 8)) {
        if (!gefunden.has(produkt.name)) gefunden.set(produkt.name, produkt);
      }
      if (gefunden.size >= 14) break;
    }
    return { ...zutat, kandidaten: [...gefunden.values()].slice(0, 14) };
  }));
  const { zuordnungen = [] } = await aufrufen({
    aktion: 'zutaten-zuordnen',
    zutaten: mitKandidaten.map((zutat) => ({
      name: zutat.name,
      gramm: zutat.gramm,
      anzahl: zutat.anzahl,
      einheit: zutat.einheit,
      kandidaten: zutat.kandidaten.map((produkt, index) => ({
        id: String(index),
        name: produkt.name,
        kcal_100g: produkt.kcal_100g,
        portionen: (produkt.portions || []).map(([label, gramm]) => `${label} = ${gramm} g`),
      })),
    })),
  });
  return mitKandidaten.map((zutat, index) => {
    const zuordnung = zuordnungen.find((eintrag) => eintrag.index === index);
    const produkt = zuordnung?.kandidat != null ? zutat.kandidaten[Number(zuordnung.kandidat)] || null : null;
    // Portion nur übernehmen, wenn es sie am gewählten Eintrag wirklich gibt.
    const gesucht = String(zuordnung?.portion || '').split(' = ')[0].trim();
    const treffer = produkt && gesucht ? (produkt.portions || []).find(([label]) => label === gesucht) : null;
    const anzahl = Number(zuordnung?.anzahl) > 0 ? Number(zuordnung.anzahl) : 1;
    return {
      name: zutat.name,
      produkt,
      gramm: treffer ? Math.round(treffer[1] * anzahl) : Math.round(Number(zuordnung?.gramm ?? zutat.gramm) || 0),
      portion: treffer ? { grams: treffer[1], label: treffer[0], count: anzahl } : null,
    };
  });
}
