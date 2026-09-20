import { beforeEach, describe, expect, it, vi } from 'vitest';
import {
  HOECHSTALTER_MS, groesse, hole, istGehalten, leeren, schluessel, verwerfen,
} from './datenspeicher.js';

beforeEach(() => leeren());

describe('schluessel', () => {
  it('stellt den Bereich voran', () => {
    expect(schluessel('shopping', 'artikel')).toBe('shopping:artikel');
    expect(schluessel('reminders', 'ernaehrung', '2026-09-20')).toBe('reminders:ernaehrung:2026-09-20');
  });

  it('behandelt fehlende Teile als leer, statt "undefined" zu schreiben', () => {
    expect(schluessel('body', undefined)).toBe('body:');
    expect(schluessel('body', null)).toBe('body:');
  });
});

describe('hole', () => {
  it('lädt beim ersten Mal und hält den Wert danach', async () => {
    const laden = vi.fn().mockResolvedValue(['a']);
    expect(await hole('essen:x', laden)).toEqual(['a']);
    expect(await hole('essen:x', laden)).toEqual(['a']);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('bündelt gleichzeitige Aufrufe zu einer einzigen Anfrage', async () => {
    // Ohne das würden zwei Seiten, die dieselben Daten brauchen, doppelt laden.
    let aufloesen;
    const laden = vi.fn(() => new Promise((r) => { aufloesen = r; }));
    const beide = Promise.all([hole('essen:x', laden), hole('essen:x', laden)]);
    await new Promise((r) => setTimeout(r, 0));   // laden() startet im Mikrotask
    aufloesen(['einmal']);
    expect(await beide).toEqual([['einmal'], ['einmal']]);
    expect(laden).toHaveBeenCalledTimes(1);
  });

  it('merkt sich einen Fehlschlag nicht', async () => {
    const laden = vi.fn()
      .mockRejectedValueOnce(new Error('Netz weg'))
      .mockResolvedValue(['danach']);
    await expect(hole('essen:x', laden)).rejects.toThrow('Netz weg');
    expect(istGehalten('essen:x')).toBe(false);
    expect(await hole('essen:x', laden)).toEqual(['danach']);
  });

  it('lädt mit frisch:true neu, obwohl ein Wert vorliegt', async () => {
    const laden = vi.fn().mockResolvedValueOnce(['alt']).mockResolvedValueOnce(['neu']);
    await hole('essen:x', laden);
    expect(await hole('essen:x', laden, { frisch: true })).toEqual(['neu']);
    expect(laden).toHaveBeenCalledTimes(2);
  });

  it('lädt nach Ablauf des Höchstalters neu', async () => {
    const laden = vi.fn().mockResolvedValueOnce(['alt']).mockResolvedValueOnce(['neu']);
    vi.useFakeTimers();
    try {
      await hole('essen:x', laden);
      vi.setSystemTime(Date.now() + HOECHSTALTER_MS + 1000);
      expect(await hole('essen:x', laden)).toEqual(['neu']);
    } finally {
      vi.useRealTimers();
    }
  });
});

/* Dieselbe Bereichslogik wie bei den Änderungsereignissen: eine Speicherung
   im Einkauf darf die Rezeptdaten nicht mit wegwerfen. */
describe('verwerfen', () => {
  const fuellen = async () => {
    await hole('shopping:artikel', async () => 1);
    await hole('food-log:sammlungen', async () => 2);
    await hole('food-log:eintraege', async () => 3);
    await hole('body:messwerte', async () => 4);
  };

  it('trifft nur den genannten Bereich', async () => {
    await fuellen();
    verwerfen('food-log');
    expect(istGehalten('food-log:sammlungen')).toBe(false);
    expect(istGehalten('food-log:eintraege')).toBe(false);
    expect(istGehalten('shopping:artikel')).toBe(true);
    expect(istGehalten('body:messwerte')).toBe(true);
  });

  it('nimmt auch eine Liste von Bereichen', async () => {
    await fuellen();
    verwerfen(['shopping', 'body']);
    expect(istGehalten('shopping:artikel')).toBe(false);
    expect(istGehalten('body:messwerte')).toBe(false);
    expect(istGehalten('food-log:sammlungen')).toBe(true);
  });

  it('verwirft ohne Angabe alles', async () => {
    await fuellen();
    verwerfen();
    expect(groesse()).toBe(0);
  });

  it('verwechselt keine Bereiche mit gemeinsamem Anfang', async () => {
    // "food" darf "food-log" nicht treffen.
    await hole('food-log:sammlungen', async () => 1);
    verwerfen('food');
    expect(istGehalten('food-log:sammlungen')).toBe(true);
  });

  it('stoppt auch eine noch laufende Anfrage als gehalten', async () => {
    let aufloesen;
    const p = hole('shopping:artikel', () => new Promise((r) => { aufloesen = r; }));
    await new Promise((r) => setTimeout(r, 0));   // laden() startet im Mikrotask
    verwerfen('shopping');
    aufloesen(['spaet']);
    await p;
    // Nach dem Verwerfen darf das spaete Ergebnis nicht als frisch gelten.
    const laden = vi.fn().mockResolvedValue(['neu']);
    expect(await hole('shopping:artikel', laden)).toEqual(['neu']);
  });
});
