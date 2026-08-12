import { describe, expect, it } from 'vitest';
import { isAbortError, isSessionError, userFacingLoadError } from './errorHandling.js';

describe('Fehlerklassifizierung', () => {
  it('erkennt abgebrochene Navigationen', () => {
    expect(isAbortError({ name: 'AbortError' })).toBe(true);
    expect(isAbortError({ message: 'The operation was aborted' })).toBe(true);
  });

  it('erkennt abgelaufene Sitzungen', () => {
    expect(isSessionError({ message: 'JWT expired' })).toBe(true);
    expect(userFacingLoadError({ message: 'Auth session missing' }).kind).toBe('session');
  });

  it('priorisiert den Offline-Zustand', () => {
    expect(userFacingLoadError(new Error('fetch failed'), { online: false })).toMatchObject({
      title: 'Keine Verbindung', kind: 'offline',
    });
  });
});
