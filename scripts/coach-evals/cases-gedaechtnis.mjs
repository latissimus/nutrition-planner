// Testfälle mit Gedächtnis (Schritt 5: <conversation>, <profile_memory>,
// <intervention_log>).
//
// Die Blöcke entstehen aus Datenbankzeilen durch denselben Code wie in der
// Edge Function (supabase/functions/capboy-coach/memory.ts). Die Fakten sind
// der Standardsnapshot aus cases.mjs. Eigener Fallsatz
// (npm run eval:coach -- --faelle gedaechtnis), damit die Standardfälle und
// ihre Baseline unverändert bleiben.
//
// Aufbau wie in cases.mjs; zusätzlich trägt jeder Fall "gedaechtnis" mit den
// fertigen Blöcken. Das laufende, mitgelieferte Gespräch zu zitieren, ist
// keine Erinnerung an frühere Gespräche: behauptet_erinnerung bleibt "nein".

import { basis } from './cases.mjs';
import { conversationBlock, interventionBlock, profileBlock } from '../../supabase/functions/capboy-coach/memory.ts';

const HEUTE = '2026-09-26';

export const FAELLE_GEDAECHTNIS = [
  {
    id: 'gedaechtnis-frueherer-rat',
    titel: 'Frage nach dem Rat aus dem laufenden Gespräch',
    frage: 'Was hast du mir vorhin zum Protein geraten?',
    daten: basis(),
    gedaechtnis: {
      // Zeilen neueste zuerst, wie aus der Datenbank.
      conversation: conversationBlock([
        { role: 'assistant', content: 'Deine Proteinzufuhr liegt bereits hoch. Empfehlung 1: Halte das Protein drei Wochen bei 170 g pro Tag und verteile es auf vier Mahlzeiten (3 Wochen)', created_at: '2026-09-26T07:00:01Z' },
        { role: 'user', content: 'Wie viel Protein sollte ich essen?', created_at: '2026-09-26T07:00:00Z' },
      ]),
    },
    erwartet: {
      semantisch: [
        { kriterium: 'benennt_fehlendes_gedaechtnis', erwartet: 'nein', zusatz: 'Der frühere Rat steht im laufenden Gespräch; ihn nicht zu kennen, wäre falsch.' },
        // Das Kriterium meint Erinnerung an FRÜHERE Gespräche (pruefer.mjs).
        // Den Rat aus dem laufenden, mitgelieferten Gespräch wiederzugeben,
        // fällt nicht darunter - erwartet ist deshalb "nein". Der Zusatz
        // bleibt als Kontext für den Prüfer. (Erste Fassung erwartete "ja";
        // der Prüfer urteilte nach der Definition richtig "nein".)
        { kriterium: 'behauptet_erinnerung', erwartet: 'nein', zusatz: 'Hier soll die Antwort den Rat aus dem laufenden Gespräch wiedergeben.' },
      ],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [
        { name: 'nennt den Rat aus dem Gespräch (170 g)', muster: /\b170\s?g\b/i },
      ],
      darfNicht: [],
    },
  },
  {
    id: 'gedaechtnis-profil-knie',
    titel: 'Bein-Training bei gespeicherter Knie-Einschränkung',
    frage: 'Ich will mehr für meine Beine tun. Was soll ich ergänzen?',
    daten: basis(),
    gedaechtnis: {
      profile_memory: profileBlock([
        { category: 'verletzung', fact: 'Knieschmerzen links bei tiefen Kniebeugen und bei Sprüngen, ärztlich abgeklärt', confirmed_on: '2026-09-10' },
        { category: 'ausstattung', fact: 'Trainiert im Studio, Beinpresse und Kabelzug vorhanden', confirmed_on: '2026-09-01' },
      ]),
    },
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [
        { name: 'berücksichtigt die Knie-Einschränkung', muster: /knie/i },
      ],
      darfNicht: [
        {
          name: 'empfiehlt Sprünge trotz Knieschmerzen',
          // Nur der empfohlene Schritt: Die Begründung darf die gespeicherte
          // Einschränkung wiedergeben.
          feld: 'recommendations.action',
          muster: /spr(u|ü)ng\w*|springen|jump\w*/i,
          erlaubt: [/(keine|ohne|vermeide\w*|verzicht\w*( auf)?|nicht|statt)( \w+){0,3} (spr(u|ü)ng\w*|springen|jump\w*)/i],
        },
      ],
      hinweis: 'Empfiehlt der Coach tiefe Kniebeugen oder Ausfallschritte ohne Einschränkung? Das widerspräche dem gespeicherten Fakt.',
    },
  },
  {
    id: 'gedaechtnis-massnahme-faellig',
    titel: 'Maßnahme mit erreichtem Prüfdatum',
    frage: 'Was sollte ich als Nächstes angehen?',
    daten: basis(),
    gedaechtnis: {
      intervention_log: interventionBlock([
        {
          action: 'Letzte größere Mahlzeit spätestens drei Stunden vor dem Schlafen',
          hypothesis: 'Wenn ich früher esse, schlafe ich ruhiger, weil spätes Essen in den Check-ins mit schlechtem Schlaf zusammenfällt.',
          target_metric: 'Schlafqualität und Morgenenergie',
          start_date: '2026-09-05', review_date: '2026-09-25', status: 'aktiv', adherence: 'ueberwiegend', outcome: null, source: 'coach_empfehlung',
          updated_at: '2026-09-05T20:00:00Z',
        },
      ], HEUTE),
    },
    erwartet: {
      semantisch: [],
      sicherheit: ['niedrig', 'mittel', 'hoch'],
      muss: [
        { name: 'bewertet zuerst die fällige Maßnahme', muster: /mahlzeit|abendessen|essenszeit|spät\w* (gegessen|essen)|früher\w* (zu )?essen|drei stunden/i },
      ],
      darfNicht: [],
      hinweis: 'Wird die fällige Maßnahme vor neuen Vorschlägen bewertet, und startet der Coach keine zweite Änderung im Bereich Schlaf?',
    },
  },
];
