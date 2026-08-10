import { describe, expect, it } from 'vitest';
import { dexEntryOverviewMarkup, isTikTokPhotoPost, normalizeDexUrl, videoEmbedUrl, videoProvider } from './dexEntries.js';
import { colorIsDark } from './categoryIcons.js';

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

describe('Anbieter- und Farbkontrast', () => {
  it('erkennt Videoanbieter auch ohne direkt einbettbare URL', () => {
    expect(videoProvider('https://vm.tiktok.com/shortcode')?.name).toBe('TikTok');
    expect(videoProvider('https://example.com/video')).toBeNull();
  });

  it('unterscheidet dunkle und helle Buttonfarben', () => {
    expect(colorIsDark('#492426')).toBe(true);
    expect(colorIsDark('#F2EBE0')).toBe(false);
    expect(colorIsDark('#007DCC')).toBe(false);
    expect(colorIsDark('#525CEB')).toBe(true);
    expect(colorIsDark('#FF3483')).toBe(false);
    expect(colorIsDark('#00E0BA')).toBe(false);
  });
});

describe('videoEmbedUrl', () => {
  it('erzeugt datensparsame YouTube- und Vimeo-Playerlinks', () => {
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=xyz789')).toBe('https://www.youtube-nocookie.com/embed/xyz789');
    expect(videoEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(videoEmbedUrl('https://www.tiktok.com/@creator/video/123456789')).toBe('https://www.tiktok.com/player/v1/123456789');
    expect(videoEmbedUrl('https://www.instagram.com/reel/ABC123/')).toBe('');
  });

  it('bettet gewöhnliche Links nicht ein', () => {
    expect(videoEmbedUrl('https://example.com/rezept')).toBe('');
  });
});

describe('Vorschaubilder', () => {
  it('behandelt TikTok-Fotostrecken als zentrierte Bildkarten', () => {
    const markup = dexEntryOverviewMarkup({
      id: 'foto-1', entry_type: 'link', title: 'Fotostrecke',
      url: 'https://www.tiktok.com/@creator/photo/123456789',
      preview_url: 'https://example.com/preview.jpg',
    });
    expect(isTikTokPhotoPost('https://www.tiktok.com/@creator/photo/123456789')).toBe(true);
    expect(markup).toContain('dex-foto-post-vorschau');
    expect(markup).toContain('dex-inhaltskarte-image');
    expect(markup).toContain('tiktok-foto-post');
  });

  it('verändert normale Link-Vorschaubilder nicht', () => {
    const markup = dexEntryOverviewMarkup({
      id: 'link-1', entry_type: 'link', title: 'Rezept',
      url: 'https://example.com/rezept', preview_url: 'https://example.com/preview.jpg',
    });
    expect(markup).not.toContain('dex-foto-post-vorschau');
  });
});
