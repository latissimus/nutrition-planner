import { describe, expect, it } from 'vitest';
import { normalizeDexUrl } from './dexEntries.js';

describe('normalizeDexUrl', () => {
  it('ergänzt bei einer Domain das HTTPS-Protokoll', () => {
    expect(normalizeDexUrl('example.com/rezept')).toBe('https://example.com/rezept');
  });

  it('bewahrt vollständige Weblinks', () => {
    expect(normalizeDexUrl('http://example.com/a?b=1')).toBe('http://example.com/a?b=1');
  });

  it('weist leere und nicht-webbasierte Links zurück', () => {
    expect(() => normalizeDexUrl('')).toThrow('Link');
    expect(() => normalizeDexUrl('javascript:alert(1)')).toThrow('Weblinks');
  });
});
