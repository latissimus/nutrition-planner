import { afterEach, describe, expect, it, vi } from 'vitest';

const createSignedUrl = vi.fn();
vi.mock('./supabase.js', () => ({
  supabase: { storage: { from: () => ({ createSignedUrl }) } },
}));

const { signieren } = await import('./signierteAdressen.js');

afterEach(() => {
  createSignedUrl.mockReset();
  vi.useRealTimers();
});

describe('signieren', () => {
  it('verwendet eine gültige Adresse wieder, statt neu zu signieren', async () => {
    let zaehler = 0;
    createSignedUrl.mockImplementation(async () => ({ data: { signedUrl: `url-${++zaehler}` }, error: null }));
    const erste = await signieren('dex-entries', 'a.jpg', 3600, { transform: { width: 540 } });
    const zweite = await signieren('dex-entries', 'a.jpg', 3600, { transform: { width: 540 } });
    expect(erste.data.signedUrl).toBe('url-1');
    expect(zweite.data.signedUrl).toBe('url-1');
    expect(createSignedUrl).toHaveBeenCalledTimes(1);
    // Andere Maße sind eine eigene Adresse.
    const original = await signieren('dex-entries', 'a.jpg', 3600);
    expect(original.data.signedUrl).toBe('url-2');
  });

  it('signiert neu, wenn nur noch eine Viertelstunde bleibt', async () => {
    vi.useFakeTimers();
    vi.setSystemTime(new Date('2026-10-01T10:00:00Z'));
    let zaehler = 0;
    createSignedUrl.mockImplementation(async () => ({ data: { signedUrl: `neu-${++zaehler}` }, error: null }));
    await signieren('dex-entries', 'b.jpg', 3600);
    vi.setSystemTime(new Date('2026-10-01T10:44:00Z'));
    expect((await signieren('dex-entries', 'b.jpg', 3600)).data.signedUrl).toBe('neu-1');
    vi.setSystemTime(new Date('2026-10-01T10:46:00Z'));
    expect((await signieren('dex-entries', 'b.jpg', 3600)).data.signedUrl).toBe('neu-2');
  });

  it('merkt sich Fehlschläge nicht', async () => {
    createSignedUrl.mockResolvedValueOnce({ data: null, error: new Error('weg') })
      .mockResolvedValueOnce({ data: { signedUrl: 'zweiter-versuch' }, error: null });
    expect((await signieren('dex-entries', 'c.jpg', 3600)).data).toBeNull();
    expect((await signieren('dex-entries', 'c.jpg', 3600)).data.signedUrl).toBe('zweiter-versuch');
  });
});
