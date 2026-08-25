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
  createTraitOfferCandidateArtifacts,
} from '../../src/simulation/candidates/trait-offer-capability';
import { createSteadyGrowthCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
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

describe('Latest Model Hammer Rank II target predicate', () => {
  const latestModelOffer: AuthoredTraitOffer = Object.freeze({
    kind: 'traits',
    giverKey: 'Icarus',
    options: Object.freeze([
      { traitKey: 'UpgradeHammerBoon' },
      { traitKey: 'OmegaExplodeBoon' },
      { traitKey: 'CastHazardBoon' },
    ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    selectedOptionKey: 'option1',
  });

  it('uses only source-declared equipped Rank-I Hammers and folds exactly one to Rank II', () => {
    const before = historyFrom([
      { giverKey: 'WeaponUpgrade', traitKey: 'StaffDoubleAttackTrait' },
      { giverKey: 'WeaponUpgrade', traitKey: 'StaffDashAttackTrait' },
    ]);
    expect(before.equippedTraits.StaffDoubleAttackTrait?.hammerRank).toBe('RankI');
    expect(before.equippedTraits.StaffDashAttackTrait?.hammerRank).toBe('RankI');
    expect(targetedAcquisitionTargetKeys(catalog, 'UpgradeHammerBoon', before)).toEqual([
      'StaffDoubleAttackTrait',
    ]);

    const withTarget = Object.freeze({
      ...latestModelOffer,
      options: Object.freeze([
        { ...latestModelOffer.options[0], targetTraitKey: 'StaffDoubleAttackTrait' },
        latestModelOffer.options[1],
        latestModelOffer.options[2],
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
    });
    const assessment = assessSelectedTargetedAcquisition(catalog, withTarget, before);
    expect(assessment).toMatchObject({
      applies: true,
      legal: true,
      transition: {
        kind: 'upgradeHammerToRank2',
        sourceTraitKey: 'UpgradeHammerBoon',
        targetTraitKey: 'StaffDoubleAttackTrait',
        oldHammerRank: 'RankI',
        newHammerRank: 'RankII',
      },
    });
    const reached = evaluateReachedTraitOffer(
      catalog,
      owner,
      'icarus-latest-model',
      withTarget,
      before,
      Object.freeze({}),
      before.events.length,
    );
    const recorded = recordReachedTraitOffer(catalog, reached, before.events.length + 1, 'test');
    expect(recorded.history.equippedTraits.StaffDoubleAttackTrait?.hammerRank).toBe('RankII');
    expect(recorded.history.equippedTraits.StaffDashAttackTrait?.hammerRank).toBe('RankI');
    expect(recorded.history.equippedTraits.UpgradeHammerBoon).toMatchObject({
      giverKey: 'Icarus',
    });
    expect(recorded.history.equippedTraits.UpgradeHammerBoon?.rarity).toBeUndefined();
    expect(targetedAcquisitionTargetKeys(catalog, 'UpgradeHammerBoon', recorded.history)).toEqual(
      [],
    );
  });

  it('keeps Latest Model unavailable without an eligible Rank-I Hammer', () => {
    const history = historyWith('WeaponUpgrade', 'StaffDashAttackTrait');
    expect(assessTraitOption(catalog, 'UpgradeHammerBoon', history).findings).toContainEqual({
      code: 'targetedAcquisitionNoEligibleTarget',
      traitKey: 'UpgradeHammerBoon',
    });
  });
});

describe('targeted selected-trait child chronology', () => {
  const traitOwner = createTraitOfferAddress(
    createIncomingRewardAddress(goldenFBiome, goldenFStartId),
    'source',
  );

  it.each([
    ['Bridal Glow', 'BoonDecayBoon', undefined, 'targetedAcquisitionTargetMissing'],
    [
      'Bridal Glow retained invalid',
      'BoonDecayBoon',
      'ApolloCastBoon',
      'targetedAcquisitionTargetUnavailable',
    ],
    ['Latest Model', 'UpgradeHammerBoon', undefined, 'targetedAcquisitionTargetMissing'],
    [
      'Latest Model retained invalid',
      'UpgradeHammerBoon',
      'StaffDashAttackTrait',
      'targetedAcquisitionTargetUnavailable',
    ],
  ] as const)(
    'retains %s as the outer acquisition while blocking its exact child',
    (_label, selectedTraitKey, targetTraitKey, findingCode) => {
      const before =
        selectedTraitKey === 'BoonDecayBoon'
          ? historyFrom([{ giverKey: 'Demeter', traitKey: 'DemeterWeaponBoon', rarity: 'Common' }])
          : historyFrom([{ giverKey: 'WeaponUpgrade', traitKey: 'StaffDoubleAttackTrait' }]);
      const offer: AuthoredTraitOffer = Object.freeze({
        kind: 'traits',
        giverKey: selectedTraitKey === 'BoonDecayBoon' ? 'Hera' : 'Icarus',
        options: Object.freeze(
          selectedTraitKey === 'BoonDecayBoon'
            ? [
                {
                  traitKey: selectedTraitKey,
                  rarity: 'Common',
                  ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
                },
                { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
                { traitKey: 'HeraCastBoon', rarity: 'Common' },
              ]
            : [
                {
                  traitKey: selectedTraitKey,
                  ...(targetTraitKey === undefined ? {} : { targetTraitKey }),
                },
                { traitKey: 'OmegaExplodeBoon' },
                { traitKey: 'CastHazardBoon' },
              ],
        ) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
        selectedOptionKey: 'option1',
      });
      const initial = initializeTestRewardBranches()[0]!;
      const findings = new Map();
      const settlement = settleEncounterTraitOffer(
        catalog,
        Object.freeze({ ...initial, traitHistory: before }),
        traitOwner.owner,
        offer,
        before.events.length + 1,
        'encounterCompleted',
        findings,
        undefined,
        'source',
      );
      const expectedChild = createTraitAcquisitionTargetAddress(traitOwner, 'option1');
      expect(settlement.branch.traitHistory?.equippedTraits[selectedTraitKey]).toBeDefined();
      expect(settlement.blockedChild?.address).toEqual(expectedChild);
      expect(settlement.blockedChild?.branch).toBe(settlement.branch);
      expect([...findings.values()].map((entry) => entry.finding)).toContainEqual(
        expect.objectContaining({ code: findingCode, origin: expectedChild }),
      );
      expect(settlement.branch.traitHistory?.events.at(-1)).not.toHaveProperty(
        'targetedAcquisitionTransition',
      );
      if (selectedTraitKey === 'BoonDecayBoon') {
        expect(settlement.branch.traitHistory?.equippedTraits.DemeterWeaponBoon).toMatchObject({
          rarity: 'Common',
          level: 1,
        });
      } else {
        expect(settlement.branch.traitHistory?.equippedTraits.StaffDoubleAttackTrait).toMatchObject(
          {
            hammerRank: 'RankI',
          },
        );
      }
    },
  );
});
