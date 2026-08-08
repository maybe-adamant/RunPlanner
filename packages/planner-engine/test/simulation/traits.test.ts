import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import {
  createRewardHistoryState,
  factsWithHistory,
  type RewardKernelFacts,
} from '@run-planner/engine/reward-kernel';
import {
  assessTraitOption,
  assessTraitOfferComposition,
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitOfferEvents,
  recordReachedTraitOffer,
  traitCandidates,
  type ProjectEvaluation,
  type ReachedTraitOfferEvaluation,
  type RewardBranch,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures';

import { createDefaultTraitOffers } from '../../src/authored-project/traits';
import {
  initializeRewardBranches,
  processOwnedRewardAcquisition,
} from '../../src/simulation/rewards/processing';
import {
  evaluateTraitOfferCandidate,
  type TraitOfferCandidateQuery,
} from '../../src/simulation/candidates/trait-offer';
import { simulateProject } from '../../src/simulation';

const owner = { kind: 'project' } as SemanticAddress;

function replaceBiomeRewardBranches(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  branches: readonly RewardBranch[],
): ProjectEvaluation {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (route === undefined || biome === undefined || !('rewards' in biome)) {
    throw new Error(`missing ${routeKey}/${biomeKey} reward evaluation`);
  }
  const replacedBiome = Object.freeze({
    ...biome,
    rewards: Object.freeze({ ...biome.rewards, branches: Object.freeze([...branches]) }),
  });
  const replacedRoute = Object.freeze({
    ...route,
    biomes: Object.freeze(
      route.biomes.map((candidate) => (candidate === biome ? replacedBiome : candidate)),
    ),
  });
  return Object.freeze({
    ...evaluation,
    routes: Object.freeze(
      evaluation.routes.map((candidate) => (candidate === route ? replacedRoute : candidate)),
    ),
  });
}

function branchWithTraitTrace(trace: ReachedTraitOfferEvaluation): RewardBranch {
  return Object.freeze({
    bags: Object.freeze({}),
    history: attachTraitHistory(createRewardHistoryState(), trace.before),
    events: Object.freeze([]),
    processedThroughHistorySequence: 0,
    traitHistory: trace.before,
    traitEvaluations: Object.freeze([trace]),
  });
}

function reachedTraitTraces(evaluation: ProjectEvaluation): readonly ReachedTraitOfferEvaluation[] {
  return Object.freeze(
    evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome
          ? biome.rewards.branches.flatMap((branch) => branch.traitEvaluations ?? [])
          : [],
      ),
    ),
  );
}

// Source-expected Hammer memberships and aspect restrictions from
// docs/audits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md.  This is intentionally
// independent of the normalized catalog so the 92 x 24 candidate closure
// cannot pass by comparing the evaluator with its own compatibility data.
const expectedHammerTraitsByWeapon = {
  WeaponStaffSwing: [
    'StaffDoubleAttackTrait',
    'StaffLongAttackTrait',
    'StaffDashAttackTrait',
    'StaffTripleShotTrait',
    'StaffJumpSpecialTrait',
    'StaffExAoETrait',
    'StaffAttackRecoveryTrait',
    'StaffFastSpecialTrait',
    'StaffExHealTrait',
    'StaffSecondStageTrait',
    'StaffPowershotTrait',
    'StaffOneWayAttackTrait',
    'StaffRaiseDeadBigTrait',
    'StaffRaiseDeadDoubleTrait',
    'StaffLoneShadeRespawnTrait',
    'StaffLoneShadeRallyTrait',
  ],
  WeaponDagger: [
    'DaggerBlinkAoETrait',
    'DaggerSpecialJumpTrait',
    'DaggerSpecialLineTrait',
    'DaggerRapidAttackTrait',
    'DaggerSpecialConsecutiveTrait',
    'DaggerBackstabTrait',
    'DaggerSpecialReturnTrait',
    'DaggerSpecialFanTrait',
    'DaggerAttackFinisherTrait',
    'DaggerFinalHitTrait',
    'DaggerChargeStageSkipTrait',
    'DaggerDashAttackTripleTrait',
    'DaggerTripleBuffTrait',
    'DaggerTripleRepeatWomboTrait',
    'DaggerTripleHomingSpecialTrait',
  ],
  WeaponAxe: [
    'AxeSpinSpeedTrait',
    'AxeChargedSpecialTrait',
    'AxeAttackRecoveryTrait',
    'AxeMassiveThirdStrikeTrait',
    'AxeThirdStrikeTrait',
    'AxeRangedWhirlwindTrait',
    'AxeFreeSpinTrait',
    'AxeArmorTrait',
    'AxeBlockEmpowerTrait',
    'AxeSecondStageTrait',
    'AxeDashAttackTrait',
    'AxeSturdyTrait',
    'AxeRallyFrenzyTrait',
    'AxeRallyFirstStrikeTrait',
  ],
  WeaponTorch: [
    'TorchExSpecialCountTrait',
    'TorchSpecialSpeedTrait',
    'TorchAttackSpeedTrait',
    'TorchSpecialLineTrait',
    'TorchSpecialImpactTrait',
    'TorchMoveSpeedTrait',
    'TorchSplitAttackTrait',
    'TorchEnhancedAttackTrait',
    'TorchDiscountExAttackTrait',
    'TorchLongevityTrait',
    'TorchOrbitPointTrait',
    'TorchSpinAttackTrait',
    'TorchAutofireSprintTrait',
  ],
  WeaponLob: [
    'LobAmmoTrait',
    'LobAmmoMagnetismTrait',
    'LobRushArmorTrait',
    'LobSpreadShotTrait',
    'LobSpecialSpeedTrait',
    'LobSturdySpecialTrait',
    'LobOneSideTrait',
    'LobInOutSpecialExTrait',
    'LobStraightShotTrait',
    'LobPulseAmmoTrait',
    'LobPulseAmmoCollectTrait',
    'LobGrowthTrait',
    'LobGunOverheatTrait',
    'LobGunBounceTrait',
    'LobGunSpecialBounceTrait',
    'LobGunAttackRangeTrait',
    'LobGunAttackDoublerTrait',
  ],
  WeaponSuit: [
    'SuitArmorTrait',
    'SuitAttackSpeedTrait',
    'SuitAttackSizeTrait',
    'SuitAttackRangeTrait',
    'SuitFullChargeTrait',
    'SuitDashAttackTrait',
    'SuitSpecialJumpTrait',
    'SuitSpecialStartUpTrait',
    'SuitSpecialAutoTrait',
    'SuitSpecialBlockTrait',
    'SuitSpecialDiscountTrait',
    'SuitSpecialConsecutiveHitTrait',
    'SuitComboForwardRocketTrait',
    'SuitComboBlockBuffTrait',
    'SuitComboDoubleSpecialTrait',
    'SuitComboDashAttackTrait',
    'SuitPowershotTrait',
  ],
} as const satisfies Readonly<Record<string, readonly string[]>>;

