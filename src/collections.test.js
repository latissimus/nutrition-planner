import { beforeEach, describe, expect, it, vi } from 'vitest';

const mocks = vi.hoisted(() => {
  const query = {
    error: null,
    insert: vi.fn(),
    update: vi.fn(),
    delete: vi.fn(),
    eq: vi.fn(),
    select: vi.fn(),
    single: vi.fn(),
  };
  Object.values(query).forEach((value) => {
    if (typeof value === 'function' && value !== query.single) value.mockReturnValue(query);
  });
  return {
    query,
    from: vi.fn(() => query),
    verwerfen: vi.fn(),
  };
});

vi.mock('./supabase.js', () => ({ supabase: { from: mocks.from } }));
vi.mock('./datenspeicher.js', () => ({
  hole: vi.fn(),
  schluessel: vi.fn(),
  verwerfen: mocks.verwerfen,
}));

import { deleteCollection, saveCollection } from './collections.js';

describe('Sammlungsänderungen', () => {
  beforeEach(() => {
    vi.clearAllMocks();
    mocks.query.error = null;
    mocks.query.insert.mockReturnValue(mocks.query);
    mocks.query.update.mockReturnValue(mocks.query);
    mocks.query.delete.mockReturnValue(mocks.query);
    mocks.query.eq.mockReturnValue(mocks.query);
    mocks.query.select.mockReturnValue(mocks.query);
    mocks.query.single.mockResolvedValue({ data: { id: 'neu', root_key: 'stress' }, error: null });
  });

  it('verwirft nach dem Anlegen den Cache des Wissensbereichs', async () => {
    await saveCollection('user-1', {
      rootKey: 'stress', parentId: null, name: 'Fokus', color: '#333333', iconKey: 'folder',
    });

    expect(mocks.query.insert).toHaveBeenCalled();
    expect(mocks.verwerfen).toHaveBeenCalledWith('stress');
  });

  it('löscht nur eigene Ordner und verwirft danach den Bereichscache', async () => {
    await deleteCollection('user-1', { id: 'ordner-1', root_key: 'training' });

    expect(mocks.query.eq).toHaveBeenCalledWith('user_id', 'user-1');
    expect(mocks.verwerfen).toHaveBeenCalledWith('training');
  });
});
