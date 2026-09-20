import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOffer,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  assessTraitOption,
  assessTraitOffer,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordAspectStartingTrait,
  recordReachedTraitOffer,
  traitCandidates,
  boonRarityFactsForOffer,
  traitOfferStartingOutcome,
  type ProjectEvaluation,
  type SelectedTraitOfferAssessment,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFStartId,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';

import {
  initializeTestRewardBranches,
  initializeTestRewardBranchesForRoute,
} from '../support/arcana-fear';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer/capability';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition/site-settlement';
import { mergeRewardFindingEmissions } from '../../src/simulation/rewards/findings';
import { settleEncounterTraitOffer } from '../../src/simulation/rewards/trait-settlement/coordinator';
import {
  evaluateTraitOfferCandidate,
  type TraitOfferCandidateQuery,
} from '../../src/simulation/candidates/trait-offer/query';
import {
  createPreparedProjectCandidateSession,
  simulateProject,
  simulateProjectAssembly,
} from '../../src/simulation';
import { traitFrontierState, withSettledSpellDrop } from '../support/simulation-state';
import { createDefaultRouteLoadout } from '../../src/authored-project/loadout';

const owner = { kind: 'project' } as SemanticAddress;

function settleTestRoomReward(
  biome: ReturnType<typeof createBiomeAddress>,
  occurrenceId: ReturnType<typeof createOccurrenceId>,
  branches: Parameters<typeof settleOwnedAcquisitionSite>[1],
  source: Parameters<typeof settleOwnedAcquisitionSite>[2]['source'],
  sequence: number,
  facts: Parameters<typeof settleOwnedAcquisitionSite>[3],
  findings: Map<string, import('../../src/simulation/finding-regions').FindingRegionEntry>,
) {
  const settlement = settleOwnedAcquisitionSite(
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
  );
  mergeRewardFindingEmissions(findings, settlement.findingEmissions);
  return settlement.branches;
}

