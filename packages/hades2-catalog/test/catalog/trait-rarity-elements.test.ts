import { describe, expect, it } from 'vitest';

import { createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import type { ProperUpbringingEffect } from '@run-planner/engine/catalog-schema';
import type { RawTraitDeclaration, RawTraitGiverDeclaration } from '../../src/declarations/traits';

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
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: {},
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must not be empty/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Lightning: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/unknown|must be one of/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 0 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/positive integer/);
    expect(() =>
      malformed({
        fromRarity: 'Epic',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Common/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Common',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1 } },
      }),
    ).toThrow(/must be Rare|must follow/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
      }),
    ).toThrow(/exactly the Proper Upbringing effect fields/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
        boonRarityContribution: { additive: { Rare: 1, Epic: 0 } },
      }),
    ).toThrow(/exactly Rare: 1/);
    expect(() =>
      malformed({
        fromRarity: 'Common',
        minimumRarity: 'Rare',
        activationElementMinimums: { Fire: 2 },
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
                    activationElementMinimums: { Fire: 2 },
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
});
