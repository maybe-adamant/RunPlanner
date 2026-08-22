import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createTraitAcquisitionTargetAddress,
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
  assessSelectedTargetedAcquisition,
  assessTraitOfferComposition,
  createTraitHistoryState,
  evaluateReachedTraitOffer,
  foldTraitHistoryEvents,
  isPomEligibleTrait,
  recordReachedTraitOffer,
  recordAspectStartingTrait,
  isAspectSpellDropDormant,
  traitCandidates,
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
import { createTraitOfferCandidateArtifacts } from '../../src/simulation/candidate-artifacts';
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
    ['HephaestusWeaponBoon', 'Hephaestus', 9, 7, 5],
    ['HephaestusSpecialBoon', 'Hephaestus', 11, 9, 7],
    ['HephaestusSprintBoon', 'Hephaestus', 8, 7, 6],
  ] as const)(
    'enforces Bridal Glow level caps for %s at every rarity boundary',
    (traitKey, giverKey, commonLimit, rareLimit, epicLimit) => {
      for (const [rarity, limit] of [
        ['Common', commonLimit],
        ['Rare', rareLimit],
        ['Epic', epicLimit],
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
        expect(targetedAcquisitionTargetKeys(catalog, 'BoonDecayBoon', atLimit)).toContain(
          traitKey,
        );
        const aboveLimit = foldTraitHistoryEvents(catalog, [
          atLimit.events.find((event) => event.kind === 'traitOffer')!,
          levelMutation(1, traitKey, 1, limit + 1),
        ]);
        expect(targetedAcquisitionTargetKeys(catalog, 'BoonDecayBoon', aboveLimit)).not.toContain(
          traitKey,
        );
      }
      expect(
        targetedAcquisitionTargetKeys(
          catalog,
          'BoonDecayBoon',
          historyWith(giverKey, traitKey, 'Heroic'),
        ),
      ).not.toContain(traitKey);
    },
  );
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
    expect(proper.minimumScalableGodTraitRarity).toBeUndefined();
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
    const withoutSource = foldTraitHistoryEvents(catalog, [
      ...events,
      ...historyFrom([
        { giverKey: 'Hera', traitKey: 'ElementalRarityUpgradeBoon', rarity: 'Common' as const },
      ]).events,
    ]);
    expect(withoutSource.minimumScalableGodTraitRarity).toBe('Rare');
    const replay = foldTraitHistoryEvents(catalog, events);
    expect(replay.minimumScalableGodTraitRarity).toBeUndefined();
    expect(replay.equippedTraits.ApolloWeaponBoon?.rarity).toBe('Common');
    expect(foldTraitHistoryEvents(catalog, withoutSource.events)).toEqual(withoutSource);
  });

  it('removes only the future floor on deactivation and promotes a Common on reactivation', () => {
    const activated = activeHistory();
    const deactivated = acquireLegalTrait(activated, 'Hera', 'HeraWeaponBoon', 'Epic');
    expect(deactivated.minimumScalableGodTraitRarity).toBeUndefined();
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
    expect(reactivated.minimumScalableGodTraitRarity).toBe('Rare');
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
      expect.objectContaining({ code: 'rarityBelowActiveFloor' }),
    );
    expect(replacement.replacementTransition?.requiredRarity).toBe('Epic');
    const common = assessTraitOption(
      catalog,
      'HeraSpecialBoon',
      history,
      { resolvedProviderKey: 'Hera' },
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
    const dormant = foldTraitHistoryEvents(catalog, initial.events);
    expect(dormant.minimumScalableGodTraitRarity).toBeUndefined();
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
    expect(branchA.minimumScalableGodTraitRarity).toBe('Rare');
    expect(branchB.minimumScalableGodTraitRarity).toBeUndefined();
    expect(foldTraitHistoryEvents(catalog, [...branchA.events])).toEqual(branchA);
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

  it('gates Athena Death Defiance candidates while retaining an invalid authored option', () => {
    const history = createTraitHistoryState();
    const falseCandidate = traitCandidates(catalog, 'Athena', history, {
      deathDefianceConditionMet: false,
    }).find((candidate) => candidate.traitKey === 'DeathDefianceRefillBoon');
    const trueCandidate = traitCandidates(catalog, 'Athena', history, {
      deathDefianceConditionMet: true,
    }).find((candidate) => candidate.traitKey === 'DeathDefianceRefillBoon');
    expect(falseCandidate?.available).toBe(false);
    expect(falseCandidate?.assessment.findings).toContainEqual({
      code: 'offerContext',
      traitKey: 'DeathDefianceRefillBoon',
      detail: 'deathDefianceConditionMet',
    });
    expect(trueCandidate?.available).toBe(true);

    const retained = Object.freeze({
      kind: 'traits',
      giverKey: 'Athena',
      options: Object.freeze([
        { traitKey: 'DeathDefianceRefillBoon', rarity: 'Common' as const },
        { traitKey: 'InvulnerabilityDashBoon', rarity: 'Common' as const },
        { traitKey: 'RetaliateInvulnerabilityBoon', rarity: 'Common' as const },
      ]) as Extract<AuthoredTraitOffer, { kind: 'traits' }>['options'],
      selectedOptionKey: 'option1' as const,
      deathDefianceConditionMet: false,
    });
    expect(
      assessTraitOffer(catalog, retained, history, {
        deathDefianceConditionMet: retained.deathDefianceConditionMet,
      }),
    ).toMatchObject([
      {
        legal: false,
        findings: [
          {
            code: 'offerContext',
            traitKey: 'DeathDefianceRefillBoon',
            detail: 'deathDefianceConditionMet',
          },
        ],
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