function reachedTraitOffers(
  evaluation: ProjectEvaluation,
): readonly SelectedTraitOfferAssessment[] {
  return Object.freeze(
    evaluation.route.biomes.flatMap((biome) =>
      'rewards' in biome ? biome.rewards.selectedTraitOffers : [],
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

describe('Sacrificial Hymn replacement composition', () => {
  it('starts the next eligible offer with one replacement while a Hymn use is active', () => {
    const history = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const draft = traitOfferStartingOutcome(
      catalog,
      'Hera',
      traitFrontierState(history, { stygianWell: { hymnUses: 1 } }),
      { replacementRollChance: 1 },
    );
    expect(draft).toBeDefined();
    if (draft?.kind !== 'traits') throw new Error('expected a Hera Hymn draft');
    expect(
      draft?.options.some(
        (option) =>
          assessTraitOption(
            catalog,
            option.traitKey,
            traitFrontierState(history),
            { resolvedProviderKey: 'Hera' },
            option.rarity,
          ).replacementTransition !== undefined,
      ),
    ).toBe(true);
  });

  it('applies Yarn and Hymn once to the same eligible encounter screen', () => {
    const history = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const draft = traitOfferStartingOutcome(
      catalog,
      'Hera',
      traitFrontierState(history, { stygianWell: { hymnUses: 1 } }),
      { replacementRollChance: 1 },
    );
    if (draft?.kind !== 'traits') throw new Error('expected a Hera Hymn draft');
    const replacementIndex = draft.options.findIndex(
      (option) =>
        assessTraitOption(
          catalog,
          option.traitKey,
          traitFrontierState(history),
          { resolvedProviderKey: 'Hera' },
          option.rarity,
        ).replacementTransition !== undefined,
    );
    if (replacementIndex < 0) throw new Error('expected a forced replacement option');
    const replacement = draft.options[replacementIndex]!;
    const options = [
      ...draft.options.slice(0, replacementIndex),
      ...draft.options.slice(replacementIndex + 1),
    ];
    options.splice(1, 0, replacement);
    const selectedOptionKey = 'option2' as const;
    const initial = initializeTestRewardBranches()[0]!;
    const eligibleDraft: AuthoredTraitOffer = Object.freeze({
      ...draft,
      options: Object.freeze(
        options.map((option) => Object.freeze({ ...option, rarity: 'Rare' as const })),
      ) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey,
    });
    const settlement = settleEncounterTraitOffer(
      catalog,
      Object.freeze({
        ...initial,
        state: Object.freeze({
          ...initial.state,
          traitHistory: history,
          stygianWell: Object.freeze({
            ...initial.state.stygianWell,
            yarnUses: 2,
            hymnUses: 2,
          }),
        }),
      }),
      createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      eligibleDraft,
      history.events.length + 1,
      'encounterCompleted',
    );
    expect(settlement.branch.state.stygianWell).toMatchObject({ yarnUses: 1, hymnUses: 1 });
    const equipped = settlement.branch.state.traitHistory?.equippedTraits[replacement.traitKey];
    if (equipped === undefined)
      throw new Error(
        JSON.stringify({
          draft: eligibleDraft,
          findings: settlement.findingEntries,
          events: settlement.branch.state.traitHistory?.events,
        }),
      );
    expect(equipped).toMatchObject({ level: 3, rarity: 'Rare' });
  });

  it('applies and consumes Yarn and Hymn on an ordinary incoming Boon screen', () => {
    const history = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const initial = initializeTestRewardBranches()[0]!;
    const source = {
      origin: createIncomingRewardAddress(goldenFBiome, createOccurrenceId('well-incoming-boon')),
      offer: {
        rewardType: 'Boon' as const,
        payload: { kind: 'BoonSource' as const, source: 'HeraUpgrade' },
      },
      producerLifecycleKey: 'RoomReward' as const,
      instanceProvenance: 'free' as const,
      presentsMaterializedScreen: false,
      traitOffersByAcquisitionRole: Object.freeze({
        source: Object.freeze({
          kind: 'traits' as const,
          giverKey: 'Hera',
          options: Object.freeze([
            { traitKey: 'HeraWeaponBoon', rarity: 'Rare' as const },
            { traitKey: 'HeraSpecialBoon', rarity: 'Rare' as const },
            { traitKey: 'HeraCastBoon', rarity: 'Rare' as const },
          ] as const),
          selectedOptionKey: 'option1' as const,
        }),
      }),
    };
    const settled = settleTestRoomReward(
      goldenFBiome,
      createOccurrenceId('well-incoming-boon'),
      [
        Object.freeze({
          ...initial,
          state: Object.freeze({
            ...initial.state,
            traitHistory: history,
            stygianWell: Object.freeze({ ...initial.state.stygianWell, yarnUses: 1, hymnUses: 1 }),
          }),
        }),
      ],
      source,
      history.events.length + 1,
      (state) => factsWithHistory(baseFacts(), state.rewardHistory, new Set()),
      new Map(),
    )[0]!;
    expect(settled.state.stygianWell).toMatchObject({ yarnUses: 0, hymnUses: 0 });
    expect(settled.traitEvaluations?.at(-1)?.state.stygianWell).toMatchObject({
      yarnUses: 1,
      hymnUses: 1,
    });
    expect(settled.state.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
      level: 3,
      rarity: 'Rare',
    });
  });

  it('retains Yarn and Hymn on a missing incoming Boon screen and publishes their candidate context', () => {
    const history = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const initial = initializeTestRewardBranches()[0]!;
    const origin = createIncomingRewardAddress(
      goldenFBiome,
      createOccurrenceId('well-missing-incoming-boon'),
    );
    const product = settleOwnedAcquisitionSite(
      catalog,
      [
        Object.freeze({
          ...initial,
          state: Object.freeze({
            ...initial.state,
            traitHistory: history,
            stygianWell: Object.freeze({ ...initial.state.stygianWell, yarnUses: 1, hymnUses: 1 }),
          }),
        }),
      ],
      {
        siteOwner: createOccurrenceAddress(
          goldenFBiome,
          createOccurrenceId('well-missing-incoming-boon'),
        ),
        pointKey: 'roomRewardPickup',
        entryKey: 'self',
        source: {
          origin,
          offer: {
            rewardType: 'Boon',
            payload: { kind: 'BoonSource', source: 'HeraUpgrade' },
          },
          producerLifecycleKey: 'RoomReward',
          instanceProvenance: 'free',
          presentsMaterializedScreen: false,
          traitOffersByAcquisitionRole: Object.freeze({ source: null }),
        },
        historySequence: history.events.length + 1,
      },
      (state) => factsWithHistory(baseFacts(), state.rewardHistory, new Set()),
    );
    const blocked = product.traitChildSettlements?.[0];
    expect(blocked?.branch.state.stygianWell).toMatchObject({ yarnUses: 1, hymnUses: 1 });
    expect(blocked?.candidateContext?.state.stygianWell).toMatchObject({
      yarnUses: 1,
      hymnUses: 1,
    });
    expect(blocked?.candidateContext?.source).toMatchObject({ resolvedProviderKey: 'Hera' });
  });
});

describe('rarity offer settlement contacts', () => {
  it('keeps Common possible in F Miniboss but excludes it in Q Miniboss', () => {
    const history = createTraitHistoryState();
    const fOverride = catalog.rooms.byKey.F_MiniBoss01?.boonRarityOverride;
    const qOverride = catalog.rooms.byKey.Q_MiniBoss02?.boonRarityOverride;
    if (fOverride === undefined || qOverride === undefined)
      throw new Error('missing audited Miniboss rarity overrides');
    const contextFor = (boonRarityRoomOverride: typeof fOverride) => ({
      resolvedProviderKey: 'Apollo',
      boonRarityFacts: boonRarityFactsForOffer(catalog, traitFrontierState(history), {
        resolvedProviderKey: 'Apollo',
        boonRarityRoomOverride,
      })!,
    });
    const value = {
      kind: 'traits',
      giverKey: 'Apollo',
      selectedOptionKey: 'option1',
      options: [
        { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
        { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
      ],
    } as const;
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        value,
        traitFrontierState(history),
        contextFor(fOverride),
        1,
      ).generation?.legal,
    ).toBe(true);
    expect(
      evaluateReachedTraitOffer(
        catalog,
        owner,
        'source',
        value,
        traitFrontierState(history),
        contextFor(qOverride),
        1,
      ).generation?.legal,
    ).toBe(false);
  });

  it('settles a Hermes offer in a Miniboss with the room override, not the room reward provider', () => {
    const occurrenceId = createOccurrenceId('rarity-hermes-miniboss');
    const room = catalog.rooms.byKey.Q_MiniBoss02;
    if (room?.boonRarityOverride === undefined)
      throw new Error('missing Q Miniboss rarity override');
    const settled = settleTestRoomReward(
      createBiomeAddress('Surface', 'Q'),
      occurrenceId,
      initializeTestRewardBranches(),
      {
        origin: createIncomingRewardAddress(createBiomeAddress('Surface', 'Q'), occurrenceId),
        offer: { rewardType: 'HermesUpgrade' },
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        presentsMaterializedScreen: true,
        traitContext: { boonRarityRoomOverride: room.boonRarityOverride },
        traitOffersByAcquisitionRole: {
          self: {
            kind: 'traits',
            giverKey: 'Hermes',
            options: [
              { traitKey: 'HermesWeaponBoon', rarity: 'Common' },
              { traitKey: 'HermesSpecialBoon', rarity: 'Common' },
              { traitKey: 'HermesCastDiscountBoon', rarity: 'Common' },
            ],
            selectedOptionKey: 'option1',
            rarificationActions: [],
          },
        },
      },
      1,
      (state) => factsWithHistory(baseFacts(), state.rewardHistory, new Set()),
      new Map(),
    )[0]!;
    expect(settled.traitEvaluations?.[0]?.source.boonRarityFacts).toMatchObject({
      providerBase: { Rare: 0.06, Epic: 0.03, Heroic: 0, Duo: 0, Legendary: 0.01 },
      rollOrder: ['Common', 'Rare', 'Epic', 'Duo', 'Legendary'],
      roomOverride: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
    });
    expect(settled.traitEvaluations?.[0]?.generation?.legal).toBe(false);
  });
});

describe('trait legality and derived facts', () => {
  it.each(['Underworld', 'Surface', 'Dream'])(
    'assesses Forage against %s at the shared eligibility contact',
    (routeKey) => {
      const history = createTraitHistoryState();
      expect(
        assessTraitOption(catalog, 'PlantHealthBoon', traitFrontierState(history, { routeKey }), {})
          .legal,
      ).toBe(routeKey !== 'Dream');
      expect(
        traitCandidates(catalog, 'Demeter', traitFrontierState(history, { routeKey }), {}).find(
          (candidate) => candidate.traitKey === 'PlantHealthBoon',
        )?.available,
      ).toBe(routeKey !== 'Dream');
      expect(
        assessTraitOption(catalog, 'PlantHealthBoon', traitFrontierState(history, { routeKey }), {
          blockGiftBoons: true,
        }).legal,
      ).toBe(false);
      expect(
        assessTraitOption(
          catalog,
          'DemeterWeaponBoon',
          traitFrontierState(history, { routeKey }),
          {},
        ).legal,
      ).toBe(true);
    },
  );
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
    expect(derivedHistory.equippedSlots).toMatchObject({
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
  ])('reports the $label authority', ({ traitKey, history, code }) => {
    expect(
      assessTraitOption(catalog, traitKey, traitFrontierState(history), {}).findings.map(
        (finding) => finding.code,
      ),
    ).toContain(code);
  });

  it('retains prerequisite trait keys as typed finding evidence', () => {
    const finding = assessTraitOption(
      catalog,
      'SlowExAttackBoon',
      traitFrontierState(createTraitHistoryState()),
      {},
    ).findings.find((candidate) => candidate.code === 'missingPrerequisite');
    expect(finding).toEqual({
      code: 'missingPrerequisite',
      traitKey: 'SlowExAttackBoon',
      requirementTraitKeys: [
        'AphroditeWeaponBoon',
        'ApolloWeaponBoon',
        'DemeterWeaponBoon',
        'HephaestusWeaponBoon',
        'HeraWeaponBoon',
        'HestiaWeaponBoon',
        'PoseidonWeaponBoon',
        'ZeusWeaponBoon',
        'AresWeaponBoon',
      ],
    });
  });

  it('accepts satisfied positive, element, and zero-Common requirements', () => {
    expect(
      assessTraitOption(
        catalog,
        'DoorHealToFullBoon',
        traitFrontierState(historyWith('Aphrodite', 'HighHealthOffenseBoon', 'Rare')),
        {},
      ).legal,
    ).toBe(true);
    expect(
      assessTraitOption(catalog, 'ElementalDamageBoon', traitFrontierState(derivedHistory), {})
        .legal,
    ).toBe(true);
    expect(
      assessTraitOption(
        catalog,
        'CommonGlobalDamageBoon',
        traitFrontierState(historyWith('Hera', 'HeraWeaponBoon', 'Rare')),
        {},
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
        const loadout = { weaponKey: weapon.key, aspectKey };
        const expectedCompatible = new Set<string>(
          expectedHammerTraitsByWeapon[
            weapon.key as keyof typeof expectedHammerTraitsByWeapon
          ].filter((traitKey) =>
            (expectedHammerRestrictedAspects[traitKey] ?? weapon.aspectKeys).includes(aspectKey),
          ),
        );
        const candidates = traitCandidates(
          catalog,
          hammer.key,
          traitFrontierState(history, { loadout }),
          {},
        );
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
    const lobLoadout = { weaponKey: 'WeaponLob', aspectKey: 'LobAmmoBoostAspect' };
    const history = historyWith('WeaponUpgrade', 'LobAmmoMagnetismTrait');
    const excluded = assessTraitOption(
      catalog,
      'LobPulseAmmoTrait',
      traitFrontierState(history, { loadout: lobLoadout }),
      {},
    );
    expect(excluded).toEqual({
      legal: false,
      findings: [
        {
          code: 'negativePrerequisite',
          traitKey: 'LobPulseAmmoTrait',
          requirementTraitKeys: ['LobAmmoMagnetismTrait'],
        },
      ],
    });

    const reverse = assessTraitOption(
      catalog,
      'LobAmmoMagnetismTrait',
      traitFrontierState(historyWith('WeaponUpgrade', 'LobPulseAmmoTrait'), {
        loadout: lobLoadout,
      }),
      {},
    );
    expect(reverse).toEqual({
      legal: false,
      findings: [
        {
          code: 'negativePrerequisite',
          traitKey: 'LobAmmoMagnetismTrait',
          requirementTraitKeys: ['LobPulseAmmoTrait'],
        },
      ],
    });

    const compatible = assessTraitOption(
      catalog,
      'LobAmmoTrait',
      traitFrontierState(history, { loadout: lobLoadout }),
      {},
    );
    expect(compatible).toEqual({ legal: true, findings: [] });
  });

  it.each([
    ['Underworld', createGoldenFGHIProject],
    ['Surface', loadSurfaceNOPQProject],
  ] as const)(
    'carries concrete trait state across the complete %s route',
    (routeKey, createProject) => {
      const evaluation = simulateProject(catalog, createProject()).route;
      if (evaluation === undefined) throw new Error(`${routeKey} route is missing`);
      expect(evaluation.findings).toEqual([]);
      expect(evaluation.status).toBe('valid');
      expect(evaluation.biomes).toHaveLength(4);
      const finalBiome = evaluation.biomes.at(-1);
      if (finalBiome === undefined || !('rewards' in finalBiome)) {
        throw new Error(`${routeKey} final biome reward product is missing`);
      }
      const finalBranch = finalBiome.rewards.branches[0];
      if (finalBranch === undefined || finalBranch.state.traitHistory === undefined) {
        throw new Error(`${routeKey} trait history is missing`);
      }
      const events = finalBranch.state.traitHistory.events;
      expect(events.length).toBeGreaterThan(0);
      expect(
        events.some(
          (event) =>
            event.kind === 'traitOffer' &&
            catalog.traitGivers.byKey[event.giverKey]?.providerKind === 'hammer',
        ),
      ).toBe(true);
      expect(
        events.some(
          (event) =>
            event.kind === 'traitOffer' &&
            catalog.traitGivers.byKey[event.giverKey]?.providerKind === 'hermes',
        ),
      ).toBe(true);
      if (routeKey === 'Surface') {
        expect(events.some((event) => event.acquisitionRole === 'chosenSource')).toBe(true);
        expect(events.some((event) => event.acquisitionRole === 'spurnedSource')).toBe(true);
      }
      expect(finalBranch.state.rewardHistory.traitFacts.upgradableTraitCount).toBe(
        finalBranch.state.traitHistory.upgradableTraitCount,
      );
      expect('upgradableTraitCount' in finalBranch.state.rewardHistory).toBe(false);
      expect(events.map((event) => event.sequence)).toEqual(
        [...events].map((event) => event.sequence).sort((left, right) => left - right),
      );
    },
  );
});

describe('reached trait offer chronology', () => {
  it('requires a settled Spell Drop, not Aspect-start Sky Fall, before enabling Task Force', () => {
    const emptyHistory = createTraitHistoryState();
    expect(
      assessTraitOption(catalog, 'OlympianSpellCountBoon', traitFrontierState(emptyHistory), {})
        .legal,
    ).toBe(false);

    const ordinarySpellHistory = foldTraitHistoryEvents(catalog, [
      Object.freeze({
        kind: 'traitOffer' as const,
        owner,
        acquisitionRole: 'spell',
        sequence: 1,
        giverKey: 'SpellDrop',
        options: Object.freeze([{ traitKey: 'SpellPolymorphTrait' }]) as TraitOfferEvent['options'],
        selectedOptionKey: 'option1' as const,
        acquisitionPoint: 'test',
      }),
    ]);
    expect(
      assessTraitOption(
        catalog,
        'OlympianSpellCountBoon',
        withSettledSpellDrop(traitFrontierState(ordinarySpellHistory)),
        {},
      ).legal,
    ).toBe(true);

    const aspectSpellHistory = recordAspectStartingTrait(catalog, emptyHistory, owner, {
      aspectKey: 'SuitHexAspect',
    });
    expect(
      assessTraitOption(
        catalog,
        'OlympianSpellCountBoon',
        traitFrontierState(aspectSpellHistory),
        {},
      ).legal,
    ).toBe(false);
  });
  const offer = (giverKey: string, traitKeys: readonly [string, string, string]) =>
    Object.freeze({
      kind: 'traits',
      giverKey,
      options: Object.freeze(
        traitKeys.map((traitKey) => Object.freeze({ traitKey, rarity: 'Common' as const })),
      ) as TraitOfferEvent['options'],
      selectedOptionKey: 'option1' as const,
    });

  it('keeps an invalid first offer out of history so a later Olympian can satisfy the rule', () => {
    const first = evaluateReachedTraitOffer(
      catalog,
      owner,
      'chosenSource',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloRetaliateBoon']),
      traitFrontierState(createTraitHistoryState()),
      {},
      0,
    );
    expect(first.generation?.legal).toBe(false);
    expect(recordReachedTraitOffer(catalog, first, 1, 'test').history.events).toHaveLength(0);

    const second = evaluateReachedTraitOffer(
      catalog,
      owner,
      'chosenSource',
      offer('Apollo', ['ApolloWeaponBoon', 'ApolloSpecialBoon', 'ApolloCastBoon']),
      first.state,
      {},
      1,
    );
    expect(second.generation?.legal).toBe(true);
    expect(recordReachedTraitOffer(catalog, second, 2, 'test').history.events).toHaveLength(1);
  });

  it('publishes and repairs a real invalid first offer through project simulation', () => {
    const owner = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const traitAddress = createTraitOfferAddress(owner, 'source');
    const invalidFirstOffer = Object.freeze({
      kind: 'traits',
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
    const route = evaluation.route;
    const f = route?.biomes.find((candidate) => candidate.biomeKey === 'F');
    if (f === undefined || !('rewards' in f)) throw new Error('F reward evaluation is missing');

    expect(f.findings).toContainEqual({
      code: 'traitOfferGenerationUnavailable',
      severity: 'error',
      phase: 'rewardGeneration',
      origin: traitAddress,
      evidence: { acquisitionRole: 'source', lifecyclePoint: 'roomRewardPickup' },
    });
    const branch = f.rewards.branches[0];
    if (branch === undefined) throw new Error('F reward branch is missing');
    const firstTrace = f.rewards.selectedTraitOffers.find(
      (trace) =>
        semanticAddressKey(trace.address.owner) === semanticAddressKey(owner) &&
        trace.acquisitionRole === 'source',
    );
    const laterTrace = f.rewards.selectedTraitOffers.find(
      (trace) =>
        trace.address.owner.kind !== 'encounterPhase' &&
        trace.address.owner.kind !== 'acquisitionEntry' &&
        trace.address.owner.occurrenceId === goldenFOccurrenceId(2, 1) &&
        trace.acquisitionRole === 'source',
    );
    if (firstTrace === undefined) throw new Error('first-offer repair trace is missing');
    expect(firstTrace.branches[0]?.generation).toMatchObject({ applies: true, legal: false });
    expect(laterTrace).toBeUndefined();
    expect(branch.state.traitHistory?.events).not.toContainEqual(
      expect.objectContaining({ owner, acquisitionRole: 'source' }),
    );
    expect(branch.state.traitHistory?.events).toHaveLength(0);
    expect(
      createPreparedProjectCandidateSession(
        catalog,
        simulateProjectAssembly(catalog, project),
      ).evaluate({
        kind: 'traitOffer',
        trait: traitAddress,
        value: {
          kind: 'traits',
          giverKey: 'Apollo',
          options: [
            { traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
            { traitKey: 'ApolloSpecialBoon', rarity: 'Common' },
            { traitKey: 'ApolloCastBoon', rarity: 'Common' },
          ],
          selectedOptionKey: 'option1',
        },
      }),
    ).toMatchObject({ kind: 'traitOffer', result: { supported: true, findings: [] } });
  });

  it('keeps first-offer candidate support and evidence grouped by reached branch', () => {
    const project = createGoldenFGHIProject();
    const baseline = simulateProject(catalog, project);
    const owner = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const trait = createTraitOfferAddress(owner, 'source');
    const value: AuthoredTraitOffer = Object.freeze({
      kind: 'traits',
      giverKey: 'Apollo',
      options: Object.freeze([
        { traitKey: 'ApolloCastBoon', rarity: 'Common' },
        { traitKey: 'ApolloSprintBoon', rarity: 'Common' },
        { traitKey: 'ApolloManaBoon', rarity: 'Common' },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1',
    });
    const occupiedBefore = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
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
      traitFrontierState(occupiedBefore),
      {},
      0,
    );
    const invalidBranchTrace = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      value,
      traitFrontierState(createTraitHistoryState()),
      {},
      0,
    );
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          Object.freeze([
            Object.freeze({ state: legalBranchTrace.state, source: legalBranchTrace.source }),
            Object.freeze({ state: invalidBranchTrace.state, source: invalidBranchTrace.source }),
          ]),
        ],
      ]),
    );
    const query: TraitOfferCandidateQuery = { kind: 'traitOffer', trait, value };
    const result = evaluateTraitOfferCandidate(
      catalog,
      project,
      baseline,
      candidateArtifacts,
      query,
    );
    if (result.kind !== 'traitOffer') throw new Error('trait offer candidate was unavailable');

    expect(result.result.supported).toBe(true);
    expect(result.result.branches).toHaveLength(2);
    expect(result.result.branches[0]).toMatchObject({
      assessments: [
        { legal: true, findings: [] },
        { legal: true, findings: [] },
        { legal: true, findings: [] },
      ],
      composition: { applies: false, legal: true, findings: [] },
      persephoneRollMaximums: [undefined, undefined, undefined],
      effectiveLevels: [1, 1, 1],
    });
    expect(result.result.branches[1]).toMatchObject({
      assessments: [
        { legal: true, findings: [] },
        { legal: true, findings: [] },
        { legal: true, findings: [] },
      ],
      generation: {
        applies: true,
        legal: false,
        findings: [{ code: 'traitOfferGenerationUnavailable' }],
      },
      persephoneRollMaximums: [undefined, undefined, undefined],
      effectiveLevels: [1, 1, 1],
    });
    expect(result.result.findings).toContainEqual({ code: 'traitOfferGenerationUnavailable' });
  });

  it('keeps naturally surviving same-owner traces on one pre-offer state and context', () => {
    // The current Golden and representative routes naturally collapse repeated
    // owners onto one pre-offer context. The constructed boundary witness above
    // protects the typed candidate product if a future branch producer diverges.
    const routes = [
      ['Underworld', createGoldenFGHIProject],
      ['Surface', loadSurfaceNOPQProject],
    ] as const;
    for (const [routeKey, createProject] of routes) {
      const traces = reachedTraitOffers(simulateProject(catalog, createProject())).filter(
        (trace) => trace.address.routeKey === routeKey,
      );
      expect(traces.every((trace) => trace.branches.length > 0)).toBe(true);
    }
  });

  it('keeps individually eligible non-core choices available while the whole offer needs repair', () => {
    const candidate = traitCandidates(
      catalog,
      'Apollo',
      traitFrontierState(createTraitHistoryState()),
      {},
    ).find((entry) => entry.traitKey === 'ApolloRetaliateBoon' && entry.rarity === 'Common');
    expect(candidate?.available).toBe(true);
    expect(candidate?.assessment.findings).toEqual([]);
  });

  it('keeps Athena preferred candidates authorable without a Death Defiance input', () => {
    const history = createTraitHistoryState();
    const candidate = traitCandidates(catalog, 'Athena', traitFrontierState(history), {}).find(
      (entry) => entry.traitKey === 'DeathDefianceRefillBoon',
    );
    expect(candidate?.available).toBe(true);

    const retained = Object.freeze({
      kind: 'traits',
      giverKey: 'Athena',
      options: Object.freeze([
        { traitKey: 'DeathDefianceRefillBoon', rarity: 'Common' as const },
        { traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
        { traitKey: 'RetaliateInvulnerabilityBoon', rarity: 'Common' as const },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1' as const,
    });
    expect(assessTraitOffer(catalog, retained, traitFrontierState(history), {})).toMatchObject([
      {
        legal: true,
      },
      { legal: true },
      { legal: true },
    ]);
  });

  it('records only the valid trait acquisition when an invalid offer emits no equipped event', () => {
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
    const facts = (state: { readonly rewardHistory: Parameters<typeof factsWithHistory>[1] }) =>
      factsWithHistory(baseFacts(), state.rewardHistory, new Set());
    const findings = new Map();
    const hammer = { rewardType: 'WeaponUpgrade' as const };
    const hammerKeys = catalog.traitGivers.byKey.WeaponUpgrade?.traitKeys.filter((traitKey) => {
      const compatibility = catalog.traits.byKey[traitKey]?.hammerCompatibility;
      return (
        compatibility?.weaponKey === authoredLoadout.weaponKey &&
        compatibility.aspectKeys.includes(authoredLoadout.aspectKey)
      );
    });
    if (hammerKeys === undefined || hammerKeys.length < 3) {
      throw new Error('invalid-Hammer trace fixture needs three compatible options');
    }
    const hammerOffer = Object.freeze({
      weaponUpgrade: Object.freeze({
        kind: 'traits' as const,
        giverKey: 'WeaponUpgrade',
        options: Object.freeze(
          hammerKeys.slice(0, 3).map((traitKey) => Object.freeze({ traitKey })),
        ) as readonly [
          { readonly traitKey: string },
          { readonly traitKey: string },
          { readonly traitKey: string },
        ],
        selectedOptionKey: 'option1' as const,
      }),
    });
    let branches = settleTestRoomReward(
      biome,
      createOccurrenceId('invalid-hammer-trace'),
      initializeTestRewardBranchesForRoute(
        undefined,
        undefined,
        catalog,
        undefined,
        undefined,
        'Underworld',
        { ...createDefaultRouteLoadout(catalog), ...activeLoadout },
      ),
      {
        origin: createIncomingRewardAddress(biome, createOccurrenceId('invalid-hammer-trace')),
        offer: hammer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        presentsMaterializedScreen: true,
        traitOffersByAcquisitionRole: hammerOffer,
        traitContext: {},
      },
      1,
      facts,
      findings,
    );
    const boon = {
      rewardType: 'Boon' as const,
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const boonOffer = Object.freeze({
      source: Object.freeze({
        kind: 'traits' as const,
        giverKey: 'Apollo',
        options: Object.freeze([
          Object.freeze({ traitKey: 'ApolloWeaponBoon', rarity: 'Common' as const }),
          Object.freeze({ traitKey: 'ApolloSpecialBoon', rarity: 'Common' as const }),
          Object.freeze({ traitKey: 'ApolloCastBoon', rarity: 'Common' as const }),
        ] as const),
        selectedOptionKey: 'option1' as const,
      }),
    });
    branches = settleTestRoomReward(
      biome,
      createOccurrenceId('valid-boon-trace'),
      branches,
      {
        origin: createIncomingRewardAddress(biome, createOccurrenceId('valid-boon-trace')),
        offer: boon,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        presentsMaterializedScreen: true,
        traitOffersByAcquisitionRole: boonOffer,
        traitContext: {},
      },
      2,
      facts,
      findings,
    );

    const branch = branches[0];
    const expectedOffer = boonOffer.source;
    if (expectedOffer?.kind !== 'traits') throw new Error('valid boon trait offer is missing');
    expect(branch?.events).toContainEqual(
      expect.objectContaining({
        kind: 'concreteAcquisition',
        origin: expect.objectContaining({
          occurrenceId: 'valid-boon-trace',
        }),
      }),
    );
    expect(branch?.state.traitHistory?.events).toHaveLength(1);
    expect(
      branch?.state.traitHistory?.equippedTraits[expectedOffer.options[0].traitKey],
    ).toBeDefined();
  });
});
