import { describe, expect, it } from 'vitest';
import { normalizeDexUrl, videoEmbedUrl } from './dexEntries.js';

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

describe('videoEmbedUrl', () => {
  it('erzeugt datensparsame YouTube- und Vimeo-Playerlinks', () => {
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=xyz789')).toBe('https://www.youtube-nocookie.com/embed/xyz789');
    expect(videoEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(videoEmbedUrl('https://www.tiktok.com/@creator/video/123456789')).toBe('https://www.tiktok.com/player/v1/123456789');
    expect(videoEmbedUrl('https://www.instagram.com/reel/ABC123/')).toBe('https://www.instagram.com/reel/ABC123/embed/');
  });

  it('bettet gewöhnliche Links nicht ein', () => {
    expect(videoEmbedUrl('https://example.com/rezept')).toBe('');
  });
});
