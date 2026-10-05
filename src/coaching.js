import { supabase } from './supabase.js';
import { escapeHtml } from './coachFenster.js';

// Tägliches Coaching in der App (COACHING-PLAN.md, Schritt 4). Der Chat ist
// seine Heimat: Das neueste Coaching steht als Karte über dem Gespräch, und
// Rückfragen schließen an (das Gespräch trägt die id des Coachings, siehe
// capboy-coach). Ungelesen zeigt das Coach-Symbol einen Briefumschlag; die
// angesprochenen Bereiche bekommen rosa Punkte an ihren Reitern, bis man die
// Seite besucht.

// Bereich des Coachings → Reiter im Menüband.
export const COACHING_ROUTEN = {
  training: 'training',
  ernaehrung: 'reminders',
  schlaf: 'sleep',
  koerper: 'body',
  erholung: 'body',
  routinen: 'habits',
};
const BEREICH_NAMEN = {
  training: 'Training', ernaehrung: 'Ernährung', schlaf: 'Schlaf', koerper: 'Körper', erholung: 'Erholung', routinen: 'Routinen',
};
// Punkte an den Reitern gelten nur für ein frisches Coaching.
const FRISCH_STUNDEN = 36;

const besuchtKey = (id) => `capboy:coaching-besucht:${id}`;
const besuchteRouten = (id) => {
  try { return new Set(JSON.parse(localStorage.getItem(besuchtKey(id)) || '[]')); } catch { return new Set(); }
};

/** Das neueste Coaching der Person (Tag), auch wenn es noch läuft oder fehlschlug. */
export async function neuestesCoaching(userId) {
  const { data, error } = await supabase.from('coach_coachings')
    .select('id,datum,status,ergebnis,bereiche,erstellt_am,gelesen_am')
    .eq('user_id', userId).eq('art', 'tag')
    .order('datum', { ascending: false }).limit(1).maybeSingle();
  // Ohne Tabelle (Migration fehlt) gibt es schlicht kein Coaching.
  if (error) {
    if (/coach_coachings|does not exist|schema cache/i.test(error.message || '')) return null;
    throw error;
  }
  return data || null;
}

export const istFrisch = (coaching) => Boolean(coaching?.erstellt_am)
  && Date.now() - Date.parse(coaching.erstellt_am) < FRISCH_STUNDEN * 3_600_000;

/** Hinweise für Kopf und Menüband: Briefumschlag und Reiter mit Punkt. */
export function coachingHinweise(coaching) {
  if (!coaching || coaching.status !== 'bereit' || !istFrisch(coaching)) return { ungelesen: false, routen: new Set() };
  const besucht = besuchteRouten(coaching.id);
  const routen = new Set((coaching.bereiche || []).map((bereich) => COACHING_ROUTEN[bereich]).filter((route) => route && !besucht.has(route)));
  return { ungelesen: !coaching.gelesen_am, routen };
}

/** Eine Seite besucht: Ihr Punkt aus dem Coaching verschwindet. */
export function routeBesucht(coaching, route) {
  if (!coaching?.id || !route) return false;
  const routen = new Set((coaching.bereiche || []).map((bereich) => COACHING_ROUTEN[bereich]));
  if (!routen.has(route)) return false;
  const besucht = besuchteRouten(coaching.id);
  if (besucht.has(route)) return false;
  besucht.add(route);
  try { localStorage.setItem(besuchtKey(coaching.id), JSON.stringify([...besucht])); } catch {}
  return true;
}

export async function alsGelesenMarkieren(coaching) {
  if (!coaching?.id || coaching.gelesen_am || coaching.status !== 'bereit') return;
  const jetzt = new Date().toISOString();
  const { error } = await supabase.from('coach_coachings').update({ gelesen_am: jetzt }).eq('id', coaching.id);
  if (error) {
    console.warn('Coaching nicht als gelesen markiert:', error.message);
    return;
  }
  coaching.gelesen_am = jetzt;
  window.dispatchEvent(new CustomEvent('capboy:coaching-gelesen', { detail: { id: coaching.id } }));
}

const datumText = (coaching) => {
  const datum = new Date(`${coaching.datum}T12:00:00`);
  const heute = new Date().toLocaleDateString('sv-SE');
  const tag = coaching.datum === heute ? 'Heute' : datum.toLocaleDateString('de-DE', { weekday: 'short', day: 'numeric', month: 'short' });
  return `${tag}, 21 Uhr`;
};

/* Ein Lauf braucht Sekunden bis wenige Minuten. Steht er nach 15 Minuten noch
   auf „läuft“, wurde die Funktion abgebrochen; dann gilt er als gescheitert. */
const HAENGT_NACH_MS = 15 * 60_000;
const haengt = (coaching) => coaching.status === 'laeuft' && Boolean(coaching.erstellt_am)
  && Date.now() - Date.parse(coaching.erstellt_am) > HAENGT_NACH_MS;

/** Karte über dem Gespräch: Überschrift, Punkte, Fokus. Laufend oder gescheitert ein klarer Status. */
export function coachingKarteMarkup(coaching) {
  if (!coaching) return '';
  if (coaching.status === 'laeuft' && !haengt(coaching)) {
    return `<section class="coaching-karte is-status" aria-live="polite">
      <header><span class="coaching-marke">Coaching</span><small>${escapeHtml(datumText(coaching))}</small></header>
      <p>Dein Coaching wird gerade erstellt …</p>
    </section>`;
  }
  if (coaching.status !== 'bereit') {
    return `<section class="coaching-karte is-status is-fehler">
      <header><span class="coaching-marke">Coaching</span><small>${escapeHtml(datumText(coaching))}</small></header>
      <p>Das Coaching konnte diesmal nicht erstellt werden. Deine Daten sind sicher; der nächste Versuch kommt mit dem nächsten Coaching. Fragen kannst du den Coach jederzeit hier im Chat.</p>
    </section>`;
  }
  const ergebnis = coaching.ergebnis || {};
  const punkte = (ergebnis.punkte || []).map((punkt) => `<li><span class="coaching-bereich">${escapeHtml(BEREICH_NAMEN[punkt.bereich] || punkt.bereich)}</span><p>${escapeHtml(punkt.text)}</p></li>`).join('');
  return `<section class="coaching-karte" aria-label="Coaching">
    <header><span class="coaching-marke">Coaching</span><small>${escapeHtml(datumText(coaching))}</small></header>
    <h2>${escapeHtml(ergebnis.ueberschrift || '')}</h2>
    ${punkte ? `<ul class="coaching-punkte">${punkte}</ul>` : ''}
    ${ergebnis.fokus ? `<div class="coaching-fokus"><b>Fokus</b><p>${escapeHtml(ergebnis.fokus.text)}</p></div>` : ''}
    <footer>Datenlage: ${escapeHtml(ergebnis.datenlage || 'niedrig')} · Frag einfach unten nach.</footer>
  </section>`;
}
