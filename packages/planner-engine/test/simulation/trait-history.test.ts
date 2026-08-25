import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createNaturalSelectionResultAddress,
  createTraitAcquisitionTargetAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  createSteadyGrowthOutcomeAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  assessTraitOption,
  assessTraitOffer,
  assessSelectedTargetedAcquisition,
  assessTraitOfferComposition,
  assessTraitOfferDomainComposition,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  hasEffectiveInRunUpgrade,
  isPomEligibleTrait,
  isPomUpgradeTarget,
  assessNaturalSelectionTargets,
  assessRansom,
  recordReachedTraitOffer,
  resolveRuntimeOfferFallbackTraitKey,
  promoteArcana,
  isAspectSpellDropDormant,
  traitCandidates,
  boonRarityFactsForOffer,
  traitOfferCompositionDomains,
  traitOfferStartingDraft,
  targetedAcquisitionTargetKeys,
  type ProjectEvaluation,
  type SelectedTraitOfferAssessment,
  type TraitHistoryState,
  type TraitOfferEvent,
  type TraitLevelMutationEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

import { initializeTestRewardBranches } from '../support/arcana-fear';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';
import { createArcanaFearState } from '../../src/simulation/arcana-fear';
import {
  createSteadyGrowthCandidateArtifacts,
  createTraitOfferCandidateArtifacts,
} from '../../src/simulation/candidate-artifacts';
import { evaluateNaturalSelectionResultCandidate } from '../../src/simulation/candidates/trait-offer';
import {
  initializeRewardBranches,
  settleEncounterTraitOffer,
  settleOwnedAcquisitionSite,
} from '../../src/simulation/rewards/processing';
import {
  evaluateTraitOfferCandidate,
  type TraitOfferCandidateQuery,
} from '../../src/simulation/candidates/trait-offer';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '../../src/simulation';

const owner = { kind: 'project' } as SemanticAddress;
const naturalSelectionSlots = ['Melee', 'Secondary', 'Ranged', 'Rush', 'Mana'] as const;

function settleTestRoomReward(
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
  branches: Parameters<typeof settleOwnedAcquisitionSite>[1],
  source: Parameters<typeof settleOwnedAcquisitionSite>[2]['source'],
  sequence: number,
  facts: Parameters<typeof settleOwnedAcquisitionSite>[3],
  findings: Parameters<typeof settleOwnedAcquisitionSite>[4],
) {
  return settleOwnedAcquisitionSite(
    catalog,
    branches,
    {
      siteOwner: createOccurrenceAddress(biome, occurrenceId),
      pointKey: 'roomRewardPickup',
      entryKey: 'self',
      source,
      historySequence: sequence,
    },
    facts,
    findings,
  ).branches;
}

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

function reachedTraitOffers(
  evaluation: ProjectEvaluation,
): readonly SelectedTraitOfferAssessment[] {
  return Object.freeze(
    evaluation.routes.flatMap((route) =>
      route.biomes.flatMap((biome) =>
        'rewards' in biome ? biome.rewards.selectedTraitOffers : [],
      ),
    ),
  );
}

// Source-expected Hammer memberships and aspect restrictions from
// docs/audits/traits/TRAIT_OFFER_POOLS_AND_DEPENDENCIES.md.  This is intentionally
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

