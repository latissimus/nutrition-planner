import { supabase } from './supabase.js';
import { toast } from './toast.js';
import { curveSvg } from './curve.js';
import { FALTEN, datumKurz, heute, summe, zahl } from './measurements.js';
import { BODY_EXPLANATIONS, confirmedTrendChange, evaluateBodyComp, goalWeightInterpretation, weightTrendSummary } from './bodyComposition.js';
import { parseLogmanExport, performanceTrend } from './logmanImport.js';
import { materialIconMarkup } from './categoryIcons.js';
import { createSpecialDexOverlay, SPECIAL_DEX_CLASSES } from './specialDex.js';
import { notifyCoinBalanceChanged, notifyHomeCountsChanged, subscribeToTablesChanges } from './realtime.js';
import { getPreference, setPreference } from './userPreferences.js';
import hautfaltenData from './data/hautfalten.json';
import ypsiProtokolle from './data/ypsi-protokolle.json';
import { alterAmMessdatum, koerperfettAnteil, magermasse } from './ypsiFormel.js';
import {
  buildSkinfoldPlan,
  bravermanComplete,
  bravermanRecommendations,
  scoreBravermanAssessment,
  supplementName,
  supplementSafety,
  BRAVERMAN_BEREICHE,
  BRAVERMAN_DEFIZIT_FRAGEN,
  BRAVERMAN_REIHENFOLGE,
} from './ypsiAssessment.js';

const BRAVERMAN_PREFERENCE = 'comp:braverman-defizit-v1';

const FALTEN_HILFE = {
  kinn: 'Mittig unter dem Kinn eine senkrechte Falte greifen.', wange: 'Seitlich an der Wange immer dieselbe Position verwenden.',
  brust: 'Schräge Falte zwischen vorderer Achselfalte und Brustwarze.', ruecken: 'Schräge Falte direkt unterhalb des Schulterblatts.',
  rippe: 'Senkrechte Falte seitlich am Oberkörper auf gleicher Höhe.', huefte: 'Schräge Falte unmittelbar oberhalb des Beckenkamms.',
  bauch: 'Senkrechte Falte wenige Zentimeter neben dem Bauchnabel.', trizeps: 'Senkrechte Falte mittig an der Rückseite des Oberarms.',
  bizeps: 'Senkrechte Falte mittig an der Vorderseite des Oberarms.', wade: 'Senkrechte Falte an der Innenseite der Wade auf größtem Umfang.',
  quadrizeps: 'Senkrechte Falte mittig an der Vorderseite des Oberschenkels.', beinbizeps: 'Senkrechte Falte mittig an der Rückseite des Oberschenkels.',
  knie: 'Senkrechte Falte direkt auf der Mitte der Kniescheibe.',
};
const escapeHtml = (value = '') => String(value).replaceAll('&', '&amp;').replaceAll('<', '&lt;').replaceAll('>', '&gt;').replaceAll('"', '&quot;').replaceAll("'", '&#39;');
const display = (value, digits = 1) => Number(value || 0).toLocaleString('de-DE', { maximumFractionDigits: digits });
const day = (value) => Math.floor(new Date(`${value}T12:00:00`).getTime() / 86_400_000);
const vollstaendigeFalten = (falten = {}) => FALTEN.every(([key]) => zahl(falten?.[key]) != null);

async function queryState(userId, signal) {
  const abort = (query) => signal ? query.abortSignal(signal) : query;
  const results = await Promise.all([
    abort(supabase.from('skinfolds').select('*').eq('user_id', userId).order('gemessen_am', { ascending: false }).limit(60)),
    // Erst die neuesten 180 Datensaetze laden. Bei aufsteigender Sortierung vor
    // dem Limit gingen nach laengerer Nutzung ausgerechnet die aktuellen Werte
    // verloren. Fuer Berechnung und Kurve werden sie danach chronologisch
    // sortiert.
    abort(supabase.from('weights').select('*').eq('user_id', userId).order('gemessen_am', { ascending: false }).limit(180)),
    abort(supabase.from('waist_measurements').select('*').eq('user_id', userId).order('gemessen_am').limit(60)),
    abort(supabase.from('logman_performance').select('*').eq('user_id', userId).order('performed_on').limit(500)),
    abort(supabase.from('sleep_logs').select('sleep_date,quality,energy').eq('user_id', userId).order('sleep_date').limit(60)),
    abort(supabase.from('bodycomp_checkins').select('*').eq('user_id', userId).order('checkin_date').limit(60)),
    abort(supabase.from('nutrition_settings').select('goal,bodycomp_thresholds,calculation_basis,height_cm,birth_date').eq('user_id', userId).maybeSingle()),
  ]);
  const error = results.find((result) => result.error)?.error;
  if (error) throw error;
  const weights = (results[1].data || [])
    .map((row) => ({ ...row, date: row.gemessen_am, kg: Number(row.kg) }))
    .sort((a, b) => a.gemessen_am.localeCompare(b.gemessen_am));
  const settings = results[6].data || {};
  return {
    skinfolds: (results[0].data || [])
      .map((row) => ({
        ...row,
        total: summe(row.falten),
        gewichtKg: row.gewicht_kg == null ? null : Number(row.gewicht_kg),
        alter: alterAmMessdatum(settings.birth_date, row.gemessen_am),
      }))
      .sort((a, b) => a.gemessen_am.localeCompare(b.gemessen_am)),
    weights,
    waists: results[2].data || [], performance: results[3].data || [],
    sleep: results[4].data || [], checkins: results[5].data || [], settings,
  };
}

function recoveryTrend(sleep, checkins) {
  const values = [...sleep.map((row) => (Number(row.quality) + Number(row.energy)) / 2), ...checkins.map((row) => Number(row.recovery)).filter(Boolean)];
  if (values.length < 6) return null;
  const split = Math.floor(values.length / 2); const mean = (list) => list.reduce((sumValue, value) => sumValue + value, 0) / list.length;
  const difference = mean(values.slice(split)) - mean(values.slice(0, split));
  return difference > 0.3 ? 1 : difference < -0.3 ? -1 : 0;
}

function infoDetails(title, text) { return `<details class="body-info"><summary>${title}<span aria-hidden="true">?</span></summary><p>${text}</p></details>`; }

function bodyHeroMarkup(state) {
  const latest = state.weights.at(-1);
  const trend = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const recentDays = new Set(state.weights
    .filter((row) => day(heute()) - day(row.gemessen_am) < 7)
    .map((row) => row.gemessen_am)).size;
  const progress = Math.min(100, Math.round(recentDays / 7 * 100));
  const weekly = Number(trend.weeklyKg || 0);
  const weeklyLabel = latest
    ? `${weekly > 0 ? '+' : ''}${display(weekly, 2)} kg pro Woche`
    : 'Noch keine Messung';
  return `<div class="body-v2-stack ${SPECIAL_DEX_CLASSES.content} ${SPECIAL_DEX_CLASSES.stack}"><section class="body-v2-hero ${SPECIAL_DEX_CLASSES.hero}" style="--body-progress:${progress}%">
    <div class="body-v2-ring"><span><b>${latest ? display(trend.average7Kg) : '–'}</b><small>7-TAGE Ø</small></span></div>
    <div class="body-v2-hero-value"><small>AKTUELLES GEWICHT</small><div><strong>${latest ? display(latest.kg) : '–'}</strong>${latest ? '<b>kg</b>' : ''}</div><span>${latest ? weeklyLabel : 'Noch keine Messung'}</span></div>
    <button class="body-analysis-info" type="button" aria-expanded="false" aria-label="COMP-Auswertung erklären">i</button>
  </section>
  <div class="body-analysis-help" hidden>
    <p>In <b>COMP</b> hältst du Gewicht, Taillenumfang und deine <b>10-Falten-Summe</b> fest. Neue Messungen trägst du über den zentralen Hinzufügen-Button ein.</p>
    <p><b>COMP</b> bewertet nicht einzelne Tageswerte, sondern deinen geglätteten Gewichtsverlauf.</p>
    <p>Ergänzende Daten wie <b>Taillenumfang</b>, <b>10-Falten-Summe</b>, Training und Erholung helfen dabei, Veränderungen sinnvoll einzuordnen.</p>
    <p>Die Auswertung zeigt beobachtete Trends, keine exakte Körperfettmessung und <b>keine medizinische Diagnose</b>.</p>
  </div></div>`;
}

function weightEntryMarkup() {
  return `<form class="gew-eingabe body-entry-form" data-weight-form>
    <label class="falte gew-feld"><span>Datum</span><input class="input gew-datum-eingabe" type="date" value="${heute()}" data-weight-date></label>
    <label class="falte gew-feld"><span>Gewicht</span><span class="gew-wert-eingabe"><input class="input gew-in" type="text" inputmode="decimal" placeholder="84,2" data-weight-value><i>kg</i></span></label>
    <button class="btn btn-primary" type="submit">Gewicht speichern</button>
  </form>`;
}

function waistEntryMarkup() {
  return `<form class="body-inline-form body-entry-form" data-waist-form>
    <p class="body-guide">Miss den Taillenumfang stehend, nach entspannter Ausatmung und immer an derselben Stelle: am besten auf Höhe des Bauchnabels beziehungsweise dort, wo du die Messposition dauerhaft reproduzierbar findest.</p>
    <label><span>Datum</span><input class="input" type="date" value="${heute()}" data-waist-date></label>
    <label><span>Taillenumfang</span><span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" placeholder="90,0" data-waist-value><i>cm</i></span></label>
    <label class="body-standard"><input type="checkbox" data-waist-standard><span>Unter standardisierten Bedingungen gemessen</span></label>
    <button class="btn btn-primary" type="submit">Taillenumfang speichern</button>
  </form>`;
}

export function skinfoldEntryMarkup(groesseCm = '', gewichtKg = '') {
  return `<form class="body-entry-form" data-skinfold-form>
    <p class="body-guide">Alle zwei bis vier Wochen · gleiche Tageszeit und Körperseite · gleiche Messperson und gleicher Caliper · ähnliche Hydrierungs- und Ernährungsbedingungen.</p>
    <label class="fld-l">Datum<input class="input" type="date" value="${heute()}" data-skinfold-date></label>
    <label class="fld-l">Körpergröße<span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" placeholder="180" autocomplete="off" value="${escapeHtml(String(groesseCm ?? ''))}" data-skinfold-height><i>cm</i></span></label>
    <label class="fld-l">Körpergewicht bei dieser Messung<span class="nutrition-unit-field"><input class="input" type="text" inputmode="decimal" placeholder="85,0" autocomplete="off" value="${escapeHtml(String(gewichtKg ?? ''))}" data-skinfold-weight><i>kg</i></span></label>
    <label class="body-standard"><input type="checkbox" data-skinfold-standard><span>Standardisierte Bedingungen eingehalten</span></label>
    <div class="guided-fold-grid">${FALTEN.map(([key, label], index) => `<fieldset><legend>${label}</legend><small>${FALTEN_HILFE[key]}</small><div><input class="input" type="text" inputmode="decimal" enterkeyhint="${index === FALTEN.length - 1 ? 'done' : 'next'}" autocomplete="off" id="skinfold-${key}" name="skinfold-${key}" placeholder="mm" aria-label="${label} in Millimetern" data-fold="${key}"></div></fieldset>`).join('')}</div>
    <div class="falten-summe" data-skinfold-quality>0 von ${FALTEN.length} Falten eingetragen.</div>
    <button class="btn btn-primary btn-block" type="submit" disabled>Messung speichern</button>
  </form>`;
}

