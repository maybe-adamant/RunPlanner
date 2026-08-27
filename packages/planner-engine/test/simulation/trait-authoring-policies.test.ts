import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  createSteadyGrowthOutcomeAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  assessTraitOption,
  assessSelectedTargetedAcquisition,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  hasEffectiveInRunUpgrade,
  isPomEligibleTrait,
  isPomUpgradeTarget,
  assessNaturalSelectionTargets,
  assessRansom,
  recordReachedTraitOffer,
  traitOfferStartingDraft,
  targetedAcquisitionTargetKeys,
  type TraitOfferEvent,
  type TraitLevelMutationEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { createSteadyGrowthCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
import { evaluateNaturalSelectionResultCandidate } from '../../src/simulation/candidates/trait-offer';

const owner = { kind: 'project' } as SemanticAddress;
const naturalSelectionSlots = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;

function levelMutation(
  sequence: number,
  targetTraitKey: string,
  oldLevel: number,
  newLevel: number,
): TraitLevelMutationEvent {
  return {
    kind: 'levelMutation',
    owner,
    acquisitionRole: 'test',
    sequence,
    acquisitionPoint: 'test',
    targetTraitKey,
    oldLevel,
    newLevel,
  };
}

function historyWith(
  giverKey: string,
  traitKey: string,
  rarity?: TraitOfferEvent['options'][number]['rarity'],
) {
  return historyFrom([{ giverKey, traitKey, rarity }]);
}

function historyFrom(
  entries: readonly {
    readonly giverKey: string;
    readonly traitKey: string;
    readonly rarity?: TraitOfferEvent['options'][number]['rarity'];
  }[],
) {
  return foldTraitHistoryEvents(
    catalog,
    entries.map(({ giverKey, traitKey, rarity }, index) => {
      const giver = catalog.traitGivers.byKey[giverKey];
      if (giver === undefined) throw new Error(`missing giver ${giverKey}`);
      const options = [
        { traitKey: giver.traitKeys[0]! },
        { traitKey: giver.traitKeys[1]! },
        { traitKey: giver.traitKeys[2]! },
      ] as [
        TraitOfferEvent['options'][number],
        TraitOfferEvent['options'][number],
        TraitOfferEvent['options'][number],
      ];
      options[0] = { traitKey, ...(rarity === undefined ? {} : { rarity }) };
      return {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: `test${index + 1}`,
        sequence: index + 1,
        giverKey,
        options: Object.freeze(options),
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      };
    }),
  );
}

function findingCode(traitKey: string, history: ReturnType<typeof createTraitHistoryState>) {
  return assessTraitOption(catalog, traitKey, history).findings[0]?.code;
}

describe('Boon Growth and Boon Decay target predicates', () => {
  it('does not materialize zero Persephone contributions in an automatic three-option draft', () => {
    const draft = traitOfferStartingDraft(catalog, 'Apollo', createTraitHistoryState(), {
      aspectKey: 'LobImpulseAspect',
    });
    if (draft === undefined) throw new Error('missing Apollo starting draft');

    expect(draft.options).toHaveLength(3);
    expect(draft.options.every((option) => !('persephoneLevelBonus' in option))).toBe(true);
  });

  it('keeps one-time pickup history after King’s Ransom removes Bridal Glow', () => {
    const before = historyFrom([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'BoonDecayBoon', rarity: 'Common' },
      { giverKey: 'Hera', traitKey: 'DamageShareRetaliateBoon', rarity: 'Common' },
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
    ]);
    const assessment = assessRansom(
      catalog,
      before,
      'SuperSacrificeBoonZeus',
      owner,
      'test',
      5,
      'test',
    );

    expect(assessment.removedTraitKeys).toEqual([
      'HeraWeaponBoon',
      'BoonDecayBoon',
      'DamageShareRetaliateBoon',
    ]);
    expect(assessment.resultingHistory.equippedTraits.BoonDecayBoon).toBeUndefined();
    expect(assessment.resultingHistory.previouslyPickedTraitKeys).toContain('BoonDecayBoon');
    expect(assessTraitOption(catalog, 'BoonDecayBoon', assessment.resultingHistory)).toMatchObject({
      legal: false,
      findings: expect.arrayContaining([
        expect.objectContaining({ code: 'previouslyPicked', traitKey: 'BoonDecayBoon' }),
      ]),
    });
    expect(
      assessTraitOption(catalog, 'DamageShareRetaliateBoon', assessment.resultingHistory).findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'previouslyPicked' }));
  });

  it('exposes the Ransom transform as one data-only provider-indexed assessment', () => {
    const before = historyFrom([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
    ]);
    const assessment = assessRansom(
      catalog,
      before,
      'SuperSacrificeBoonZeus',
      owner,
      'test',
      3,
      'test',
    );
    expect(assessment).toMatchObject({
      applies: true,
      removedTraitKeys: ['HeraWeaponBoon'],
      removedCount: 1,
      levelBonus: 4,
      buffedTraitKeys: ['ZeusWeaponBoon'],
    });
    expect(assessment.resultingHistory.equippedTraits.HeraWeaponBoon).toBeUndefined();
    expect(assessment.resultingHistory.equippedTraits.ZeusWeaponBoon?.level).toBe(5);
  });

  it('buffs a ranked non-priority Olympian passive through the same normalized giver identity', () => {
    const before = historyFrom([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' },
      { giverKey: 'Zeus', traitKey: 'ZeusManaBoltBoon', rarity: 'Common' },
    ]);
    const assessment = assessRansom(
      catalog,
      before,
      'SuperSacrificeBoonZeus',
      owner,
      'test',
      3,
      'test',
    );
    expect(catalog.traitGivers.byKey.Zeus?.priorityTraitKeys).not.toContain('ZeusManaBoltBoon');
    expect(isPomEligibleTrait(catalog, 'ZeusManaBoltBoon')).toBe(true);
    expect(assessment).toMatchObject({
      applies: true,
      removedCount: 1,
      levelBonus: 4,
      buffedTraitKeys: ['ZeusManaBoltBoon'],
    });
    expect(assessment.resultingHistory.equippedTraits.ZeusManaBoltBoon?.level).toBe(5);
  });

  it('requires one Steady Growth target to work for every reached branch', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const outcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(biome, createOccurrenceId('steady-branch')),
      'Combat',
    );
    const before = historyWith('Apollo', 'ApolloWeaponBoon', 'Common');
    const threshold = {
      traitKey: 'BoonGrowthBoon',
      acquisitionIdentity: 'steady',
      requiredInterval: 6,
      before,
      eligibleTargetKeys: Object.freeze(['ApolloWeaponBoon']),
    } as const;
    const noTargetThreshold = Object.freeze({
      ...threshold,
      eligibleTargetKeys: Object.freeze([]),
    });
    const artifacts = createSteadyGrowthCandidateArtifacts(
      catalog,
      new Map([[semanticAddressKey(outcome), Object.freeze([threshold, noTargetThreshold])]]),
    );
    expect(
      artifacts
        .at(outcome)
        ?.evaluate('ApolloWeaponBoon')
        .map((entry) => entry.legal),
    ).toEqual([true, false]);
  });

  it("uses Natural Selection's declaration-owned level count for its child domain", () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const trait = createTraitOfferAddress(
      createIncomingRewardAddress(biome, createOccurrenceId('natural-level-count')),
      'source',
    );
    const result = createNaturalSelectionResultAddress(trait, 'option1');
    const before = historyWith('Apollo', 'ApolloWeaponBoon', 'Common');
    const artifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(result),
          Object.freeze([Object.freeze({ before, context: Object.freeze({}) })]),
        ],
      ]),
    );
    const value: AuthoredTraitOffer = Object.freeze({
      kind: 'traits',
      giverKey: 'Demeter',
      options: Object.freeze([
        { traitKey: 'GoodStuffBoon', rarity: 'Duo' },
        { traitKey: 'BoonGrowthBoon', rarity: 'Common' },
        { traitKey: 'SlowProjectileBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { readonly kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    });
    expect(
      evaluateNaturalSelectionResultCandidate(catalog, {} as never, {} as never, artifacts, {
        kind: 'naturalSelectionResult',
        result,
        value,
        targets: undefined,
      }),
    ).toMatchObject({
      kind: 'naturalSelectionResult',
      result: { complete: false, nextTargetTraitKeys: ['ApolloWeaponBoon'] },
    });
  });

  it('requires one generic Pom-eligible trait for Narcissus A', () => {
    expect(
      assessTraitOption(catalog, 'NarcissusA', createTraitHistoryState()).findings,
    ).toContainEqual({
      code: 'missingPrerequisite',
      traitKey: 'NarcissusA',
      detail: 'upgradableTrait',
    });
    expect(
      assessTraitOption(catalog, 'NarcissusA', historyWith('Apollo', 'ApolloWeaponBoon', 'Common'))
        .legal,
    ).toBe(true);
  });
  it('starts only eligible core-god traits at level 1 and uses one eligibility authority', () => {
    const god = historyWith('Demeter', 'DemeterWeaponBoon', 'Common');
    const hermes = historyWith('Hermes', 'HermesWeaponBoon', 'Common');
    const npc = historyWith('Artemis', 'SupportingFireBoon', 'Common');
    const hammer = historyWith('WeaponUpgrade', 'StaffDoubleAttackTrait');

    expect(isPomEligibleTrait(catalog, 'DemeterWeaponBoon')).toBe(true);
    expect(isPomEligibleTrait(catalog, 'BoonGrowthBoon')).toBe(false);
    expect(god.equippedTraits.DemeterWeaponBoon?.level).toBe(1);
    expect(god.upgradableTraitCount).toBe(1);
    expect(hermes.equippedTraits.HermesWeaponBoon?.level).toBeUndefined();
    expect(npc.equippedTraits.SupportingFireBoon?.level).toBeUndefined();
    expect(hammer.equippedTraits.StaffDoubleAttackTrait?.level).toBeUndefined();
  });

  it('preserves an eligible trait level through Olympian replacement', () => {
    const seeded = historyWith('Demeter', 'DemeterWeaponBoon', 'Rare');
    const before = foldTraitHistoryEvents(catalog, [
      seeded.events[0]!,
      levelMutation(1, 'DemeterWeaponBoon', 1, 4),
    ]);
    const event: TraitOfferEvent = {
      kind: 'traitOffer',
      owner,
      acquisitionRole: 'replacement',
      sequence: 2,
      giverKey: 'Apollo',
      options: Object.freeze([
        { traitKey: 'ApolloWeaponBoon', rarity: 'Epic' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
      replacementTransition: {
        slot: 'Melee',
        replacedTraitKey: 'DemeterWeaponBoon',
        oldRarity: 'Rare',
        newTraitKey: 'ApolloWeaponBoon',
        requiredRarity: 'Epic',
      },
    };
    const replaced = foldTraitHistoryEvents(catalog, [...before.events, event]);
    expect(replaced.equippedTraits.DemeterWeaponBoon).toBeUndefined();
    expect(replaced.equippedTraits.ApolloWeaponBoon).toMatchObject({ rarity: 'Epic', level: 4 });
  });

  it('transfers a displaced level to a BlockStacking Olympian replacement without making it Pom-eligible', () => {
    const seeded = historyWith('Demeter', 'DemeterManaBoon', 'Rare');
    const before = foldTraitHistoryEvents(catalog, [
      seeded.events[0]!,
      levelMutation(1, 'DemeterManaBoon', 1, 5),
    ]);
    const replacement: TraitOfferEvent = {
      kind: 'traitOffer',
      owner,
      acquisitionRole: 'hephaestus-replacement',
      sequence: 2,
      giverKey: 'Hephaestus',
      options: Object.freeze([
        { traitKey: 'HephaestusManaBoon', rarity: 'Epic' },
        { traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
        { traitKey: 'HephaestusSpecialBoon', rarity: 'Common' },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
      replacementTransition: {
        slot: 'Mana',
        replacedTraitKey: 'DemeterManaBoon',
        oldRarity: 'Rare',
        newTraitKey: 'HephaestusManaBoon',
        requiredRarity: 'Epic',
      },
    };
    const result = foldTraitHistoryEvents(catalog, [...before.events, replacement]);
    expect(result.equippedTraits.HephaestusManaBoon?.level).toBe(5);
    expect(isPomEligibleTrait(catalog, 'HephaestusManaBoon')).toBe(false);
    expect(result.upgradableTraitCount).toBe(0);
  });

  it.each([
    ['HephaestusWeaponBoon', 'Hephaestus', 9, 7, 5, 3],
    ['HephaestusSpecialBoon', 'Hephaestus', 11, 9, 7, 5],
    ['HephaestusSprintBoon', 'Hephaestus', 8, 7, 6, 5],
  ] as const)(
    'shares the %s level caps across in-run upgrade consumers at every rarity boundary',
    (traitKey, giverKey, commonLimit, rareLimit, epicLimit, heroicLimit) => {
      for (const [rarity, limit] of [
        ['Common', commonLimit],
        ['Rare', rareLimit],
        ['Epic', epicLimit],
        ['Heroic', heroicLimit],
      ] as const) {
        const atLimit = foldTraitHistoryEvents(catalog, [
          {
            kind: 'traitOffer',
            owner,
            acquisitionRole: 'seed',
            sequence: 1,
            giverKey,
            options: Object.freeze([
              { traitKey, rarity },
              { traitKey: 'MassiveDamageBoon', rarity: 'Common' },
              { traitKey: 'AntiArmorBoon', rarity: 'Common' },
            ]) as TraitOfferEvent['options'],
            selectedOptionKey: 'option1',
            acquisitionPoint: 'test',
          },
          levelMutation(1, traitKey, 1, limit),
        ]);
        expect(hasEffectiveInRunUpgrade(catalog, traitKey, atLimit.equippedTraits[traitKey]!)).toBe(
          true,
        );
        if (rarity !== 'Heroic')
          expect(targetedAcquisitionTargetKeys(catalog, 'BoonDecayBoon', atLimit)).toContain(
            traitKey,
          );
        const aboveLimit = foldTraitHistoryEvents(catalog, [
          atLimit.events.find((event) => event.kind === 'traitOffer')!,
          levelMutation(1, traitKey, 1, limit + 1),
        ]);
        expect(
          hasEffectiveInRunUpgrade(catalog, traitKey, aboveLimit.equippedTraits[traitKey]!),
        ).toBe(false);
        expect(targetedAcquisitionTargetKeys(catalog, 'BoonDecayBoon', aboveLimit)).not.toContain(
          traitKey,
        );
      }
    },
  );

  it('keeps Natural Selection on its first shuffled order while removing a newly capped target', () => {
    const seeded = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
        owner,
        acquisitionRole: 'seed',
        sequence: 1,
        giverKey: 'Hephaestus',
        options: Object.freeze([
          { traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
          { traitKey: 'MassiveDamageBoon', rarity: 'Common' },
          { traitKey: 'AntiArmorBoon', rarity: 'Common' },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
      levelMutation(2, 'HephaestusWeaponBoon', 1, 9),
      {
        kind: 'traitOffer',
        owner,
        acquisitionRole: 'seed',
        sequence: 3,
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
    ]);
    expect(
      assessNaturalSelectionTargets(catalog, seeded, 8, naturalSelectionSlots, [
        'HephaestusWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
      ]),
    ).toMatchObject({ legal: true });
    expect(
      assessNaturalSelectionTargets(catalog, seeded, 8, naturalSelectionSlots, [
        'HephaestusWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'HephaestusWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
        'ApolloWeaponBoon',
      ]),
    ).toMatchObject({ legal: false });
  });

  it('limits Natural Selection to its declared ordinary slots while leaving Pom-eligible passives level-bearing', () => {
    const before = historyFrom([
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' },
      { giverKey: 'Zeus', traitKey: 'ZeusManaBoltBoon', rarity: 'Common' },
    ]);

    expect(isPomUpgradeTarget(catalog, before.equippedTraits.ZeusManaBoltBoon)).toBe(true);
    expect(
      assessNaturalSelectionTargets(catalog, before, 8, naturalSelectionSlots, undefined),
    ).toMatchObject({
      legal: false,
      complete: false,
      nextTargetTraitKeys: ['ZeusWeaponBoon'],
    });
  });

  it('allows Natural Selection to finish below eight only after its next domain becomes empty', () => {
    const capped = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
        owner,
        acquisitionRole: 'seed',
        sequence: 1,
        giverKey: 'Hephaestus',
        options: Object.freeze([
          { traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
          { traitKey: 'MassiveDamageBoon', rarity: 'Common' },
          { traitKey: 'AntiArmorBoon', rarity: 'Common' },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
      levelMutation(2, 'HephaestusWeaponBoon', 1, 9),
    ]);
    expect(
      assessNaturalSelectionTargets(catalog, capped, 8, naturalSelectionSlots, [
        'HephaestusWeaponBoon',
      ]),
    ).toMatchObject({ legal: true, complete: true, nextTargetTraitKeys: [] });

    const unresolved = foldTraitHistoryEvents(catalog, [
      capped.events[0]!,
      levelMutation(2, 'HephaestusWeaponBoon', 1, 8),
    ]);
    expect(
      assessNaturalSelectionTargets(catalog, unresolved, 8, naturalSelectionSlots, [
        'HephaestusWeaponBoon',
      ]),
    ).toMatchObject({
      legal: true,
      complete: false,
      nextTargetTraitKeys: ['HephaestusWeaponBoon'],
    });
  });
  it('publishes only the next member of the retained Natural Selection round order', () => {
    const before = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
      { giverKey: 'Demeter', traitKey: 'DemeterSpecialBoon', rarity: 'Common' },
    ]);

    expect(
      assessNaturalSelectionTargets(catalog, before, 8, naturalSelectionSlots, [
        'ApolloWeaponBoon',
        'DemeterSpecialBoon',
        'ApolloWeaponBoon',
      ]),
    ).toMatchObject({
      legal: true,
      complete: false,
      nextTargetTraitKeys: ['DemeterSpecialBoon'],
    });
  });
  it.each([
    ['Hermes', 'HermesWeaponBoon'],
    ['Artemis', 'SupportingFireBoon'],
    ['Athena', 'InvulnerabilityDashBoon'],
  ])('keeps rarity-bearing %s traits out of core-god upgrade predicates', (giverKey, traitKey) => {
    const history = historyWith(giverKey, traitKey, 'Common');

    expect(history.godBoonRarityCounts).toEqual({ Common: 1 });
    expect(history.upgradableTraitCount).toBe(0);
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('targetedAcquisitionNoEligibleTarget');
  });

  it('rejects Heroic-only histories because no supported next rarity exists', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Heroic');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('targetedAcquisitionNoEligibleTarget');
  });

  it('rejects Hammer-only histories because Hammers are not ranked god traits', () => {
    const history = historyWith('WeaponUpgrade', 'StaffDoubleAttackTrait');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('targetedAcquisitionNoEligibleTarget');
  });

  it('rejects a BlockInRunRarify target for Growth and a BlockStacking target for Decay', () => {
    const rarifyBlocked = historyWith('Demeter', 'ElementalDamageCapBoon', 'Rare');
    const stackingBlocked = historyWith('Demeter', 'BoonGrowthBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', rarifyBlocked)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', stackingBlocked)).toBe(
      'targetedAcquisitionNoEligibleTarget',
    );
  });

  it('accepts ordinary ranked god traits with a concrete next rarity', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', history)).toBeUndefined();
    expect(findingCode('BoonDecayBoon', history)).toBeUndefined();
  });

  it('excludes every non-superchargeable category from the exact target domain', () => {
    const history = historyFrom([
      { giverKey: 'Demeter', traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
      { giverKey: 'Demeter', traitKey: 'ElementalDamageCapBoon', rarity: 'Rare' },
      { giverKey: 'Demeter', traitKey: 'BoonGrowthBoon', rarity: 'Common' },
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Heroic' },
      { giverKey: 'WeaponUpgrade', traitKey: 'StaffDoubleAttackTrait' },
    ]);

    expect(targetedAcquisitionTargetKeys(catalog, 'BoonDecayBoon', history)).toEqual([
      'DemeterWeaponBoon',
    ]);
  });

  it('requires one exact selected target and promotes only that target to Heroic', () => {
    const before = historyFrom([
      { giverKey: 'Demeter', traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
      { giverKey: 'Apollo', traitKey: 'ApolloCastBoon', rarity: 'Rare' },
    ]);
    const baseOffer: AuthoredTraitOffer = Object.freeze({
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        { traitKey: 'BoonDecayBoon', rarity: 'Common' },
        { traitKey: 'DamageShareRetaliateBoon', rarity: 'Common' },
        { traitKey: 'SpawnCastDamageBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    });
    expect(assessSelectedTargetedAcquisition(catalog, baseOffer, before)).toMatchObject({
      applies: true,
      legal: false,
      findings: [{ code: 'targetedAcquisitionTargetMissing', traitKey: 'BoonDecayBoon' }],
    });

    const offer = Object.freeze({
      ...baseOffer,
      options: Object.freeze([
        { ...baseOffer.options[0], targetTraitKey: 'ApolloCastBoon' },
        baseOffer.options[1],
        baseOffer.options[2],
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    });
    const assessment = assessSelectedTargetedAcquisition(catalog, offer, before);
    expect(assessment).toMatchObject({
      applies: true,
      legal: true,
      transition: {
        kind: 'promoteGodTraitToHeroic',
        sourceTraitKey: 'BoonDecayBoon',
        targetTraitKey: 'ApolloCastBoon',
        oldRarity: 'Rare',
        newRarity: 'Heroic',
      },
    });
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'bridal-glow',
      offer,
      before,
      Object.freeze({}),
      before.events.length,
    );
    const recorded = recordReachedTraitOffer(catalog, reached, before.events.length + 1, 'test');
    expect(recorded.event?.targetedAcquisitionTransition).toEqual(assessment.transition);
    expect(recorded.history.equippedTraits.ApolloCastBoon?.rarity).toBe('Heroic');
    expect(recorded.history.equippedTraits.DemeterWeaponBoon?.rarity).toBe('Common');
    expect(recorded.history.equippedTraits.BoonDecayBoon?.rarity).toBe('Common');
  });

  it.each([
    ['Common', 1],
    ['Rare', 2],
    ['Epic', 3],
    ['Heroic', 4],
  ] as const)('records Bridal Glow %s rarity as a %i-level target mutation', (rarity, added) => {
    const before = historyWith('Demeter', 'DemeterWeaponBoon', 'Common');
    const offer: AuthoredTraitOffer = {
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        { traitKey: 'BoonDecayBoon', rarity, targetTraitKey: 'DemeterWeaponBoon' },
        { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        { traitKey: 'HeraCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    };
    const assessment = assessSelectedTargetedAcquisition(catalog, offer, before);
    expect(assessment.transition).toMatchObject({ oldLevel: 1, newLevel: 1 + added });
    if (rarity === 'Heroic') return;
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'bridal-glow',
      offer,
      before,
      {},
      before.events.length,
    );
    const recorded = recordReachedTraitOffer(catalog, reached, before.events.length + 1, 'test');
    expect(recorded.history.events.at(-1)).toMatchObject({
      kind: 'levelMutation',
      targetTraitKey: 'DemeterWeaponBoon',
      oldLevel: 1,
      newLevel: 1 + added,
    });
    expect(recorded.history.equippedTraits.DemeterWeaponBoon).toMatchObject({
      rarity: 'Heroic',
      level: 1 + added,
    });
  });
});
