import { describe, expect, it } from 'vitest';
import { dexStoragePath, storageScope } from './storagePaths.js';

describe('sichere Medienpfade', () => {
  it('trennt Medien nach Dex-Bereich', () => {
    expect(dexStoragePath('user-1', 'food-log', 'webp', 'datei')).toBe('user-1/food-log/datei.webp');
  });

  it('lässt keine fremden Pfadsegmente zu', () => {
    expect(storageScope('../food-log')).toBe('home');
    expect(dexStoragePath('user-1', 'training', '../jpg', 'datei')).toBe('user-1/training/datei.jpg');
  });
});
