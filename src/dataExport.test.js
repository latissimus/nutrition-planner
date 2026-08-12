import { beforeEach, describe, expect, it, vi } from 'vitest';

const handlers = new Map();
const from = vi.fn((table) => {
  const state = { table, userId: '' };
  const query = {
    select: vi.fn(() => query),
    eq: vi.fn((_column, value) => { state.userId = value; return query; }),
    order: vi.fn(() => query),
    or: vi.fn(() => query),
    abortSignal: vi.fn(() => query),
    range: vi.fn(async (start, end) => handlers.get(table)?.({ start, end, userId: state.userId }) || { data: [], error: null }),
    then: (resolve) => resolve(handlers.get(table)?.({ start: 0, end: 499, userId: state.userId }) || { data: [], error: null }),
  };
  return query;
});

vi.mock('./supabase.js', () => ({ supabase: { from } }));
const { createFullDataExport, EXPORT_PAGE_SIZE, exportFileName } = await import('./dataExport.js');

describe('vollstaendiger Datenexport', () => {
  beforeEach(() => { handlers.clear(); from.mockClear(); });

  it('laedt Tabellen seitenweise ueber das Supabase-Limit hinaus', async () => {
    handlers.set('dex_entries', ({ start }) => ({
      data: start === 0
        ? Array.from({ length: EXPORT_PAGE_SIZE }, (_, id) => ({ id, image_path: id === 0 ? 'user/bild.jpg' : null }))
        : [{ id: EXPORT_PAGE_SIZE, audio_path: 'user/aufnahme.m4a' }],
      error: null,
    }));
    handlers.set('shared_spaces', () => ({ data: [], error: null }));

    const result = await createFullDataExport({
      session: { user: { id: 'user', email: 'test@example.com', created_at: '2026-01-01' } },
      profile: { full_name: 'Test' }, theme: 'retro',
    });

    expect(result.daten.dex_eintraege).toHaveLength(EXPORT_PAGE_SIZE + 1);
    expect(result.medien.dex_eintraege).toEqual(['user/bild.jpg', 'user/aufnahme.m4a']);
    expect(result.konto.email).toBe('test@example.com');
  });

  it('exportiert weder Push-Abos noch geheime Anmeldedaten', async () => {
    handlers.set('shared_spaces', () => ({ data: [], error: null }));
    const result = await createFullDataExport({ session: { user: { id: 'user' } } });
    expect(from).not.toHaveBeenCalledWith('push_subscriptions');
    expect(JSON.stringify(result)).not.toContain('access_token');
    expect(result.nicht_enthalten.join(' ')).toContain('Push-Abonnements');
  });

  it('bricht bei einer unvollstaendigen Tabelle ab statt eine falsche Vollstaendigkeit vorzugeben', async () => {
    handlers.set('weights', () => ({ data: null, error: { message: 'offline' } }));
    await expect(createFullDataExport({ session: { user: { id: 'user' } } }))
      .rejects.toThrow('weights: offline');
  });

  it('verwendet MUSCLEDEX als Dateinamen', () => {
    expect(exportFileName(new Date('2026-08-12T12:00:00Z'))).toBe('muscledex-export-2026-08-12.json');
  });
});
