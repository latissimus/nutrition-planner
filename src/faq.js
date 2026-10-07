// FAQ: kurz erklärt, was jede Seite macht, wie CAPBOY rechnet und was die KI
// darf. Aufbau wie das Profil (dieselben Karten), Fragen als ruhige Liste im
// Stil der LOGMAN-FAQ. Die Zahlen in den Antworten stammen aus dem Code
// (bodyComposition.js, nutrition.js, logmanImport.js, sleep.js, coinDex.js,
// capboy-coach); wer dort eine Regel ändert, passt sie hier mit an.

import { materialIconMarkup } from './categoryIcons.js';

export const FAQ = [
  {
    titel: 'Grundsätzliches',
    thema: 'App, KI und ausgeblendete Seiten',
    fragen: [
      ['Rechnet die App oder die KI?',
        '<p>Alle Zahlen rechnet die App nach festen Regeln: Durchschnitte, Trends, Ziele und Veränderungen. Die KI rechnet nichts selbst. Sie liest die fertigen Ergebnisse, ordnet sie ein und schlägt nächste Schritte vor.</p>'],
      ['Warum zählen Trends mehr als einzelne Tage?',
        '<p>Gewicht, Schlaf und Messwerte schwanken von Tag zu Tag, etwa durch Wasser, Salz oder eine kurze Nacht. CAPBOY glättet deshalb Verläufe und bewertet mehrere Wochen gemeinsam.</p>'],
      ['Was passiert, wenn ich eine Seite ausblende?',
        '<p>Unter <b>Menüband anpassen</b> blendest du Seiten aus. Blendest du <b>TRACKER</b>, <b>ROUTINEN</b> oder <b>SCHLAF</b> aus, lässt die KI diesen Bereich ganz weg: keine Bewertung und keine Hinweise auf fehlende Einträge. Deine Daten bleiben gespeichert.</p>'],
    ],
  },
  {
    titel: 'TRACKER',
    thema: 'Kalorienziel, Nährwerte, Erinnerungen',
    fragen: [
      ['Wie entsteht mein Kalorienziel?',
        '<p>CAPBOY schätzt deinen Ruheumsatz mit der Mifflin-St.-Jeor-Formel aus Alter, Größe, Gewicht und Berechnungsbasis. Mal deinem Aktivitätsfaktor (1,4 bis 2,0) ergibt das den Erhaltungsbedarf.</p><p>Je nach Ziel kommen −300, +200 oder +350 kcal dazu, nie weniger als 1.200 kcal. Ein eigenes Kalorienziel geht immer vor.</p>'],
      ['Wie werden Protein, Fett und Kohlenhydrate verteilt?',
        '<p>Protein: 1,8 g pro kg Körpergewicht. Fett: 0,8 g pro kg. Den Rest deines Kalorienziels füllen die Kohlenhydrate.</p>'],
      ['Was macht die Kalorien-Kalibrierung?',
        '<p>Sie vergleicht, was du im Schnitt einträgst, mit deinem geglätteten Gewichtstrend. Rechnerisch entspricht 1 kg etwa 7.700 kcal. Daraus ergibt sich dein tatsächlicher Erhaltungsbedarf.</p><p>Dafür braucht es mindestens 21 Tage, an 80 % der Tage Einträge und mindestens drei Wiegungen pro Woche.</p>'],
      ['Ändert CAPBOY mein Ziel von selbst?',
        '<p>Nein. Ein Vorschlag ändert das Ziel um höchstens 100 kcal, frühestens eine Woche nach der letzten Anpassung, und nur, wenn du ihn übernimmst. Im BodyComp-Modus müssen außerdem Körpermaße, Leistung und Erholung den Vorschlag stützen.</p>'],
      ['Woher kommen die Nährwerte?',
        '<p>Grundnahrungsmittel aus dem Bundeslebensmittelschlüssel (BLS 4.0), Markenprodukte und Barcodes aus Open Food Facts. Prüf die Werte vor dem Speichern, besonders bei Markenprodukten.</p>'],
      ['Warum kommen keine Erinnerungen?',
        '<p>Erinnerungen schaltest du pro Mahlzeit oder Supplement ein. Auf dem iPhone kommen sie nur, wenn CAPBOY über <b>Zum Home-Bildschirm</b> installiert ist, von dort geöffnet wird und Mitteilungen erlaubt sind.</p>'],
    ],
  },
  {
    titel: 'COMP',
    thema: 'Gewicht, Hautfalten, Leistung, Gesamtbewertung',
    fragen: [
      ['Wie wird mein Gewichtstrend eingeordnet?',
        '<p>Der <b>7-Tage-Schnitt</b> glättet deine Wiegungen. Durch die geglätteten Werte der letzten 28 Tage legt CAPBOY eine Trendlinie und rechnet die Veränderung pro Woche in Prozent deines Gewichts.</p><p>Standard: bis ±0,15 % stabil, bis −0,5 % langsamer Verlust, mehr als −0,5 % zu schnell; bis +0,3 % langsame Zunahme, mehr als +0,3 % schnell. Die Grenzen kannst du in COMP ändern.</p>'],
      ['Wie sicher ist der Trend?',
        '<p>Das hängt davon ab, wie oft du dich wiegst: ab fünf Wiegungen pro Woche hoch, ab drei mittel, sonst niedrig.</p>'],
      ['Was ist die Falten-Summe?',
        '<p>Die Summe der zehn Falten von Kinn bis Wade in Millimetern. Sie zeigt den Verlauf des Unterhautfetts, keinen exakten Körperfettanteil.</p>'],
      ['Wann gilt eine Veränderung als bestätigt?',
        '<p>Wenn die letzten drei standardisierten Messungen in dieselbe Richtung gehen und die Veränderung groß genug ist: mindestens 2 mm bei der Falten-Summe, 0,5 cm bei der Taille. So wird ein einzelner Messfehler nicht zum Trend.</p>'],
      ['Wie entsteht die Körperfett-Schätzung?',
        '<p>Nach der YPSI-Formel aus deinen Unterlagen: Aus Größe und Gewicht ergibt sich eine erwartete Falten-Summe, die mit deiner gemessenen verglichen wird. Dafür braucht es alle zehn Summenfalten, die Größe und das Gewicht dieser Messung. Die Schätzung taugt für den Verlauf, nicht als medizinischer Messwert.</p>'],
      ['Wie funktioniert das Hautfalten-Ranking?',
        '<p>Jede Falte wird mit dem Referenzwert aus deinen Unterlagen verglichen, getrennt nach Berechnungsbasis. Die Falte mit der größten Abweichung steht oben. Die Hinweise dazu kommen regelbasiert aus den Seminarunterlagen, nicht von der KI.</p>'],
      ['Wie wird meine Kraft aus LOGMAN berechnet?',
        '<p>CAPBOY holt deine Sätze automatisch aus LOGMAN, sobald die Verbindung im Profil steht; der Import einer Exportdatei bleibt als Rückfall. Pro Übung und Einheit zählt der beste Satz als geschätztes Maximalgewicht (1RM): Gewicht × (1 + Wiederholungen ÷ 30). Es zählen HEAVYS und feste MIDDLES-Übungen, keine PUMPS.</p><p>Der Leistungstrend ist die durchschnittliche Veränderung je Übung vom ersten zum letzten Wert. Liegt sie über ±1 %, gilt er als steigend oder fallend.</p>'],
      ['Was bedeutet der Gesamtstatus?',
        '<p>Der Ring zählt, welche von vier Signalen vorliegen: Gewicht, Falten-Summe, Taille und Leistung. Den Status bildet die App aus Gewichtstrend, bestätigten Veränderungen, Leistung und Erholung (Schlafqualität, Morgenenergie, Erholungswerte). Eine Aussage gibt es erst nach etwa drei Wochen vergleichbarer Daten.</p>'],
      ['Wo bewertet die KI meine Werte?',
        '<p>Nicht mehr auf der COMP-Seite: COMP zeigt die Werte, die die App berechnet. Eingeordnet werden sie jeden Abend um 21 Uhr im Coaching und montags im Wochen-Coaching, beides im Chat. Die optionalen Hinweise aus deinen Seminarunterlagen stehen weiter auf COMP; sie kommen regelbasiert, nicht von der KI.</p>'],
    ],
  },
  {
    titel: 'SCHLAF',
    thema: 'Schlafdauer, Verlauf, Zusammenhänge',
    fragen: [
      ['Wie wird die Schlafdauer berechnet?',
        '<p>Von der Zubettgehzeit bis zur Aufwachzeit, auch über Mitternacht hinweg.</p>'],
      ['Was zeigt der 7-Tage-Verlauf?',
        '<p>Mittelwerte deiner bis zu sieben neuesten Morgen-Check-ins für Dauer, Qualität und Energie. Die Abweichung zeigt, wie weit deine Zubettgehzeiten im Schnitt von deiner üblichen Zeit entfernt lagen.</p>'],
      ['Wie findet CAPBOY Zusammenhänge?',
        '<p>Ab sechs Check-ins vergleicht die App bis zu 30 Nächte mit und ohne einen Tag wie „Alkohol“ oder „Spätes Koffein“. Dafür braucht es je mindestens drei Nächte und einen Unterschied von mindestens 0,4 Punkten. Das sind beobachtete Muster, keine Ursachen.</p>'],
    ],
  },
  {
    titel: 'ROUTINEN und CAPCOINS',
    thema: 'Fortschritt und Belohnungen',
    fragen: [
      ['Was zeigt der Ring bei ROUTINEN?',
        '<p>Wie viele der für heute geplanten Routinen erledigt sind. Jede Routine zählt pro geplantem Tag einmal.</p>'],
      ['Wie verdiene ich CAPCOINS?',
        '<p>Meditation 2 bis 12, Mobility 6 oder 10 und Spaziergang 8 bis 20 CAPCOINS, je nach Dauer. Eigene Routinen bringen, was du festlegst (0 bis 50, Standard 5). Dazu 3 für den Schlaf-Check-in am Morgen und 1 für jede neue Messung in COMP.</p>'],
      ['Wie löse ich CAPCOINS ein?',
        '<p>Du legst eigene Belohnungen mit Preis an. Reicht dein Kontostand, kannst du sie einlösen.</p>'],
    ],
  },
  {
    titel: 'Wissensseiten',
    thema: 'REZEPTE, ESSEN, TRAINING, SUPPS, MIND, EINKAUF',
    fragen: [
      ['Wofür sind diese Seiten?',
        '<p>Zum Sammeln: Rezepte und Wissen zu Ernährung, Training, Supplements, Motivation und Stress, jeweils mit Links, Bildern, Videos und Tonaufnahmen. Tags und Unterordner halten Ordnung. <b>EINKAUF</b> ist deine Einkaufsliste.</p>'],
      ['Wie funktioniert die Suche?',
        '<p>Die Lupe durchsucht deine Einträge in REZEPTE, ESSEN, TRAINING, SUPPS und MIND nach Titel, Text und Tags. Groß- und Kleinschreibung sowie Umlaute spielen keine Rolle. Hier ist keine KI beteiligt.</p>'],
    ],
  },
  {
    titel: 'Coach',
    thema: 'Die KI im Chat',
    fragen: [
      ['Was weiß der Coach über mich?',
        '<p>Bei jeder Frage bekommt er deine Kennzahlen der letzten sechs Wochen, einen Wochenverlauf über 12 Wochen, deine Ernährungseinträge der letzten 12 Tage, die offenen Punkte und sein Gedächtnis. Frühere Gespräche kennt er nur, wenn du eines fortsetzt.</p>'],
      ['Wohin gehen meine Daten?',
        '<p>Die Antworten schreibt ein Sprachmodell von OpenAI. Dafür werden deine Frage und die genannten Daten dorthin übertragen.</p>'],
      ['Was bedeutet „Webwissen einbeziehen“?',
        '<p>Der Coach darf zusätzlich im Web nach Fachwissen suchen und nennt dann seine Quellen. Ohne Haken antwortet er aus deinen Daten und deinen Seminarunterlagen.</p>'],
      ['Was sind die offenen Punkte beim Start?',
        '<p>Die App prüft die letzten 14 abgeschlossenen Tage: fehlende Einträge, fällige Messungen, Routinen, die seltener klappen als geplant, und Werte weit weg von einem sinnvollen Ziel.</p>'],
      ['Ist das medizinischer Rat?',
        '<p>Nein. Der Coach schätzt Training, Ernährung und Alltag ein. Bei Beschwerden oder Krankheit gehört die Frage in eine ärztliche Praxis.</p>'],
    ],
  },
  {
    titel: 'Coaching und Gedächtnis',
    thema: 'Abends, montags und was der Coach behält',
    fragen: [
      ['Was steht im Gedächtnis?',
        '<p>Fakten über dich, Maßnahmen mit Prüfdatum, deine Gespräche und die Wochenbilanzen. Du kannst alles ändern oder löschen.</p>'],
      ['Merkt sich der Coach Dinge von selbst?',
        '<p>Nein. Etwas landet nur im Gedächtnis, wenn du es übernimmst: mit <b>Merken</b> unter einer Antwort oder selbst auf der Gedächtnis-Seite.</p>'],
      ['Wie werden Maßnahmen geprüft?',
        '<p>Eine Maßnahme hat eine Zielgröße, zum Beispiel die Schlafdauer, eine erwartete Richtung und ein Prüfdatum. Ist es erreicht, vergleicht die App die Wochenwerte vor und nach dem Start, und der Coach bewertet das Ergebnis.</p>'],
      ['Was ist das Coaching um 21 Uhr?',
        '<p>Jeden Abend um 21 Uhr fasst der Coach deinen Tag zusammen, wenn es neue Daten gibt: Training aus LOGMAN, Schlaf, Ernährung, Körper und Erholung. Es steht als Karte im Chat; ein Briefumschlag am Coach-Symbol und Punkte an den betroffenen Seiten zeigen es an. Das kostet höchstens einen KI-Aufruf am Tag.</p>'],
      ['Was ist das Wochen-Coaching?',
        '<p>Montags um 21 Uhr kommt statt des Tages-Coachings die Bilanz der Woche: Vergleich mit der Vorwoche, Urteile zu fälligen Experimenten und eine Entscheidung zum Trainingsvolumen nach den LOGMAN-Regeln. Ob eine Änderung überhaupt erlaubt ist, rechnet die App; umstellen tust du sie selbst in LOGMAN.</p>'],
      ['Was ist der Wochenrückblick?',
        '<p>Von Sonntag bis Montag 21 Uhr steht im Chat ein freiwilliges Kärtchen: Wie gut liefen deine Maßnahmen, und war etwas besonders, etwa krank, unterwegs, Stress, wenig Schlaf, Feier oder Urlaub? Speichern kostet nichts; das Wochen-Coaching rechnet es mit ein. Eine solche Woche gilt als nicht repräsentativ, dann bleibt das Volumen unverändert.</p>'],
    ],
  },
];

export function faqMarkup(faq = FAQ) {
  const bereiche = faq.map((bereich) => `<details class="profile-abschnitt faq-bereich">
      <summary><span>${bereich.titel}</span><small>${bereich.thema}</small></summary>
      <div class="profile-abschnitt-inhalt faq-liste">${bereich.fragen.map(([frage, antwort]) => `
        <details class="faq-frage"><summary>${frage}</summary><div class="faq-antwort">${antwort}</div></details>`).join('')}
      </div>
    </details>`).join('');
  return `<div class="wrap pad-bottom profil-fixkopf faq-seite">
    <div class="profil-scrollinhalt">
      <header class="faq-kopf">
        <a class="faq-zurueck" href="#profile">${materialIconMarkup('arrow_back_ios', 'faq-zurueck-pfeil')}<span>Profil</span></a>
        <h1>FAQ</h1>
        <p>Kurz erklärt: was die Seiten machen, wie CAPBOY rechnet und was die KI darf.</p>
      </header>
      ${bereiche}
    </div>
  </div>`;
}

export function mountFaq(container) {
  container.classList.add('profil-fixkopf-view');
  container.innerHTML = faqMarkup();
}