function recoveryEntryMarkup() {
  return `<form class="body-checkin-form body-entry-form" data-bodycomp-checkin>
    <label><span>Datum</span><input class="input" type="date" value="${heute()}" data-checkin-date></label>
    ${[['recovery','Erholung'],['mood','Stimmung'],['hunger','Hunger']].map(([key, label]) => `<label><span>${label}</span><select class="input" data-checkin-${key}>${[1,2,3,4,5].map((value) => `<option value="${value}">${value} von 5</option>`).join('')}</select></label>`).join('')}
    <div><label><input type="checkbox" data-checkin-illness> Krankheit</label><label><input type="checkbox" data-checkin-travel> Reise</label><label><input type="checkbox" data-checkin-unusual> außergewöhnliche Mahlzeiten</label></div>
    <button class="btn btn-primary" type="submit">Check-in speichern</button>
  </form>`;
}

function logmanEntryMarkup() {
  return `<div class="body-entry-form"><p>Wähle einen JSON-Export aus LOGMAN. Vorhandene Werte desselben Tages werden aktualisiert.</p><label class="body-file-input"><span>LOGMAN-JSON-Export auswählen</span><input type="file" accept="application/json,.json" data-logman-import></label><p data-logman-status></p></div>`;
}

export function weightHistoryMarkup(weights = []) {
  if (!weights.length) return '';
  const rows = [...weights]
    .sort((a, b) => String(b.gemessen_am || b.date || '').localeCompare(String(a.gemessen_am || a.date || '')))
    .map((row) => {
      const date = row.gemessen_am || row.date;
      return `<li><time datetime="${escapeHtml(date)}">${datumKurz(date)}</time><b>${display(row.kg)} kg</b></li>`;
    }).join('');
  return `<details class="body-inner-details body-weight-history">
    <summary><span>Einzelne Wiegungen</span>${materialIconMarkup('chevron_right')}</summary>
    <p>Neueste Messung zuerst. Ein erneuter Eintrag für dasselbe Datum aktualisiert den vorhandenen Wert.</p>
    <ol>${rows}</ol>
  </details>`;
}

export function skinfoldHistoryMarkup(skinfolds = []) {
  if (!skinfolds.length) return '';
  const rows = [...skinfolds]
    .sort((a, b) => String(b.gemessen_am || '').localeCompare(String(a.gemessen_am || '')))
    .map((row) => {
      const total = row.total ?? summe(row.falten);
      const fehlend = FALTEN.filter(([key]) => zahl(row.falten?.[key]) == null).map(([, label]) => label);
      const vollstaendig = fehlend.length === 0;
      const stammdaten = [
        ['Körpergröße', row.groesse_cm == null ? '–' : `${display(row.groesse_cm)} cm`],
        ['Körpergewicht', row.gewicht_kg == null ? '–' : `${display(row.gewicht_kg)} kg`],
        ['Alter am Messdatum', row.alter == null ? '–' : `${row.alter} Jahre`],
      ].map(([label, value]) => `<div><dt>${label}</dt><dd>${value}</dd></div>`).join('');
      const values = stammdaten + FALTEN.map(([key, label]) => `<div${zahl(row.falten?.[key]) == null ? ' class="fehlt"' : ''}><dt>${label}</dt><dd>${zahl(row.falten?.[key]) != null ? `${display(row.falten[key])} mm` : '–'}</dd></div>`).join('');
      const kopf = vollstaendig && total != null
        ? `<b>${display(total)} mm</b>`
        : `<b class="unvollstaendig">${fehlend.length} fehlt${fehlend.length === 1 ? '' : 'en'}</b>`;
      return `<li><details${vollstaendig ? '' : ' class="ist-unvollstaendig"'}><summary class="body-skinfold-history-head"><time datetime="${escapeHtml(row.gemessen_am)}">${datumKurz(row.gemessen_am)}</time>${kopf}</summary>${vollstaendig ? '' : `<p class="body-skinfold-nachtragen">Ohne ${escapeHtml(fehlend.join(', '))} ergibt sich keine vergleichbare vollständige Messung. Trage sie über den Hinzufügen-Button mit demselben Datum erneut ein.</p>`}<dl>${values}</dl></details></li>`;
    }).join('');
  return `<details class="body-inner-details body-weight-history body-skinfold-history">
    <summary><span>Einzelne Hautfaltenmessungen</span>${materialIconMarkup('chevron_right')}</summary>
    <p>Neueste Messung zuerst. Tippe ein Datum an, um alle dreizehn Einzelwerte zu sehen.</p>
    <ol>${rows}</ol>
  </details>`;
}

export function skinfoldRecord({ userId, date, values, standardisiert, groesseCm = null, gewichtKg = null }) {
  const readings = Object.fromEntries(Object.entries(values).map(([key, value]) => [key, [value]]));
  return {
    user_id: userId,
    gemessen_am: date,
    falten: values,
    groesse_cm: groesseCm,
    gewicht_kg: gewichtKg,
    messreihen: readings,
    messqualitaet: standardisiert ? 'hoch' : 'niedrig',
    standardisiert,
    bedingungen: {
      gleiche_tageszeit: standardisiert,
      gleiche_seite: standardisiert,
      gleicher_caliper: standardisiert,
    },
  };
}

function weightMarkup(state) {
  const trend = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined); const latest = state.weights.at(-1);
  const interpretation = goalWeightInterpretation(trend, state.settings.goal || 'maintain');
  return `<section class="body-v2-card ${SPECIAL_DEX_CLASSES.content}" data-weight-card><header><span><b>Gewichtsverlauf</b><small>${latest ? `${display(latest.kg)} kg · ${state.weights.length} ${state.weights.length === 1 ? 'Messung' : 'Messungen'}` : 'Noch keine Messung'}</small></span></header><div class="body-v2-card-body">
    <p class="body-explain">Hier siehst du deine einzelnen Wiegungen zusammen mit dem geglätteten 7-Tage-Schnitt. Entscheidend ist nicht ein einzelner Ausreißer, sondern die Richtung über mehrere Wochen.</p>
    ${latest ? `<div class="body-metric-grid"><span><small>AKTUELL</small><b>${display(latest.kg)} kg</b></span><span><small>7-TAGE-SCHNITT</small><b>${display(trend.average7Kg)} kg</b></span><span><small>PRO WOCHE</small><b>${trend.weeklyKg > 0 ? '+' : ''}${display(trend.weeklyKg, 2)} kg</b></span><span><small>28-TAGE-ÄNDERUNG</small><b>${trend.trend28Kg > 0 ? '+' : ''}${display(trend.trend28Kg, 2)} kg</b></span></div>` : '<div class="body-chart-empty"><b>Noch kein Gewicht</b><span>Trage über den Hinzufügen-Button deine erste Wiegung ein.</span></div>'}
    <div class="body-chart-block"><header><b>VERLAUF</b><small>Tageswerte und 7-Tage-Schnitt</small></header>
    <p class="body-goal-status" data-tone="${interpretation.tone}"><b>${interpretation.label}</b><span>${interpretation.text}</span></p>
    ${curveSvg([{ values: state.weights.map((row) => ({ datum: row.gemessen_am, wert: row.kg })), className: 'roh', points: true }, { values: trend.points?.map((row) => ({ datum: row.date, wert: row.kg })) || [], className: 'trend' }], { unit: 'kg' })}
    <p class="body-chart-legend"><b>Punkte:</b> einzelne Wiegungen · <b>kräftige Linie:</b> geglätteter 7-Tage-Schnitt</p></div>
    ${weightHistoryMarkup(state.weights)}
    ${infoDetails('Warum bewertet CAPBOY den Trend?', `${BODY_EXPLANATIONS.dailyWeight} ${BODY_EXPLANATIONS.average7} ${BODY_EXPLANATIONS.trend28}`)}
    ${infoDetails('Wie oft wiegen?', BODY_EXPLANATIONS.weighingFrequency)}
    <button class="body-reset-mini" type="button" data-reset-body="weights">Gewichtsverlauf zurücksetzen</button>
  </div></section>`;
}

/* Körperfett nach der YPSI-Formel. Rechnet nur, wenn Größe, Gewicht und alle
   zehn Summenfalten vorliegen; sonst bleibt die Zeile leer. */
function ypsiKfaReihe(state) {
  return state.skinfolds
    .map((row) => {
      if (!vollstaendigeFalten(row.falten)) return null;
      const kfa = koerperfettAnteil({
        groesseCm: row.groesse_cm,
        gewichtKg: row.gewichtKg,
        summe: row.total,
      });
      if (kfa == null) return null;
      const mager = magermasse(row.gewichtKg, kfa);
      return {
        datum: row.gemessen_am,
        kfa,
        magermasse: mager,
        fettmasse: mager == null ? null : Math.round((row.gewichtKg - mager) * 10) / 10,
        gewicht: row.gewichtKg,
        groesse: row.groesse_cm,
        alter: row.alter,
        summe: row.total,
      };
    })
    .filter(Boolean);
}

