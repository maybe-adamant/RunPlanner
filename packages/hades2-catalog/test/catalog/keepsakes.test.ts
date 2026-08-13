import { describe, expect, it } from 'vitest';

import { keepsakes } from '../../src/declarations/keepsakes';
import { normalizeKeepsakes } from '../../src/compiler/keepsakes';
import { catalog } from '../../src';

describe('keepsake normalization', () => {
  it('normalizes Calling Card only for the exact admitted trait-provider set', () => {
    const admitted = [
      'Zeus',
      'Hera',
      'Poseidon',
      'Demeter',
      'Apollo',
      'Aphrodite',
      'Hephaestus',
      'Hestia',
      'Ares',
      'Hermes',
      'Artemis',
      'Athena',
      'Dionysus',
    ];
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.callingCardMenu)
        .map((giver) => giver.key)
        .sort(),
    ).toEqual([...admitted].sort());
    for (const excluded of [
      'Hades',
      'WeaponUpgrade',
      'Icarus',
      'Circe',
      'Medea',
      'Narcissus',
      'Arachne',
    ]) {
      expect(catalog.traitGivers.byKey[excluded]?.callingCardMenu).toBe(false);
    }
  });

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

  it('normalizes the closed Experimental Hammer descriptor and rejects malformed ownership facts', () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const hammer = source.find((keepsake) => keepsake.key === 'TempHammerKeepsake');
    if (hammer?.effect?.kind !== 'experimentalHammer')
      throw new Error('missing raw Experimental Hammer descriptor');
    const normalized = normalizeKeepsakes(source).byKey.TempHammerKeepsake?.effect;
    expect(normalized).toEqual({
      kind: 'experimentalHammer',
      giverKey: 'WeaponUpgrade',
      qualifyingEncounterUses: 20,
    });
    expect(Object.isFrozen(normalized)).toBe(true);
    (hammer.effect as { giverKey: string }).giverKey = 'Apollo';
    expect(normalized).toMatchObject({ giverKey: 'WeaponUpgrade' });

    for (const effect of [
      { kind: 'experimentalHammer', giverKey: 'Apollo', qualifyingEncounterUses: 20 },
      { kind: 'experimentalHammer', giverKey: 'WeaponUpgrade', qualifyingEncounterUses: 19 },
    ]) {
      const malformed = keepsakes.map((keepsake) =>
        keepsake.key === 'TempHammerKeepsake' ? { ...keepsake, effect: effect as never } : keepsake,
      );
      expect(() => normalizeKeepsakes(malformed)).toThrow(
        'must declare Experimental Hammer giver and fixed 20 qualifying encounter uses',
      );
    }
  });

  it("normalizes Calling Card's fixed six-charge descriptor and rejects malformed charges", () => {
    const source = keepsakes.map((keepsake) => ({
      ...keepsake,
      ...(keepsake.effect === undefined ? {} : { effect: { ...keepsake.effect } }),
    }));
    const callingCard = source.find((keepsake) => keepsake.key === 'RarifyKeepsake');
    if (callingCard?.effect?.kind !== 'callingCard')
      throw new Error('missing raw Calling Card descriptor');
    expect(normalizeKeepsakes(source).byKey.RarifyKeepsake?.effect).toEqual({
      kind: 'callingCard',
      rarificationCharges: 6,
    });
    const malformed = source.map((keepsake) =>
      keepsake.key === 'RarifyKeepsake'
        ? { ...keepsake, effect: { kind: 'callingCard', rarificationCharges: 5 } as never }
        : keepsake,
    );
    expect(() => normalizeKeepsakes(malformed)).toThrow(
      'must declare Calling Card fixed six rarification charges',
    );
  });
});
