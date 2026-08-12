import { describe, expect, it } from 'vitest';
import { scaledImageSize, uploadExtension } from './imageProcessing.js';

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
