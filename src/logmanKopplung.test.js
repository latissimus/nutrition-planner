import { beforeEach, describe, expect, it, vi } from 'vitest';

vi.mock('./supabase.js', () => ({ supabase: {} }));
const { logmanNeuAufbauen } = await import('./logmanKopplung.js');

// Kleiner Speicher-Ersatz: „verbunden“ liegt im localStorage.
let speicher;
beforeEach(() => {
  speicher = new Map();
  globalThis.localStorage = {
    getItem: (key) => (speicher.has(key) ? speicher.get(key) : null),
    setItem: (key, value) => speicher.set(key, String(value)),
    removeItem: (key) => speicher.delete(key),
  };
});

describe('LOGMAN: Neuabgleich nach dem Löschen manueller Importe', () => {
  it('baut den Stand neu auf (erzwingen und neu), damit ersetzte Abgleich-Zeilen zurückkommen', async () => {
    const aufruf = vi.fn(async () => ({ verbunden: true, ergebnis: 'neu', leistungswerte: 12 }));
    const antwort = await logmanNeuAufbauen({ aufruf });
    expect(aufruf).toHaveBeenCalledWith({ aktion: 'abgleichen', erzwingen: true, neu: true });
    expect(antwort.leistungswerte).toBe(12);
    expect(speicher.get('capboy:logman-verbunden')).toBe('ja');
  });

  it('ruft ohne Kopplung gar nicht erst an', async () => {
    speicher.set('capboy:logman-verbunden', 'nein');
    const aufruf = vi.fn();
    expect(await logmanNeuAufbauen({ aufruf })).toEqual({ verbunden: false });
    expect(aufruf).not.toHaveBeenCalled();
  });

  it('gibt einen Fehler weiter, damit COMP darauf hinweisen kann', async () => {
    const aufruf = vi.fn(async () => { throw new Error('nicht erreichbar'); });
    await expect(logmanNeuAufbauen({ aufruf })).rejects.toThrow('nicht erreichbar');
  });
});