function ypsiKfaMarkup(state) {
  const reihe = ypsiKfaReihe(state);
  const latest = reihe.at(-1);
  const previous = reihe.at(-2);
  const delta = latest && previous ? latest.kfa - previous.kfa : null;
  const letzteMessung = state.skinfolds.at(-1);
  const fehlt = [];
  if (letzteMessung) {
    if (letzteMessung.groesse_cm == null) fehlt.push('Körpergröße');
    if (letzteMessung.gewichtKg == null) fehlt.push('das bei der Messung gespeicherte Körpergewicht');
    if (!vollstaendigeFalten(letzteMessung.falten)) fehlt.push('vollständige Faltenwerte');
  }
  return `<section class="body-v2-card ${SPECIAL_DEX_CLASSES.content}" data-kfa-card><header><span><b>Körperfett-Schätzung</b><small>${latest ? `${display(latest.kfa)} % · ${datumKurz(latest.datum)}` : 'Noch nicht berechenbar'}</small></span></header><div class="body-v2-card-body">
    <p class="body-explain">Schätzung nach der YPSI-Formel aus Körpergröße, Gewicht und der Summe der zehn Rumpf- und Wadenfalten. Der <b>Verlauf</b> ist die Aussage — der absolute Wert ist eine Regression aus dem Seminar, keine Messung.</p>
    ${latest ? `<div class="body-metric-grid">
      <span><small>KÖRPERFETT</small><b>${display(latest.kfa)} %</b></span>
      <span><small>FETTMASSE</small><b>${display(latest.fettmasse)} kg</b></span>
      <span><small>MAGERMASSE</small><b>${display(latest.magermasse)} kg</b></span>
      <span><small>FALTENSUMME</small><b>${display(latest.summe)} mm</b></span>
    </div>
    ${delta != null ? `<p class="body-neutral-note">Gegenüber der vorigen Messung: ${delta > 0 ? '+' : ''}${display(delta, 2)} Prozentpunkte.</p>` : ''}
    <div class="body-chart-block"><header><b>VERLAUF</b><small>Körperfett in Prozent</small></header>${curveSvg([{ values: reihe.map((row) => ({ datum: row.datum, wert: row.kfa })), className: 'trend', points: true }], { unit: '%' })}</div>
    <p class="body-chart-legend">Berechnet aus <b>${display(latest.groesse)} cm</b> und <b>${display(latest.gewicht)} kg</b>, die mit dieser Messung gespeichert wurden${latest.alter == null ? '' : ` · Alter am Messdatum: <b>${latest.alter} Jahre</b>`}.</p>`
    : `<div class="body-chart-empty"><b>Noch keine Schätzung</b><span>${fehlt.length ? `Für die letzte Messung fehlt ${escapeHtml(fehlt.join(' und '))}.` : 'Nach der ersten vollständigen Messung mit Körpergröße und passender Wiegung erscheint hier die Schätzung.'}</span></div>`}
    ${infoDetails('Wie wird gerechnet?', 'Die Formel bildet aus Größe und Gewicht einen Nullpunkt und bewertet dann, wie weit deine Faltensumme davon entfernt liegt: Körperfett steigt mit der Wurzel dieses Abstands. Zwei Eigenheiten der Vorlage sind wichtig. Erstens liegt der Nullpunkt über alle realistischen Größen und Gewichte hinweg nur zwischen etwa 42 und 45 mm – er ist also fast eine Konstante und keine persönliche Erwartung. Zweitens geht nur der Betrag des Abstands ein, eine Summe unterhalb des Nullpunkts erhöht den Wert deshalb genauso wie eine darüber. Das Geschlecht geht nicht ein. Quelle: Formel.xlsx (YPSI), Blatt „Tracking“. Die Schätzung ersetzt keine Messung wie DEXA oder BodPod und ist keine medizinische Diagnose.')}
  </div></section>`;
}

function faltenLegendeMarkup(state) {
  const latest = state.skinfolds.filter((row) => vollstaendigeFalten(row.falten)).at(-1);
  const sex = state.settings.calculation_basis === 'female' ? 'frau' : 'mann';
  const rows = FALTEN.map(([slug, label]) => {
    const info = hautfaltenData.falten[slug];
    const kurz = info?.interpretation?.kurzbeschreibung || '';
    const wert = latest?.falten?.[slug];
    const norm = info?.norm?.[`${sex}_mm`];
    let statusKlasse = '';
    if (wert != null && norm != null) statusKlasse = wert > norm * 1.6 ? 'ist-hoch' : wert > norm ? 'ist-erhoeht' : 'ist-im-ziel';
    return `<button type="button" class="falten-legende-item ${statusKlasse}" data-falten-detail="${slug}">
      <span class="falten-item-head"><b>${escapeHtml(label)}</b><small>${escapeHtml(kurz)}</small></span>
      <span class="falten-item-value">${wert != null ? `<b>${display(wert)}</b><small>mm</small>` : '<em>–</em>'}${materialIconMarkup('chevron_right')}</span>
    </button>`;
  }).join('');
  return `<details class="body-inner-details body-falten-legende">
    <summary><span>Falten im Detail (YPSI-Interpretation)</span>${materialIconMarkup('chevron_right')}</summary>
    <p class="body-legende-intro">Tippe auf eine Falte, um zu sehen, was sie laut BioSignature/YPSI aussagt, wie sie gemessen wird und welche Protokolle infrage kommen.</p>
    <div class="falten-legende-liste">${rows}</div>
    <p class="body-legende-disclaimer">Erfahrungswerte aus dem YPSI-System (Wolfgang Unsöld, Charles Poliquin). Keine klinisch validierten Diagnostiktests, keine medizinische Diagnose.</p>
  </details>`;
}

/* Die YPSI-Rangformel bewertet |Wert/4 − Referenz| und unterscheidet nicht,
   ob die Abweichung nach oben oder unten geht. Fuer die Handlung ist das der
   Unterschied, deshalb wird die Richtung im UI immer mitgenannt. */
function richtungsText(fold) {
  if (!fold || fold.richtung === 'exakt') return 'auf Referenz';
  return `${display(fold.score, 2)} ${fold.richtung === 'unter' ? 'unter' : 'über'} Referenz`;
}

function ypsiPriorityMarkup(state) {
  const recentSleep = state.sleep.slice(-7);
  const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
  const plan = buildSkinfoldPlan(state.skinfolds, state.settings.calculation_basis, {
    recentEnergy: average(recentSleep.map((row) => Number(row.energy)).filter(Number.isFinite)),
    recentSleep: average(recentSleep.map((row) => Number(row.quality)).filter(Number.isFinite)),
  });
  if (!plan) return `<section class="ypsi-priority-empty">
    <b>YPSI-Prioritäten</b>
    <span>Nach deiner ersten vollständigen Messung ordnet CAPBOY die vier Protokollgruppen und zeigt die passende Startphase.</span>
  </section>`;
  return `<section class="ypsi-priority-block">
    <header><span><small>YPSI-ASSESSMENT</small><b>Deine Hautfalten-Prioritäten</b></span><em>${datumKurz(plan.date)}</em></header>
    <div class="ypsi-top-fold"><small>PRIORISIERTE FALTE</small><b>${escapeHtml(plan.topFold.label)}</b><span>${display(plan.topFold.value)} mm · ${richtungsText(plan.topFold)} · Rang 1 nach Formel.xlsx</span></div>
    ${plan.topFold.richtung === 'unter' ? '<p class="body-neutral-note">Diese Falte ist priorisiert, weil sie <b>unter</b> dem Referenzwert liegt. Die YPSI-Rangformel bewertet den Betrag der Abweichung und unterscheidet die Richtung nicht — für die Handlung ist sie aber entscheidend. Ein Wert unter der Referenz ist in der Regel kein Ansatzpunkt für Fettabbau.</p>' : ''}
    <p>Die App zeigt oben Rang 1 über alle dreizehn Falten. Darunter ordnet sie die fünf vorhandenen Protokollgruppen, frühere Messungen und Gegenfalten aus den Seminarunterlagen ein. Tippe eine Gruppe an, um Ernährung, Schlaf, Supplements und die Begründung zu sehen.</p>
    <div class="ypsi-priority-list">${plan.priorities.map((priority) => {
      const currentProtocol = priority.recommendedProtocols[0] || priority.phaseProtocols[0];
      const values = priority.details.map((item) => `${item.label} ${display(item.value)} mm`).join(' · ');
      return `<button type="button" data-ypsi-priority="${priority.id}">
        <i>${priority.priority}</i><span><b>${escapeHtml(priority.label)}</b><small>Führend: ${escapeHtml(priority.primaryFold.label)} · ${escapeHtml(values)}</small>${priority.priority === 1 ? `<em>Aktueller Schritt: Phase ${priority.suggestedPhase === 4 ? '4+' : priority.suggestedPhase}${currentProtocol?.fokus ? ` · ${escapeHtml(currentProtocol.fokus)}` : ''}</em>` : `<em>Nächster möglicher Einstieg: Phase ${priority.suggestedPhase === 4 ? '4+' : priority.suggestedPhase}</em>`}</span>${materialIconMarkup('chevron_right')}
      </button>`;
    }).join('')}</div>
    <p class="ypsi-method-note"><b>Phasenlogik:</b> Wird dieselbe Gruppe bei einer späteren Messung erneut Priorität 1, folgt dort die nächste Phase. Die YPSI-Strategie ergänzt deine Kalorien- und Gewichtssteuerung; sie ersetzt sie nicht.</p>
  </section>`;
}

