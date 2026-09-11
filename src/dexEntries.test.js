import { describe, expect, it } from 'vitest';
import { dexEntryOverviewMarkup, isTikTokPhotoPost, normalizeDexUrl, videoEmbedUrl, videoProvider } from './dexEntries.js';
import { categoryColor, colorIsDark, pageLook } from './categoryIcons.js';

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

  it('verankert die feste CAPBOY-Seitenpalette', () => {
    expect(Object.fromEntries([
      'food-log', 'reminders', 'sleep', 'habits', 'shopping',
      'essen', 'training', 'supps', 'body', 'stress', 'coins', 'profile',
    ].map((route) => [route, categoryColor(route)]))).toEqual({
      'food-log': '#F0C987',
      reminders: '#FEEFB8',
      sleep: '#0E1D47',
      habits: '#4B125C',
      shopping: '#FFEDE3',
      essen: '#3C153B',
      training: '#013E37',
      supps: '#47230F',
      body: '#94DEFF',
      stress: '#E36887',
      coins: '#E6D6FF',
      profile: '#A7C957',
    });
  });

  it('verwendet für TRACKER, COMP, REZEPTE und TRAINING feste Retro-Farbpaare', () => {
    expect(pageLook('reminders', '#000000', 'wallpaper-burger')).toEqual(expect.objectContaining({
      color: '#FEEFB8', ink: '#4E342E', accent: '#4E342E', accentInk: '#FEEFB8',
    }));
    expect(pageLook('body', '#000000', 'wallpaper-comp')).toEqual(expect.objectContaining({
      color: '#94DEFF', ink: '#FF277F', accent: '#FF277F', accentInk: '#94DEFF',
    }));
    expect(pageLook('food-log', '#000000', 'wallpaper-pizza')).toEqual(expect.objectContaining({
      color: '#F0C987', ink: '#3C153B', accent: '#F0C987', accentInk: '#3C153B',
    }));
    expect(pageLook('essen', '#000000', 'wallpaper-essen')).toEqual(expect.objectContaining({
      color: '#3C153B', ink: '#F0C987', accent: '#3C153B', accentInk: '#F0C987',
    }));
    expect(pageLook('training', '#000000', 'wallpaper-dumbbell')).toEqual(expect.objectContaining({
      color: '#013E37', ink: '#FCEFBB', accent: '#013E37', accentInk: '#FCEFBB',
    }));
    expect(pageLook('supps', '#000000', 'wallpaper-supps')).toEqual(expect.objectContaining({
      color: '#47230F', ink: '#B5D0F3', accent: '#47230F', accentInk: '#B5D0F3',
    }));
    expect(pageLook('shopping', '#000000', 'wallpaper-brokkoli')).toEqual(expect.objectContaining({
      color: '#FFEDE3', ink: '#49251E', accent: '#FFEDE3', accentInk: '#49251E',
    }));
    expect(pageLook('sleep', '#000000', 'wallpaper-moon')).toEqual(expect.objectContaining({
      color: '#0E1D47', ink: '#FCEFBB', accent: '#0E1D47', accentInk: '#FCEFBB',
    }));
    expect(pageLook('stress', '#000000', 'wallpaper-stress')).toEqual(expect.objectContaining({
      color: '#E36887', ink: '#FFE08C', accent: '#E36887', accentInk: '#FFE08C',
    }));
  });
});

describe('videoEmbedUrl', () => {
  it('erzeugt datensparsame YouTube- und Vimeo-Playerlinks', () => {
    expect(videoEmbedUrl('https://youtu.be/abc123')).toBe('https://www.youtube-nocookie.com/embed/abc123');
    expect(videoEmbedUrl('https://www.youtube.com/watch?v=xyz789')).toBe('https://www.youtube-nocookie.com/embed/xyz789');
    expect(videoEmbedUrl('https://vimeo.com/123456')).toBe('https://player.vimeo.com/video/123456');
    expect(videoEmbedUrl('https://www.tiktok.com/@creator/video/123456789')).toBe('https://www.tiktok.com/player/v1/123456789');
    expect(videoEmbedUrl('https://www.instagram.com/reel/ABC123/')).toBe('https://www.instagram.com/reel/ABC123/embed/');
    expect(videoEmbedUrl('https://www.instagram.com/reels/XYZ789/?utm_source=test')).toBe('https://www.instagram.com/reel/XYZ789/embed/');
  });

  it('bettet gewöhnliche Links nicht ein', () => {
    expect(videoEmbedUrl('https://example.com/rezept')).toBe('');
    expect(videoEmbedUrl('https://www.instagram.com/p/ABC123/')).toBe('');
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

  it('zentriert normale Artikelbilder ohne einseitigen Beschnitt', () => {
    const markup = dexEntryOverviewMarkup({
      id: 'link-1', entry_type: 'link', title: 'Rezept',
      url: 'https://example.com/rezept', preview_url: 'https://example.com/preview.jpg',
    });
    expect(markup).not.toContain('dex-foto-post-vorschau');
    expect(markup).toContain('dex-artikel-vorschau');
  });
});
