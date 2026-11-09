import { describe, expect, it } from 'vitest';

import { stableChoice, stableHash } from '../../src/authored-project/stable-hash';

describe('stable hash', () => {
  it('is 32-bit FNV-1a', () => {
    expect(stableHash('')).toBe(0x811c9dc5);
    expect(stableHash('a')).toBe(0xe40c292c);
    expect(stableHash('foobar')).toBe(0xbf9cf968);
  });
});

describe('stable choice', () => {
  it('pins its picks', () => {
    expect(stableChoice('room|anchor:stygianWell', [1, 2, 3, 4, 5, 6, 7, 8, 9])).toBe(9);
    expect(stableChoice('room|flip', [false, true])).toBe(true);
    expect(stableChoice('room', [])).toBeUndefined();
  });

  it('breaks a tie toward the earlier choice', () => {
    // A number and its string spell the same, so they score alike.
    expect(stableChoice('room', [1, '1'])).toBe(1);
    expect(stableChoice('room', ['1', 1])).toBe('1');
  });

  it('spreads items over choices that differ only in their last character', () => {
    const counts = new Map<number, number>();
    for (let index = 0; index < 360; index += 1) {
      const pick = stableChoice(`room-${index}|anchor:stygianWell`, [1, 2, 3, 4, 5, 6, 7, 8, 9])!;
      counts.set(pick, (counts.get(pick) ?? 0) + 1);
    }
    // Raw FNV-1a piles items onto the highest digits; the finalizer leaves
    // every point near its even share of 40.
    expect(counts.size).toBe(9);
    for (const count of counts.values()) expect(count).toBeGreaterThan(25);
    for (const count of counts.values()) expect(count).toBeLessThan(60);
  });
});
