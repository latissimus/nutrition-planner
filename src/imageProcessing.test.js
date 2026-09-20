import { describe, expect, it } from 'vitest';
import { bildEndung, scaledImageSize, uploadExtension } from './imageProcessing.js';

describe('scaledImageSize', () => {
  it('verkleinert Querformat proportional', () => {
    expect(scaledImageSize(4000, 3000, 1600)).toEqual({ width: 1600, height: 1200, scaled: true });
  });

  it('vergrößert kleine Bilder nicht', () => {
    expect(scaledImageSize(800, 600, 1600)).toEqual({ width: 800, height: 600, scaled: false });
  });
});

describe('uploadExtension', () => {
  it('verwendet die Dateiendung und normalisiert JPEG', () => {
    expect(uploadExtension({ name: 'foto.webp', type: 'image/webp' })).toBe('webp');
    expect(uploadExtension({ name: '', type: 'image/jpeg' })).toBe('jpg');
  });
});

/* Der Kern eines gefundenen Fehlers: canvas.toBlob faellt stillschweigend auf
   PNG zurueck, wenn WebP nicht kodiert werden kann. Wurde die Datei trotzdem
   als .webp abgelegt, lagen PNG-Bytes unter falschem Namen in der Ablage –
   gemessen 3,7 MB statt rund 250 KB. Die Endung muss deshalb dem
   TATSAECHLICHEN Inhaltstyp folgen. */
describe('bildEndung', () => {
  it('folgt dem tatsächlichen Inhaltstyp', () => {
    expect(bildEndung('image/webp')).toBe('webp');
    expect(bildEndung('image/png')).toBe('png');
  });

  it('normalisiert JPEG auf jpg', () => {
    expect(bildEndung('image/jpeg')).toBe('jpg');
  });

  it('fällt bei fehlendem oder unsinnigem Typ auf jpg zurück', () => {
    expect(bildEndung('')).toBe('jpg');
    expect(bildEndung(undefined)).toBe('jpg');
    expect(bildEndung('application/octet-stream')).toBe('jpg');
    expect(bildEndung('image/svg+xml')).toBe('jpg');
  });
});
