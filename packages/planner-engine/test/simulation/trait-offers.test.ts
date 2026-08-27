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
  assessTraitOfferComposition,
  assessTraitOfferDomainComposition,
  attachTraitHistory,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  recordAspectStartingTrait,
  recordReachedTraitOffer,
  resolveRuntimeOfferFallbackTraitKey,
  traitCandidates,
  boonRarityFactsForOffer,
  traitOfferCompositionDomains,
  traitOfferStartingDraft,
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

import { initializeTestRewardBranches } from '../support/arcana-fear';
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidates/trait-offer-capability';
import { settleOwnedAcquisitionSite } from '../../src/simulation/rewards/acquisition-settlement';
import {
  processEncounterTraitOffer,
  settleEncounterTraitOffer,
} from '../../src/simulation/rewards/trait-settlement';
import { selectedTraitOfferProducts } from '../../src/simulation/rewards/biome/selected-trait-products';
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

describe('rarity-aware high-tier composition', () => {
  const timeStop = catalog.traits.byKey.TimeStopLastStandBoon;
  const duo = catalog.traits.byKey.ApolloSecondStageCastBoon;
  const hermes = catalog.traitGivers.byKey.Hermes;
  if (timeStop === undefined || duo === undefined || hermes === undefined)
    throw new Error('missing Hermes Legendary fixture');
  const highTierCatalog = Object.freeze({
    ...catalog,
    traits: Object.freeze({
      ...catalog.traits,
      values: Object.freeze(
        catalog.traits.values.map((trait) =>
          trait.key === timeStop.key || trait.key === duo.key
            ? Object.freeze({ ...trait, offerRequirements: Object.freeze([]) })
            : trait,
        ),
      ),
      byKey: Object.freeze({
        ...catalog.traits.byKey,
        [timeStop.key]: Object.freeze({ ...timeStop, offerRequirements: Object.freeze([]) }),
        [duo.key]: Object.freeze({ ...duo, offerRequirements: Object.freeze([]) }),
      }),
    }),
    traitGivers: Object.freeze({
      ...catalog.traitGivers,
      values: Object.freeze(
        catalog.traitGivers.values.map((giver) =>
          giver.key === 'Hermes'
            ? Object.freeze({ ...giver, traitKeys: Object.freeze([timeStop.key, duo.key]) })
            : giver,
        ),
      ),
      byKey: Object.freeze({
        ...catalog.traitGivers.byKey,
        Hermes: Object.freeze({ ...hermes, traitKeys: Object.freeze([timeStop.key, duo.key]) }),
      }),
    }),
  });
  const possibleContext = {
    boonRarityFacts: {
      providerBase: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
      contributions: [],
    },
  } as const;
  const impossibleContext = {
    boonRarityFacts: {
      providerBase: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
      roomOverride: { Legendary: 0 },
      contributions: [],
    },
  } as const;
  const duoContext = {
    boonRarityFacts: {
      providerBase: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
      roomOverride: { Duo: 0.2, Legendary: 0 },
      contributions: [],
    },
  } as const;

  it('keeps high-tier support branch-local, excludes impossible checks, and never requires H', () => {
    const history = createTraitHistoryState();
    expect(
      traitOfferCompositionDomains(highTierCatalog, 'Hermes', history, impossibleContext).highTier,
    ).toEqual([]);
    expect(
      traitOfferCompositionDomains(
        highTierCatalog,
        'Hermes',
        history,
        possibleContext,
      ).highTier.map((candidate) => [candidate.traitKey, candidate.rarity]),
    ).toEqual([[timeStop.key, 'Legendary']]);
    expect(
      traitOfferCompositionDomains(highTierCatalog, 'Hermes', history, duoContext).highTier.map(
        (candidate) => [candidate.traitKey, candidate.rarity],
      ),
    ).toEqual([[duo.key, 'Duo']]);
    // Re-reading the impossible branch must not inherit support cached for the possible one.
    expect(
      traitOfferCompositionDomains(highTierCatalog, 'Hermes', history, impossibleContext).highTier,
    ).toEqual([]);
    expect(
      assessTraitOfferDomainComposition({
        ordinaryKeys: ['ordinary1', 'ordinary2'],
        highTierKeys: [timeStop.key],
        replacementKeys: [],
        authored: [
          { traitKey: 'ordinary1', kind: 'ordinary' },
          { traitKey: 'ordinary2', kind: 'ordinary' },
        ],
        fallbackGold: false,
      }).legal,
    ).toBe(true);
  });
});