function ypsiProtocolMarkup(protocol, open = false) {
  const supplements = [
    ...(protocol.supplemente || []).map((item) => ({ ...item, optional: false })),
    ...(protocol.optionale_supplemente || []).map((item) => ({ ...item, optional: true })),
  ];
  return `<details class="falten-protokoll-item"${open ? ' open' : ''}><summary><span><b>${escapeHtml(protocol.name)}</b>${protocol.fokus ? `<small>${escapeHtml(protocol.fokus)}</small>` : ''}</span>${materialIconMarkup('chevron_right')}</summary>
    ${protocol.bedingungen?.length ? `<div class="ypsi-protocol-conditions"><b>Passt nur, wenn:</b><ul>${protocol.bedingungen.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></div>` : ''}
    <ul>${supplements.map((supplement) => {
      const safety = supplementSafety(supplement.slug);
      return `<li><span><b>${escapeHtml(supplementName(supplement.slug))}${supplement.optional ? ' · optional' : ''}</b>${safety ? `<small>${escapeHtml(safety)}</small>` : ''}</span>${supplement.dosierung ? `<strong>${escapeHtml(supplement.dosierung)}</strong>` : ''}</li>`;
    }).join('')}</ul>${protocol.notiz ? `<p class="falten-protokoll-notiz">${escapeHtml(protocol.notiz)}</p>` : ''}</details>`;
}

function ypsiPriorityDetailMarkup(priority) {
  const foldInfo = priority.details.map((item) => hautfaltenData.falten[item.slug]).filter(Boolean);
  const lifestyle = [...new Set(foldInfo.flatMap((info) => info.interpretation?.hebel || []))];
  const causes = [...new Set(foldInfo.flatMap((info) => info.interpretation?.hauptursachen || []))];
  const protocolsByPhase = [1, 2, 3, 4].map((phase) => ({
    phase,
    protocols: priority.protocols.filter((protocol) => Number(protocol.phase) === phase),
  })).filter((group) => group.protocols.length);
  const currentProtocols = priority.recommendedProtocols.length ? priority.recommendedProtocols : priority.phaseProtocols;
  return `<header class="falten-detail-header"><div><small>YPSI-PRIORITÄT ${priority.priority} · PHASE ${priority.suggestedPhase === 4 ? '4+' : priority.suggestedPhase}</small><h2>${escapeHtml(priority.label)}</h2></div><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="falten-detail-body ypsi-priority-detail">
      <section class="ypsi-primary-fold"><small>PRIORISIERTE FALTE DIESER GRUPPE</small><b>${escapeHtml(priority.primaryFold.label)}</b><span>${display(priority.primaryFold.value)} mm · Faltenrang ${priority.primaryFold.foldPriority}</span></section>
      <section class="ypsi-detail-values">${priority.details.map((item) => `<span${item.slug === priority.primaryFold.slug ? ' class="is-primary"' : ''}><small>${escapeHtml(item.label)}</small><b>${display(item.value)} mm</b></span>`).join('')}</section>
      ${priority.priority === 1 ? `<section class="falten-detail-section ypsi-current-step"><h3>Aktueller Vorschlag: Phase ${priority.suggestedPhase === 4 ? '4+' : priority.suggestedPhase}</h3><p>Diese Gruppe war in ${priority.occurrences} vollständigen Messung${priority.occurrences === 1 ? '' : 'en'} Priorität 1. ${priority.suggestedPhase < 4 ? 'Daraus folgt der nächste chronologische Basisschritt.' : 'Ab Phase 4 entscheidet die passende Wechselbeziehung bzw. Symptomatik über die Variante.'}</p>${currentProtocols.length ? `<div class="falten-detail-protokolle">${currentProtocols.map((protocol) => ypsiProtocolMarkup(protocol, true)).join('')}</div>` : '<p><b>Noch keine Variante automatisch gewählt.</b> Die Messwerte allein unterscheiden die Phase-4-Zweige nicht sicher. Prüfe die Bedingungen unter „Wechselbeziehungen“.</p>'}</section>` : `<section class="falten-detail-section"><h3>Noch nicht der aktive Schritt</h3><p>Diese Gruppe liegt aktuell auf Rang ${priority.priority}. Wird sie in einer späteren Messung Priorität 1, wäre Phase ${priority.suggestedPhase === 4 ? '4+' : priority.suggestedPhase} der aus dem Verlauf abgeleitete Einstieg.</p></section>`}
      ${priority.relationships.length ? `<section class="falten-detail-section ypsi-relations"><h3>Wechselbeziehungen aus den Unterlagen</h3>${priority.relationships.map((relation) => `<article class="ypsi-relation is-${relation.tone}"><b>${escapeHtml(relation.title)}</b><p>${escapeHtml(relation.summary)}</p><small>${escapeHtml(relation.basis)}</small>${relation.actions.length ? `<ul>${relation.actions.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul>` : ''}</article>`).join('')}</section>` : ''}
      ${causes.length ? `<section class="falten-detail-section"><h3>Kontext aus dem Seminar</h3><div class="falten-detail-tags">${causes.map((item) => `<span>${escapeHtml(item)}</span>`).join('')}</div></section>` : ''}
      ${lifestyle.length ? `<section class="falten-detail-section"><h3>Ernährung, Alltag & Schlaf</h3><ul class="falten-detail-hinweise">${lifestyle.map((item) => `<li>${escapeHtml(item)}</li>`).join('')}</ul></section>` : ''}
      <section class="falten-detail-section"><h3>Alle Phasen zum Nachschlagen</h3><p class="falten-detail-hinweis">Nicht gleichzeitig beginnen: Phase 1 bis 3 werden nur bei wiederkehrender Priorität chronologisch durchlaufen. Phase 4+ ist eine bedingungsabhängige Auswahl.</p>
        <div class="falten-detail-protokolle">${protocolsByPhase.map((phaseGroup) => `<section class="ypsi-phase-group"><h4>Phase ${phaseGroup.phase === 4 ? '4+' : phaseGroup.phase}</h4>${phaseGroup.protocols.map((protocol) => ypsiProtocolMarkup(protocol, phaseGroup.phase === priority.suggestedPhase && priority.priority === 1)).join('')}</section>`).join('')}</div>
      </section>
      <p class="falten-detail-disclaimer">Praxisstrategie aus deinen YPSI-Seminarunterlagen. Prüfe Produkte, Dosierungen, Erkrankungen und Medikamente vor der Einnahme fachlich. Die Kaloriensteuerung in TRACKER läuft unabhängig weiter.</p>
    </div>`;
}

function skinfoldMarkup(state) {
  const valid = state.skinfolds.filter((row) => row.total != null && vollstaendigeFalten(row.falten)); const latest = valid.at(-1); const previous = valid.at(-2);
  const unvollstaendig = state.skinfolds.filter((row) => !vollstaendigeFalten(row.falten));
  const smallChange = latest && previous && Math.abs(latest.total - previous.total) < Math.max(2, previous.total * 0.02);
  return `<section class="body-v2-card ${SPECIAL_DEX_CLASSES.content}" data-skinfold-card><header><span><b>10-Falten-Summe</b><small>${latest ? `${display(latest.total)} mm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span></header><div class="body-v2-card-body"><h2 class="section-title mini-title">10-Falten-Summe in mm</h2>
    <p class="body-explain">Gemessen werden 13 Falten. In die Summe gehen nach der YPSI-Vorlage die zehn von Kinn bis Wade ein — Oberschenkel und Bizeps bleiben bewusst draußen, damit Summe und Körperfettformel zusammenpassen. Der Verlauf wird nur sinnvoll, wenn du unter ähnlichen Bedingungen misst.</p>
    ${latest ? `<div class="body-latest-value"><small>LETZTE SUMME</small><strong>${display(latest.total)} <b>mm</b></strong><span>${datumKurz(latest.gemessen_am)}</span></div>` : '<div class="body-chart-empty"><b>Noch keine Faltenmessung</b><span>Nach der ersten vollständigen 13-Falten-Messung erscheint hier die Summe.</span></div>'}
    ${smallChange ? '<p class="body-neutral-note">Die Veränderung liegt möglicherweise innerhalb der normalen Messschwankung. Noch keine Anpassung erforderlich.</p>' : ''}
    ${unvollstaendig.length ? `<p class="body-neutral-note">${unvollstaendig.length} ältere ${unvollstaendig.length === 1 ? 'Messung hat' : 'Messungen haben'} noch nicht alle 13 Werte und ${unvollstaendig.length === 1 ? 'fehlt' : 'fehlen'} deshalb im Verlauf. Du findest ${unvollstaendig.length === 1 ? 'sie' : 'sie'} unten unter „Einzelne Hautfaltenmessungen“ zum Nachtragen.</p>` : ''}
    <div class="body-chart-block"><header><b>VERLAUF</b><small>Summe der zehn Falten Kinn bis Wade</small></header>${curveSvg([{ values: valid.map((row) => ({ datum: row.gemessen_am, wert: row.total })), className: 'trend', points: true }], { unit: 'mm' })}</div>
    ${ypsiPriorityMarkup(state)}
    ${faltenLegendeMarkup(state)}
    ${skinfoldHistoryMarkup(state.skinfolds)}
    ${infoDetails('Was wird gemessen?', BODY_EXPLANATIONS.skinfolds)}
    <details class="body-inner-details body-skinfold-reminder"><summary><span>Hautfalten-Erinnerung</span>${materialIconMarkup('chevron_right')}</summary><p>Lege fest, ob CAPBOY dich alle zwei bis vier Wochen an eine neue 13-Falten-Messung erinnert.</p><div data-skinfold-settings></div></details>
    <button class="body-reset-mini" type="button" data-reset-body="skinfolds">13-Falten-Werte zurücksetzen</button>
  </div></section>`;
}

function faltenDetailMarkup(slug, state) {
  const info = hautfaltenData.falten[slug];
  if (!info) return `<p>Keine Informationen zu dieser Falte hinterlegt.</p>`;
  const sex = state.settings.calculation_basis === 'female' ? 'frau' : 'mann';
  const sexLabel = sex === 'frau' ? '♀' : '♂';
  const otherSexLabel = sex === 'frau' ? '♂' : '♀';
  const latest = state.skinfolds.filter((row) => row.falten?.[slug] != null).at(-1);
  const wert = latest?.falten?.[slug];
  const previous = state.skinfolds.filter((row) => row.falten?.[slug] != null).at(-2);
  const vorherWert = previous?.falten?.[slug];
  const delta = wert != null && vorherWert != null ? wert - vorherWert : null;

  const norm = info.norm || {};
  const normEigenerWert = norm[`${sex}_mm`];
  const normAnderer = norm[`${sex === 'frau' ? 'mann' : 'frau'}_mm`];
  let statusText = '';
  let statusTone = 'neutral';
  if (wert != null) {
    if (normEigenerWert != null) {
      if (wert <= normEigenerWert) { statusText = `Im Zielbereich (≤ ${normEigenerWert} mm ${sexLabel})`; statusTone = 'good'; }
      else if (wert < normEigenerWert * 1.6) { statusText = `Über Norm (${normEigenerWert} mm ${sexLabel})`; statusTone = 'watch'; }
      else { statusText = `Deutlich über Norm (${normEigenerWert} mm ${sexLabel})`; statusTone = 'attention'; }
    } else if (norm.grenzwert_mm != null) {
      if (wert <= norm.grenzwert_mm) { statusText = `Unter Grenzwert (${norm.grenzwert_mm} mm)`; statusTone = 'good'; }
      else { statusText = `Über Grenzwert (${norm.grenzwert_mm} mm)`; statusTone = 'attention'; }
    } else {
      statusText = 'Keine feste Norm — je niedriger, desto besser';
    }
  }

  const messung = info.messung || {};
  const interp = info.interpretation || {};
  const protokolle = (info.protokoll_ids || [])
    .map((id) => ypsiProtokolle.protokolle[id])
    .filter(Boolean);

  return `
    <header class="falten-detail-header">
      <div>
        <small>Falte</small>
        <h2>${escapeHtml(info.label)}</h2>
      </div>
      <button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button>
    </header>
    <div class="falten-detail-body">
      ${wert != null ? `<section class="falten-detail-status status-${statusTone}">
        <div><small>DEIN WERT</small><strong>${display(wert)} <b>mm</b></strong><span>${datumKurz(latest.gemessen_am)}${delta != null ? ` · ${delta > 0 ? '+' : ''}${display(delta)} mm ggü. vorher` : ''}</span></div>
        ${statusText ? `<div class="falten-detail-status-hint"><span>${escapeHtml(statusText)}</span></div>` : ''}
      </section>` : `<section class="falten-detail-status status-neutral"><em>Noch keine Messung für diese Falte.</em></section>`}

      <section class="falten-detail-section">
        <h3>Was diese Falte bedeutet</h3>
        <p class="falten-detail-kurz"><b>${escapeHtml(interp.kurzbeschreibung || '')}</b></p>
        ${interp.ausfuehrlich ? `<p>${escapeHtml(interp.ausfuehrlich)}</p>` : ''}
        ${(interp.hauptursachen || []).length ? `<div class="falten-detail-tags"><b>Hauptursachen:</b>${interp.hauptursachen.map((h) => `<span>${escapeHtml(h)}</span>`).join('')}</div>` : ''}
        ${(interp.hebel || []).length ? `<div class="falten-detail-tags falten-detail-hebel"><b>Hebel:</b>${interp.hebel.map((h) => `<span>${escapeHtml(h)}</span>`).join('')}</div>` : ''}
        ${interp.praxisregel ? `<p class="falten-detail-hinweis">${escapeHtml(interp.praxisregel)}</p>` : ''}
        ${(interp.vier_hebel || []).length ? `<div class="falten-detail-tags"><b>4 Hebel:</b>${interp.vier_hebel.map((h) => `<span>${escapeHtml(h)}</span>`).join('')}</div>` : ''}
      </section>

      ${normEigenerWert != null || norm.grenzwert_mm != null || norm.notiz ? `<section class="falten-detail-section">
        <h3>Norm & Orientierung</h3>
        <div class="falten-detail-norm">
          ${norm.ziel_mm?.[sex] != null ? `<div><small>Ziel ${sexLabel} (du)</small><b>&lt; ${norm.ziel_mm[sex]} mm</b></div>` : ''}
          ${norm.normal_bis_mm?.[sex] != null
            ? `<div><small>Normal bis ${sexLabel}</small><b>${norm.normal_bis_mm[sex]} mm</b></div>`
            : normEigenerWert != null ? `<div><small>Norm ${sexLabel} (du)</small><b>${normEigenerWert} mm</b></div>` : ''}
          ${norm.normal_bis_mm == null && normAnderer != null ? `<div><small>Norm ${otherSexLabel}</small><b>${normAnderer} mm</b></div>` : ''}
          ${norm.grenzwert_mm != null ? `<div><small>Grenzwert</small><b>${norm.grenzwert_mm} mm</b></div>` : ''}
          ${norm.katastrophal_mm != null ? `<div><small>Kritisch ab</small><b>${norm.katastrophal_mm} mm</b></div>` : ''}
        </div>
        ${norm.notiz ? `<p class="falten-detail-hinweis">${escapeHtml(norm.notiz)}</p>` : ''}
      </section>` : ''}

      <section class="falten-detail-section">
        <h3>So wird gemessen</h3>
        <p><b>Typ:</b> ${escapeHtml(messung.typ || '–')} · <b>Seite:</b> ${escapeHtml(messung.seite || '–')}</p>
        ${messung.position ? `<p>${escapeHtml(messung.position)}</p>` : ''}
        ${(messung.hinweise || []).length ? `<ul class="falten-detail-hinweise">${messung.hinweise.map((h) => `<li>${escapeHtml(h)}</li>`).join('')}</ul>` : ''}
      </section>

      ${protokolle.length ? `<section class="falten-detail-section">
        <h3>YPSI-Protokolle</h3>
        ${info.protokoll_hinweis ? `<p class="falten-detail-hinweis">${escapeHtml(info.protokoll_hinweis)}</p>` : ''}
        <p class="falten-detail-hinweis">Chronologisch abarbeiten: Phase 1 → 2 → 3, dann Phase 4+ nach Symptomatik wählen. Nicht alles gleichzeitig einnehmen.</p>
        <div class="falten-detail-protokolle">
          ${protokolle.map((p) => `<div class="falten-protokoll-item">
            <header><b>${escapeHtml(p.name)}</b>${p.fokus ? `<small>${escapeHtml(p.fokus)}</small>` : ''}</header>
            <ul>${(p.supplemente || []).map((s) => `<li><span><b>${escapeHtml(supplementName(s.slug))}</b>${supplementSafety(s.slug) ? `<small>${escapeHtml(supplementSafety(s.slug))}</small>` : ''}</span>${s.dosierung ? `<strong>${escapeHtml(s.dosierung)}</strong>` : ''}</li>`).join('')}</ul>
            ${p.notiz ? `<p class="falten-protokoll-notiz">${escapeHtml(p.notiz)}</p>` : ''}
          </div>`).join('')}
        </div>
      </section>` : ''}

      ${info.quelle ? `<p class="falten-detail-quelle">Quelle: ${escapeHtml(info.quelle)}</p>` : ''}
      <p class="falten-detail-disclaimer">Angaben aus dem YPSI-System (Wolfgang Unsöld) und BioSignature (Charles Poliquin). Keine klinisch validierten Diagnostiktests, keine medizinische Diagnose. Bei ernsthaften Beschwerden ärztlich abklären lassen.</p>
    </div>
  `;
}

function emptyBravermanState() {
  return {
    version: 1,
    answers: Object.fromEntries(BRAVERMAN_REIHENFOLGE.map((key) => [key, []])),
    currentType: BRAVERMAN_REIHENFOLGE[0],
    currentIndex: 0,
    completedAt: null,
    safetyNotice: false,
  };
}

function bravermanState() {
  const saved = getPreference(BRAVERMAN_PREFERENCE, null);
  const initial = emptyBravermanState();
  if (!saved || saved.version !== 1 || typeof saved !== 'object') return initial;
  return {
    ...initial,
    ...saved,
    answers: Object.fromEntries(BRAVERMAN_REIHENFOLGE.map((key) => [key, Array.isArray(saved.answers?.[key]) ? saved.answers[key] : []])),
  };
}

const bravermanPositions = () => BRAVERMAN_REIHENFOLGE.flatMap((type) => BRAVERMAN_DEFIZIT_FRAGEN[type].map((_, index) => ({ type, index })));

function bravermanQuestionMarkup(test) {
  const positions = bravermanPositions();
  const currentPosition = Math.max(0, positions.findIndex((position) => position.type === test.currentType && position.index === test.currentIndex));
  const position = positions[currentPosition] || positions[0];
  const question = BRAVERMAN_DEFIZIT_FRAGEN[position.type][position.index];
  const area = BRAVERMAN_BEREICHE[position.type];
  const answered = positions.filter(({ type, index }) => typeof test.answers?.[type]?.[index] === 'boolean').length;
  const selected = test.answers?.[position.type]?.[position.index];
  return `<header class="falten-detail-header braverman-sheet-header"><div><small>BRAVERMAN-DEFIZITPROFIL</small><h2>${escapeHtml(area.label)}</h2></div><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
    <div class="braverman-test-body">
      <div class="braverman-progress"><span style="--braverman-progress:${Math.round(answered / positions.length * 100)}%"></span><small>${answered} von ${positions.length}</small></div>
      ${test.safetyNotice ? `<aside class="braverman-safety"><b>Du musst damit nicht allein bleiben.</b><p>Wenn du akut daran denkst, dir etwas anzutun, rufe bitte sofort 112 oder wende dich an eine Krisenhilfe. Dieser Test kann keine Unterstützung durch einen Menschen ersetzen.</p><button type="button" data-dismiss-safety>Hinweis schließen</button></aside>` : ''}
      <section class="braverman-question"><small>${position.index + 1} von ${BRAVERMAN_DEFIZIT_FRAGEN[position.type].length} · ${escapeHtml(area.kurz)}</small><h3>${escapeHtml(question)}</h3><p>Trifft diese Aussage aktuell auf dich zu?</p>
        <div><button type="button" data-braverman-answer="false"${selected === false ? ' class="selected"' : ''}>Nein</button><button type="button" data-braverman-answer="true"${selected === true ? ' class="selected"' : ''}>Ja</button></div>
      </section>
      <footer class="braverman-nav"><button type="button" data-braverman-prev${currentPosition === 0 ? ' disabled' : ''}>Zurück</button><button type="button" data-braverman-pause>Speichern & schließen</button></footer>
      <p class="falten-detail-disclaimer">Die Aussagen stammen sinngemäß aus Teil 2 des Braverman Personality Type Assessment. Antworte nach deinem aktuellen Zustand, nicht nach einem einzelnen ungewöhnlichen Tag.</p>
    </div>`;
}

function bravermanResultMarkup(test, { sheet = false } = {}) {
  const result = scoreBravermanAssessment(test.answers);
  const scored = BRAVERMAN_REIHENFOLGE.map((key) => ({ key, score: result.scores[key], ...result.severity[key] }));
  const focusRecommendations = bravermanRecommendations(result.focus, result.severity[result.focus].id);
  const heading = sheet ? `<header class="falten-detail-header braverman-sheet-header"><div><small>BRAVERMAN-DEFIZITPROFIL</small><h2>Dein Ergebnis</h2></div><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>` : '';
  return `${heading}<div class="${sheet ? 'braverman-test-body ' : ''}braverman-result">
    ${sheet && test.safetyNotice ? `<aside class="braverman-safety"><b>Du musst damit nicht allein bleiben.</b><p>Wenn du akut daran denkst, dir etwas anzutun, rufe bitte sofort 112 oder wende dich an eine Krisenhilfe. Dieser Test kann keine Unterstützung durch einen Menschen ersetzen.</p><button type="button" data-dismiss-safety>Hinweis schließen</button></aside>` : ''}
    <section class="braverman-result-focus"><small>STÄRKSTER AKTUELLER FOKUS</small><b>${escapeHtml(BRAVERMAN_BEREICHE[result.focus].label)}</b><span>${escapeHtml(BRAVERMAN_BEREICHE[result.focus].kurz)}</span></section>
    <div class="braverman-score-list">${scored.map((item) => {
      const total = BRAVERMAN_DEFIZIT_FRAGEN[item.key].length;
      return `<div data-tone="${item.tone}"><span><b>${escapeHtml(BRAVERMAN_BEREICHE[item.key].label)}</b><small>${item.score} von ${total} · ${item.label}</small></span><i><em style="width:${Math.round(item.score / total * 100)}%"></em></i></div>`;
    }).join('')}</div>
    ${sheet ? `<section class="falten-detail-section braverman-foods"><h3>Ernährung aus den Unterlagen</h3><p>Als erste, niedrigschwellige Strategie nennt das Material für ${escapeHtml(focusRecommendations.area.label)}:</p><div class="falten-detail-tags">${focusRecommendations.foods.map((food) => `<span>${escapeHtml(food)}</span>`).join('')}</div></section>
      <section class="falten-detail-section"><h3>Supplement-Optionen der Vorlage</h3><p class="falten-detail-hinweis">Die Dosis entspricht der historischen Tabelle für die ermittelte Ausprägung. Sie ist keine automatische Einnahmeanweisung.</p><div class="braverman-supplements">${focusRecommendations.supplements.map((supplement) => `<details><summary><span><b>${escapeHtml(supplement.name)}</b><small>${escapeHtml(supplement.dose)}</small></span>${materialIconMarkup('chevron_right')}</summary>${supplement.notiz ? `<p>${escapeHtml(supplement.notiz)}</p>` : ''}${supplement.safety ? `<p class="braverman-warning">${escapeHtml(supplement.safety)}</p>` : '<p>Vor der Einnahme Produktangaben, Medikamente und persönliche Kontraindikationen prüfen.</p>'}</details>`).join('')}</div></section>
      <p class="falten-detail-disclaimer">Das Ergebnis beschreibt das Antwortmuster des Braverman-Modells und keine im Gehirn gemessenen Neurotransmitterwerte. Ernährung, Schlaf und Training stehen vor einer Supplement-Auswahl.</p>
      <div class="braverman-result-actions"><button class="btn btn-primary" type="button" data-close>Fertig</button><button type="button" data-braverman-reset>Test neu starten</button></div>` : ''}
  </div>`;
}

function neurotransmitterMarkup() {
  const test = bravermanState();
  const complete = bravermanComplete(test.answers);
  const answered = bravermanPositions().filter(({ type, index }) => typeof test.answers?.[type]?.[index] === 'boolean').length;
  const completedLabel = test.completedAt ? `Ausgewertet · ${datumKurz(String(test.completedAt).slice(0, 10))}` : 'Ausgewertet';
  return `<section class="body-v2-card neurotransmitter-card ${SPECIAL_DEX_CLASSES.content}" data-neurotransmitter-card><header><span><b>Neurotransmitter-Profil</b><small>${complete ? completedLabel : answered ? `${answered} Aussagen beantwortet` : 'Braverman-Assessment'}</small></span></header><div class="body-v2-card-body">
    <p class="body-explain">Der Test nutzt Teil 2 des Braverman-Assessments und verbindet dein Antwortmuster mit Ernährungs- und Supplement-Strategien aus deinen Seminarunterlagen.</p>
    ${complete ? bravermanResultMarkup(test) : `<div class="braverman-intro"><span aria-hidden="true">🧠</span><div><b>Vier aktuelle Bereiche</b><p>Dopamin, Acetylcholin, GABA und Serotonin. Du kannst den Test jederzeit unterbrechen und später fortsetzen.</p></div></div>`}
    <button class="btn btn-primary btn-block" type="button" data-braverman-open>${complete ? 'Ergebnis und Strategien öffnen' : answered ? 'Test fortsetzen' : 'Test starten'}</button>
    <p class="ypsi-method-note">Deine Antworten werden in deinen persönlichen Einstellungen gespeichert. Das Profil ist eine YPSI-/Braverman-Praxisorientierung, kein Labortest.</p>
  </div></section>`;
}

function waistMarkup(state) {
  const latest = state.waists.at(-1);
  return `<section class="body-v2-card ${SPECIAL_DEX_CLASSES.content}" data-waist-card><header><span><b>Taillenumfang</b><small>${latest ? `${display(latest.cm)} cm · ${datumKurz(latest.gemessen_am)}` : 'Noch keine Messung'}</small></span></header><div class="body-v2-card-body"><p class="body-explain">Der Taillenumfang ergänzt Gewicht und Hautfalten. Er hilft besonders dabei, Veränderungen im Bauchbereich sichtbar zu machen.</p>${latest ? `<div class="body-latest-value"><small>LETZTER WERT</small><strong>${display(latest.cm)} <b>cm</b></strong><span>${datumKurz(latest.gemessen_am)}</span></div>` : '<div class="body-chart-empty"><b>Noch kein Taillenumfang</b><span>Trage über den Hinzufügen-Button deine erste Messung ein.</span></div>'}<div class="body-chart-block"><header><b>VERLAUF</b><small>Taillenumfang in Zentimetern</small></header>${curveSvg([{ values: state.waists.map((row) => ({ datum: row.gemessen_am, wert: Number(row.cm) })), className: 'trend', points: true }], { unit: 'cm' })}</div>${infoDetails('Richtig messen', `${BODY_EXPLANATIONS.waist} Miss stehend, nach entspannter Ausatmung und immer an derselben Stelle. Für den Verlauf ist eine gut reproduzierbare Position wichtiger als eine perfekt anatomische Definition; praktisch eignet sich meist die Höhe des Bauchnabels.`)}<button class="body-reset-mini" type="button" data-reset-body="waist">Taillenumfang zurücksetzen</button></div></section>`;
}

function bodyCompMarkup(state) {
  const weight = weightTrendSummary(state.weights, state.settings.bodycomp_thresholds || undefined);
  const skinfoldDelta = confirmedTrendChange(state.skinfolds.filter((row) => vollstaendigeFalten(row.falten)), (row) => row.total, 2);
  const waistDelta = confirmedTrendChange(state.waists, (row) => Number(row.cm), 0.5); const performance = performanceTrend(state.performance); const recovery = recoveryTrend(state.sleep, state.checkins);
  const allDates = [...state.weights.map((row) => row.gemessen_am), ...state.skinfolds.map((row) => row.gemessen_am), ...state.waists.map((row) => row.gemessen_am)].sort();
  const weeks = allDates.length > 1 ? (day(allDates.at(-1)) - day(allDates[0])) / 7 : 0;
  const result = evaluateBodyComp({ weight, skinfoldDelta, waistDelta, performanceTrend: performance.direction, recoveryTrend: recovery, weeks });
  const thresholds = { stableLoss: -0.15, slowLoss: -0.5, stableGain: 0.15, slowGain: 0.3, ...(state.settings.bodycomp_thresholds || {}) };
  return `<details class="body-v2-overview ${SPECIAL_DEX_CLASSES.content}" data-bodycomp-card>
    <summary><span><b>Körpertrend</b><small>${escapeHtml(result.message)}</small></span>${materialIconMarkup('chevron_right')}</summary>
    <div class="body-v2-card-body">
      <p class="bodycomp-message">${escapeHtml(result.message)}</p>
      ${result.suggestion ? `<p>${escapeHtml(result.suggestion)}</p>` : ''}
      <div class="bodycomp-sources">
        <span>Gewicht <b>${weight.category || 'unklar'}</b></span>
        <span>Faltensumme <b>${skinfoldDelta == null ? 'noch nicht bestätigt' : `${skinfoldDelta > 0 ? '+' : ''}${display(skinfoldDelta)} mm`}</b></span>
        <span>Taille <b>${waistDelta == null ? 'noch nicht bestätigt' : `${waistDelta > 0 ? '+' : ''}${display(waistDelta)} cm`}</b></span>
        <span>LOGMAN-Leistung <b>${performance.direction == null ? 'Import fehlt' : `${performance.percent > 0 ? '+' : ''}${display(performance.percent)} %`}</b></span>
        <span>Schlaf & Erholung <b>${recovery == null ? 'noch unklar' : recovery > 0 ? 'verbessert' : recovery < 0 ? 'verschlechtert' : 'stabil'}</b></span>
      </div>
      <details class="body-info"><summary>Einordnung und Einschränkungen<span>?</span></summary><p>${BODY_EXPLANATIONS.recovery}</p>${result.limitations.map((item) => `<p>${escapeHtml(item)}</p>`).join('')}</details>
      <details class="body-inner-details"><summary><span>Orientierungsbereiche anpassen</span>${materialIconMarkup('chevron_right')}</summary><form class="body-threshold-form" data-bodycomp-thresholds><div class="body-threshold-explanation"><b>Was bedeuten diese Werte?</b><p>COMP vergleicht die durchschnittliche Gewichtsänderung pro Woche mit deinem aktuellen 7-Tage-Schnitt. Innerhalb der beiden ersten Grenzen gilt das Gewicht als stabil. Werden die äußeren Grenzen überschritten, wird die Ab- oder Zunahme als schnell eingeordnet. Die Werte sind Orientierung und keine biologische Exaktheit.</p></div><label><span>Gewichtsverlust erkannt ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.stableLoss), 2)}" data-threshold-stable-loss><i>%</i></span></label><label><span>Schneller Verlust ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(Math.abs(thresholds.slowLoss), 2)}" data-threshold-slow-loss><i>%</i></span></label><label><span>Gewichtszunahme erkannt ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.stableGain, 2)}" data-threshold-stable-gain><i>%</i></span></label><label><span>Schnelle Zunahme ab</span><span class="nutrition-unit-field"><input class="input" inputmode="decimal" value="${display(thresholds.slowGain, 2)}" data-threshold-slow-gain><i>%</i></span></label><button class="btn btn-primary" type="submit">Orientierungsbereiche speichern</button></form></details>
    </div>
  </details>`;
}

function logmanMarkup(state) {
  const trend = performanceTrend(state.performance);
  const baselines = new Map();
  [...state.performance]
    .sort((a, b) => a.performed_on.localeCompare(b.performed_on))
    .forEach((row) => {
      const key = `${row.category}:${String(row.exercise).toLowerCase()}`;
      if (!baselines.has(key) && Number(row.estimated_1rm) > 0) baselines.set(key, Number(row.estimated_1rm));
    });
  const daily = [...state.performance.reduce((days, row) => {
    const date = row.performed_on;
    const value = Number(row.estimated_1rm || 0);
    const baseline = baselines.get(`${row.category}:${String(row.exercise).toLowerCase()}`);
    if (!date || !value || !baseline) return days;
    const current = days.get(date) || { sum: 0, count: 0 };
    current.sum += value / baseline * 100;
    current.count += 1;
    days.set(date, current);
    return days;
  }, new Map())].map(([datum, value]) => ({ datum, wert: value.sum / value.count }));
  return `<section class="body-v2-card ${SPECIAL_DEX_CLASSES.content}" data-logman-card><header><span><b>LOGMAN-Leistung</b><small>${state.performance.length ? `${state.performance.length} Werte · ${trend.percent > 0 ? '+' : ''}${display(trend.percent)} %` : 'Noch kein Import'}</small></span></header><div class="body-v2-card-body"><p class="body-explain">Importierte LOGMAN-Daten zeigen, ob deine vergleichbare Trainingsleistung eher steigt, fällt oder stabil bleibt. COMP nutzt das nur als Zusatzsignal, nicht als alleinigen Beweis.</p>${state.performance.length ? `<div class="body-latest-value"><small>VERGLEICHBARER TREND</small><strong>${trend.percent > 0 ? '+' : ''}${display(trend.percent)} <b>%</b></strong><span>${trend.comparableSessions} importierte Leistungswerte</span></div>` : '<div class="body-chart-empty"><b>Noch keine LOGMAN-Daten</b><span>Importiere einen LOGMAN-Export über den Hinzufügen-Button.</span></div>'}<div class="body-chart-block"><header><b>VERLAUF</b><small>Leistungsindex · erster Wert = 100</small></header>${curveSvg([{ values: daily, className: 'trend', points: true }], { unit: '%' })}</div>${infoDetails('Wie wird Leistung verwendet?', `${BODY_EXPLANATIONS.performance} Der Verlauf normalisiert jede Übung auf ihren ersten importierten Wert. Dadurch werden unterschiedliche Übungen nicht als absolute Kilogrammwerte miteinander vermischt.`)}<button class="body-reset-mini" type="button" data-reset-body="logman">LOGMAN-Importe zurücksetzen</button></div></section>`;
}

export async function mountBodyMetrics(container, { session, profile, onProfileUpdated, signal, onRendered }) {
  const userId = session.user.id;
  let state;
  let activeRender = null;
  let renderQueued = false;

  const renderOnce = async () => {
    state = await queryState(userId, signal);
    if (signal?.aborted) return;
    const markup = `
      ${bodyHeroMarkup(state)}
      ${bodyCompMarkup(state)}
      ${weightMarkup(state)}
      ${skinfoldMarkup(state)}
      ${ypsiKfaMarkup(state)}
      ${neurotransmitterMarkup()}
      ${waistMarkup(state)}
      ${logmanMarkup(state)}`;
    const content = container.querySelector(':scope > .body-metrics-wrap > .kategorie-scrollinhalt');
    if (content) {
      // Nach dem ersten Mount liegen Titel und Aktionsknöpfe außerhalb dieses
      // Inhaltscontainers. Nur die Messkarten austauschen, damit ein neuer
      // Gewichtswert niemals den gesamten Dex-Chrome samt Bedienung löscht.
      // Der eigene Body-Dex-Eintragsbereich behält dabei seine Listener und
      // sein Realtime-Abo, statt bei jeder Wiegung erneut angelegt zu werden.
      const entries = content.querySelector(':scope > [data-dex-entries]');
      content.innerHTML = markup;
      if (entries) content.append(entries);
    } else {
      container.innerHTML = `<div class="wrap pad-bottom body-metrics-wrap">${markup}</div>`;
    }
    const pageMeta = container.querySelector('[data-food-scroll-meta]');
    if (pageMeta) pageMeta.textContent = `${state.weights.length} ${state.weights.length === 1 ? 'Wiegung' : 'Wiegungen'}`;
    bind();
    // Nach jedem Re-Render bekommt main.js die Chance, den dex-eintraege-Slot
    // (Update-Hinweis mit eigenen COMP-Notizen) wieder anzuhängen und
    // renderDexEntries darauf loszulassen. Sonst überlebt der Slot nur den
    // ersten Mount, weil container.innerHTML alles wegwirft.
    try { await onRendered?.(container); } catch { /* ignoriert */ }
  };

  const render = async () => {
    if (activeRender) {
      renderQueued = true;
      return activeRender;
    }
    activeRender = (async () => {
      do {
        renderQueued = false;
        await renderOnce();
      } while (renderQueued && !signal?.aborted);
    })();
    try {
      await activeRender;
    } finally {
      activeRender = null;
    }
  };

  const entryOptions = {
    weight: { title: 'Gewicht eintragen', markup: weightEntryMarkup },
    waist: { title: 'Taillenumfang eintragen', markup: waistEntryMarkup },
    skinfold: {
      title: '13-Falten-Messung',
      // Groesse aus der letzten Messung vorbelegen, ersatzweise aus dem Profil.
      markup: () => skinfoldEntryMarkup(
        state.skinfolds.findLast((row) => row.groesse_cm != null)?.groesse_cm
        ?? state.settings.height_cm
        ?? '',
        state.skinfolds.findLast((row) => row.gemessen_am === heute())?.gewicht_kg
        ?? state.weights.findLast((row) => row.gemessen_am === heute())?.kg
        ?? '',
      ),
    },
    recovery: { title: 'Erholung protokollieren', markup: recoveryEntryMarkup },
    logman: { title: 'LOGMAN-Import', markup: logmanEntryMarkup },
  };

  const bindEntryOverlay = (overlay) => {
    const closeAndRender = async () => {
      overlay.remove();
      try { await render(); }
      catch (error) { toast(error.message || 'COMP konnte nicht aktualisiert werden'); }
    };
    const withBusySubmit = async (form, action) => {
      const submit = form.querySelector('button[type="submit"]');
      if (submit) submit.disabled = true;
      try { await action(); }
      finally { if (submit?.isConnected) submit.disabled = false; }
    };
    const weightForm = overlay.querySelector('[data-weight-form]');
    if (weightForm) weightForm.onsubmit = async (event) => {
      event.preventDefault();
      await withBusySubmit(weightForm, async () => {
        const kg = zahl(weightForm.querySelector('[data-weight-value]').value);
        const date = weightForm.querySelector('[data-weight-date]').value;
        if (!kg || kg <= 0 || kg >= 500) return toast('Bitte ein gültiges Gewicht eintragen');
        const isNew = !state.weights.some((row) => row.gemessen_am === date);
        const { error } = await supabase.from('weights').upsert({ user_id: userId, gemessen_am: date, kg }, { onConflict: 'user_id,gemessen_am' });
        if (error) return toast('Gewicht konnte nicht gespeichert werden');
        notifyHomeCountsChanged();
        if (isNew) notifyCoinBalanceChanged();
        toast(isNew ? 'Gewicht gespeichert · +1 CAPCOIN' : 'Gewicht aktualisiert');
        await closeAndRender();
      });
    };

    const waistForm = overlay.querySelector('[data-waist-form]');
    if (waistForm) waistForm.onsubmit = async (event) => {
      event.preventDefault();
      await withBusySubmit(waistForm, async () => {
        const cm = zahl(waistForm.querySelector('[data-waist-value]').value);
        const date = waistForm.querySelector('[data-waist-date]').value;
        if (!cm || cm < 30 || cm > 250) return toast('Bitte einen gültigen Taillenumfang eintragen');
        const isNew = !state.waists.some((row) => row.gemessen_am === date);
        const { error } = await supabase.from('waist_measurements').upsert({ user_id: userId, gemessen_am: date, cm, standardisiert: waistForm.querySelector('[data-waist-standard]').checked }, { onConflict: 'user_id,gemessen_am' });
        if (error) return toast('Taillenumfang konnte nicht gespeichert werden');
        if (isNew) notifyCoinBalanceChanged();
        toast(isNew ? 'Taillenumfang gespeichert · +1 CAPCOIN' : 'Taillenumfang aktualisiert');
        await closeAndRender();
      });
    };

    const skinfoldForm = overlay.querySelector('[data-skinfold-form]');
    if (skinfoldForm) {
      const skinfoldDate = skinfoldForm.querySelector('[data-skinfold-date]');
      const skinfoldWeight = skinfoldForm.querySelector('[data-skinfold-weight]');
      const skinfoldHeight = skinfoldForm.querySelector('[data-skinfold-height]');
      skinfoldDate.onchange = () => {
        const existing = state.skinfolds.findLast((row) => row.gemessen_am === skinfoldDate.value);
        const exactWeight = existing?.gewicht_kg
          ?? state.weights.findLast((row) => row.gemessen_am === skinfoldDate.value)?.kg;
        skinfoldWeight.value = exactWeight == null ? '' : String(exactWeight).replace('.', ',');
        if (existing?.groesse_cm != null) skinfoldHeight.value = String(existing.groesse_cm).replace('.', ',');
        skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => {
          const value = existing?.falten?.[input.dataset.fold];
          input.value = value == null ? '' : String(value).replace('.', ',');
        });
        updateSkinfold();
      };
      const updateSkinfold = () => {
        const values = {};
        skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => {
          const value = zahl(input.value);
          if (value != null && value >= 0) values[input.dataset.fold] = value;
        });
        const complete = FALTEN.filter(([key]) => values[key] != null).length;
        const total = summe(values);
        const message = `${complete} von ${FALTEN.length} Falten eingetragen`;
        skinfoldForm.querySelector('[data-skinfold-quality]').innerHTML = `${escapeHtml(message)}${total != null ? ` · <b>${display(total)} mm</b> Summe` : ''}`;
        skinfoldForm.querySelector('button[type="submit"]').disabled = complete === 0;
        return { values, complete };
      };
      skinfoldForm.querySelectorAll('[data-fold]').forEach((input) => { input.oninput = updateSkinfold; });
      skinfoldDate.onchange();
      const foldInputs = [...skinfoldForm.querySelectorAll('[data-fold]')];
      foldInputs.forEach((input, index) => {
        input.onkeydown = (event) => {
          if (event.key !== 'Enter') return;
          event.preventDefault();
          const next = foldInputs[index + 1];
          if (next) {
            next.focus({ preventScroll: true });
            next.scrollIntoView({ block: 'center', behavior: 'smooth' });
          } else {
            input.blur();
          }
        };
      });
      skinfoldForm.onsubmit = async (event) => {
        event.preventDefault();
        await withBusySubmit(skinfoldForm, async () => {
          const { values, complete } = updateSkinfold();
          if (complete === 0) return toast('Bitte mindestens eine Hautfalte eintragen');
          const date = skinfoldForm.querySelector('[data-skinfold-date]').value;
          const groesseCm = zahl(skinfoldForm.querySelector('[data-skinfold-height]').value);
          if (groesseCm == null || groesseCm < 100 || groesseCm > 250) return toast('Bitte eine Körpergröße zwischen 100 und 250 cm eintragen');
          const gewichtKg = zahl(skinfoldForm.querySelector('[data-skinfold-weight]').value);
          if (gewichtKg == null || gewichtKg <= 0 || gewichtKg >= 500) return toast('Bitte das Körpergewicht bei dieser Messung eintragen');
          const isNew = !state.skinfolds.some((row) => row.gemessen_am === date);
          const standardisiert = skinfoldForm.querySelector('[data-skinfold-standard]').checked;
          const record = skinfoldRecord({ userId, date, values, standardisiert, groesseCm, gewichtKg });
          const { error } = await supabase.from('skinfolds').upsert(record, { onConflict: 'user_id,gemessen_am' });
          if (error) return toast(`Messung konnte nicht gespeichert werden: ${error.message}`);
          notifyHomeCountsChanged();
          if (isNew) notifyCoinBalanceChanged();
          const status = complete === FALTEN.length ? 'Hautfaltenmessung' : `Unvollständige Messung (${complete}/${FALTEN.length})`;
          toast(isNew ? `${status} gespeichert · +1 CAPCOIN` : `${status} aktualisiert`);
          await closeAndRender();
        });
      };
    }

    const checkinForm = overlay.querySelector('[data-bodycomp-checkin]');
    if (checkinForm) checkinForm.onsubmit = async (event) => {
      event.preventDefault();
      await withBusySubmit(checkinForm, async () => {
        const form = event.currentTarget;
        const { error } = await supabase.from('bodycomp_checkins').upsert({ user_id: userId, checkin_date: form.querySelector('[data-checkin-date]').value, recovery: Number(form.querySelector('[data-checkin-recovery]').value), mood: Number(form.querySelector('[data-checkin-mood]').value), hunger: Number(form.querySelector('[data-checkin-hunger]').value), illness: form.querySelector('[data-checkin-illness]').checked, travel: form.querySelector('[data-checkin-travel]').checked, unusual_meals: form.querySelector('[data-checkin-unusual]').checked }, { onConflict: 'user_id,checkin_date' });
        if (error) return toast('Check-in konnte nicht gespeichert werden');
        toast('Erholung protokolliert');
        await closeAndRender();
      });
    };

    const importInput = overlay.querySelector('[data-logman-import]');
    if (importInput) importInput.onchange = async (event) => {
      const status = overlay.querySelector('[data-logman-status]');
      const file = event.target.files?.[0];
      if (!file) return;
      try {
        const parsed = JSON.parse(await file.text());
        const rows = parseLogmanExport(parsed).map((row) => ({ ...row, user_id: userId }));
        if (!rows.length) throw new Error('Keine vergleichbaren HEAVYS-/MIDDLES-Werte gefunden.');
        const { error } = await supabase.from('logman_performance').upsert(rows, { onConflict: 'user_id,performed_on,exercise,category' });
        if (error) throw error;
        status.textContent = `${rows.length} Leistungswerte importiert.`;
        toast('LOGMAN-Leistung importiert');
        await closeAndRender();
      } catch (error) {
        status.textContent = error.message || 'Import fehlgeschlagen.';
      }
    };
    requestAnimationFrame(() => overlay.querySelector('input:not([type="checkbox"]),select')?.focus({ preventScroll: true }));
  };

  const openEntryOverlay = (kind) => {
    const config = entryOptions[kind];
    if (!config) return;
    const overlay = createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-body-entry-overlay]',
      className: 'body-entry-overlay',
      sheetClassName: `body-entry-sheet body-entry-sheet-${kind}`,
      ariaLabel: config.title,
      markup: `<header><h2>${config.title}</h2><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header><div class="body-entry-content">${config.markup()}</div>`,
    });
    overlay.dataset.bodyEntryOverlay = '';
    bindEntryOverlay(overlay);
  };

  const openFaltenDetail = (slug) => {
    createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-falten-detail-overlay]',
      className: 'body-entry-overlay falten-detail-overlay',
      sheetClassName: 'body-entry-sheet falten-detail-sheet',
      ariaLabel: `Falten-Details: ${hautfaltenData.falten[slug]?.label || slug}`,
      markup: faltenDetailMarkup(slug, state),
    }).dataset.faltenDetailOverlay = '';
  };

  const openYpsiPriority = (groupId) => {
    const recentSleep = state.sleep.slice(-7);
    const average = (values) => values.length ? values.reduce((total, value) => total + value, 0) / values.length : null;
    const plan = buildSkinfoldPlan(state.skinfolds, state.settings.calculation_basis, {
      recentEnergy: average(recentSleep.map((row) => Number(row.energy)).filter(Number.isFinite)),
      recentSleep: average(recentSleep.map((row) => Number(row.quality)).filter(Number.isFinite)),
    });
    const priority = plan?.priorities.find((item) => item.id === groupId);
    if (!priority) return;
    createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-ypsi-priority-overlay]',
      className: 'body-entry-overlay falten-detail-overlay ypsi-priority-overlay',
      sheetClassName: 'body-entry-sheet falten-detail-sheet ypsi-priority-sheet',
      ariaLabel: `YPSI-Priorität ${priority.priority}: ${priority.label}`,
      markup: ypsiPriorityDetailMarkup(priority),
    }).dataset.ypsiPriorityOverlay = '';
  };

  const openBraverman = () => {
    let test = bravermanState();
    const overlay = createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-braverman-overlay]',
      className: 'body-entry-overlay falten-detail-overlay braverman-overlay',
      sheetClassName: 'body-entry-sheet falten-detail-sheet braverman-sheet',
      ariaLabel: 'Braverman-Defizitprofil',
      markup: '',
    });
    overlay.dataset.bravermanOverlay = '';
    const sheet = overlay.querySelector('.braverman-sheet');
    const positions = bravermanPositions();
    const persist = () => setPreference(BRAVERMAN_PREFERENCE, test, { syncDelay: 0 });
    const show = () => {
      const isComplete = bravermanComplete(test.answers);
      sheet.innerHTML = isComplete ? bravermanResultMarkup(test, { sheet: true }) : bravermanQuestionMarkup(test);
      sheet.scrollTop = 0;
      sheet.querySelectorAll('[data-braverman-answer]').forEach((button) => {
        button.onclick = () => {
          const currentIndex = positions.findIndex((position) => position.type === test.currentType && position.index === test.currentIndex);
          const position = positions[Math.max(0, currentIndex)];
          const value = button.dataset.bravermanAnswer === 'true';
          const answers = { ...test.answers, [position.type]: [...(test.answers[position.type] || [])] };
          answers[position.type][position.index] = value;
          const riskAnswer = value && position.type === 'serotonin' && [19, 20].includes(position.index);
          const next = positions[currentIndex + 1];
          test = {
            ...test,
            answers,
            safetyNotice: test.safetyNotice || riskAnswer,
            currentType: next?.type || position.type,
            currentIndex: next?.index ?? position.index,
          };
          if (bravermanComplete(answers)) test.completedAt = new Date().toISOString();
          persist();
          show();
        };
      });
      const previous = sheet.querySelector('[data-braverman-prev]');
      if (previous) previous.onclick = () => {
        const currentIndex = positions.findIndex((position) => position.type === test.currentType && position.index === test.currentIndex);
        const target = positions[Math.max(0, currentIndex - 1)];
        test = { ...test, currentType: target.type, currentIndex: target.index };
        persist();
        show();
      };
      const pause = sheet.querySelector('[data-braverman-pause]');
      if (pause) pause.onclick = async () => { persist(); overlay.remove(); await render(); };
      const dismissSafety = sheet.querySelector('[data-dismiss-safety]');
      if (dismissSafety) dismissSafety.onclick = () => { test = { ...test, safetyNotice: false }; persist(); show(); };
      const reset = sheet.querySelector('[data-braverman-reset]');
      if (reset) reset.onclick = () => {
        if (!confirm('Braverman-Test wirklich neu starten? Das bisherige Ergebnis wird ersetzt.')) return;
        test = emptyBravermanState();
        persist();
        show();
      };
    };
    overlay.addEventListener('click', (event) => {
      if (event.target.closest('[data-close]')) requestAnimationFrame(() => render());
    });
    show();
  };

  const openAddMenu = () => {
    const overlay = createSpecialDexOverlay({
      colorScope: 'body',
      replaceSelector: '[data-body-add-overlay]',
      className: 'body-add-overlay',
      sheetClassName: 'body-add-sheet',
      ariaLabel: 'Messung hinzufügen',
      markup: `<header><h2>Messung hinzufügen</h2><button type="button" data-close aria-label="Schließen">${materialIconMarkup('close')}</button></header>
        <div class="kategorie-sheet-menu body-add-menu">
          <button type="button" data-body-add="weight">${materialIconMarkup('monitor_weight')}<span><b>Gewicht</b><small>Neue Wiegung eintragen</small></span></button>
          <button type="button" data-body-add="waist">${materialIconMarkup('measuring_tape')}<span><b>Taillenumfang</b><small>Umfang dokumentieren</small></span></button>
          <button type="button" data-body-add="skinfold">${materialIconMarkup('body_fat')}<span><b>13-Falten-Messung</b><small>Geführte Messung starten</small></span></button>
          <button type="button" data-body-add="recovery">${materialIconMarkup('favorite')}<span><b>Erholungs-Check-in</b><small>Erholung, Stimmung und Hunger</small></span></button>
          <button type="button" data-body-add="logman">${materialIconMarkup('upload_file')}<span><b>LOGMAN-Import</b><small>Leistungsdaten ergänzen</small></span></button>
        </div>`,
    });
    overlay.dataset.bodyAddOverlay = '';
    overlay.querySelectorAll('[data-body-add]').forEach((button) => {
      button.onclick = () => {
        const kind = button.dataset.bodyAdd;
        overlay.remove();
        openEntryOverlay(kind);
      };
    });
  };

  const bind = () => {
    const infoButton = container.querySelector('.body-analysis-info');
    const infoHelp = container.querySelector('.body-analysis-help');
    infoButton.onclick = () => {
      const open = infoHelp.hidden;
      infoHelp.hidden = !open;
      infoButton.setAttribute('aria-expanded', String(open));
    };
    const thresholdForm = container.querySelector('[data-bodycomp-thresholds]');
    if (thresholdForm) thresholdForm.onsubmit = async (event) => { event.preventDefault(); const form = event.currentTarget; const stableLoss = zahl(form.querySelector('[data-threshold-stable-loss]').value); const slowLoss = zahl(form.querySelector('[data-threshold-slow-loss]').value); const stableGain = zahl(form.querySelector('[data-threshold-stable-gain]').value); const slowGain = zahl(form.querySelector('[data-threshold-slow-gain]').value); if (!(stableLoss > 0 && slowLoss > stableLoss && stableGain > 0 && slowGain > stableGain)) return toast('Bitte aufsteigende, positive Prozentgrenzen eintragen'); const bodycomp_thresholds = { stableLoss: -stableLoss, slowLoss: -slowLoss, stableGain, slowGain }; const { error } = await supabase.from('nutrition_settings').upsert({ user_id: userId, bodycomp_thresholds }, { onConflict: 'user_id' }); if (error) return toast('Orientierungsbereiche konnten nicht gespeichert werden'); toast('Orientierungsbereiche gespeichert'); await render(); };
    const settings = container.querySelector('[data-skinfold-settings]');
    if (settings) {
      settings.innerHTML = `<div class="mess-einst body-reminder-settings"><label class="switchline mess-erinnerung-switch"><input type="checkbox" data-reminder-active${profile.falten_erinnerung ? ' checked' : ''}><i class="switchline-track"></i><span>Erinnerung aktiv</span></label><label class="mess-zeile"><span>alle</span><select class="input compact-input" data-reminder-weeks>${[2,3,4].map((weeks) => `<option value="${weeks}"${profile.falten_intervall_wochen === weeks ? ' selected' : ''}>${weeks} Wochen</option>`).join('')}</select></label><label class="mess-zeile"><span>um</span><input class="input compact-input" type="time" value="${String(profile.falten_uhrzeit || '08:00').slice(0,5)}" data-reminder-time></label></div>`;
      settings.querySelectorAll('input,select').forEach((field) => { field.onchange = async () => { const values = { falten_erinnerung: settings.querySelector('[data-reminder-active]').checked, falten_intervall_wochen: Number(settings.querySelector('[data-reminder-weeks]').value), falten_uhrzeit: settings.querySelector('[data-reminder-time]').value, zeitzone: Intl.DateTimeFormat().resolvedOptions().timeZone || 'Europe/Berlin' }; const { error } = await supabase.from('profiles').update(values).eq('id', userId); if (error) return toast('Einstellung nicht gespeichert'); Object.assign(profile, values); onProfileUpdated?.(profile); toast('Erinnerung gespeichert'); }; });
    }
    const resetConfig = {
      weights: { table: 'weights', label: 'alle Gewichtswerte', toast: 'Gewichtsverlauf zurückgesetzt' },
      skinfolds: { table: 'skinfolds', label: 'alle 13-Falten-Messungen', toast: '13-Falten-Werte zurückgesetzt' },
      waist: { table: 'waist_measurements', label: 'alle Taillenmessungen', toast: 'Taillenumfang zurückgesetzt' },
      logman: { table: 'logman_performance', label: 'alle importierten LOGMAN-Leistungsdaten', toast: 'LOGMAN-Importe zurückgesetzt' },
    };
    container.querySelectorAll('[data-falten-detail]').forEach((button) => {
      button.onclick = () => openFaltenDetail(button.dataset.faltenDetail);
    });
    container.querySelectorAll('[data-ypsi-priority]').forEach((button) => {
      button.onclick = () => openYpsiPriority(button.dataset.ypsiPriority);
    });
    container.querySelectorAll('[data-braverman-open]').forEach((button) => {
      button.onclick = openBraverman;
    });
    container.querySelectorAll('[data-reset-body]').forEach((button) => {
      button.onclick = async () => {
        const config = resetConfig[button.dataset.resetBody];
        if (!config || !confirm(`Wirklich ${config.label} löschen?`)) return;
        const { error } = await supabase.from(config.table).delete().eq('user_id', userId);
        if (error) return toast('Daten konnten nicht gelöscht werden');
        notifyHomeCountsChanged();
        toast(config.toast);
        await render();
      };
    });
  };
  container.innerHTML = '<div class="wrap"><section class="card"><p>COMP wird geladen …</p></section></div>';
  try {
    await render();
  } catch (error) {
    if (!signal?.aborted) container.innerHTML = `<div class="wrap"><section class="card"><p class="msg err">COMP konnte nicht geladen werden.<br><small>${escapeHtml(error.message)}</small></p></section></div>`;
  }
  subscribeToTablesChanges({
    tables: ['weights', 'skinfolds', 'waist_measurements', 'bodycomp_checkins', 'logman_performance', 'nutrition_settings'],
    signal,
    onChange: () => {
      if (document.querySelector('[data-body-entry-overlay]')) {
        renderQueued = true;
        return;
      }
      render();
    },
  });
  return {
    meta: `${state?.weights?.length || 0} Wiegungen`,
    openAddMenu,
  };
}