const expectedHammerRestrictedAspects: Readonly<Record<string, readonly string[]>> = {
  StaffDoubleAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffLongAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffDashAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffExAoETrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffOneWayAttackTrait: ['BaseStaffAspect', 'StaffClearCastAspect', 'StaffSelfHitAspect'],
  StaffRaiseDeadBigTrait: ['StaffRaiseDeadAspect'],
  StaffRaiseDeadDoubleTrait: ['StaffRaiseDeadAspect'],
  StaffLoneShadeRespawnTrait: ['StaffRaiseDeadAspect'],
  StaffLoneShadeRallyTrait: ['StaffRaiseDeadAspect'],
  DaggerDashAttackTripleTrait: [
    'DaggerBackstabAspect',
    'DaggerHomingThrowAspect',
    'DaggerBlockAspect',
  ],
  DaggerTripleBuffTrait: ['DaggerTripleAspect'],
  DaggerTripleRepeatWomboTrait: ['DaggerTripleAspect'],
  DaggerTripleHomingSpecialTrait: ['DaggerTripleAspect'],
  AxeMassiveThirdStrikeTrait: ['AxeRecoveryAspect', 'AxeArmCastAspect', 'AxePerfectCriticalAspect'],
  AxeThirdStrikeTrait: ['AxeRecoveryAspect', 'AxeArmCastAspect', 'AxePerfectCriticalAspect'],
  AxeRallyFrenzyTrait: ['AxeRallyAspect'],
  AxeRallyFirstStrikeTrait: ['AxeRallyAspect'],
  TorchExSpecialCountTrait: [
    'TorchSpecialDurationAspect',
    'TorchDetonateAspect',
    'TorchAutofireAspect',
  ],
  TorchAttackSpeedTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchDiscountExAttackTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchLongevityTrait: [
    'TorchSpecialDurationAspect',
    'TorchSprintRecallAspect',
    'TorchDetonateAspect',
  ],
  TorchSplitAttackTrait: ['TorchSpecialDurationAspect', 'TorchAutofireAspect'],
  TorchAutofireSprintTrait: ['TorchAutofireAspect'],
  LobAmmoTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobAmmoMagnetismTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobSpreadShotTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobOneSideTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobStraightShotTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobPulseAmmoTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobPulseAmmoCollectTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobGrowthTrait: ['LobAmmoBoostAspect', 'LobCloseAttackAspect', 'LobImpulseAspect'],
  LobGunOverheatTrait: ['LobGunAspect'],
  LobGunBounceTrait: ['LobGunAspect'],
  LobGunSpecialBounceTrait: ['LobGunAspect'],
  LobGunAttackRangeTrait: ['LobGunAspect'],
  LobGunAttackDoublerTrait: ['LobGunAspect'],
  SuitDashAttackTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialJumpTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialStartUpTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialAutoTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialBlockTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialDiscountTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitSpecialConsecutiveHitTrait: ['BaseSuitAspect', 'SuitMarkCritAspect', 'SuitHexAspect'],
  SuitComboForwardRocketTrait: ['SuitComboAspect'],
  SuitComboBlockBuffTrait: ['SuitComboAspect'],
  SuitComboDoubleSpecialTrait: ['SuitComboAspect'],
  SuitComboDashAttackTrait: ['SuitComboAspect'],
  SuitPowershotTrait: ['SuitComboAspect'],
};

