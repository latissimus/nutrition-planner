import { describe, expect, it } from 'vitest';
import { meditationSounds, remainingMeditationSeconds } from './meditationTimer.js';

describe('Meditationstimer', () => {
  it('nimmt Musik automatisch auf, aber keine Beginn- und Endklänge', () => {
    const labels = meditationSounds.map(([, label]) => label);
    expect(labels).toContain('Pure Meditation');
    expect(labels).toContain('Binaural – Theta-Ruhe');
    expect(labels).toContain('Binaural – Alpha-Fokus');
    expect(labels).not.toContain('Routine Beginn');
    expect(labels).not.toContain('Routine Ende');
    expect(labels).not.toContain('Meditation Beginn');
    expect(labels).not.toContain('Meditation Ende');
  });

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
