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

describe('trait declarations and giver compiler owners', () => {
  it('declares the exact shop-aware God-trait giver set', () => {
    const actual = catalog.traitGivers.values
      .filter((giver) => giver.shopAwareGodTrait)
      .map((giver) => giver.key)
      .sort();
    expect(actual).toEqual([
      'Aphrodite',
      'Apollo',
      'Ares',
      'Artemis',
      'Athena',
      'Demeter',
      'Dionysus',
      'Hades',
      'Hephaestus',
      'Hera',
      'Hermes',
      'Hestia',
      'Poseidon',
      'Zeus',
    ]);
  });
  it('owns the exact runtime offer requirements and ordered fallback domains', () => {
    const expected = {
      NarcissusH: {
        requirement: 'missingLastStand',
        fallbacks: ['NarcissusB', 'NarcissusC', 'NarcissusD'],
      },
      EchoDeathDefianceRefill: {
        requirement: 'missingLastStand',
        fallbacks: ['DiminishingDodgeBoon', 'DiminishingHealthAndManaBoon', 'EchoDoubleLevelBoon'],
      },
      DeathDefianceRetaliateCurse: {
        requirement: 'heldLastStand',
        fallbacks: ['HealingOnDeathCurse', 'MoneyOnDeathCurse', 'ManaOverTimeCurse'],
      },
      DeathDefianceRefillBoon: {
        requirement: 'missingLastStandAndAthenaFirstMeeting',
        fallbacks: [
          'InvulnerabilityDashBoon',
          'RetaliateInvulnerabilityBoon',
          'FocusLastStandBoon',
        ],
      },
      HadesDeathDefianceDamageBoon: {
        requirement: 'deathDefianceDamageBoonEligible',
        fallbacks: ['HadesLifestealBoon', 'HadesPreDamageBoon', 'HadesChronosDebuffBoon'],
      },
    } as const;

    for (const [traitKey, policy] of Object.entries(expected)) {
      const trait = traits.traits.byKey[traitKey];
      expect(trait?.runtimeOfferRequirement, traitKey).toBe(policy.requirement);
      expect(trait?.runtimeOfferFallbackTraitKeys, traitKey).toEqual(policy.fallbacks);
    }
  });

  it('declares the exact three traits blocked after any prior pickup', () => {
    expect(
      catalog.traits.values
        .filter((trait) => trait.blockOfferIfPreviouslyPicked)
        .map((trait) => trait.key)
        .sort(),
    ).toEqual(['BoonDecayBoon', 'KeepsakeLevelBoon', 'RoomRewardBonusBoon']);
  });

  it('rejects a non-boolean previously-picked declaration flag', () => {
    expect(() =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key === 'BoonDecayBoon'
              ? { ...trait, blockOfferIfPreviouslyPicked: 'yes' as never }
              : trait,
          ),
        },
      }),
    ).toThrow(/blockOfferIfPreviouslyPicked.*boolean/);
  });

  it('rejects missing and extra previously-picked declaration ownership', () => {
    const mutate = (traitKey: string, value: boolean | undefined) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          traits: declarations.traitCatalog.traits.map((trait) =>
            trait.key !== traitKey
              ? trait
              : ({ ...trait, blockOfferIfPreviouslyPicked: value } as RawTraitDeclaration),
          ),
        },
      });
    expect(() => mutate('BoonDecayBoon', undefined)).toThrow(
      /BoonDecayBoon\.blockOfferIfPreviouslyPicked.*required/,
    );
    expect(() => mutate('HeraWeaponBoon', true)).toThrow(
      /HeraWeaponBoon\.blockOfferIfPreviouslyPicked.*reserved/,
    );
  });

  it('declares Selene’s eight normal spells and Aspect-owned Sky Fall exactly', () => {
    expect(traits.givers.byKey.SpellDrop).toMatchObject({
      providerKind: 'spell',
      traitKeys: [
        'SpellPolymorphTrait',
        'SpellMeteorTrait',
        'SpellTransformTrait',
        'SpellLeapTrait',
        'SpellLaserTrait',
        'SpellSummonTrait',
        'SpellTimeSlowTrait',
        'SpellPotionTrait',
      ],
      selectedOptionPathPointBonuses: [0, 1, 2],
    });
    expect(traits.aspects.byKey.SuitHexAspect?.startingTrait).toEqual({
      traitKey: 'SpellMoonBeamTrait',
      giverKey: 'SpellDrop',
    });
    for (const key of [...traits.givers.byKey.SpellDrop!.traitKeys, 'SpellMoonBeamTrait'])
      expect(traits.traits.byKey[key]?.equipmentSlot).toBe('Spell');
  });

  it('rejects a non-SpellDrop or malformed ordered spell-point profile', () => {
    const mutate = (giverKey: string, selectedOptionPathPointBonuses: unknown) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          givers: declarations.traitCatalog.givers.map((giver) =>
            giver.key === giverKey
              ? ({ ...giver, selectedOptionPathPointBonuses } as never)
              : giver,
          ),
        },
      });
    expect(() => mutate('SpellDrop', [0, 2, 1])).toThrow(/ordered \[0, 1, 2\]/);
    expect(() => mutate('Apollo', [0, 1, 2])).toThrow(/SpellDrop ordered/);
  });

  it('rejects malformed Aspect starting spell links', () => {
    const mutate = (startingTrait: unknown) =>
      createCatalog({
        ...declarations,
        traitCatalog: {
          ...declarations.traitCatalog,
          aspects: declarations.traitCatalog.aspects.map((aspect) =>
            aspect.key === 'SuitHexAspect'
              ? {
                  ...aspect,
                  startingTrait: startingTrait as { traitKey: string; giverKey: string },
                }
              : aspect,
          ),
        },
      });
    expect(() => mutate({ traitKey: 'UnknownSpell', giverKey: 'SpellDrop' })).toThrow(
      /unknown trait/,
    );
    expect(() => mutate({ traitKey: 'SpellPolymorphTrait', giverKey: 'SpellDrop' })).toThrow(
      /must not belong to the normal spell pool/,
    );
    expect(() => mutate({ traitKey: 'SpellMoonBeamTrait', giverKey: 'Apollo' })).toThrow(
      /must identify a spell provider/,
    );
    expect(() =>
      mutate({ traitKey: 'SpellMoonBeamTrait', giverKey: 'SpellDrop', extra: true }),
    ).toThrow(/exactly traitKey and giverKey/);
    expect(() => mutate({ traitKey: '', giverKey: 'SpellDrop' })).toThrow(/must not be empty/);
  });
});