function baseFacts(): RewardKernelFacts {
  return {
    requirements: {
      counters: {
        biomeDepthCache: 4,
        biomeEncounterDepth: 2,
        encounterDepth: 7,
        enteredBiomes: 1,
        upgradableTraitCount: 0,
      },
      records: {
        biomeUseRecord: {},
        lootTypeHistory: {},
        roomsEntered: {},
        useRecord: {},
      },
      currentRoomShopOptionNames: new Set(),
      currentRoomRewardType: undefined,
      currentRoomStructuralTags: [],
      rewardLookups: {},
      runDepthCache: 8,
      lastEventRunDepthCaches: {},
      recentEncounterEnvelopeSlots: [],
      offeredExitCount: 3,
      currentBatchRoomGameNames: [],
      clockwork: undefined,
      flags: { allSpellInvested: false, pendingSpellDrop: false },
    },
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
  return foldTraitOfferEvents(
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
  it('rejects Heroic-only histories because no supported next rarity exists', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Heroic');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('superchargeableTarget');
  });

  it('rejects Hammer-only histories because Hammers are not ranked god traits', () => {
    const history = historyWith('WeaponUpgrade', 'StaffDoubleAttackTrait');
    expect(findingCode('BoonGrowthBoon', history)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', history)).toBe('superchargeableTarget');
  });

  it('rejects a BlockInRunRarify target for Growth and a BlockStacking target for Decay', () => {
    const rarifyBlocked = historyWith('Demeter', 'ElementalDamageCapBoon', 'Rare');
    const stackingBlocked = historyWith('Demeter', 'BoonGrowthBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', rarifyBlocked)).toBe('rarifiableTarget');
    expect(findingCode('BoonDecayBoon', stackingBlocked)).toBe('superchargeableTarget');
  });

  it('accepts ordinary ranked god traits with a concrete next rarity', () => {
    const history = historyWith('Demeter', 'DemeterWeaponBoon', 'Common');
    expect(findingCode('BoonGrowthBoon', history)).toBeUndefined();
    expect(findingCode('BoonDecayBoon', history)).toBeUndefined();
  });
});

