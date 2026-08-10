import { describe, expect, it } from 'vitest';
import { remainingMeditationSeconds } from './meditationTimer.js';

describe('Meditationstimer', () => {
  it('zieht genau eine Sekunde pro realer Sekunde ab', () => {
    const start = 12_000;
    const end = start + 5 * 60 * 1000;
    expect(remainingMeditationSeconds(end, start)).toBe(300);
    expect(remainingMeditationSeconds(end, start + 1_000)).toBe(299);
    expect(remainingMeditationSeconds(end, start + 60_000)).toBe(240);
  });

  it('wird nach Ablauf nicht negativ', () => {
    expect(remainingMeditationSeconds(10_000, 11_500)).toBe(0);
  });
});
