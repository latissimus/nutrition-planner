import { describe, expect, it, vi } from 'vitest';
import { createLruCache, createRouteStack, disposeViewEntry } from './navigationState.js';

describe('route stack', () => {
  it('unterscheidet Vorwaerts-, Rueckwaerts- und gleiche Navigation', () => {
    const stack = createRouteStack('home');

    expect(stack.navigate('training')).toBe('vor');
    expect(stack.navigate('collection/a')).toBe('vor');
    expect(stack.navigate('entry/1')).toBe('vor');
    expect(stack.navigate('entry/1')).toBe('gleich');
    expect(stack.navigate('collection/a')).toBe('zurueck');
    expect(stack.snapshot()).toEqual(['home', 'training', 'collection/a']);
  });

  it('erkennt nur die direkt vorherige Route als nativen Zurueckweg', () => {
    const stack = createRouteStack('home');
    stack.navigate('food-log');
    stack.navigate('collection/low-carb');

    expect(stack.isPrevious('food-log')).toBe(true);
    expect(stack.isPrevious('home')).toBe(false);
  });

  it('bleibt bei schnellen Richtungswechseln konsistent', () => {
    const stack = createRouteStack('home');
    stack.navigate('training');
    stack.navigate('entry/1');
    expect(stack.navigate('training')).toBe('zurueck');
    expect(stack.navigate('entry/2')).toBe('vor');
    expect(stack.snapshot()).toEqual(['home', 'training', 'entry/2']);
  });
});

describe('view LRU cache', () => {
  it('entfernt bei Ueberlauf die aelteste Ansicht und raeumt sie auf', () => {
    const onEvict = vi.fn();
    const cache = createLruCache({ limit: 2, onEvict });
    const home = { node: { id: 'home' } };
    const training = { node: { id: 'training' } };
    const entry = { node: { id: 'entry' } };

    cache.set('home', home);
    cache.set('training', training);
    cache.set('entry/1', entry);

    expect(cache.keys()).toEqual(['training', 'entry/1']);
    expect(onEvict).toHaveBeenCalledWith(home, 'home');
  });

  it('nimmt eine Ansicht heraus, ohne sie als verworfen aufzuraeumen', () => {
    const onEvict = vi.fn();
    const cache = createLruCache({ onEvict });
    const view = { node: { id: 'home' } };
    cache.set('home', view);

    expect(cache.take('home')).toBe(view);
    expect(cache.size).toBe(0);
    expect(onEvict).not.toHaveBeenCalled();
  });

  it('raeumt ersetzte und explizit geloeschte Ansichten genau einmal auf', () => {
    const onEvict = vi.fn();
    const cache = createLruCache({ onEvict });
    const first = { node: { id: 'first' } };
    const second = { node: { id: 'second' } };
    cache.set('route', first);
    cache.set('route', second);
    cache.delete('route');

    expect(onEvict).toHaveBeenNthCalledWith(1, first, 'route');
    expect(onEvict).toHaveBeenNthCalledWith(2, second, 'route');
  });

  it('beendet Medien, trennt Embeds und bricht offene Arbeit beim Verwerfen ab', () => {
    const audio = { pause: vi.fn() };
    const video = { pause: vi.fn() };
    const iframe = { removeAttribute: vi.fn() };
    const node = {
      querySelectorAll: vi.fn((selector) => selector === 'iframe' ? [iframe] : [audio, video]),
      remove: vi.fn(),
    };
    const controller = { abort: vi.fn() };

    disposeViewEntry({ node, controller });

    expect(controller.abort).toHaveBeenCalledOnce();
    expect(audio.pause).toHaveBeenCalledOnce();
    expect(video.pause).toHaveBeenCalledOnce();
    expect(iframe.removeAttribute).toHaveBeenCalledWith('src');
    expect(node.remove).toHaveBeenCalledOnce();
  });
});
