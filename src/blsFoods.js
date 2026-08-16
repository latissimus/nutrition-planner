// Bundeslebensmittelschlüssel (BLS 4.0) als lokale Grundnahrungsmittel-Quelle.
// Die Daten liegen als statisches JSON (public/bls-foods.json), werden einmal
// geladen und im Speicher gehalten. Suche + Ranking laufen client-seitig.

let ladePromise = null;
let daten = null;

async function ladeBls() {
  if (daten) return daten;
  if (!ladePromise) {
    ladePromise = fetch(`${import.meta.env.BASE_URL}bls-foods.json`)
      .then((res) => (res.ok ? res.json() : []))
      .then((liste) => { daten = Array.isArray(liste) ? liste : []; return daten; })
      .catch(() => { daten = []; return daten; });
  }
  return ladePromise;
}

// Optionales Vorladen (z. B. beim Öffnen des Suchdialogs), damit die erste
// Suche nicht auf den Download wartet.
export function preloadBls() { ladeBls(); }

function normalisiere(text) {
  return String(text || '').toLocaleLowerCase('de').trim();
}

// Ranking, das deutsche Komposita berücksichtigt: „Apfel roh" vor „Apfelmus",
// „Magerquark"/„Vollmilch" vor Gerichten wie „Roggenbrot mit Quark".
const GERICHT = /\bmit\b|auflauf|eintopf|suppe|salat|pudding|dressing|sauce|so(ß|ss)e|gef(ü|ue)llt|\bpaste\b/;
function bewerte(nameLow, worte, query) {
  if (nameLow === query) return 1000;
  const qWorte = query.split(/\s+/).filter(Boolean);
  let score;
  if (qWorte.length > 1) {
    const alle = qWorte.every((qw) => worte.some((w) => w.startsWith(qw)));
    if (!alle) return nameLow.includes(query) ? 100 : 0;
    score = nameLow.startsWith(query) ? 700 : 450;
  } else if (worte[0] === query) score = 700;         // Basisname („Apfel roh")
  else if (worte.includes(query)) score = 500;         // eigenständiges Wort
  else if (worte.some((w) => w.endsWith(query))) score = 450;   // Kompositum-Suffix
  else if (worte.some((w) => w.startsWith(query))) score = 400; // Kompositum-Präfix
  else if (nameLow.includes(query)) score = 100;       // Teilstring
  else return 0;
  if (GERICHT.test(nameLow)) score -= 300;             // zubereitete Gerichte abwerten
  return score;
}

function alsProdukt(eintrag) {
  const portions = Array.isArray(eintrag.po) ? eintrag.po : null;
  return {
    barcode: '',
    name: eintrag.n,
    brand: 'Grundnahrungsmittel',
    image_url: '',
    serving_g: portions?.[0]?.[1] || 100,
    kcal_100g: eintrag.k,
    protein_100g: eintrag.p,
    carbs_100g: eintrag.ch,
    fat_100g: eintrag.f,
    portions,
    source: 'bls',
  };
}

export async function blsSuche(begriff, limit = 12) {
  const query = normalisiere(begriff);
  if (query.length < 2) return [];
  const liste = await ladeBls();
  const treffer = [];
  for (const eintrag of liste) {
    const nameLow = normalisiere(eintrag.n);
    if (!nameLow.includes(query.split(/\s+/)[0])) continue; // schneller Vorfilter
    const worte = nameLow.split(/[\s,()/]+/).filter(Boolean);
    const score = bewerte(nameLow, worte, query);
    if (score > 0) treffer.push({ eintrag, score, len: nameLow.length });
  }
  treffer.sort((a, b) => b.score - a.score || a.len - b.len);
  return treffer.slice(0, limit).map((t) => alsProdukt(t.eintrag));
}
