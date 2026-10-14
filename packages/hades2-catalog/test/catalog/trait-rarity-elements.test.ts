import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import type { ProperUpbringingEffect } from '@run-planner/engine/catalog-schema';
import type {
  RawTraitDeclaration,
  RawTraitGiverDeclaration,
} from '../../src/declarations/traits/types';

describe('trait rarity and elements', () => {
  it('rejects malformed declaration-owned rarity floors at catalog construction', () => {
    const proper = declarations.traitCatalog.traits.find(
      (trait) => trait.key === 'ElementalRarityUpgradeBoon',
    );
    if (proper === undefined) throw new Error('missing Proper Upbringing declaration');
    const malformed = (effect: object) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === proper.key
              ? {
                  ...trait,
                  // Deliberately malformed values enter through the raw declaration boundary.
                  rarityFloorEffect: effect as unknown as ProperUpbringingEffect,
                }
              : trait,
          ),
        },
      });
    expect(() =>
      malformed({
        fromRarity: 'Epic',
        minimumRarity: 'Rare',
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Common/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Common',
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Rare|must follow/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
      }),
    ).toThrow(/exactly the Proper Upbringing effect fields/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        boonRarityContribution: { additive: { Rare: 1, Epic: 0 } },
      }),
    ).toThrow(/exactly Rare: 1/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        boonRarityContribution: { additive: { Rare: 0 } },
      }),
    ).toThrow(/exactly Rare: 1/);
    const hammer = declarations.traitCatalog.traits.find(
      (trait) => trait.hammerCompatibility !== undefined,
    );
    if (hammer === undefined) throw new Error('missing Hammer declaration');
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === hammer.key
              ? {
                  ...trait,
                  rarityFloorEffect: {
                    fromRarity: 'Common',
                    minimumRarity: 'Rare',
                    boonRarityContribution: { additive: { Rare: 1 } },
                  },
                }
              : trait,
          ),
        },
      }),
    ).toThrow(/reserved to ElementalRarityUpgradeBoon/);
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'HeraWeaponBoon'
              ? { ...trait, rarityFloorEffect: proper.rarityFloorEffect! }
              : trait,
          ),
        },
      }),
    ).toThrow(/reserved to ElementalRarityUpgradeBoon/);
  });

  it('rejects malformed rarityless declarations and giver policies', () => {
    const withTrait = (
      traitKey: string,
      replacement: (trait: RawTraitDeclaration) => RawTraitDeclaration,
    ) => ({
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === traitKey ? replacement(trait) : trait,
        ),
      },
    });

    expect(() =>
      createCatalog(
        withTrait('DiminishingDodgeBoon', (trait) => ({
          ...trait,
          freshOfferRarities: ['Common'],
          equippedRarities: ['Common'],
        })),
      ),
    ).toThrow(/explicitly rarityless traits must omit rarity arrays/);
    for (const rarityArrays of [
      { freshOfferRarities: [] },
      { equippedRarities: [] },
      { freshOfferRarities: [], equippedRarities: [] },
    ] as const) {
      expect(() =>
        createCatalog(
          withTrait('DiminishingDodgeBoon', (trait) => ({ ...trait, ...rarityArrays })),
        ),
      ).toThrow(/explicitly rarityless traits must omit rarity arrays/);
    }
    expect(() =>
      createCatalog(
        withTrait('DiminishingDodgeBoon', (trait) => ({ ...trait, usesBoonRarity: true })),
      ),
    ).toThrow(/rarityless traits cannot use boon rarity/);
    expect(() =>
      createCatalog(
        withTrait('AphroditeWeaponBoon', (trait) => {
          const {
            freshOfferRarities: _freshOfferRarities,
            equippedRarities: _equippedRarities,
            ...withoutRarityArrays
          } = trait;
          void _freshOfferRarities;
          void _equippedRarities;
          return withoutRarityArrays;
        }),
      ),
    ).toThrow(/ranked rarity domains must not be empty/);

    const withGiver = (
      giverKey: string,
      replacement: (giver: RawTraitGiverDeclaration) => RawTraitGiverDeclaration,
    ) => ({
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === giverKey ? replacement(giver) : giver,
        ),
      },
    });
    expect(() =>
      createCatalog(
        withGiver('Aphrodite', (giver) => ({ ...giver, rarityPolicy: { kind: 'none' } })),
      ),
    ).toThrow(/no-rarity givers require only rarityless members/);
    expect(() =>
      createCatalog(
        withGiver('Echo', (giver) => ({
          ...giver,
          rarityPolicy: { kind: 'fixed', rarity: 'Common' },
        })),
      ),
    ).toThrow(/ranked giver policies cannot contain rarityless members/);
    for (const [giverKey, rarityPolicy] of [
      ['Echo', { kind: 'none', rarity: 'Common' }],
      ['Aphrodite', { kind: 'fixed', rarity: 'Common', rarities: ['Common'] }],
      ['Aphrodite', { kind: 'selectable', rarities: ['Common'], rarity: 'Common' }],
    ] as const) {
      expect(() =>
        createCatalog(
          withGiver(giverKey, (giver) => ({
            ...giver,
            rarityPolicy: rarityPolicy as unknown as RawTraitGiverDeclaration['rarityPolicy'],
          })),
        ),
      ).toThrow(/rarity policy must contain exactly/);
    }
  });

  it('declares the entered-biome menu on exactly the six NPC menus that scale by it', () => {
    expect(
      catalog.traitGivers.values
        .filter((giver) => giver.acquisitionOrdinalMenu === true)
        .map((giver) => giver.key)
        .sort(),
    ).toEqual(['Arachne', 'Circe', 'Echo', 'Icarus', 'Medea', 'Narcissus']);
    const withGiver = (giverKey: string, extra: object) => ({
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === giverKey ? ({ ...giver, ...extra } as RawTraitGiverDeclaration) : giver,
        ),
      },
    });
    expect(() => createCatalog(withGiver('Aphrodite', { acquisitionOrdinalMenu: true }))).toThrow(
      /acquisitionOrdinalMenu: must be true on a rarityless NPC giver/,
    );
  });

  it('scales Circe health and familiar values by acquisition ordinal only from an entered-biome menu', () => {
    expect(catalog.traits.byKey.CirceEnlargeTrait!.maxStatEffect).toEqual({
      kind: 'multiplier',
      maxHealth: [1.15, 1.15, 1.2, 1.3],
    });
    const withCirce = (
      giver: (raw: RawTraitGiverDeclaration) => RawTraitGiverDeclaration,
      maxHealth: unknown = [1.15, 1.15, 1.2, 1.3],
    ) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'CirceEnlargeTrait'
              ? ({
                  ...trait,
                  maxStatEffect: { kind: 'multiplier', maxHealth },
                } as RawTraitDeclaration)
              : trait,
          ),
          givers: declarations.traitCatalog.givers.map((raw) =>
            raw.key === 'Circe' ? giver(raw) : raw,
          ),
        },
      });
    expect(() =>
      withCirce((raw) => {
        const { acquisitionOrdinalMenu: _menu, ...rest } = raw;
        void _menu;
        return rest;
      }),
    ).toThrow(/an acquisition-ordinal value requires an acquisitionOrdinalMenu giver/);
    expect(catalog.traits.byKey.DoubleFamiliarTrait!.maxStatEffect).toEqual({
      kind: 'familiarStackMultiplier',
      multiplier: [2, 2, 3, 3],
    });
    expect(() => withCirce((raw) => raw, [1.15, 1.2, 1.3])).toThrow(
      /must declare four acquisition ordinals/,
    );
  });

  it.each([
    [
      'moved to another core trait',
      'ApolloWeaponBoon',
      { Common: 1, Rare: 1, Epic: 1, Heroic: 1 },
      /reserved/,
    ],
    [
      'moved to a non-Pom trait',
      'HephaestusManaBoon',
      { Common: 1, Rare: 1, Epic: 1, Heroic: 1 },
      /reserved/,
    ],
    ['partial rarities', 'HephaestusWeaponBoon', { Common: 1, Rare: 1, Epic: 1 }, /cover exactly/],
    [
      'zero cap',
      'HephaestusWeaponBoon',
      { Common: 0, Rare: 1, Epic: 1, Heroic: 1 },
      /positive integer/,
    ],
  ] as const)(
    'rejects malformed declaration-owned cooldown upgrade limits: %s',
    (_name, traitKey, caps, message) => {
      const malformed = {
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === traitKey
              ? {
                  ...trait,
                  maximumEligibleLevelByRarity: caps as never,
                }
              : trait,
          ),
        },
      };
      expect(() => createCatalog(malformed)).toThrow(message);
    },
  );

  it('declares source ActivationRequirements and ElementalMultipliers for the Infusions', () => {
    const activation = Object.fromEntries(
      catalog.traits.values.flatMap((trait) =>
        trait.activationRequirement === undefined ? [] : [[trait.key, trait.activationRequirement]],
      ),
    );
    expect(activation).toEqual({
      ElementalRarityUpgradeBoon: {
        kind: 'elementMinimums',
        minimums: { Fire: 2, Earth: 2, Air: 2, Water: 2 },
      },
      ElementalUnifiedBoon: { kind: 'highestBaseElementCount', minimum: 8 },
      ElementalOlympianDamageBoon: { kind: 'elementMinimums', minimums: { Earth: 8 } },
      ElementalRallyBoon: { kind: 'elementMinimums', minimums: { Fire: 3 } },
      ElementalDamageFloorBoon: { kind: 'elementMinimums', minimums: { Air: 5 } },
      ElementalDamageCapBoon: { kind: 'elementMinimums', minimums: { Water: 6 } },
    });
    const scaling = Object.fromEntries(
      catalog.traits.values.flatMap((trait) =>
        trait.elementalMultiplier === undefined ? [] : [[trait.key, trait.elementalMultiplier]],
      ),
    );
    expect(scaling).toEqual({
      ElementalDamageBoon: 'Earth',
      ElementalBaseDamageBoon: 'Fire',
      ElementalDodgeBoon: 'Air',
      ElementalHealthBoon: 'Water',
    });
  });

  it('rejects malformed activation requirements and elemental multipliers', () => {
    const withTrait = (traitKey: string, patch: Record<string, unknown>) => () =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === traitKey ? ({ ...trait, ...patch } as RawTraitDeclaration) : trait,
          ),
        },
      });
    expect(
      withTrait('ElementalRallyBoon', {
        activationRequirement: { kind: 'elementMinimums', minimums: {} },
      }),
    ).toThrow(/minimums: must not be empty/);
    expect(
      withTrait('ElementalRallyBoon', {
        activationRequirement: { kind: 'elementMinimums', minimums: { Lightning: 2 } },
      }),
    ).toThrow(/must be one of/);
    expect(
      withTrait('ElementalRallyBoon', {
        activationRequirement: { kind: 'elementMinimums', minimums: { Fire: 0 } },
      }),
    ).toThrow(/positive integer/);
    expect(
      withTrait('ElementalUnifiedBoon', {
        activationRequirement: { kind: 'highestBaseElementCount', minimum: 8, element: 'Fire' },
      }),
    ).toThrow(/exactly kind and minimum/);
    expect(
      withTrait('ElementalUnifiedBoon', { activationRequirement: { kind: 'godBoonRarity' } }),
    ).toThrow(/unknown activation requirement/);
    expect(withTrait('ElementalRarityUpgradeBoon', { activationRequirement: undefined })).toThrow(
      /requires the trait to declare an activationRequirement/,
    );
    expect(withTrait('ElementalDodgeBoon', { elementalMultiplier: 'Lightning' })).toThrow(
      /elementalMultiplier: must be one of/,
    );
    expect(withTrait('ElementalHealthBoon', { elementalMultiplier: undefined })).toThrow(
      /perElement effect requires an elementalMultiplier/,
    );
  });
});
