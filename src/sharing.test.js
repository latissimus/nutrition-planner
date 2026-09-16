import { describe, expect, it } from 'vitest';
import { chooseSharedSpace, shareStateLabel } from './sharing.js';

describe('chooseSharedSpace', () => {
  it('verwendet ohne eingehende Freigabe den eigenen Bereich', () => {
    expect(chooseSharedSpace('user-1', [])).toEqual({ ownerId: 'user-1', isShared: false, shareId: null });
  });

  it('verwendet beim Partner den Bereich des Eigentümers', () => {
    expect(chooseSharedSpace('partner', [{ id: 'share-1', owner_id: 'owner', partner_id: 'partner' }]))
      .toEqual({ ownerId: 'owner', isShared: true, shareId: 'share-1' });
  });
});

/* Die Zeile unter "Mit Partner teilen" muss ohne Öffnen des Sheets sagen,
   ob und in welche Richtung der Bereich geteilt ist. */
describe('shareStateLabel', () => {
  it('nennt den ungeteilten Zustand', () => {
    expect(shareStateLabel({ fehler: false, eigene: [], empfangen: false }))
      .toBe('Noch mit niemandem geteilt');
  });

  it('nennt bei genau einer Freigabe die E-Mail', () => {
    expect(shareStateLabel({ fehler: false, eigene: [{ partner_email: 'anna@beispiel.de' }], empfangen: false }))
      .toBe('Freigegeben für anna@beispiel.de');
  });

  it('zählt ab zwei Freigaben', () => {
    expect(shareStateLabel({
      fehler: false,
      eigene: [{ partner_email: 'a@b.de' }, { partner_email: 'c@d.de' }],
      empfangen: false,
    })).toBe('Freigegeben für 2 Personen');
  });

  it('unterscheidet die Gegenrichtung', () => {
    // Als Empfänger sind die eigenen Freigaben leer – ohne diesen Zweig
    // stünde dort faelschlich "Noch mit niemandem geteilt".
    expect(shareStateLabel({ fehler: false, eigene: [], empfangen: true }))
      .toBe('Wird für dich freigegeben');
  });

  it('meldet einen Fehlschlag, statt Freigaben zu verschweigen', () => {
    expect(shareStateLabel({ fehler: true, eigene: [], empfangen: false }))
      .toBe('Freigaben konnten nicht geladen werden');
    expect(shareStateLabel(null)).toBe('Freigaben konnten nicht geladen werden');
  });
});