describe('Proper Upbringing rarity lifecycle', () => {
  const elementPairs = [
    ['HeraWeaponBoon', 'Hera'],
    ['PoseidonWeaponBoon', 'Poseidon'],
    ['HeraCastBoon', 'Hera'],
    ['ZeusWeaponBoon', 'Zeus'],
    ['HeraSprintBoon', 'Hera'],
    ['HestiaWeaponBoon', 'Hestia'],
    ['HeraManaBoon', 'Hera'],
    ['DemeterManaBoon', 'Demeter'],
  ] as const;

  function twoEachHistory() {
    return historyFrom(
      elementPairs.map(([traitKey, giverKey]) => ({
        giverKey,
        traitKey,
        rarity: 'Common' as const,
      })),
    );
  }

  function activeHistory() {
    const source = historyFrom([
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]).events[0];
    if (source === undefined) throw new Error('missing Proper Upbringing event');
    const result = historyFrom([
      ...twoEachHistory().events.map((event) => ({
        giverKey: event.giverKey,
        traitKey: event.options[0]!.traitKey,
        rarity: event.options[0]!.rarity,
      })),
      {
        giverKey: source.giverKey,
        traitKey: source.options[0]!.traitKey,
        rarity: source.options[0]!.rarity,
      },
    ]);
    return result;
  }

  function eventFor(
    sequence: number,
    giverKey: string,
    traitKey: string,
    rarity: TraitOfferEvent['options'][number]['rarity'],
    replacementTransition?: TraitOfferEvent['replacementTransition'],
  ): TraitOfferEvent {
    return {
      owner,
      acquisitionRole: `proper-${sequence}`,
      sequence,
      giverKey,
      options: [
        { traitKey, ...(rarity === undefined ? {} : { rarity }) },
        { traitKey: catalog.traitGivers.byKey[giverKey]!.traitKeys[1]! },
        { traitKey: catalog.traitGivers.byKey[giverKey]!.traitKeys[2]! },
      ],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
      ...(replacementTransition === undefined ? {} : { replacementTransition }),
    };
  }

  it('offers at one of each base element while inactive and activates at two of each', () => {
    const oneEach = historyFrom([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraCastBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraSprintBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraManaBoon', rarity: 'Common' as const },
    ]);
    expect(
      assessTraitOption(catalog, 'ElementalRarityUpgradeBoon', oneEach, {}, 'Common').legal,
    ).toBe(true);
    expect(oneEach.minimumScalableGodTraitRarity).toBeUndefined();
    expect(activeHistory().minimumScalableGodTraitRarity).toBe('Rare');
  });

  it('activates when a later acquisition supplies the final base element', () => {
    const history = historyFrom([
      { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraCastBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraSprintBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'HeraManaBoon', rarity: 'Common' as const },
      { giverKey: 'Demeter', traitKey: 'DemeterManaBoon', rarity: 'Common' as const },
      { giverKey: 'Hestia', traitKey: 'HestiaWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Zeus', traitKey: 'ZeusWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
      { giverKey: 'Poseidon', traitKey: 'PoseidonWeaponBoon', rarity: 'Common' as const },
    ]);
    expect(history.minimumScalableGodTraitRarity).toBe('Rare');
    expect(history.equippedTraits.PoseidonWeaponBoon?.rarity).toBe('Rare');
  });

  it('promotes eligible Olympian and Hermes Commons once, preserving all declaration identity', () => {
    const history = historyFrom([
      ...elementPairs.map(([traitKey, giverKey]) => ({
        giverKey,
        traitKey,
        rarity: 'Common' as const,
      })),
      { giverKey: 'Hermes', traitKey: 'HermesWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]);
    expect(history.equippedTraits.HeraWeaponBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.HermesWeaponBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.ElementalRarityUpgradeBoon?.rarity).toBe('Common');
    expect(history.godBoonRarityCounts.Common ?? 0).toBe(0);
    expect(history.godBoonRarityCounts.Rare).toBe(9);
    expect(history.equippedTraits.HeraWeaponBoon).not.toBe(
      historyFrom([{ giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' as const }])
        .equippedTraits.HeraWeaponBoon,
    );
    expect(foldTraitOfferEvents(catalog, history.events)).toEqual(history);
  });

  it('does not promote fixed or excluded domains and deactivation keeps promotions', () => {
    const history = activeHistory();
    const withFixed = historyFrom([
      ...elementPairs.map(([traitKey, giverKey]) => ({
        giverKey,
        traitKey,
        rarity: 'Common' as const,
      })),
      { giverKey: 'Demeter', traitKey: 'ElementalDamageBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]);
    expect(withFixed.equippedTraits.ElementalDamageBoon?.rarity).toBe('Common');
    expect(history.equippedTraits.HeraWeaponBoon?.rarity).toBe('Rare');
    expect(history.minimumScalableGodTraitRarity).toBe('Rare');
  });

  it('rejects fresh Common below the floor but keeps Rare/Epic and fixed domains', () => {
    const history = activeHistory();
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, {}, 'Common').findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityBelowActiveFloor' }));
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, {}, 'Rare').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityBelowActiveFloor' }));
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, {}, 'Epic').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityBelowActiveFloor' }));
    expect(
      assessTraitOption(catalog, 'ElementalDamageBoon', history, {}, 'Common').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityBelowActiveFloor' }));
    expect(
      assessTraitOption(catalog, 'AllElementalBoon', history, {}, 'Legendary').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityBelowActiveFloor' }));
  });

  it('reactivates for a Common acquired while inactive and replays independently', () => {
    const inactive = twoEachHistory();
    const events = [...inactive.events];
    const withoutSource = foldTraitOfferEvents(catalog, [
      ...events,
      ...historyFrom([
        { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
      ]).events,
    ]);
    expect(withoutSource.minimumScalableGodTraitRarity).toBe('Rare');
    const replay = foldTraitOfferEvents(catalog, events);
    expect(replay.minimumScalableGodTraitRarity).toBeUndefined();
    expect(replay.equippedTraits.HeraWeaponBoon?.rarity).toBe('Common');
    expect(foldTraitOfferEvents(catalog, withoutSource.events)).toEqual(withoutSource);
  });

  it('removes only the future floor on deactivation and promotes a Common on reactivation', () => {
    const initial = twoEachHistory();
    const source = historyFrom([
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]).events[0]!;
    const activated = foldTraitOfferEvents(catalog, [
      ...initial.events,
      { ...source, sequence: 9 },
    ]);
    const deactivated = foldTraitOfferEvents(catalog, [
      ...activated.events,
      eventFor(10, 'Apollo', 'ApolloWeaponBoon', 'Rare', {
        slot: 'Melee',
        replacedTraitKey: 'HeraWeaponBoon',
        oldRarity: 'Rare',
        newTraitKey: 'ApolloWeaponBoon',
        requiredRarity: 'Rare',
      }),
    ]);
    expect(deactivated.minimumScalableGodTraitRarity).toBeUndefined();
    expect(deactivated.equippedTraits.HeraCastBoon?.rarity).toBe('Rare');
    const reactivated = foldTraitOfferEvents(catalog, [
      ...deactivated.events,
      eventFor(11, 'Zeus', 'ZeusSpecialBoon', 'Common'),
      eventFor(12, 'Hera', 'HeraWeaponBoon', 'Epic', {
        slot: 'Melee',
        replacedTraitKey: 'ApolloWeaponBoon',
        oldRarity: 'Rare',
        newTraitKey: 'HeraWeaponBoon',
        requiredRarity: 'Epic',
      }),
    ]);
    expect(reactivated.minimumScalableGodTraitRarity).toBe('Rare');
    expect(reactivated.equippedTraits.ZeusSpecialBoon?.rarity).toBe('Rare');
    expect(reactivated.equippedTraits.HeraWeaponBoon?.rarity).toBe('Epic');
  });

  it('keeps replacement rarity and replacement shortage floor-aware', () => {
    const history = activeHistory();
    const replacement = assessTraitOption(
      catalog,
      'ApolloWeaponBoon',
      history,
      { resolvedProviderKey: 'Apollo' },
      'Epic',
    );
    expect(replacement.findings).not.toContainEqual(
      expect.objectContaining({ code: 'rarityBelowActiveFloor' }),
    );
    expect(replacement.replacementTransition?.requiredRarity).toBe('Epic');
    const common = assessTraitOption(
      catalog,
      'ApolloManaBoon',
      history,
      { resolvedProviderKey: 'Apollo' },
      'Common',
    );
    expect(common.findings).toContainEqual(
      expect.objectContaining({ code: 'rarityBelowActiveFloor' }),
    );
  });

  it('does not activate or promote from an invalid/unselected offer and keeps replay branch-local', () => {
    const initial = twoEachHistory();
    const source = historyFrom([
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]).events[0]!;
    const dormant = foldTraitOfferEvents(catalog, initial.events);
    expect(dormant.minimumScalableGodTraitRarity).toBeUndefined();
    const invalidOffer = evaluateReachedTraitOffer(
      catalog,
      owner,
      'proper-invalid',
      {
        giverKey: 'Hera',
        options: [
          { traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' },
          { traitKey: 'HeraWeaponBoon', rarity: 'Common' },
          { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        ],
        selectedOptionKey: 'option1',
      },
      initial,
      {},
      9,
    );
    expect(recordReachedTraitOffer(catalog, invalidOffer, 9, 'test').event).toBeUndefined();
    const branchA = foldTraitOfferEvents(catalog, [...initial.events, { ...source, sequence: 9 }]);
    const branchB = foldTraitOfferEvents(catalog, initial.events);
    expect(branchA.minimumScalableGodTraitRarity).toBe('Rare');
    expect(branchB.minimumScalableGodTraitRarity).toBeUndefined();
    expect(foldTraitOfferEvents(catalog, [...branchA.events])).toEqual(branchA);
  });
});

describe('trait legality and derived facts', () => {
  const derivedHistory = historyFrom([
    { giverKey: 'Demeter', traitKey: 'DemeterManaBoon', rarity: 'Common' },
    { giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Rare' },
    { giverKey: 'Apollo', traitKey: 'ApolloCastBoon', rarity: 'Epic' },
  ]);

  it('rebuilds elements, rarity counts, slots, and upgradeability from equipped traits', () => {
    expect(derivedHistory.elementCounts).toEqual({
      Aether: 0,
      Earth: 2,
      Air: 0,
      Fire: 1,
      Water: 0,
    });
    expect(derivedHistory.highestBaseElementCount).toBe(2);
    expect(derivedHistory.godBoonRarityCounts).toEqual({ Common: 1, Rare: 1, Epic: 1 });
    expect(derivedHistory.ordinaryBoonSlots).toMatchObject({
      Mana: { traitKey: 'DemeterManaBoon', rarity: 'Common' },
      Melee: { traitKey: 'HeraWeaponBoon', rarity: 'Rare' },
      Ranged: { traitKey: 'ApolloCastBoon', rarity: 'Epic' },
    });
    expect(derivedHistory.upgradableTraitCount).toBe(3);
  });

  it.each([
    {
      label: 'already equipped',
      traitKey: 'DemeterManaBoon',
      history: derivedHistory,
      code: 'alreadyEquipped',
    },
    {
      label: 'positive prerequisite',
      traitKey: 'DoorHealToFullBoon',
      history: createTraitHistoryState(),
      code: 'missingPrerequisite',
    },
    {
      label: 'negative prerequisite',
      traitKey: 'LobAmmoMagnetismTrait',
      history: historyWith('WeaponUpgrade', 'LobPulseAmmoTrait'),
      context: { weaponKey: 'WeaponLob', aspectKey: 'LobAmmoBoostAspect' },
      code: 'negativePrerequisite',
    },
    {
      label: 'element threshold',
      traitKey: 'ElementalDamageBoon',
      history: createTraitHistoryState(),
      code: 'elementThreshold',
    },
    {
      label: 'rarity count',
      traitKey: 'CommonGlobalDamageBoon',
      history: derivedHistory,
      code: 'rarityCount',
    },
    {
      label: 'ordinary slot occupancy',
      traitKey: 'ApolloWeaponBoon',
      history: derivedHistory,
      code: 'occupiedBoonSlot',
    },
  ])('reports the $label authority', ({ traitKey, history, context, code }) => {
    expect(
      assessTraitOption(catalog, traitKey, history, context).findings.map(
        (finding) => finding.code,
      ),
    ).toContain(code);
  });

  it('accepts satisfied positive, element, and zero-Common requirements', () => {
    expect(
      assessTraitOption(
        catalog,
        'DoorHealToFullBoon',
        historyWith('Aphrodite', 'HighHealthOffenseBoon', 'Rare'),
      ).legal,
    ).toBe(true);
    expect(assessTraitOption(catalog, 'ElementalDamageBoon', derivedHistory).legal).toBe(true);
    expect(
      assessTraitOption(
        catalog,
        'CommonGlobalDamageBoon',
        historyWith('Hera', 'HeraWeaponBoon', 'Rare'),
      ).legal,
    ).toBe(true);
  });

  it('closes every Hammer option over all six weapons and 24 aspects', () => {
    const hammer = catalog.traitGivers.byKey.WeaponUpgrade;
    if (hammer === undefined) throw new Error('Hammer giver is missing');
    const expectedTraitKeys = Object.values(expectedHammerTraitsByWeapon).flat();
    expect(expectedTraitKeys).toHaveLength(92);
    expect(new Set(expectedTraitKeys)).toEqual(new Set(hammer.traitKeys));
    const history = createTraitHistoryState();
    for (const weapon of catalog.weapons.values) {
      for (const aspectKey of weapon.aspectKeys) {
        const context = { weaponKey: weapon.key, aspectKey };
        const expectedCompatible = new Set<string>(
          expectedHammerTraitsByWeapon[
            weapon.key as keyof typeof expectedHammerTraitsByWeapon
          ].filter((traitKey) =>
            (expectedHammerRestrictedAspects[traitKey] ?? weapon.aspectKeys).includes(aspectKey),
          ),
        );
        const candidates = traitCandidates(catalog, hammer.key, history, context);
        expect(candidates).toHaveLength(92);
        expect(
          new Set(candidates.filter((candidate) => candidate.available).map((c) => c.traitKey)),
        ).toEqual(expectedCompatible);
        for (const candidate of candidates) {
          expect(candidate.rarity).toBeUndefined();
          if (expectedCompatible.has(candidate.traitKey)) {
            expect(candidate.available).toBe(true);
            expect(candidate.assessment).toEqual({ legal: true, findings: [] });
          } else {
            expect(candidate.available).toBe(false);
            expect(candidate.assessment).toEqual({
              legal: false,
              findings: [{ code: 'wrongHammerLoadout', traitKey: candidate.traitKey }],
            });
          }
        }
      }
    }
  });

  it('retains exact acquired Hammer exclusions independently of aspect compatibility', () => {
    const history = historyWith('WeaponUpgrade', 'LobAmmoMagnetismTrait');
    const excluded = assessTraitOption(catalog, 'LobPulseAmmoTrait', history, {
      weaponKey: 'WeaponLob',
      aspectKey: 'LobAmmoBoostAspect',
    });
    expect(excluded).toEqual({
      legal: false,
      findings: [
        {
          code: 'negativePrerequisite',
          traitKey: 'LobPulseAmmoTrait',
          detail: 'LobAmmoMagnetismTrait',
        },
      ],
    });

    const reverse = assessTraitOption(
      catalog,
      'LobAmmoMagnetismTrait',
      historyWith('WeaponUpgrade', 'LobPulseAmmoTrait'),
      {
        weaponKey: 'WeaponLob',
        aspectKey: 'LobAmmoBoostAspect',
      },
    );
    expect(reverse).toEqual({
      legal: false,
      findings: [
        {
          code: 'negativePrerequisite',
          traitKey: 'LobAmmoMagnetismTrait',
          detail: 'LobPulseAmmoTrait',
        },
      ],
    });

    const compatible = assessTraitOption(catalog, 'LobAmmoTrait', history, {
      weaponKey: 'WeaponLob',
      aspectKey: 'LobAmmoBoostAspect',
    });
    expect(compatible).toEqual({ legal: true, findings: [] });
  });

  it.each([
    ['Underworld', createGoldenFGHIProject],
    ['Surface', createRepresentativeNOPQProject],
  ] as const)(
    'carries concrete trait state across the complete %s route',
    (routeKey, createProject) => {
      const evaluation = simulateProject(catalog, createProject()).routes.find(
        (route) => route.routeKey === routeKey,
      );
      if (evaluation === undefined) throw new Error(`${routeKey} route is missing`);
      expect(evaluation.status).toBe('valid');
      expect(evaluation.biomes).toHaveLength(4);
      const finalBiome = evaluation.biomes.at(-1);
      if (finalBiome === undefined || !('rewards' in finalBiome)) {
        throw new Error(`${routeKey} final biome reward product is missing`);
      }
      const finalBranch = finalBiome.rewards.branches[0];
      if (finalBranch === undefined || finalBranch.traitHistory === undefined) {
        throw new Error(`${routeKey} trait history is missing`);
      }
      const events = finalBranch.traitHistory.events;
      expect(events.length).toBeGreaterThan(0);
      expect(
        events.some(
          (event) => catalog.traitGivers.byKey[event.giverKey]?.providerKind === 'hammer',
        ),
      ).toBe(true);
      expect(
        events.some(
          (event) => catalog.traitGivers.byKey[event.giverKey]?.providerKind === 'hermes',
        ),
      ).toBe(true);
      if (routeKey === 'Surface') {
        expect(events.some((event) => event.acquisitionRole === 'chosenSource')).toBe(true);
        expect(events.some((event) => event.acquisitionRole === 'spurnedSource')).toBe(true);
      }
      expect(finalBranch.history.traitFacts.upgradableTraitCount).toBe(
        finalBranch.traitHistory.upgradableTraitCount,
      );
      expect('upgradableTraitCount' in finalBranch.history).toBe(false);
      expect(events.map((event) => event.sequence)).toEqual(
        [...events].map((event) => event.sequence).sort((left, right) => left - right),
      );
    },
  );
});

describe('reached trait offer chronology', () => {
  const offer = (giverKey: string, traitKeys: readonly [string, string, string]) =>
    Object.freeze({
      giverKey,
      options: Object.freeze(traitKeys.map((traitKey) => Object.freeze({ traitKey }))) as [
        { readonly traitKey: string },
        { readonly traitKey: string },
        { readonly traitKey: string },
      ],
      selectedOptionKey: 'option1' as const,
    });

  it('assesses the first Olympian offer as one complete priority composition', () => {
    const valid = offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']);
    expect(assessTraitOfferComposition(catalog, valid, createTraitHistoryState())).toEqual({
      applies: true,
      legal: true,
      findings: [],
    });

    const nonPriority = offer('Apollo', [
      'ApolloWeaponBoon',
      'ApolloSpecialBoon',
      'ApolloRetaliateBoon',
    ]);
    expect(assessTraitOfferComposition(catalog, nonPriority, createTraitHistoryState())).toEqual({
      applies: true,
      legal: false,
      findings: [
        {
          code: 'nonPriorityTrait',
          traitKey: 'ApolloRetaliateBoon',
          optionKey: 'option3',
        },
      ],
    });

    const missingAttackOrSpecial = offer('Apollo', [
      'ApolloCastBoon',
      'ApolloSprintBoon',
      'ApolloManaBoon',
    ]);
    expect(
      assessTraitOfferComposition(catalog, missingAttackOrSpecial, createTraitHistoryState()),
    ).toEqual({ applies: true, legal: false, findings: [{ code: 'missingAttackOrSpecial' }] });
  });

  it('does not apply first-offer composition after a slot is occupied or to Hermes/Hammer', () => {
    const occupied = foldTraitOfferEvents(catalog, [
      {
        owner,
        acquisitionRole: 'seed',
        sequence: 1,
        giverKey: 'Apollo',
        options: Object.freeze([
          { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
          { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
          { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'seed',
      },
    ]);
    const invalid = offer('Apollo', ['ApolloCastBoon', 'ApolloSprintBoon', 'ApolloManaBoon']);
    expect(assessTraitOfferComposition(catalog, invalid, occupied)).toEqual({
      applies: false,
      legal: true,
      findings: [],
    });
    expect(
      assessTraitOfferComposition(
        catalog,
        offer('Hermes', ['HermesWeaponBoon', 'HermesSpecialBoon', 'HermesCastDiscountBoon']),
        createTraitHistoryState(),
      ),
    ).toEqual({ applies: false, legal: true, findings: [] });
    expect(
      assessTraitOfferComposition(
        catalog,
        offer('WeaponUpgrade', [
          'StaffDoubleAttackTrait',
          'StaffLongAttackTrait',
          'StaffDashAttackTrait',
        ]),
        createTraitHistoryState(),
      ),
    ).toEqual({ applies: false, legal: true, findings: [] });
  });

  it('keeps an invalid first offer out of history so a later Olympian can satisfy the rule', () => {
    const first = evaluateReachedTraitOffer(
      catalog,
      owner,
      'chosenSource',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloRetaliateBoon']),
      createTraitHistoryState(),
      {},
      0,
    );
    expect(first.composition.legal).toBe(false);
    expect(recordReachedTraitOffer(catalog, first, 1, 'test').history.events).toHaveLength(0);

    const second = evaluateReachedTraitOffer(
      catalog,
      owner,
      'chosenSource',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      first.before,
      {},
      1,
    );
    expect(second.composition.legal).toBe(true);
    expect(recordReachedTraitOffer(catalog, second, 2, 'test').history.events).toHaveLength(1);
  });

  it('publishes and repairs a real invalid first offer through project simulation', () => {
    const owner = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const traitAddress = createTraitOfferAddress(owner, 'source');
    const invalidFirstOffer = Object.freeze({
      giverKey: 'Apollo',
      options: Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' as const },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' as const },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1' as const,
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceTraitOffer',
      trait: traitAddress,
      value: invalidFirstOffer,
    });
    const evaluation = simulateProject(catalog, project);
    const route = evaluation.routes.find((candidate) => candidate.routeKey === 'Underworld');
    const f = route?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('F reward evaluation is missing');

    expect(f.findings).toContainEqual({
      code: 'missingAttackOrSpecial',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: traitAddress,
      evidence: { acquisitionRole: 'source', lifecyclePoint: 'roomRewardPickup' },
    });
    const branch = f.rewards.branches[0];
    if (branch === undefined) throw new Error('F reward branch is missing');
    const firstTrace = branch.traitEvaluations?.find(
      (trace) =>
        semanticAddressKey(trace.address) === semanticAddressKey(owner) &&
        trace.acquisitionRole === 'source',
    );
    const laterTrace = branch.traitEvaluations?.find(
      (trace) =>
        'occurrenceId' in trace.address &&
        trace.address.occurrenceId === goldenFOccurrenceId(2, 1) &&
        trace.acquisitionRole === 'source',
    );
    if (firstTrace === undefined || laterTrace === undefined) {
      throw new Error('first-offer repair traces are missing');
    }
    expect(firstTrace.composition).toMatchObject({ applies: true, legal: false });
    expect(laterTrace.before.ordinaryBoonSlots).toEqual({});
    expect(laterTrace.composition).toEqual({ applies: true, legal: true, findings: [] });
    expect(branch.traitHistory?.events).not.toContainEqual(
      expect.objectContaining({ owner, acquisitionRole: 'source' }),
    );
    expect(branch.traitHistory?.events).toContainEqual(
      expect.objectContaining({
        owner: laterTrace.address,
        acquisitionRole: 'source',
        selectedOptionKey: laterTrace.offer.selectedOptionKey,
      }),
    );
    const selectedIndex =
      laterTrace.offer.selectedOptionKey === 'option1'
        ? 0
        : laterTrace.offer.selectedOptionKey === 'option2'
          ? 1
          : 2;
    const selectedTraitKey = laterTrace.offer.options[selectedIndex]?.traitKey;
    expect(selectedTraitKey).toBeDefined();
    expect(branch.traitHistory?.equippedTraits[selectedTraitKey!]).toBeDefined();
  });

  it('keeps first-offer candidate support and evidence grouped by reached branch', () => {
    const project = createGoldenFGHIProject();
    const baseline = simulateProject(catalog, project);
    const owner = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const trait = createTraitOfferAddress(owner, 'source');
    const value: AuthoredTraitOffer = Object.freeze({
      giverKey: 'Apollo',
      options: Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as AuthoredTraitOffer['options'],
      selectedOptionKey: 'option1',
    });
    const occupiedBefore = foldTraitOfferEvents(catalog, [
      {
        owner,
        acquisitionRole: 'seed',
        sequence: 0,
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
    const legalBranchTrace = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      value,
      occupiedBefore,
      {},
      0,
    );
    const invalidBranchTrace = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      value,
      createTraitHistoryState(),
      {},
      0,
    );
    const candidateEvaluation = replaceBiomeRewardBranches(baseline, 'Underworld', 'F', [
      branchWithTraitTrace(legalBranchTrace),
      branchWithTraitTrace(invalidBranchTrace),
    ]);
    const query: TraitOfferCandidateQuery = { kind: 'traitOffer', trait, value };
    const result = evaluateTraitOfferCandidate(catalog, project, candidateEvaluation, query);
    if (result.kind !== 'traitOffer') throw new Error('trait offer candidate was unavailable');

    expect(result.result.supported).toBe(true);
    expect(result.result.branches).toHaveLength(2);
    expect(result.result.branches[0]).toEqual({
      assessments: [
        { legal: true, findings: [] },
        { legal: true, findings: [] },
        { legal: true, findings: [] },
      ],
      composition: { applies: false, legal: true, findings: [] },
    });
    expect(result.result.branches[1]).toEqual({
      assessments: [
        { legal: true, findings: [] },
        { legal: true, findings: [] },
        { legal: true, findings: [] },
      ],
      composition: {
        applies: true,
        legal: false,
        findings: [{ code: 'missingAttackOrSpecial' }],
      },
    });
    expect(result.result.findings).toContainEqual({ code: 'missingAttackOrSpecial' });
  });

  it('keeps naturally surviving same-owner traces on one pre-offer state and context', () => {
    // The current Golden and representative routes naturally collapse repeated
    // owners onto one pre-offer context. The constructed boundary witness above
    // protects the typed candidate product if a future branch producer diverges.
    const routes = [
      ['Underworld', createGoldenFGHIProject],
      ['Surface', createRepresentativeNOPQProject],
    ] as const;
    let duplicateGroupCount = 0;
    for (const [routeKey, createProject] of routes) {
      const traces = reachedTraitTraces(simulateProject(catalog, createProject())).filter(
        (trace) => 'routeKey' in trace.address && trace.address.routeKey === routeKey,
      );
      const byOwner = new Map<string, ReachedTraitOfferEvaluation[]>();
      for (const trace of traces) {
        const key = `${semanticAddressKey(trace.address)}:${trace.acquisitionRole}`;
        const group = byOwner.get(key) ?? [];
        group.push(trace);
        byOwner.set(key, group);
      }
      for (const group of byOwner.values()) {
        if (group.length < 2) continue;
        duplicateGroupCount += 1;
        const first = group[0];
        if (first === undefined) throw new Error('same-owner trace group is empty');
        for (const trace of group.slice(1)) {
          expect(trace.before).toEqual(first.before);
          expect(trace.context).toEqual(first.context);
        }
      }
    }
    expect(duplicateGroupCount).toBeGreaterThan(0);
  });

  it('marks non-priority first-offer candidates unavailable with a composition reason', () => {
    const candidate = traitCandidates(catalog, 'Apollo', createTraitHistoryState()).find(
      (entry) => entry.traitKey === 'ApolloRetaliateBoon' && entry.rarity === 'Common',
    );
    expect(candidate?.available).toBe(false);
    expect(candidate?.assessment.findings).toContainEqual({
      code: 'nonPriorityTrait',
      traitKey: 'ApolloRetaliateBoon',
    });
  });

  it('advances trace position when an invalid offer emits no equipped event', () => {
    const authoredWeapon = catalog.weapons.values[0];
    const activeWeapon = catalog.weapons.values.find(
      (weapon) => weapon.key !== authoredWeapon?.key,
    );
    if (authoredWeapon === undefined || activeWeapon === undefined) {
      throw new Error('trait chronology fixture requires two weapons');
    }
    const authoredLoadout = {
      weaponKey: authoredWeapon.key,
      aspectKey: authoredWeapon.defaultAspectKey,
    };
    const activeLoadout = {
      weaponKey: activeWeapon.key,
      aspectKey: activeWeapon.defaultAspectKey,
    };
    const biome = createBiomeAddress('Underworld', 'F');
    const facts = (history: Parameters<typeof factsWithHistory>[1]) =>
      factsWithHistory(baseFacts(), history, new Set());
    const findings = new Map();
    const hammer = { rewardType: 'WeaponUpgrade' as const };
    let branches = processOwnedRewardAcquisition(
      catalog,
      initializeRewardBranches(),
      {
        origin: createIncomingRewardAddress(biome, createOccurrenceId('invalid-hammer-trace')),
        offer: hammer,
        producerLifecycleKey: 'RoomReward',
        traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, hammer, authoredLoadout),
        traitContext: activeLoadout,
      },
      1,
      facts,
      findings,
      (detail) => {
        throw new Error(detail);
      },
    );
    const boon = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    branches = processOwnedRewardAcquisition(
      catalog,
      branches,
      {
        origin: createIncomingRewardAddress(biome, createOccurrenceId('valid-boon-trace')),
        offer: boon,
        producerLifecycleKey: 'RoomReward',
        traitOffersByAcquisitionRole: createDefaultTraitOffers(catalog, boon, activeLoadout),
        traitContext: activeLoadout,
      },
      2,
      facts,
      findings,
      (detail) => {
        throw new Error(detail);
      },
    );

    const branch = branches[0];
    expect(branch?.traitEvaluations?.map((trace) => trace.chronologicalIndex)).toEqual([0, 1]);
    expect(branch?.traitHistory?.events).toHaveLength(1);
  });
});