describe('Selene Spell equipment chronology', () => {
  it('publishes the exact eight rarityless normal-spell candidates', () => {
    const candidates = traitCandidates(catalog, 'SpellDrop', createTraitHistoryState());
    expect(candidates).toHaveLength(8);
    expect(candidates.map((candidate) => candidate.traitKey)).not.toContain('SpellMoonBeamTrait');
    expect(candidates.every((candidate) => candidate.rarity === undefined)).toBe(true);
  });

  it('unlocks Artemis and Circe spell prerequisites only after a settled spell', () => {
    const empty = createTraitHistoryState();
    expect(assessTraitOption(catalog, 'SorceryCritBoon', empty).legal).toBe(false);
    expect(assessTraitOption(catalog, 'CirceSorceryDamageBoon', empty).legal).toBe(false);
    const spell = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'self',
        sequence: 1,
        acquisitionPoint: 'roomRewardPickup',
        giverKey: 'SpellDrop',
        options: [{ traitKey: 'SpellPolymorphTrait' }] as const,
        selectedOptionKey: 'option1' as const,
      },
    ]);
    expect(assessTraitOption(catalog, 'SorceryCritBoon', spell).legal).toBe(true);
    expect(assessTraitOption(catalog, 'CirceSorceryDamageBoon', spell).legal).toBe(true);
  });

  it('installs one selected normal spell only at acquisition and fails closed on a second spell event', () => {
    const spellOffer = {
      kind: 'traitOffer' as const,
      owner,
      acquisitionRole: 'self',
      sequence: 1,
      acquisitionPoint: 'roomRewardPickup',
      giverKey: 'SpellDrop',
      options: [
        { traitKey: 'SpellPolymorphTrait' },
        { traitKey: 'SpellMeteorTrait' },
        { traitKey: 'SpellTransformTrait' },
      ] as const,
      selectedOptionKey: 'option1' as const,
    };
    const first = foldTraitHistoryEvents(catalog, [spellOffer]);
    expect(first.equippedSlots.Spell?.traitKey).toBe('SpellPolymorphTrait');
    const second = foldTraitHistoryEvents(catalog, [
      ...first.events,
      { ...spellOffer, sequence: 2, options: [{ traitKey: 'SpellMeteorTrait' }] as const },
    ]);
    expect(second.equippedSlots.Spell?.traitKey).toBe('SpellPolymorphTrait');
    expect(second.equippedTraits.SpellMeteorTrait).toBeUndefined();
  });

  it('records the exact Aspect of Selene linked Sky Fall grant at route start', () => {
    const loadout = {
      ...createDefaultRouteLoadout(catalog),
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    };
    const branches = initializeRewardBranches(
      undefined,
      createArcanaFearState(catalog, loadout),
      catalog,
      catalog.defaultStartingKeepsakeKey,
      undefined,
      'Underworld',
      loadout,
    );
    const history = branches[0]?.traitHistory;
    expect(history?.events).toContainEqual(
      expect.objectContaining({
        kind: 'directTraitGrant',
        acquisitionPoint: 'routeStart',
        traitKey: 'SpellMoonBeamTrait',
        giverKey: 'SpellDrop',
      }),
    );
    expect(history?.equippedSlots.Spell?.traitKey).toBe('SpellMoonBeamTrait');
  });

  it('keeps a retained SpellDrop child dormant under Selene and reactivates it after switching', () => {
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('selene-dormant-spell');
    const reward = { rewardType: 'SpellDrop' as const };
    const source = {
      origin: createIncomingRewardAddress(biome, occurrenceId),
      offer: reward,
      producerLifecycleKey: 'RoomReward' as const,
      instanceProvenance: 'free' as const,
      traitOffersByAcquisitionRole: Object.freeze({
        self: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'SpellDrop',
          options: Object.freeze([
            { traitKey: 'SpellPolymorphTrait' },
            { traitKey: 'SpellMeteorTrait' },
            { traitKey: 'SpellTransformTrait' },
          ] as const),
          selectedOptionKey: 'option1' as const,
          rarificationActions: Object.freeze([]),
        }),
      }),
    };
    const makeBranches = (aspectKey: string) => {
      const loadout = { ...createDefaultRouteLoadout(catalog), weaponKey: 'WeaponSuit', aspectKey };
      return initializeRewardBranches(
        undefined,
        createArcanaFearState(catalog, loadout),
        catalog,
        catalog.defaultStartingKeepsakeKey,
        undefined,
        'Underworld',
        loadout,
      );
    };
    const settle = (aspectKey: string) =>
      settleTestRoomReward(
        biome,
        occurrenceId,
        makeBranches(aspectKey),
        { ...source, traitContext: { weaponKey: 'WeaponSuit', aspectKey } },
        1,
        (_history) => factsWithHistory(baseFacts(), _history, new Set()),
        new Map(),
      )[0]!;

    const dormant = settle('SuitHexAspect');
    expect(dormant.history.useRecord.SpellDrop).toBe(1);
    expect(dormant.traitHistory?.equippedSlots.Spell?.traitKey).toBe('SpellMoonBeamTrait');
    expect(dormant.traitHistory?.equippedTraits.SpellPolymorphTrait).toBeUndefined();
    expect(dormant.traitEvaluations).toEqual([]);

    const active = settle('BaseSuitAspect');
    expect(active.traitHistory?.equippedSlots.Spell?.traitKey).toBe('SpellPolymorphTrait');
    expect(active.traitHistory?.equippedTraits.SpellMoonBeamTrait).toBeUndefined();
    expect(active.traitEvaluations).toHaveLength(1);
    expect(isAspectSpellDropDormant(catalog, 'SuitHexAspect')).toBe(true);
    expect(isAspectSpellDropDormant(catalog, 'BaseSuitAspect')).toBe(false);
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

  function acquireLegalTrait(
    before: TraitHistoryState,
    giverKey: string,
    traitKey: string,
    rarity: TraitOfferEvent['options'][number]['rarity'],
  ): TraitHistoryState {
    const candidates = traitCandidates(catalog, giverKey, before).filter(
      (candidate) => candidate.available && candidate.traitKey !== traitKey,
    );
    const selected = traitCandidates(catalog, giverKey, before).find(
      (candidate) =>
        candidate.available && candidate.traitKey === traitKey && candidate.rarity === rarity,
    );
    if (selected === undefined) {
      throw new Error(`Missing legal ${giverKey}/${traitKey}/${rarity ?? 'untyped'} candidate`);
    }
    const alternatives = candidates.filter(
      (candidate, index, all) =>
        all.findIndex((other) => other.traitKey === candidate.traitKey) === index,
    );
    const firstAlternative = alternatives[0];
    const secondAlternative = alternatives[1];
    if (firstAlternative === undefined || secondAlternative === undefined) {
      throw new Error(`Insufficient legal ${giverKey} alternatives`);
    }
    const options: Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'] = [
      {
        traitKey: selected.traitKey,
        ...(selected.rarity === undefined ? {} : { rarity: selected.rarity }),
      },
      {
        traitKey: firstAlternative.traitKey,
        ...(firstAlternative.rarity === undefined ? {} : { rarity: firstAlternative.rarity }),
      },
      {
        traitKey: secondAlternative.traitKey,
        ...(secondAlternative.rarity === undefined ? {} : { rarity: secondAlternative.rarity }),
      },
    ];
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      `proper-${before.events.length + 1}`,
      {
        kind: 'traits',
        giverKey,
        options,
        selectedOptionKey: 'option1',
      },
      before,
      {},
      before.events.length + 1,
    );
    const applied = recordReachedTraitOffer(catalog, evaluation, before.events.length + 1, 'test');
    if (applied.event === undefined) {
      throw new Error(`Illegal evaluated ${giverKey}/${traitKey}/${rarity ?? 'untyped'} offer`);
    }
    return applied.history;
  }

  function twoEachHistory() {
    let history = createTraitHistoryState();
    for (const [giverKey, traitKey] of [
      ['Apollo', 'ApolloWeaponBoon'],
      ['Hermes', 'HermesWeaponBoon'],
      ['Hermes', 'HermesSpecialBoon'],
      ['Hermes', 'DodgeChanceBoon'],
      ['Hermes', 'SprintShieldBoon'],
      ['Hermes', 'RestockBoon'],
      ['Poseidon', 'DoubleRewardBoon'],
      ['Poseidon', 'FocusDamageShaveBoon'],
    ] as const) {
      history = acquireLegalTrait(history, giverKey, traitKey, 'Common');
    }
    return history;
  }

  function activeHistory() {
    return acquireLegalTrait(twoEachHistory(), 'Hera', 'ElementalRarityUpgradeBoon', 'Common');
  }

  it('lets Proper Upbringing promote a cooldown-capped Common trait while Pom targeting excludes it', () => {
    const capped = foldTraitHistoryEvents(catalog, [
      ...twoEachHistory().events,
      {
        kind: 'traitOffer',
        owner,
        acquisitionRole: 'seed',
        sequence: 9,
        giverKey: 'Hephaestus',
        options: Object.freeze([
          { traitKey: 'HephaestusWeaponBoon', rarity: 'Common' },
          { traitKey: 'MassiveDamageBoon', rarity: 'Common' },
          { traitKey: 'AntiArmorBoon', rarity: 'Common' },
        ]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1',
        acquisitionPoint: 'test',
      },
      levelMutation(10, 'HephaestusWeaponBoon', 1, 10),
    ]);
    expect(isPomUpgradeTarget(catalog, capped.equippedTraits.HephaestusWeaponBoon)).toBe(false);

    const promoted = acquireLegalTrait(capped, 'Hera', 'ElementalRarityUpgradeBoon', 'Common');
    expect(promoted.properUpbringingActive).toBe(true);
    expect(promoted.equippedTraits.HephaestusWeaponBoon).toMatchObject({
      rarity: 'Rare',
      level: 10,
    });
    expect(isPomUpgradeTarget(catalog, promoted.equippedTraits.HephaestusWeaponBoon)).toBe(false);
  });

  it('applies Bridal Glow before same-boundary Proper Upbringing credit', () => {
    let before = createTraitHistoryState();
    for (const [giverKey, traitKey] of [
      ['Apollo', 'ApolloWeaponBoon'],
      ['Hermes', 'HermesWeaponBoon'],
      ['Hermes', 'HermesSpecialBoon'],
      ['Hermes', 'DodgeChanceBoon'],
      ['Hermes', 'SprintShieldBoon'],
      ['Hermes', 'RestockBoon'],
      ['Poseidon', 'DoubleRewardBoon'],
    ] as const) {
      before = acquireLegalTrait(before, giverKey, traitKey, 'Common');
    }
    const proper = acquireLegalTrait(before, 'Hera', 'ElementalRarityUpgradeBoon', 'Common');
    expect(proper.properUpbringingActive).toBeUndefined();
    const offer: AuthoredTraitOffer = {
      kind: 'traits',
      giverKey: 'Hera',
      options: Object.freeze([
        { traitKey: 'BoonDecayBoon', rarity: 'Common', targetTraitKey: 'ApolloWeaponBoon' },
        { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
        { traitKey: 'HeraCastBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    };
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'same-boundary-bridal',
      offer,
      proper,
      {},
      proper.events.length,
    );
    const recorded = recordReachedTraitOffer(catalog, evaluation, proper.events.length + 1, 'test');
    expect(recorded.history.equippedTraits.BoonDecayBoon?.rarity).toBe('Rare');
    expect(recorded.history.equippedTraits.ApolloWeaponBoon).toMatchObject({
      rarity: 'Heroic',
      level: 3,
    });
    expect(foldTraitHistoryEvents(catalog, recorded.history.events)).toEqual(recorded.history);
  });

  it('credits Bridal Glow one missing target level when Proper Upbringing promotes it', () => {
    const inactive = twoEachHistory();
    const bridal: TraitOfferEvent = {
      kind: 'traitOffer',
      owner,
      acquisitionRole: 'bridal',
      sequence: inactive.events.length + 1,
      giverKey: 'Hera',
      options: Object.freeze([
        { traitKey: 'BoonDecayBoon', rarity: 'Common' },
        { traitKey: 'DamageShareRetaliateBoon', rarity: 'Common' },
        { traitKey: 'SpawnCastDamageBoon', rarity: 'Common' },
      ]) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1',
      acquisitionPoint: 'test',
      targetedAcquisitionTransition: {
        kind: 'promoteGodTraitToHeroic',
        sourceTraitKey: 'BoonDecayBoon',
        targetTraitKey: 'ApolloWeaponBoon',
        oldRarity: 'Common',
        newRarity: 'Heroic',
        oldLevel: 1,
        newLevel: 2,
      },
    };
    const beforeActivation = foldTraitHistoryEvents(catalog, [
      ...inactive.events,
      bridal,
      levelMutation(bridal.sequence, 'ApolloWeaponBoon', 1, 2),
    ]);
    const active = acquireLegalTrait(
      beforeActivation,
      'Hera',
      'ElementalRarityUpgradeBoon',
      'Common',
    );
    expect(active.equippedTraits.BoonDecayBoon?.rarity).toBe('Rare');
    expect(active.equippedTraits.ApolloWeaponBoon).toMatchObject({ rarity: 'Heroic', level: 3 });
    expect(foldTraitHistoryEvents(catalog, active.events)).toEqual(active);
  });

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
    expect(oneEach.properUpbringingActive).toBeUndefined();
    expect(activeHistory().properUpbringingActive).toBe(true);
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
    expect(history.properUpbringingActive).toBe(true);
    expect(history.equippedTraits.PoseidonWeaponBoon?.rarity).toBe('Rare');
  });

  it('promotes every eligible boon-rarity Common independently of core-god status', () => {
    const history = historyFrom([
      ...elementPairs.map(([traitKey, giverKey]) => ({
        giverKey,
        traitKey,
        rarity: 'Common' as const,
      })),
      { giverKey: 'Hermes', traitKey: 'HermesWeaponBoon', rarity: 'Common' as const },
      { giverKey: 'Artemis', traitKey: 'SupportingFireBoon', rarity: 'Common' as const },
      { giverKey: 'Athena', traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]);
    expect(history.equippedTraits.HeraWeaponBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.HermesWeaponBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.SupportingFireBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.InvulnerabilityDashBoon?.rarity).toBe('Rare');
    expect(history.equippedTraits.ElementalRarityUpgradeBoon?.rarity).toBe('Common');
    expect(history.godBoonRarityCounts.Common ?? 0).toBe(0);
    expect(history.godBoonRarityCounts.Rare).toBe(11);
    expect(history.equippedTraits.HeraWeaponBoon).not.toBe(
      historyFrom([{ giverKey: 'Hera', traitKey: 'HeraWeaponBoon', rarity: 'Common' as const }])
        .equippedTraits.HeraWeaponBoon,
    );
    expect(foldTraitHistoryEvents(catalog, history.events)).toEqual(history);
  });

  it('does not promote fixed or excluded domains', () => {
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
    expect(history.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Rare');
    expect(history.properUpbringingActive).toBe(true);
  });

  it('rejects fresh Common below the floor but keeps Rare/Epic and fixed domains', () => {
    const history = activeHistory();
    const apolloContext = {
      resolvedProviderKey: 'Apollo',
      boonRarityFacts: boonRarityFactsForOffer(catalog, history, {
        resolvedProviderKey: 'Apollo',
      })!,
    };
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, apolloContext, 'Common').findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, apolloContext, 'Rare').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'ApolloManaBoon', history, apolloContext, 'Epic').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    const hermesContext = {
      resolvedProviderKey: 'Hermes',
      boonRarityFacts: boonRarityFactsForOffer(catalog, history, {
        resolvedProviderKey: 'Hermes',
      })!,
    };
    expect(
      assessTraitOption(catalog, 'HermesCastDiscountBoon', history, hermesContext, 'Common')
        .findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'ElementalDamageBoon', history, {}, 'Common').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'AllElementalBoon', history, {}, 'Legendary').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
  });

  it('applies a Q-style guaranteed Rare check to Proper Upbringing before it activates', () => {
    const history = twoEachHistory();
    const context = {
      resolvedProviderKey: 'Hera',
      boonRarityFacts: boonRarityFactsForOffer(catalog, history, {
        resolvedProviderKey: 'Hera',
        boonRarityRoomOverride: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
      })!,
    };
    expect(history.properUpbringingActive).toBeUndefined();
    expect(
      assessTraitOption(catalog, 'ElementalRarityUpgradeBoon', history, context, 'Common').findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'ElementalRarityUpgradeBoon', history, context, 'Rare').findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
  });

  it('derives real active rank-III and Lapis rank-IV Arcana contributions at an offer frontier', () => {
    const loadout = createDefaultRouteLoadout(catalog);
    const active = createArcanaFearState(catalog, {
      ...loadout,
      manualArcanaKeys: ['RarityBoost'],
    });
    const rankIII = boonRarityFactsForOffer(
      catalog,
      createTraitHistoryState(),
      { resolvedProviderKey: 'Apollo' },
      active,
    );
    expect(rankIII?.contributions).toContainEqual({
      additive: { Rare: 0.5 },
      multiplicative: { Legendary: 1.5 },
    });
    const promoted = promoteArcana(catalog, active, ['RarityBoost'], {
      owner,
      sequence: 1,
    });
    if (!promoted.legal) throw new Error('Lapis promotion must be legal');
    const rankIV = boonRarityFactsForOffer(
      catalog,
      createTraitHistoryState(),
      { resolvedProviderKey: 'Apollo' },
      promoted.state,
    );
    expect(rankIV?.contributions).toContainEqual({
      additive: { Rare: 0.6 },
      multiplicative: { Legendary: 1.6 },
    });
  });

  it('reactivates for a Common acquired while inactive and replays independently', () => {
    const inactive = twoEachHistory();
    const events = [...inactive.events];
    const withoutSource = foldTraitHistoryEvents(catalog, [
      ...events,
      ...historyFrom([
        { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
      ]).events,
    ]);
    expect(withoutSource.properUpbringingActive).toBe(true);
    const replay = foldTraitHistoryEvents(catalog, events);
    expect(replay.properUpbringingActive).toBeUndefined();
    expect(replay.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Common');
    expect(foldTraitHistoryEvents(catalog, withoutSource.events)).toEqual(withoutSource);
  });

  it('removes only the future floor on deactivation and promotes a Common on reactivation', () => {
    const activated = activeHistory();
    const deactivated = acquireLegalTrait(activated, 'Hera', 'HeraWeaponBoon', 'Epic');
    expect(deactivated.properUpbringingActive).toBeUndefined();
    expect(deactivated.equippedTraits.HermesWeaponBoon?.rarity).toBe('Rare');
    expect(deactivated.equippedTraits.ApolloWeaponBoon).toBeUndefined();
    expect(deactivated.equippedTraits.HeraWeaponBoon?.rarity).toBe('Epic');
    const replacementEvent = deactivated.events.at(-1);
    expect(
      replacementEvent?.kind === 'traitOffer' ? replacementEvent.replacementTransition : undefined,
    ).toEqual({
      slot: 'Melee',
      replacedTraitKey: 'ApolloWeaponBoon',
      oldRarity: 'Rare',
      newTraitKey: 'HeraWeaponBoon',
      requiredRarity: 'Epic',
    });
    const reactivated = acquireLegalTrait(deactivated, 'Hermes', 'SlowProjectileBoon', 'Common');
    expect(reactivated.properUpbringingActive).toBe(true);
    expect(reactivated.equippedTraits.SlowProjectileBoon?.rarity).toBe('Rare');
    expect(reactivated.equippedTraits.HeraWeaponBoon?.rarity).toBe('Epic');
  });

  it('keeps replacement rarity and replacement shortage floor-aware', () => {
    const history = activeHistory();
    const replacement = assessTraitOption(
      catalog,
      'HeraWeaponBoon',
      history,
      { resolvedProviderKey: 'Hera' },
      'Epic',
    );
    expect(replacement.findings).not.toContainEqual(
      expect.objectContaining({ code: 'rarityRollUnavailable' }),
    );
    expect(replacement.replacementTransition?.requiredRarity).toBe('Epic');
    const common = assessTraitOption(
      catalog,
      'HeraSpecialBoon',
      history,
      {
        resolvedProviderKey: 'Hera',
        boonRarityFacts: boonRarityFactsForOffer(catalog, history, {
          resolvedProviderKey: 'Hera',
        })!,
      },
      'Common',
    );
    expect(common.findings).toContainEqual(
      expect.objectContaining({ code: 'rarityRollUnavailable' }),
    );
  });

  it('does not activate or promote from an invalid/unselected offer and keeps replay branch-local', () => {
    const initial = twoEachHistory();
    const source = historyFrom([
      { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
    ]).events[0]!;
    const dormant = foldTraitHistoryEvents(catalog, initial.events);
    expect(dormant.properUpbringingActive).toBeUndefined();
    const invalidOffer = evaluateReachedTraitOffer(
      catalog,
      owner,
      'proper-invalid',
      {
        kind: 'traits',
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
    const branchA = foldTraitHistoryEvents(catalog, [
      ...initial.events,
      { ...source, sequence: 9 },
    ]);
    const branchB = foldTraitHistoryEvents(catalog, initial.events);
    expect(branchA.properUpbringingActive).toBe(true);
    expect(branchB.properUpbringingActive).toBeUndefined();
    expect(foldTraitHistoryEvents(catalog, [...branchA.events])).toEqual(branchA);
  });
});
