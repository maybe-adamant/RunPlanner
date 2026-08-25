import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import type { RawTraitDeclaration } from '../../src/declarations/traits';

const traits = {
  weapons: catalog.weapons,
  aspects: catalog.aspects,
  traits: catalog.traits,
  givers: catalog.traitGivers,
  echoLastRunBoon: catalog.echoLastRunBoon,
  offerContexts: catalog.traitOfferContexts,
  rarityOrder: catalog.traitRarityOrder,
  baseElements: catalog.traitBaseElements,
};

describe('trait dispositions and requirements compiler owner', () => {
  it('declares Infernal Contract as rarityless and Travel Deal as one exact ranked restock', () => {
    expect(traits.traits.byKey.InfernalContractBoon).toMatchObject({
      rarityDomain: { kind: 'none' },
      blockStacking: true,
      blockInRunRarify: true,
      excludeFromRarityCount: true,
    });
    expect(traits.traits.byKey.RestockBoon?.selectedDisposition).toEqual({
      kind: 'worldShopRestock',
      refillCount: 1,
      discountByRarity: { Common: 0.05, Rare: 0.1, Epic: 0.15, Heroic: 0.2 },
    });
  });

  it('compiler-closes All Together to the exact immutable four-pair direct-grant matrix', () => {
    const expected = {
      kind: 'directTraitSets',
      sets: [
        {
          key: 'earth',
          traitKeys: ['ElementalDamageBoon', 'ElementalOlympianDamageBoon'],
        },
        {
          key: 'fire',
          traitKeys: ['ElementalBaseDamageBoon', 'ElementalRallyBoon'],
        },
        {
          key: 'air',
          traitKeys: ['ElementalDamageFloorBoon', 'ElementalDodgeBoon'],
        },
        {
          key: 'water',
          traitKeys: ['ElementalHealthBoon', 'ElementalDamageCapBoon'],
        },
      ],
    } as const;
    const disposition = catalog.traits.byKey.AllElementalBoon?.selectedDisposition;
    expect(disposition).toEqual(expected);
    expect(Object.isFrozen(disposition)).toBe(true);
    if (disposition?.kind !== 'directTraitSets') throw new Error('missing All Together descriptor');
    expect(Object.isFrozen(disposition.sets)).toBe(true);
    expect(
      disposition.sets.every((set) => Object.isFrozen(set) && Object.isFrozen(set.traitKeys)),
    ).toBe(true);

    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'AllElementalBoon'
              ? ({
                  ...trait,
                  selectedDisposition: {
                    ...expected,
                    sets: [expected.sets[0], expected.sets[2], expected.sets[1], expected.sets[3]],
                  },
                } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/must declare earth, fire, air, and water in source order/);

    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'HeraWeaponBoon'
              ? ({ ...trait, selectedDisposition: expected } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/direct trait sets are reserved for All Together/);
  });

  it('compiler-closes Gold Gold Gold to excluding exactly SpellDrop', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'EchoDoubleShop'
              ? ({
                  ...trait,
                  selectedDisposition: { kind: 'echo', effect: 'doubleShop' },
                } as RawTraitDeclaration)
              : trait,
          ),
        },
      }),
    ).toThrow(/requires kind, effect, and excludedRewardTypes/);

    const mutatedExcludedTypes = [['GiftDrop'], ['SpellDrop', 'GiftDrop']] as const;
    for (const excludedRewardTypes of mutatedExcludedTypes) {
      expect(() =>
        createCatalog({
          ...declarations,
          traitCatalog: {
            ...declarations.traitCatalog,
            traits: declarations.traitCatalog.traits.map((trait) =>
              trait.key === 'EchoDoubleShop'
                ? ({
                    ...trait,
                    selectedDisposition: {
                      kind: 'echo',
                      effect: 'doubleShop',
                      excludedRewardTypes,
                    },
                  } as RawTraitDeclaration)
                : trait,
            ),
          },
        }),
      ).toThrow(/must equal \[SpellDrop\]/);
    }
  });

  it('rejects an unknown Echo disposition effect at the raw declaration boundary', () => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'EchoDoubleLevelBoon'
            ? {
                ...trait,
                selectedDisposition: { kind: 'echo', effect: 'unexpected' } as never,
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(
      /selectedDisposition.effect.*numericNoOp.*survive.*doubleLevel/,
    );
  });

  it('declares the complete equipped Narcissus disposition table', () => {
    const table = Object.fromEntries(
      ['A', 'B', 'C', 'D', 'E', 'F', 'G', 'H', 'I'].map((suffix) => {
        const trait = catalog.traits.byKey[`Narcissus${suffix}`];
        if (trait === undefined) throw new Error(`missing Narcissus${suffix}`);
        return [suffix, trait.selectedDisposition];
      }),
    );
    expect(table).toEqual({
      A: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'pom', rewardType: 'StoreRewardRandomStack' }],
      }),
      B: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'ashes', rewardType: 'MetaCardPointsCommonDrop' }],
      }),
      C: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'currency', rewardType: 'Currency' }],
      }),
      D: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'psyche', rewardType: 'MemPointsCommonDrop' },
          { key: 'maxMana', rewardType: 'MaxManaDrop' },
        ],
      }),
      E: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'bones', rewardType: 'MetaCurrencyDrop' },
          { key: 'maxHealth', rewardType: 'MaxHealthDrop' },
        ],
      }),
      F: { kind: 'equip' },
      G: expect.objectContaining({
        kind: 'producePickups',
        pickups: [
          { key: 'elementalBoost1', rewardType: 'ElementalBoost' },
          { key: 'elementalBoost2', rewardType: 'ElementalBoost' },
        ],
      }),
      H: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'lastStand', rewardType: 'LastStandDrop' }],
      }),
      I: expect.objectContaining({
        kind: 'producePickups',
        pickups: [{ key: 'mysteryBoon', rewardType: 'BlindBoxLoot' }],
      }),
    });
  });

  it('declares Quick Buck and Buried Treasure as exact generated-pickup traits', () => {
    expect(catalog.traits.byKey.MoneyMultiplierBoon?.selectedDisposition).toEqual({
      kind: 'producePickups',
      producerLifecycleKey: 'GeneratedTraitPickup',
      pickups: [{ key: 'quickBuckGold', rewardType: 'RoomMoneyDrop' }],
    });
    expect(catalog.traits.byKey.RoomRewardBonusBoon?.selectedDisposition).toEqual({
      kind: 'producePickups',
      producerLifecycleKey: 'GeneratedTraitPickup',
      pickups: [
        { key: 'smallGold', rewardType: 'RoomMoneySmallDrop' },
        { key: 'tinyGold1', rewardType: 'RoomMoneyTinyDrop' },
        { key: 'tinyGold2', rewardType: 'RoomMoneyTinyDrop' },
        { key: 'minorHeal1', rewardType: 'HealDropMinor' },
        { key: 'minorHeal2', rewardType: 'HealDropMinor' },
        { key: 'bones', rewardType: 'MetaCurrencyDrop', excludeStorySource: true },
      ],
    });
  });

  it('owns Cherished Heirloom as the sole exact rank-one keepsake advance disposition', () => {
    expect(catalog.traits.byKey.KeepsakeLevelBoon?.selectedDisposition).toEqual({
      kind: 'advanceCurrentKeepsake',
      rankBonus: 1,
    });
    expect(
      catalog.traits.values.filter(
        (trait) => trait.selectedDisposition.kind === 'advanceCurrentKeepsake',
      ),
    ).toHaveLength(1);
  });

  it.each([
    ['missing', undefined],
    ['wrong rank', { kind: 'advanceCurrentKeepsake', rankBonus: 2 }],
    ['wrong kind', { kind: 'noOp' }],
  ] as const)('rejects a %s Cherished keepsake advance declaration', (_label, disposition) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'KeepsakeLevelBoon'
            ? { ...trait, selectedDisposition: disposition as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(/KeepsakeLevelBoon|rankBonus 1/);
  });

  it('rejects the Cherished disposition on any other trait', () => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'ApolloWeaponBoon'
            ? {
                ...trait,
                selectedDisposition: { kind: 'advanceCurrentKeepsake', rankBonus: 1 } as never,
              }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(/reserved for KeepsakeLevelBoon/);
  });

  it.each([
    [
      'unknown pickup lifecycle',
      { producerLifecycleKey: 'MissingLifecycle' },
      /unknown producer lifecycle/,
    ],
    [
      'unknown pickup reward',
      { pickups: [{ key: 'pom', rewardType: 'MissingReward' }] },
      /unknown reward type/,
    ],
    [
      'lifecycle reward mismatch',
      { producerLifecycleKey: 'RoomReward' },
      /not supported by producer lifecycle/,
    ],
  ] as const)('rejects Narcissus pickup declaration with %s', (_name, patch, message) => {
    const malformed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'NarcissusA'
            ? { ...trait, selectedDisposition: { ...trait.selectedDisposition, ...patch } as never }
            : trait,
        ),
      },
    };
    expect(() => createCatalog(malformed)).toThrow(message);
  });
});