describe('Sacrificial Hymn replacement composition', () => {
  it('raises the existing exhaustion replacement minimum without replacing its composition model', () => {
    expect(
      assessTraitOfferDomainComposition({
        ordinaryKeys: ['ordinary1', 'ordinary2', 'ordinary3'],
        highTierKeys: [],
        replacementKeys: ['replacement1'],
        authored: [
          { traitKey: 'ordinary1', kind: 'ordinary' },
          { traitKey: 'ordinary2', kind: 'ordinary' },
          { traitKey: 'ordinary3', kind: 'ordinary' },
        ],
        fallbackGold: false,
        minimumReplacementCount: 1,
      }).findings,
    ).toContainEqual(expect.objectContaining({ code: 'missingForcedReplacement' }));
    expect(
      assessTraitOfferDomainComposition({
        ordinaryKeys: ['ordinary1', 'ordinary2', 'ordinary3'],
        highTierKeys: [],
        replacementKeys: ['replacement1'],
        authored: [
          { traitKey: 'replacement1', kind: 'replacement' },
          { traitKey: 'ordinary1', kind: 'ordinary' },
          { traitKey: 'ordinary2', kind: 'ordinary' },
        ],
        fallbackGold: false,
        minimumReplacementCount: 1,
      }).legal,
    ).toBe(true);
  });

  it('starts the next eligible offer with one replacement while a Hymn use is active', () => {
    const history = historyFrom([
      { giverKey: 'Apollo', traitKey: 'ApolloWeaponBoon', rarity: 'Common' },
    ]);
    const draft = traitOfferStartingDraft(catalog, 'Hera', history, { limitedSwapUses: 1 });
    expect(draft).toBeDefined();
    expect(
      draft?.options.some(
        (option) =>
          assessTraitOption(
            catalog,
            option.traitKey,
            history,
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
    const draft = traitOfferStartingDraft(catalog, 'Hera', history, {
      limitedSwapUses: 1,
    });
    if (draft?.kind !== 'traits') throw new Error('expected a Hera Hymn draft');
    const replacementIndex = draft.options.findIndex(
      (option) =>
        assessTraitOption(
          catalog,
          option.traitKey,
          history,
          { resolvedProviderKey: 'Hera' },
          option.rarity,
        ).replacementTransition !== undefined,
    );
    if (replacementIndex < 0) throw new Error('expected a forced replacement option');
    const selectedOptionKey = `option${replacementIndex + 1}` as 'option1' | 'option2' | 'option3';
    const initial = initializeTestRewardBranches()[0]!;
    const findings = new Map();
    const eligibleDraft: AuthoredTraitOffer = Object.freeze({
      ...draft,
      options: Object.freeze(
        draft.options.map((option) => Object.freeze({ ...option, rarity: 'Rare' as const })),
      ) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey,
    });
    const settlement = settleEncounterTraitOffer(
      catalog,
      Object.freeze({
        ...initial,
        traitHistory: history,
        stygianWell: Object.freeze({
          ...initial.stygianWell,
          yarnUses: 2,
          hymnUses: 2,
        }),
      }),
      createIncomingRewardAddress(goldenFBiome, goldenFStartId),
      eligibleDraft,
      history.events.length + 1,
      'encounterCompleted',
      findings,
    );
    expect(settlement.branch.stygianWell).toMatchObject({ yarnUses: 1, hymnUses: 1 });
    const equipped =
      settlement.branch.traitHistory?.equippedTraits[draft.options[replacementIndex]!.traitKey];
    if (equipped === undefined)
      throw new Error(
        JSON.stringify({
          draft: eligibleDraft,
          findings: [...findings.values()],
          events: settlement.branch.traitHistory?.events,
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
          traitHistory: history,
          stygianWell: Object.freeze({ ...initial.stygianWell, yarnUses: 1, hymnUses: 1 }),
        }),
      ],
      source,
      history.events.length + 1,
      (rewardHistory) => factsWithHistory(baseFacts(), rewardHistory, new Set()),
      new Map(),
    )[0]!;
    expect(settled.stygianWell).toMatchObject({ yarnUses: 0, hymnUses: 0 });
    expect(settled.traitEvaluations?.at(-1)?.context).toMatchObject({
      temporaryBoonRarityUses: 1,
      limitedSwapUses: 1,
    });
    expect(settled.traitHistory?.equippedTraits.HeraWeaponBoon).toMatchObject({
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
          traitHistory: history,
          stygianWell: Object.freeze({ ...initial.stygianWell, yarnUses: 1, hymnUses: 1 }),
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
          traitOffersByAcquisitionRole: Object.freeze({ source: null }),
        },
        historySequence: history.events.length + 1,
      },
      (rewardHistory) => factsWithHistory(baseFacts(), rewardHistory, new Set()),
      new Map(),
    );
    const blocked = product.traitChildSettlements?.[0];
    expect(blocked?.branch.stygianWell).toMatchObject({ yarnUses: 1, hymnUses: 1 });
    expect(blocked?.candidateContext?.context).toMatchObject({
      temporaryBoonRarityUses: 1,
      limitedSwapUses: 1,
      resolvedProviderKey: 'Hera',
    });
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
      boonRarityFacts: boonRarityFactsForOffer(catalog, history, {
        resolvedProviderKey: 'Apollo',
        boonRarityRoomOverride,
      })!,
    });
    expect(
      assessTraitOption(catalog, 'ApolloWeaponBoon', history, contextFor(fOverride), 'Common')
        .findings,
    ).not.toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable' }));
    expect(
      assessTraitOption(catalog, 'ApolloWeaponBoon', history, contextFor(qOverride), 'Common')
        .findings,
    ).toContainEqual(expect.objectContaining({ code: 'rarityRollUnavailable', detail: 'Common' }));
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
      (history) => factsWithHistory(baseFacts(), history, new Set()),
      new Map(),
    )[0]!;
    expect(settled.traitEvaluations?.[0]?.context.boonRarityFacts).toMatchObject({
      providerBase: { Rare: 0.06, Epic: 0.03, Duo: 0, Legendary: 0.01 },
      roomOverride: { Rare: 1, Epic: 0.7, Duo: 0.2, Legendary: 0.2 },
    });
    expect(settled.traitEvaluations?.[0]?.assessments[0]?.findings).toContainEqual(
      expect.objectContaining({ code: 'rarityRollUnavailable', detail: 'Common' }),
    );
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

  it('retains prerequisite trait keys as typed finding evidence', () => {
    const finding = assessTraitOption(
      catalog,
      'SlowExAttackBoon',
      createTraitHistoryState(),
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
          requirementTraitKeys: ['LobAmmoMagnetismTrait'],
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
          requirementTraitKeys: ['LobPulseAmmoTrait'],
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
    ['Surface', loadSurfaceNOPQProject],
  ] as const)(
    'carries concrete trait state across the complete %s route',
    (routeKey, createProject) => {
      const evaluation = simulateProject(catalog, createProject()).routes.find(
        (route) => route.routeKey === routeKey,
      );
      if (evaluation === undefined) throw new Error(`${routeKey} route is missing`);
      expect(evaluation.findings).toEqual([]);
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
      expect(finalBranch.history.traitFacts.upgradableTraitCount).toBe(
        finalBranch.traitHistory.upgradableTraitCount,
      );
      expect('upgradableTraitCount' in finalBranch.history).toBe(false);
      expect(events.map((event) => event.sequence)).toEqual(
        [...events].map((event) => event.sequence).sort((left, right) => left - right),
      );
    },
    10_000,
  );
});

describe('reached trait offer chronology', () => {
  it('requires a settled Spell Drop, not Aspect-start Sky Fall, before exporting Task Force fallback', () => {
    const emptyHistory = createTraitHistoryState();
    expect(assessTraitOption(catalog, 'OlympianSpellCountBoon', emptyHistory).legal).toBe(false);

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
      assessTraitOption(catalog, 'OlympianSpellCountBoon', ordinarySpellHistory, {
        settledSpellDrop: true,
      }).legal,
    ).toBe(true);

    const aspectSpellHistory = recordAspectStartingTrait(catalog, emptyHistory, owner, {
      aspectKey: 'SuitHexAspect',
    });
    expect(assessTraitOption(catalog, 'OlympianSpellCountBoon', aspectSpellHistory).legal).toBe(
      false,
    );

    const offer = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Athena',
      options: Object.freeze([
        { traitKey: 'OlympianSpellCountBoon', rarity: 'Common' as const },
        { traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
        { traitKey: 'RetaliateInvulnerabilityBoon', rarity: 'Common' as const },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    });

    expect(resolveRuntimeOfferFallbackTraitKey(catalog, offer, ordinarySpellHistory)).toBe(
      'FocusLastStandBoon',
    );
    const evaluation = evaluateReachedTraitOffer(
      catalog,
      owner,
      'source',
      offer,
      ordinarySpellHistory,
      { settledSpellDrop: true },
      0,
    );
    expect(evaluation.runtimeOfferFallbackTraitKey).toBe('FocusLastStandBoon');

    const branch = initializeTestRewardBranches()[0];
    if (branch === undefined) throw new Error('Task Force product fixture is missing its branch');
    const branchWithSpell = Object.freeze({
      ...branch,
      history: attachTraitHistory(branch.history, ordinarySpellHistory),
      traitHistory: ordinarySpellHistory,
    });
    const settled = processEncounterTraitOffer(catalog, branchWithSpell, owner, offer, 1, 'test');
    expect(selectedTraitOfferProducts([settled]).runtimeOfferFallbacks).toEqual([
      expect.objectContaining({
        preferredKey: 'OlympianSpellCountBoon',
        fallbackKey: 'FocusLastStandBoon',
      }),
    ]);
  });

  it('resolves Athena’s declaration-owned fallback after excluding companion screen rows', () => {
    const offer = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Athena',
      options: Object.freeze([
        { traitKey: 'DeathDefianceRefillBoon', rarity: 'Common' as const },
        { traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
        { traitKey: 'RetaliateInvulnerabilityBoon', rarity: 'Common' as const },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    });
    expect(resolveRuntimeOfferFallbackTraitKey(catalog, offer, createTraitHistoryState())).toBe(
      'FocusLastStandBoon',
    );
  });
  const offer = (giverKey: string, traitKeys: readonly [string, string, string]) =>
    Object.freeze({
      kind: 'traits',
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
    const occupied = foldTraitHistoryEvents(catalog, [
      {
        kind: 'traitOffer',
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
    expect(firstTrace.branches[0]?.composition).toMatchObject({ applies: true, legal: false });
    expect(laterTrace).toBeUndefined();
    expect(branch.traitHistory?.events).not.toContainEqual(
      expect.objectContaining({ owner, acquisitionRole: 'source' }),
    );
    expect(branch.traitHistory?.events).toHaveLength(0);
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
    const candidateArtifacts = createTraitOfferCandidateArtifacts(
      catalog,
      new Map([
        [
          semanticAddressKey(trait),
          Object.freeze([
            Object.freeze({ before: legalBranchTrace.before, context: legalBranchTrace.context }),
            Object.freeze({
              before: invalidBranchTrace.before,
              context: invalidBranchTrace.context,
            }),
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
    expect(result.result.branches[0]).toEqual({
      assessments: [
        { legal: true, findings: [] },
        { legal: true, findings: [] },
        { legal: true, findings: [] },
      ],
      composition: { applies: false, legal: true, findings: [] },
      persephoneLevelBonusMaximums: [undefined, undefined, undefined],
      effectiveLevels: [1, 1, 1],
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
      persephoneLevelBonusMaximums: [undefined, undefined, undefined],
      effectiveLevels: [1, 1, 1],
    });
    expect(result.result.findings).toContainEqual({ code: 'missingAttackOrSpecial' });
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

  it('keeps Athena preferred candidates authorable without a Death Defiance input', () => {
    const history = createTraitHistoryState();
    const candidate = traitCandidates(catalog, 'Athena', history).find(
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
    expect(assessTraitOffer(catalog, retained, history)).toMatchObject([
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
    const facts = (history: Parameters<typeof factsWithHistory>[1]) =>
      factsWithHistory(baseFacts(), history, new Set());
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
      initializeTestRewardBranches(),
      {
        origin: createIncomingRewardAddress(biome, createOccurrenceId('invalid-hammer-trace')),
        offer: hammer,
        producerLifecycleKey: 'RoomReward',
        instanceProvenance: 'free',
        traitOffersByAcquisitionRole: hammerOffer,
        traitContext: activeLoadout,
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
        traitOffersByAcquisitionRole: boonOffer,
        traitContext: activeLoadout,
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
    expect(branch?.traitHistory?.events).toHaveLength(1);
    expect(branch?.traitHistory?.equippedTraits[expectedOffer.options[0].traitKey]).toBeDefined();
  });
});
