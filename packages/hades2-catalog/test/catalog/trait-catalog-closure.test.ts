import { describe, expect, it } from 'vitest';

import { catalog, createCatalog } from '../../src';
import { declarations } from '../../src/declarations';
import {
  expectedDeferredTraitKeys,
  expectedGiverPools,
  expectedPriorityTraitKeys,
} from './support/traits';

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

describe('trait catalog closure', () => {
  it('preserves the compiler boundary failure order across independent malformed inputs', () => {
    const mutate = (patch: Record<string, unknown>) =>
      createCatalog({
        ...declarations,
        traitCatalog: { ...declarations.traitCatalog, ...patch } as never,
      });

    expect(() =>
      mutate({
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'ElementalRarityUpgradeBoon'
            ? { ...trait, rarityFloorEffect: undefined }
            : trait,
        ),
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' ? { ...giver, label: '' } : giver,
        ),
      }),
    ).toThrow(/ElementalRarityUpgradeBoon\.rarityFloorEffect/);

    expect(() =>
      mutate({
        deferredTraitKeys: [...declarations.traitCatalog.deferredTraitKeys, 'AphroditeWeaponBoon'],
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite' ? { ...giver, label: '' } : giver,
        ),
      }),
    ).toThrow(/deferredTraitKeys/);

    expect(() =>
      mutate({
        boonRarityBases: {},
        aspects: declarations.traitCatalog.aspects.map((aspect) =>
          aspect.key === 'SuitHexAspect'
            ? { ...aspect, startingTrait: { traitKey: 'SpellMoonBeamTrait', giverKey: 'Missing' } }
            : aspect,
        ),
      }),
    ).toThrow(/boonRarityBases/);

    expect(() =>
      mutate({
        aspects: declarations.traitCatalog.aspects.map((aspect) =>
          aspect.key === 'SuitHexAspect'
            ? { ...aspect, startingTrait: { traitKey: 'SpellMoonBeamTrait', giverKey: 'Apollo' } }
            : aspect,
        ),
        traits: declarations.traitCatalog.traits.map((trait) =>
          trait.key === 'AllElementalBoon'
            ? {
                ...trait,
                selectedDisposition: {
                  kind: 'directTraitSets',
                  sets: [
                    {
                      key: 'earth',
                      traitKeys: ['AphroditeWeaponBoon', 'ElementalOlympianDamageBoon'],
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
                } as never,
              }
            : trait,
        ),
      }),
    ).toThrow(/must identify a spell provider/);
  });

  it('declares the complete field-NPC provider surfaces', () => {
    expect(traits).toBeDefined();
    expect(traits?.weapons.values).toHaveLength(6);
    expect(traits?.aspects.values).toHaveLength(24);
    expect(traits?.traits.values).toHaveLength(419);
    expect(traits?.givers.values.map((giver) => [giver.key, giver.traitKeys.length])).toEqual([
      ['Aphrodite', 22],
      ['Arachne', 8],
      ['Artemis', 9],
      ['Athena', 8],
      ['Icarus', 8],
      ['Apollo', 22],
      ['Ares', 22],
      ['Demeter', 22],
      ['Dionysus', 8],
      ['Hades', 8],
      ['Hephaestus', 22],
      ['Hera', 22],
      ['Hestia', 22],
      ['Poseidon', 22],
      ['Zeus', 22],
      ['Hermes', 13],
      ['Medea', 8],
      ['Narcissus', 9],
      ['Circe', 9],
      ['Echo', 8],
      ['WeaponUpgrade', 92],
      ['SpellDrop', 8],
      ['Chaos', 33],
    ]);
    expect(
      Object.fromEntries(traits?.givers.values.map((giver) => [giver.key, giver.traitKeys])),
    ).toEqual(expectedGiverPools);
    expect(declarations.traitCatalog.deferredTraitKeys).toEqual(expectedDeferredTraitKeys);
    for (const [giverKey, priorityTraitKeys] of Object.entries(expectedPriorityTraitKeys)) {
      expect(traits.givers.byKey[giverKey]?.priorityTraitKeys).toEqual(priorityTraitKeys);
    }
    expect(traits.givers.byKey.Hermes?.priorityTraitKeys).toEqual([]);
    expect(traits.givers.byKey.WeaponUpgrade?.priorityTraitKeys).toEqual([]);
  });

  it('declares the exact player-rarityless Story and field-NPC matrix', () => {
    const raritylessProviders = [
      'Arachne',
      'Icarus',
      'Medea',
      'Narcissus',
      'Circe',
      'Hades',
    ] as const;
    for (const giverKey of raritylessProviders) {
      const giver = traits.givers.byKey[giverKey];
      expect(giver?.rarityPolicy, giverKey).toEqual({ kind: 'none' });
      for (const traitKey of giver?.traitKeys ?? []) {
        expect(traits.traits.byKey[traitKey], `${giverKey}:${traitKey}`).toMatchObject({
          rarityDomain: { kind: 'none' },
          usesBoonRarity: false,
          blockInRunRarify: giverKey === 'Hades',
        });
      }
    }

    for (const giverKey of ['Athena', 'Artemis', 'Dionysus'] as const) {
      const giver = traits.givers.byKey[giverKey];
      expect(giver?.rarityPolicy.kind, giverKey).toBe('selectable');
      expect(
        giver?.traitKeys.every((key) => traits.traits.byKey[key]?.rarityDomain.kind === 'ranked'),
      ).toBe(true);
    }
  });

  it('declares the landed Echo matrix as rarityless with closed dispositions', () => {
    const giver = traits.givers.byKey.Echo;
    expect(giver?.rarityPolicy).toEqual({ kind: 'none' });
    expect(giver?.traitKeys).toEqual([
      'EchoLastReward',
      'EchoDeathDefianceRefill',
      'DiminishingDodgeBoon',
      'DiminishingHealthAndManaBoon',
      'EchoLastRunBoon',
      'EchoDoubleLevelBoon',
      'EchoDoubleShop',
      'EchoRepeatKeepsakeBoon',
    ]);
    expect(
      giver?.traitKeys.map((key) => ({
        key,
        rarityDomain: traits.traits.byKey[key]?.rarityDomain,
        disposition: traits.traits.byKey[key]?.selectedDisposition,
      })),
    ).toEqual([
      {
        key: 'EchoLastReward',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'lastReward' },
      },
      {
        key: 'EchoDeathDefianceRefill',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'survive' },
      },
      {
        key: 'DiminishingDodgeBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'numericNoOp' },
      },
      {
        key: 'DiminishingHealthAndManaBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'numericNoOp' },
      },
      {
        key: 'EchoLastRunBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'lastRunBoon' },
      },
      {
        key: 'EchoDoubleLevelBoon',
        rarityDomain: { kind: 'none' },
        disposition: { kind: 'echo', effect: 'doubleLevel' },
      },
      {
        key: 'EchoDoubleShop',
        rarityDomain: { kind: 'none' },
        disposition: {
          kind: 'echo',
          effect: 'doubleShop',
          excludedRewardTypes: ['SpellDrop'],
        },
      },
      {
        key: 'EchoRepeatKeepsakeBoon',
        rarityDomain: { kind: 'none' },
        disposition: {
          kind: 'echo',
          effect: 'repeatKeepsake',
          excludedKeepsakeKeys: [
            'AthenaEncounterKeepsake',
            'HadesAndPersephoneKeepsake',
            'EscalatingKeepsake',
            'FountainRarityKeepsake',
          ],
        },
      },
    ]);
  });

  it('keeps shared traits giver-neutral and closes deferred operands without placeholders', () => {
    expect(traits?.givers.byKey.Aphrodite?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.givers.byKey.Zeus?.traitKeys).toContain('SprintEchoBoon');
    expect(traits?.traits.byKey.SprintEchoBoon).toBeDefined();
    expect(traits?.traits.byKey.SorceryCritBoon).toBeDefined();
    expect(declarations.traitCatalog.deferredTraitKeys).not.toContain('SpellLaserTrait');
    expect(traits?.traits.byKey.SorceryCritBoon?.rarityDomain).toEqual({
      kind: 'ranked',
      freshOfferRarities: ['Common', 'Rare', 'Epic'],
      equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
    });
  });

  it('rejects unknown pools at the catalog boundary', () => {
    const unknownPool = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver, index) =>
          index === 0 ? { ...giver, traitKeys: [...giver.traitKeys, 'NotARealTrait'] } : giver,
        ),
      },
    };
    expect(() => createCatalog(unknownPool)).toThrow(/unknown trait/);
  });

  it('rejects malformed priority declarations and retired giver authoring seeds', () => {
    const duplicatePriority = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? {
                ...giver,
                priorityTraitKeys: [giver.priorityTraitKeys[0]!, ...giver.priorityTraitKeys],
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(duplicatePriority)).toThrow(/priorityTraitKeys/);

    const retiredSeed = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        givers: declarations.traitCatalog.givers.map((giver) =>
          giver.key === 'Aphrodite'
            ? {
                ...giver,
                defaultOffer: {
                  options: [
                    { traitKey: 'AphroditeWeaponBoon', rarity: 'Common' as const },
                    { traitKey: 'AphroditeSpecialBoon', rarity: 'Common' as const },
                    { traitKey: 'AphroditeCastBoon', rarity: 'Common' as const },
                  ] as const,
                  selectedOption: 0 as const,
                },
              }
            : giver,
        ),
      },
    };
    expect(() => createCatalog(retiredSeed as typeof declarations)).toThrow(
      /defaultOffer.*not supported/,
    );
  });

  it('keeps compiler-local deferred operands out of the normalized catalog', () => {
    const withoutCompilerKeys = {
      ...declarations,
      traitCatalog: {
        ...declarations.traitCatalog,
        deferredTraitKeys: declarations.traitCatalog.deferredTraitKeys,
      },
    };
    const normalized = createCatalog(withoutCompilerKeys);
    expect(normalized.traits.byKey.CastProjectileBoon).toBeDefined();
    expect(normalized.traits.byKey.CastAnywhereBoon).toBeDefined();
    expect(normalized.traits.byKey.SelfCastBoon).toBeDefined();
    expect('deferredTraitKeys' in normalized).toBe(false);
  });
});
