import { afterEach, describe, expect, it, vi } from 'vitest';
import { registriereServiceWorker } from './pwa.js';

class EreignisQuelle {
  constructor() { this.listeners = new Map(); }

  addEventListener(typ, listener) {
    const listeners = this.listeners.get(typ) || [];
    listeners.push(listener);
    this.listeners.set(typ, listeners);
  }

  ausloesen(typ) {
    (this.listeners.get(typ) || []).forEach((listener) => listener());
  }
}

afterEach(() => {
  vi.unstubAllEnvs();
  vi.unstubAllGlobals();
});

describe('registriereServiceWorker', () => {
  it('meldet auch einen Worker, der beim Registrieren bereits installiert', async () => {
    vi.stubEnv('DEV', false);
    const worker = Object.assign(new EreignisQuelle(), { state: 'installing', postMessage: vi.fn() });
    const registration = Object.assign(new EreignisQuelle(), {
      waiting: null,
      installing: worker,
      update: vi.fn(async () => null),
    });
    const serviceWorker = Object.assign(new EreignisQuelle(), {
      controller: {},
      register: vi.fn(async () => registration),
      getRegistrations: vi.fn(async () => []),
    });
    const unterzeile = { textContent: '' };
    const updateButton = {
      isConnected: false,
      hidden: false,
      disabled: false,
      setAttribute: vi.fn(),
      querySelector: vi.fn(() => unterzeile),
    };
    const dokument = Object.assign(new EreignisQuelle(), {
      visibilityState: 'visible',
      querySelector: vi.fn(() => null),
      createElement: vi.fn(() => updateButton),
      body: { append: vi.fn(() => { updateButton.isConnected = true; }) },
    });

    vi.stubGlobal('navigator', { serviceWorker });
    vi.stubGlobal('document', dokument);
    vi.stubGlobal('window', new EreignisQuelle());
    vi.stubGlobal('location', { reload: vi.fn() });
    vi.stubGlobal('setInterval', vi.fn());

    await registriereServiceWorker();
    expect(serviceWorker.register).toHaveBeenCalledWith('./sw.js', { updateViaCache: 'none' });
    expect(updateButton.hidden).toBe(true);

    worker.state = 'installed';
    worker.ausloesen('statechange');

    expect(updateButton.hidden).toBe(false);
    expect(unterzeile.textContent).toBe('Jetzt aktualisieren');
  });
});
