import { describe, expect, it } from 'vitest';

import { keepsakes } from '../../src/declarations/keepsakes';
import { normalizeKeepsakes } from '../../src/compiler/keepsakes';

describe('keepsake normalization', () => {
  it('rejects malformed rank and Fated inventory facts before catalog construction', () => {
    const wrongRank = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongRank[0] = { ...wrongRank[0]!, rank: 'Rare' as never };
    expect(() => normalizeKeepsakes(wrongRank)).toThrow('must be fixed rank III (Epic)');

    const wrongDisposition = keepsakes.map((keepsake) => ({ ...keepsake }));
    wrongDisposition[29] = { ...wrongDisposition[29]!, fatedDisposition: 'neutral' };
    expect(() => normalizeKeepsakes(wrongDisposition)).toThrow('expected enabling');

    expect(
      normalizeKeepsakes([...keepsakes].reverse()).values.map((keepsake) => keepsake.key),
    ).toEqual([...keepsakes].reverse().map((keepsake) => keepsake.key));

    const replaced = keepsakes.map((keepsake) => ({ ...keepsake }));
    replaced[0] = { ...replaced[0]!, key: 'UnknownKeepsake' };
    expect(() => normalizeKeepsakes(replaced)).toThrow(
      'must declare the exact authoritative ordinary keepsake inventory',
    );
  });

  it('normalizes the closed Jeweled Pom descriptor without retaining caller-owned effect state', () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const pom = source.find((keepsake) => keepsake.key === 'HadesAndPersephoneKeepsake');
    if (pom?.effect?.kind !== 'jeweledPom') throw new Error('missing raw Jeweled Pom descriptor');
    const normalized = normalizeKeepsakes(source).byKey.HadesAndPersephoneKeepsake?.effect;
    expect(normalized).toEqual({
      kind: 'jeweledPom',
      giverKey: 'Hades',
      subsequentEligibleTraitLevels: 3,
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    (pom.effect as { giverKey: string }).giverKey = 'Apollo';
    expect(normalized).toMatchObject({ giverKey: 'Hades' });

    for (const effect of [
      { kind: 'jeweledPom', giverKey: 'Apollo', subsequentEligibleTraitLevels: 3 },
      { kind: 'jeweledPom', giverKey: 'Hades', subsequentEligibleTraitLevels: 2 },
    ]) {
      const malformed = keepsakes.map((keepsake) =>
        keepsake.key === 'HadesAndPersephoneKeepsake'
          ? { ...keepsake, effect: effect as never }
          : keepsake,
      );
      expect(() => normalizeKeepsakes(malformed)).toThrow(
        'must declare Jeweled Pom fixed +3 eligible-trait levels',
      );
    }
  });
});
