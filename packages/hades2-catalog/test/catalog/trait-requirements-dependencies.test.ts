import { describe, expect, it } from 'vitest';

import { catalog } from '../../src';
import { declarations } from '../../src/declarations';
import {
  expectedElementTraitKeys,
  expectedDevotionMixedRequirementOwners,
  expectedGiverPools,
  expectedLinkedBoonRequirementOwners,
  expectedOrdinarySlots,
  expectedOfferRequirements,
  expectedPositiveRequirementOwners,
  expectedSettledSpellDropRequirementOwners,
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
const allRequirements = (trait: (typeof traits.traits.values)[number]) => [
  ...trait.linkedBoonRequirements,
  ...trait.eligibilityRequirements,
];

describe('trait requirements and dependencies', () => {
  it('declares the three optional linked-priority insertions', () => {
    expect(
      Object.fromEntries(
        traits.traits.values
          .filter((trait) => trait.optionalLinkedPriority)
          .map((trait) => [trait.key, trait.optionalLinkedPriority]),
      ),
    ).toEqual({
      BlindChanceBoon: true,
      MassiveKnockupBoon: true,
      PoseidonStatusBoon: true,
    });
  });

  it('keeps Trial exclusion on ordinary Duos while preserving source overrides', () => {
    const trialOverrides = new Set([
      'ApolloSecondStageCastBoon',
      'GoodStuffBoon',
      'SuperSacrificeBoonHera',
      'SuperSacrificeBoonZeus',
      'SelfCastBoon',
    ]);
    const duoTraits = traits.traits.values.filter(
      (trait) =>
        trait.rarityDomain.kind === 'ranked' &&
        trait.rarityDomain.freshOfferRarities.length === 1 &&
        trait.rarityDomain.freshOfferRarities[0] === 'Duo',
    );
    expect(duoTraits.map((trait) => trait.key)).toEqual(
      expect.arrayContaining([...trialOverrides]),
    );
    for (const trait of duoTraits) {
      const devotionRequirement = trait.eligibilityRequirements.find(
        (requirement) =>
          requirement.kind === 'offerContext' && requirement.context === 'devotionNoDuo',
      );
      expect(devotionRequirement).toEqual(
        trialOverrides.has(trait.key)
          ? undefined
          : { kind: 'offerContext', context: 'devotionNoDuo', required: false },
      );
    }
  });

  it('normalizes rarity, element, context, and derived-fact contracts', () => {
    expect(traits?.rarityOrder).toEqual(['Common', 'Rare', 'Epic', 'Heroic']);
    expect(traits?.baseElements).toEqual(['Earth', 'Air', 'Fire', 'Water']);
    expect(traits?.offerContexts.byKey.devotionNoDuo?.blockedRarity).toBe('Duo');
    expect(traits?.offerContexts.byKey.blockGiftBoons?.roomFlag).toBe('BlockGiftBoons');
    expect(traits?.givers.byKey.Aphrodite?.rarityPolicy).toEqual({
      kind: 'selectable',
      rarities: ['Common', 'Rare', 'Epic'],
    });
    expect(traits?.givers.byKey.Icarus?.rarityPolicy).toEqual({ kind: 'none' });
    expect(traits?.givers.byKey.Hades?.rarityPolicy).toEqual({ kind: 'none' });
    expect(traits?.givers.byKey.Dionysus?.rarityPolicy).toEqual({
      kind: 'selectable',
      rarities: ['Common', 'Rare', 'Epic'],
    });
    for (const traitKey of expectedGiverPools.Hades ?? []) {
      expect(traits.traits.byKey[traitKey]).toMatchObject({
        rarityDomain: { kind: 'none' },
        elementContributions: {},
        usesBoonRarity: false,
        isCoreGodTrait: false,
        blockStacking: false,
        blockInRunRarify: true,
        excludeFromRarityCount: false,
      });
      expect(traits.traits.byKey[traitKey]?.equipmentSlot).toBeUndefined();
    }
    for (const traitKey of expectedGiverPools.Dionysus ?? []) {
      expect(traits.traits.byKey[traitKey]).toMatchObject({
        rarityDomain: {
          kind: 'ranked',
          freshOfferRarities: ['Common', 'Rare', 'Epic'],
          equippedRarities: ['Common', 'Rare', 'Epic', 'Heroic'],
        },
        elementContributions: { Water: 1 },
        usesBoonRarity: true,
        isCoreGodTrait: false,
        blockStacking: false,
        blockInRunRarify: false,
        excludeFromRarityCount: false,
      });
      expect(traits.traits.byKey[traitKey]?.equipmentSlot).toBeUndefined();
    }
    expect(traits?.traits.byKey.FocusAttackDamageTrait?.eligibilityRequirements).toEqual([
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeWeaponBoon',
          'ApolloWeaponBoon',
          'AresWeaponBoon',
          'DemeterWeaponBoon',
          'HephaestusWeaponBoon',
          'HeraWeaponBoon',
          'HestiaWeaponBoon',
          'PoseidonWeaponBoon',
          'ZeusWeaponBoon',
        ],
      },
    ]);
    expect(traits?.traits.byKey.FocusSpecialDamageTrait?.eligibilityRequirements).toEqual([
      {
        kind: 'anyEquippedTrait',
        traitKeys: [
          'AphroditeSpecialBoon',
          'ApolloSpecialBoon',
          'AresSpecialBoon',
          'DemeterSpecialBoon',
          'HephaestusSpecialBoon',
          'HeraSpecialBoon',
          'HestiaSpecialBoon',
          'PoseidonSpecialBoon',
          'ZeusSpecialBoon',
        ],
      },
    ]);
    expect(traits?.traits.byKey.FocusAttackDamageTrait?.selectedDisposition).toEqual({
      kind: 'upgradeOccupiedBoonSlot',
      slot: 'Melee',
      levelCount: 3,
    });
    expect(traits?.traits.byKey.FocusSpecialDamageTrait?.selectedDisposition).toEqual({
      kind: 'upgradeOccupiedBoonSlot',
      slot: 'Secondary',
      levelCount: 3,
    });
    expect(traits?.traits.byKey.UpgradeHammerBoon?.targetedAcquisition).toEqual({
      kind: 'upgradeHammerToRank2',
      target: 'upgradableHammer',
    });

    const allElemental = traits?.traits.byKey.AllElementalBoon;
    expect(allElemental?.elementContributions).toEqual({
      Aether: 1,
      Earth: 1,
      Air: 1,
      Fire: 1,
      Water: 1,
    });
    expect(traits?.traits.byKey.CommonGlobalDamageBoon?.eligibilityRequirements).toContainEqual({
      kind: 'godBoonRarityCount',
      rarity: 'Common',
      minimum: 0,
      maximum: 0,
    });
    expect(traits?.traits.byKey.BoonGrowthBoon?.eligibilityRequirements).toContainEqual({
      kind: 'rarifiableTrait',
    });
    expect(traits?.traits.byKey.BoonDecayBoon?.targetedAcquisition).toEqual({
      kind: 'promoteGodTraitToHeroic',
      target: 'superchargeableGodTrait',
    });
    expect(traits?.traits.byKey.HephaestusWeaponBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 9,
      Rare: 7,
      Epic: 5,
      Heroic: 3,
    });
    expect(traits?.traits.byKey.HephaestusSpecialBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 11,
      Rare: 9,
      Epic: 7,
      Heroic: 5,
    });
    expect(traits?.traits.byKey.HephaestusSprintBoon?.maximumEligibleLevelByRarity).toEqual({
      Common: 8,
      Rare: 7,
      Epic: 6,
      Heroic: 5,
    });
    expect(traits?.traits.byKey.ElementalUnifiedBoon?.eligibilityRequirements).toContainEqual({
      kind: 'highestBaseElementCount',
      minimum: 4,
    });
    expect(traits?.traits.byKey.ElementalDamageBoon?.eligibilityRequirements).toContainEqual({
      kind: 'elementCount',
      element: 'Earth',
      minimum: 2,
    });
    expect(traits?.traits.byKey.PlantHealthBoon?.eligibilityRequirements).toContainEqual({
      kind: 'offerContext',
      context: 'blockGiftBoons',
      required: false,
    });
    expect(
      Object.fromEntries(
        traits.traits.values
          .filter((trait) => trait.equipmentSlot !== undefined && trait.equipmentSlot !== 'Spell')
          .map((trait) => [trait.key, trait.equipmentSlot]),
      ),
    ).toEqual(expectedOrdinarySlots);

    expect(
      Object.fromEntries(
        catalog.traitElements.map((element) => [
          element,
          traits.traits.values
            .filter((trait) => trait.elementContributions[element] !== undefined)
            .map((trait) => trait.key)
            .sort(),
        ]),
      ),
    ).toEqual(expectedElementTraitKeys);
    expect(
      new Set(traits.traits.values.flatMap((trait) => Object.values(trait.elementContributions))),
    ).toEqual(new Set([1]));

    // The declaration set is the source expected map for the normalized
    // classification. Compare every included trait, including explicit
    // rarityless NPC declarations and the 92 no-rarity Hammers.
    const expectedCoreGodTraitKeys = new Set(
      declarations.traitCatalog.givers
        .filter((giver) => giver.providerKind === 'olympian')
        .flatMap((giver) => giver.traitKeys),
    );
    for (const expected of declarations.traitCatalog.traits) {
      const actual = traits.traits.byKey[expected.key];
      expect(actual).toBeDefined();
      if (actual === undefined) continue;
      expect({
        key: actual.key,
        label: actual.label,
        rarityDomain: actual.rarityDomain,
        eligibilityRequirements: actual.eligibilityRequirements,
        linkedBoonRequirements: actual.linkedBoonRequirements,
        equipmentSlot: actual.equipmentSlot,
        elementContributions: actual.elementContributions,
        usesBoonRarity: actual.usesBoonRarity,
        isCoreGodTrait: actual.isCoreGodTrait,
        blockStacking: actual.blockStacking,
        blockInRunRarify: actual.blockInRunRarify,
        excludeFromRarityCount: actual.excludeFromRarityCount,
        selfExclusion: actual.selfExclusion,
        hammerCompatibility: actual.hammerCompatibility,
      }).toEqual({
        key: expected.key,
        label: expected.label,
        rarityDomain:
          expected.hammerCompatibility === undefined && expected.rarityDomain !== 'none'
            ? {
                kind: 'ranked',
                freshOfferRarities: expected.freshOfferRarities,
                equippedRarities: expected.equippedRarities,
              }
            : { kind: 'none' },
        eligibilityRequirements: expected.eligibilityRequirements,
        linkedBoonRequirements: expected.linkedBoonRequirements,
        equipmentSlot: expected.equipmentSlot,
        elementContributions: expected.elementContributions,
        usesBoonRarity: expected.usesBoonRarity,
        isCoreGodTrait: expectedCoreGodTraitKeys.has(expected.key),
        blockStacking: expected.blockStacking,
        blockInRunRarify: expected.blockInRunRarify,
        excludeFromRarityCount: expected.excludeFromRarityCount,
        selfExclusion: expected.selfExclusion,
        hammerCompatibility: expected.hammerCompatibility,
      });
    }
    expect(traits.traits.values).toHaveLength(declarations.traitCatalog.traits.length);
    expect(traits?.traits.byKey.ElementalOlympianDamageBoon?.rarityDomain).toEqual({
      kind: 'ranked',
      freshOfferRarities: ['Common', 'Rare', 'Epic'],
      equippedRarities: ['Common', 'Rare', 'Epic'],
    });
    expect(Object.isFrozen(traits.traits.byKey.AphroditeWeaponBoon?.rarityDomain)).toBe(true);
    expect(Object.isFrozen(traits.traits.byKey.StaffDoubleAttackTrait?.rarityDomain)).toBe(true);
  });

  it('keeps the complete positive, settled SpellDrop, and dependency requirement matrix', () => {
    type Requirement = (typeof traits.traits.values)[number]['eligibilityRequirements'][number];
    const containsPositiveEquippedRequirement = (requirement: Requirement): boolean => {
      if (requirement.kind === 'anyEquippedTrait') return true;
      if (requirement.kind === 'all')
        return requirement.requirements.some(containsPositiveEquippedRequirement);
      return false;
    };
    const positiveOwners = traits.traits.values
      .filter((trait) => allRequirements(trait).some(containsPositiveEquippedRequirement))
      .map((trait) => trait.key);
    expect(positiveOwners).toHaveLength(expectedPositiveRequirementOwners.length);
    expect(new Set(positiveOwners)).toEqual(new Set(expectedPositiveRequirementOwners));

    const containsSettledSpellDropRequirement = (requirement: Requirement): boolean => {
      if (requirement.kind === 'settledSpellDrop') return true;
      if (requirement.kind === 'all')
        return requirement.requirements.some(containsSettledSpellDropRequirement);
      return false;
    };
    const settledSpellDropOwners = traits.traits.values
      .filter((trait) => allRequirements(trait).some(containsSettledSpellDropRequirement))
      .map((trait) => trait.key);
    expect(settledSpellDropOwners).toEqual(expectedSettledSpellDropRequirementOwners);

    const actualOfferRequirements = Object.fromEntries(
      traits.traits.values
        .map(
          (trait) =>
            [
              trait.key,
              allRequirements(trait).filter(
                (requirement) =>
                  !(
                    requirement.kind === 'offerContext' &&
                    requirement.context === 'devotionNoDuo' &&
                    requirement.required === false
                  ),
              ),
            ] as const,
        )
        .filter(([, requirements]) => requirements.length > 0)
        .map(([traitKey, requirements]) => [traitKey, JSON.stringify(requirements)]),
    );
    expect(actualOfferRequirements).toEqual(expectedOfferRequirements);

    const linkedOwners = new Set<string>(expectedLinkedBoonRequirementOwners);
    const devotionMixedOwners = new Set<string>(expectedDevotionMixedRequirementOwners);
    const castMixedOwners = new Set(['CastAnywhereBoon', 'SelfCastBoon']);
    for (const trait of traits.traits.values) {
      const expected = JSON.parse(expectedOfferRequirements[trait.key] ?? '[]') as Requirement[];
      const linked = linkedOwners.has(trait.key)
        ? castMixedOwners.has(trait.key)
          ? [expected[0]!]
          : expected
        : [];
      const eligibility = devotionMixedOwners.has(trait.key)
        ? [{ kind: 'offerContext', context: 'devotionNoDuo', required: false }]
        : castMixedOwners.has(trait.key)
          ? [expected[1]!]
          : linkedOwners.has(trait.key)
            ? []
            : expected;
      expect(trait.linkedBoonRequirements).toEqual(linked);
      expect(trait.eligibilityRequirements).toEqual(eligibility);
    }

    const deferred = new Set(declarations.traitCatalog.deferredTraitKeys);
    const walk = (requirement: Requirement): readonly string[] => {
      if (requirement.kind === 'anyEquippedTrait' || requirement.kind === 'notEquippedTrait') {
        return requirement.traitKeys;
      }
      if (requirement.kind === 'all') return requirement.requirements.flatMap(walk);
      return [];
    };
    for (const trait of traits.traits.values) {
      for (const requirement of allRequirements(trait)) {
        for (const key of walk(requirement)) {
          expect(traits.traits.byKey[key] ?? deferred.has(key)).toBeTruthy();
        }
      }
    }
    expect(traits.traits.byKey.LobAmmoMagnetismTrait?.eligibilityRequirements).toContainEqual({
      kind: 'notEquippedTrait',
      traitKeys: ['LobPulseAmmoTrait'],
    });
    expect(traits.traits.byKey.LobPulseAmmoTrait?.eligibilityRequirements).toContainEqual({
      kind: 'notEquippedTrait',
      traitKeys: ['LobAmmoMagnetismTrait'],
    });

    const partition = traits.traits.values.reduce(
      (counts, trait) => {
        const eligibility = trait.eligibilityRequirements.length > 0;
        const linked = trait.linkedBoonRequirements.length > 0;
        counts[
          eligibility && linked
            ? 'mixed'
            : eligibility
              ? 'eligibilityOnly'
              : linked
                ? 'linkedOnly'
                : 'empty'
        ] += 1;
        return counts;
      },
      { empty: 0, linkedOnly: 0, eligibilityOnly: 0, mixed: 0 },
    );
    expect(partition).toEqual({ empty: 316, linkedOnly: 41, eligibilityOnly: 28, mixed: 34 });
    expect(traits.traits.byKey.SprintEchoBoon).toMatchObject({
      eligibilityRequirements: [
        { kind: 'offerContext', context: 'devotionNoDuo', required: false },
      ],
    });
    expect(traits.traits.byKey.SprintEchoBoon?.linkedBoonRequirements).toHaveLength(1);
    expect(traits.traits.byKey.WeakPotencyBoon).toMatchObject({
      eligibilityRequirements: [],
    });
    expect(traits.traits.byKey.WeakPotencyBoon?.linkedBoonRequirements).toHaveLength(1);
  });
});
