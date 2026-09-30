import { describe, expect, it } from 'vitest';
import {
  dexEntryOverviewMarkup, entryClassFiltersMarkup, filterEntriesByClass, isTikTokPhotoPost,
  normalizeDexUrl, videoEmbedUrl, videoProvider,
} from './dexEntries.js';
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

  // Retro-Pastell: die früher dunklen Seiten als pastelliges Gegenstück.
  it('verankert die feste CAPBOY-Seitenpalette', () => {
    expect(Object.fromEntries([
      'food-log', 'reminders', 'sleep', 'habits', 'shopping',
      'essen', 'training', 'supps', 'body', 'stress', 'coins', 'profile',
    ].map((route) => [route, categoryColor(route)]))).toEqual({
      'food-log': '#F0C987',
      reminders: '#FFEDE3',
      sleep: '#A9B8F5',
      habits: '#C3B1F5',
      shopping: '#FFEFB3',
      essen: '#FFC39E',
      training: '#3E9C9F',
      supps: '#D8BFD8',
      body: '#94DEFF',
      stress: '#E36887',
      coins: '#F0B3E6',
      profile: '#F7F3EA',
    });
  });

  // Retro: Seitenfarbe und Akzent bleiben fest; Schrift und Tinte sind je
  // nach Kontrast schwarz oder weiß.
  it('verwendet für TRACKER, COMP, REZEPTE und TRAINING feste Retro-Farbpaare', () => {
    expect(pageLook('reminders', '#000000', 'wallpaper-burger')).toEqual(expect.objectContaining({
      color: '#FFEDE3', ink: '#111111', accent: '#111111', accentInk: '#FFFFFF',
    }));
    expect(pageLook('body', '#000000', 'wallpaper-comp')).toEqual(expect.objectContaining({
      color: '#94DEFF', ink: '#111111', accent: '#FF277F', accentInk: '#111111',
    }));
    expect(pageLook('food-log', '#000000', 'wallpaper-pizza')).toEqual(expect.objectContaining({
      color: '#F0C987', ink: '#111111', accent: '#F0C987', accentInk: '#111111',
    }));
    expect(pageLook('essen', '#000000', 'wallpaper-essen')).toEqual(expect.objectContaining({
      color: '#FFC39E', ink: '#111111', accent: '#FFC39E', accentInk: '#111111',
    }));
    expect(pageLook('training', '#000000', 'wallpaper-dumbbell')).toEqual(expect.objectContaining({
      color: '#3E9C9F', ink: '#111111', accent: '#3E9C9F', accentInk: '#111111',
    }));
    expect(pageLook('supps', '#000000', 'wallpaper-supps')).toEqual(expect.objectContaining({
      color: '#D8BFD8', ink: '#111111', accent: '#2A1E5C', accentInk: '#FFFFFF',
    }));
    expect(pageLook('habits', '#000000', 'wallpaper-wolke')).toEqual(expect.objectContaining({
      color: '#C3B1F5', ink: '#111111', accent: '#C3B1F5', accentInk: '#111111',
      pattern: 'wallpaper-stress',
    }));
    expect(pageLook('shopping', '#000000', 'wallpaper-brokkoli')).toEqual(expect.objectContaining({
      color: '#FFEFB3', ink: '#111111', accent: '#013E37', accentInk: '#FFFFFF',
    }));
    expect(pageLook('sleep', '#000000', 'wallpaper-moon')).toEqual(expect.objectContaining({
      color: '#A9B8F5', ink: '#111111', accent: '#A9B8F5', accentInk: '#111111',
    }));
    expect(pageLook('stress', '#000000', 'wallpaper-stress')).toEqual(expect.objectContaining({
      color: '#E36887', ink: '#111111', accent: '#E36887', accentInk: '#111111',
      pattern: 'wallpaper-wolke',
    }));
    expect(pageLook('coins', '#000000', 'wallpaper-game')).toEqual(expect.objectContaining({
      color: '#F0B3E6', ink: '#111111', accent: '#432C5E', accentInk: '#FFFFFF',
    }));
    expect(pageLook('profile', '#000000', 'drops')).toEqual(expect.objectContaining({
      color: '#F7F3EA', ink: '#111111', accent: '#0A1330', accentInk: '#FFFFFF',
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

describe('MIND-Themenleiste', () => {
  it('zeigt nur die weiterhin festen Themen oberhalb des Eintragsrasters', () => {
    const markup = entryClassFiltersMarkup([
      { training_class: 'impulses' },
      { training_class: 'strains' },
      { training_class: 'triggers' },
    ], 'stress');
    expect(markup).toContain('aria-label="MIND filtern"');
    expect(markup).toContain('>Alle</button>');
    expect(markup).toContain('>Entspannung</button>');
    expect(markup).not.toContain('>Impulse</button>');
    expect(markup).not.toContain('>Belastungen</button>');
    expect(markup).not.toContain('>Auslöser</button>');
  });

  it('ergänzt frei vergebene Tags als filterbare Chips', () => {
    const entries = [
      { id: 'eins', training_class: 'impulses', tags: ['Selbstwert', 'Fokus'] },
      { id: 'zwei', training_class: 'relaxation', tags: ['Atmung'] },
    ];
    const markup = entryClassFiltersMarkup(entries, 'stress');
    expect(markup).toContain('data-entry-class-filter="tag:selbstwert"');
    expect(markup).toContain('>Selbstwert</button>');
    expect(filterEntriesByClass(entries, 'tag:selbstwert')).toEqual([entries[0]]);
  });
});

describe('Instagram-Vorschau', () => {
  it('verwendet das gespeicherte Vorschaubild auch für Reels', () => {
    const markup = dexEntryOverviewMarkup({
      id: 'instagram-1', entry_type: 'link', title: 'Reel',
      url: 'https://www.instagram.com/reel/ABC123/',
      preview_url: 'https://example.com/instagram.jpg', provider: 'Instagram',
    });
    expect(markup).toContain('https://example.com/instagram.jpg');
    expect(markup).toContain('dex-video-vorschau');
  });
});
