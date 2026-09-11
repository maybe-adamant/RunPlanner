import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import { expectedHammerRestrictions, expectedHammersWithoutRankII } from './support/traits';

const traits = { traits: catalog.traits };

describe('Hammer compatibility declarations', () => {
  it('preserves Legendary rarity while keeping Hammer declarations un-rarified', () => {
    const hammerTrait = declarations.traitCatalog.traits.find(
      (trait) => trait.key === 'StaffTripleShotTrait',
    );
    if (hammerTrait === undefined) throw new Error('fixture');
    const invalidHammer = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === hammerTrait.key
            ? {
                ...trait,
                freshOfferRarities: ['Rare' as const],
                equippedRarities: ['Rare' as const],
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(invalidHammer)).toThrow(/rarityless traits cannot declare/);
    expect(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy).toEqual({ kind: 'none' });
    expect(catalog.traits.byKey.StaffTripleShotTrait?.rarityDomain).toEqual({ kind: 'none' });
    expect(Object.isFrozen(catalog.traitGivers.byKey.WeaponUpgrade?.rarityPolicy)).toBe(true);
  });

  it('keeps the exact Hammer aspect and Rank II matrix', () => {
    expect(Object.keys(expectedHammerRestrictions)).toHaveLength(48);
    for (const [traitKey, aspectKeys] of Object.entries(expectedHammerRestrictions)) {
      expect(traits.traits.byKey[traitKey]?.hammerCompatibility?.aspectKeys).toEqual(aspectKeys);
    }
    expect(traits.traits.values.filter((trait) => trait.hammerCompatibility)).toHaveLength(92);
    expect(
      traits.traits.values.filter((trait) => trait.hammerCompatibility?.supportsRankII),
    ).toHaveLength(65);
    expect(
      traits.traits.values
        .filter(
          (trait) =>
            trait.hammerCompatibility !== undefined && !trait.hammerCompatibility.supportsRankII,
        )
        .map((trait) => trait.key)
        .sort(),
    ).toEqual(expectedHammersWithoutRankII);
    expect(
      traits.traits.values.filter(
        (trait) => trait.hammerCompatibility && trait.hammerCompatibility.aspectKeys.length === 4,
      ),
    ).toHaveLength(44);
  });
});
