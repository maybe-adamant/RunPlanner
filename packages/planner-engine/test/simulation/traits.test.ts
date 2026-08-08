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
  type TraitOfferEvent,
} from '@run-planner/engine/simulation';
import { describe, expect, it } from 'vitest';

import { createDefaultTraitOffers } from '../../src/authored-project/traits';
import {
  initializeRewardBranches,
  processOwnedRewardAcquisition,
} from '../../src/simulation/rewards/processing';

const owner = { kind: 'project' } as SemanticAddress;

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
