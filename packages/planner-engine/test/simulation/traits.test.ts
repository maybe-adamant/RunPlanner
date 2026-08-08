import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createIncomingRewardAddress,
  createOccurrenceId,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { factsWithHistory, type RewardKernelFacts } from '@run-planner/engine/reward-kernel';
import {
  assessTraitOption,
  createTraitHistoryState,
  foldTraitOfferEvents,
  traitCandidates,
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import {
  createGoldenFGHIProject,
  createRepresentativeNOPQProject,
} from '@run-planner/test-fixtures';

import { createDefaultTraitOffers } from '../../src/authored-project/traits';
import {
  initializeRewardBranches,
  processOwnedRewardAcquisition,
} from '../../src/simulation/rewards/processing';
import { simulateProject } from '../../src/simulation';

const owner = { kind: 'project' } as SemanticAddress;

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
