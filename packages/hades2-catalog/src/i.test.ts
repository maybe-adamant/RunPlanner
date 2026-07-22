import type { CountedRewardBinding } from '@run-planner/engine/reward-kernel';
import type { LinearBiomeLayout, RoomDeclaration } from '@run-planner/engine/catalog-schema';
import type {
  RequirementEvaluationContext,
  RequirementExpression,
} from '@run-planner/engine/requirements';
import {
  createDefaultBatchState,
  createDefaultRoomState,
} from '@run-planner/engine/authored-project';
import { evaluateRequirement } from '@run-planner/engine/requirements';
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './catalog';
import { declarations, type RawCatalogInput } from './declarations';
import { catalog } from './index';

function raw(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

function requireILayout(): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey.I;
  if (layout?.kind !== 'LinearBiome') {
    throw new Error('expected I LinearBiome layout');
  }
  return layout;
}

function requireRoom(gameName: string): RoomDeclaration {
  const room = catalog.rooms.byKey[gameName];
  if (room === undefined) {
    throw new Error(`missing room ${gameName}`);
  }
  return room;
}

function requireEligibility(gameName: string): RequirementExpression {
  const eligibility = requireRoom(gameName).eligibility;
  if (eligibility === undefined) {
    throw new Error(`${gameName} has no eligibility`);
  }
  return eligibility;
}

function context(
  overrides: Partial<RequirementEvaluationContext> = {},
): RequirementEvaluationContext {
  return {
    counters: {
      biomeDepthCache: 4,
      biomeEncounterDepth: 4,
      encounterDepth: 4,
      enteredBiomes: 4,
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
    rewardLookups: {},
    runDepthCache: 20,
    lastEventRunDepthCaches: {},
    recentEncounterPhases: [],
    offeredExitCount: 2,
    currentBatchRoomGameNames: [],
    clockwork: {
      remainingGoals: 5,
      maxNonGoalRewards: 3,
      nonGoalRewardsAcquired: 0,
    },
    flags: { allSpellInvested: false, pendingSpellDrop: false },
    ...overrides,
  };
}

describe('complete dormant I catalog', () => {
  it('normalizes the fixed entry, Clockwork loop, generated terminal, and completion tail', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'I');
    const layout = requireILayout();

    expect(rooms).toHaveLength(32);
    expect(layout).toEqual({
      biomeKey: 'I',
      kind: 'LinearBiome',
      initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
      start: { kind: 'fixedEntry', role: 'intro', roomGameName: 'I_Intro' },
      entries: [{ kind: 'fixedEntry', role: 'story', roomGameName: 'I_Story01' }],
      continuation: {
        progressionPolicy: { kind: 'eligibilityDriven' },
        batchPolicy: { kind: 'clockwork', initialGoalCount: 5, fields: [] },
        rewardStorePolicy: { kind: 'none' },
        rewardStoreOverrides: [],
      },
      terminal: {
        kind: 'generatedTarget',
        roomGameName: 'I_PreBoss02',
        closesBiomeWhenPicked: true,
      },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: 'I_Boss01' },
          { role: 'postboss', roomGameName: 'I_PostBoss01' },
        ],
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
      fields: [
        {
          key: 'maxNonGoalRewards',
          kind: 'boundedInteger',
          min: 3,
          max: 6,
          defaultValue: 3,
        },
      ],
      bounds: { maxBatches: 12, maxTargets: 22 },
    });
    expect(createDefaultBatchState(layout.continuation.batchPolicy)).toBeNull();
  });

  it('keeps Intro and Hades as stateless derived fixed entries with exact history facts', () => {
    expect(requireRoom('I_Intro')).toMatchObject({
      kind: 'Intro',
      mode: { kind: 'derived', classification: 'fixedEntry' },
      exits: [{ index: 1, type: 'TartarusExitDoor' }],
      incomingReward: { kind: 'none' },
      encounterProfileKey: 'FixedIntro',
      counters: { biomeDepthCache: 0, roomHistoryOrdinal: 1 },
    });
    expect(requireRoom('I_Story01')).toMatchObject({
      label: 'Hades',
      kind: 'Story',
      mode: { kind: 'derived', classification: 'fixedEntry' },
      exits: [{ index: 1, type: 'TartarusExitDoor' }],
      incomingReward: { kind: 'fixed', offer: { rewardType: 'Story' } },
      encounterProfileKey: 'I_Story01',
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
    });
    expect(catalog.encounterProfiles.byKey.I_Story01?.phases).toEqual([
      {
        key: 'I_Story01',
        kind: 'story',
        countsEncounterDepth: false,
        baselineEncounterKey: 'Story_Hades_01',
      },
    ]);
  });

  it('declares all 24 combat maps with exact exits and one dormant NonGoal value', () => {
    const twoExitRooms = new Set([
      'I_Combat01',
      'I_Combat03',
      'I_Combat04',
      'I_Combat09',
      'I_Combat10',
      'I_Combat11',
      'I_Combat12',
      'I_Combat15',
      'I_Combat18',
      'I_Combat21',
      'I_Combat22',
    ]);

    for (let index = 1; index <= 24; index += 1) {
      const suffix = String(index).padStart(2, '0');
      const gameName = `I_Combat${suffix}`;
      const room = requireRoom(gameName);
      const incoming = room.incomingReward as CountedRewardBinding;

      expect(room).toMatchObject({
        gameName,
        label: `Combat ${suffix}`,
        kind: 'Combat',
        mode: { kind: 'authored', templateKey: 'ClockworkCombat' },
        forcedRewardStoreKey: 'TartarusRewards',
        enteredRewardStoreHistory: { kind: 'resolvedOffer' },
        encounterProfileKey: 'ClockworkCombat',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
      });
      expect(room.exits).toHaveLength(twoExitRooms.has(gameName) ? 2 : 1);
      expect(room.exits.every((exit) => exit.type === 'TartarusExitDoor')).toBe(true);
      expect(incoming).toMatchObject({
        kind: 'countedChoice',
        storeKeys: ['TartarusRewards'],
        ineligibleRewardTypes: ['Boon'],
      });
      expect(incoming.allowedRewardTypes).not.toContain('Boon');

      const state = createDefaultRoomState(catalog, room, {
        role: 'ordinary',
        resolvedStoreKey: 'TartarusRewards',
        entryActive: false,
      });
      expect(state).toEqual({ kind: 'counted', offer: { rewardType: 'RoomMoneyTripleDrop' } });

      if (twoExitRooms.has(gameName)) {
        expect(room.eligibility).toEqual({ kind: 'clockworkNonGoalCapacity', reserve: 1 });
      } else if (gameName === 'I_Combat24') {
        expect(room.eligibility).toEqual({
          kind: 'counterRange',
          axis: 'biomeDepthCache',
          range: { max: 5 },
        });
      } else {
        expect(room.eligibility).toBeUndefined();
      }
    }

    expect(catalog.encounterProfiles.byKey.ClockworkCombat?.phases).toEqual([
      { key: 'Combat', kind: 'combat', countsEncounterDepth: true },
    ]);
  });

  it('evaluates the two-exit reserve and Combat 24 depth ceiling from typed facts', () => {
    const capacity = requireEligibility('I_Combat01');
    expect(evaluateRequirement(capacity, context())).toBe(true);
    expect(
      evaluateRequirement(
        capacity,
        context({
          clockwork: {
            remainingGoals: 3,
            maxNonGoalRewards: 3,
            nonGoalRewardsAcquired: 2,
          },
        }),
      ),
    ).toBe(false);

    expect(evaluateRequirement(requireEligibility('I_Combat24'), context())).toBe(true);
    expect(
      evaluateRequirement(
        requireEligibility('I_Combat24'),
        context({ counters: { ...context().counters, biomeDepthCache: 6 } }),
      ),
    ).toBe(false);
  });

  it('preserves special-peer order, exclusion, force competition, and reward filters', () => {
    const reprieve = requireRoom('I_Reprieve01');
    const verminancer = requireRoom('I_MiniBoss01');
    const goldwrath = requireRoom('I_MiniBoss02');

    expect(reprieve).toMatchObject({
      kind: 'Reprieve',
      exits: [
        { index: 1, type: 'TartarusExitDoor' },
        { index: 2, type: 'TartarusExitDoor' },
      ],
      incomingReward: {
        kind: 'countedChoice',
        storeKeys: ['TartarusRewards'],
        ineligibleRewardTypes: ['Devotion'],
      },
      forcedRewardStoreKey: 'TartarusRewards',
      encounterProfileKey: 'HealthRestore',
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
    });
    for (const room of [verminancer, goldwrath]) {
      const incoming = room.incomingReward as CountedRewardBinding;
      expect(room).toMatchObject({
        kind: 'Miniboss',
        forcedRewardStoreKey: 'TartarusRewards',
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
        force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 3, deadline: 7 },
      });
      expect(incoming.allowedRewardTypes).toEqual(['Boon']);
      expect(incoming.defaultOffersByStore.TartarusRewards).toEqual({
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      });
    }

    const noPeer = context();
    const ordinaryPeer = context({ currentBatchRoomGameNames: ['I_Combat01'] });
    const specialPeer = context({ currentBatchRoomGameNames: ['I_MiniBoss01'] });
    expect(evaluateRequirement(requireEligibility('I_Reprieve01'), noPeer)).toBe(false);
    expect(evaluateRequirement(requireEligibility('I_Reprieve01'), ordinaryPeer)).toBe(true);
    expect(evaluateRequirement(requireEligibility('I_Reprieve01'), specialPeer)).toBe(false);
    expect(
      evaluateRequirement(
        requireEligibility('I_MiniBoss01'),
        context({
          currentBatchRoomGameNames: ['I_Combat01'],
          records: { ...context().records, roomsEntered: { I_MiniBoss02: 1 } },
        }),
      ),
    ).toBe(false);
  });

  it('derives pre-goal, declined post-goal, and picked terminal preboss states', () => {
    const room = requireRoom('I_PreBoss02');
    const eligibility = requireEligibility(room.gameName);

    expect(evaluateRequirement(eligibility, context())).toBe(false);
    expect(
      evaluateRequirement(
        eligibility,
        context({
          clockwork: {
            remainingGoals: 0,
            maxNonGoalRewards: 4,
            nonGoalRewardsAcquired: 2,
          },
        }),
      ),
    ).toBe(true);
    expect(room).toMatchObject({
      kind: 'Preboss',
      mode: { kind: 'authored', templateKey: 'ShopPreboss' },
      exits: [{ index: 1, type: 'TartarusExitDoor' }],
      incomingReward: { kind: 'shop', shopProfileKey: 'I_WorldShop' },
      enteredRewardStoreHistory: { kind: 'none' },
      caps: { maxAppearancesThisBiome: 1, maxCreationsPerRoom: 1 },
      force: { kind: 'always' },
    });

    expect(
      createDefaultRoomState(catalog, room, {
        role: 'ordinary',
        entryActive: false,
      }),
    ).toEqual({ kind: 'shop' });
    const entered = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
    });
    expect(entered.kind).toBe('shop');
    if (entered.kind !== 'shop') {
      throw new Error('expected I shop state');
    }
    expect(entered.shop?.profileKey).toBe('I_WorldShop');
    expect(Object.keys(entered.shop?.offers ?? {})).toEqual([
      'BoostedBoon',
      'MixedProgress',
      'Survival',
      'PremiumProgress',
      'MetaProgress',
    ]);
  });

  it('keeps an ordinary companion valid beside an unpicked generated preboss occurrence', () => {
    const companion = requireRoom('I_Combat02');
    expect(companion.eligibility).toBeUndefined();
    expect(requireILayout().terminal).toEqual({
      kind: 'generatedTarget',
      roomGameName: 'I_PreBoss02',
      closesBiomeWhenPicked: true,
    });
    expect(
      createDefaultRoomState(catalog, companion, {
        role: 'ordinary',
        resolvedStoreKey: 'TartarusRewards',
        entryActive: false,
      }),
    ).toEqual({ kind: 'counted', offer: { rewardType: 'RoomMoneyTripleDrop' } });
  });

  it('declares neutral Chronos completion and excludes unsupported concrete variants', () => {
    expect(requireRoom('I_Boss01')).toMatchObject({
      label: 'Chronos',
      mode: { kind: 'derived', classification: 'completion' },
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'I_Boss01',
    });
    expect(catalog.encounterProfiles.byKey.I_Boss01?.phases[0]).toMatchObject({
      baselineEncounterKey: 'BossChronos01',
      countsEncounterDepth: false,
    });
    expect(requireRoom('I_PostBoss01')).toMatchObject({
      mode: { kind: 'derived', classification: 'completion' },
      incomingReward: { kind: 'none' },
      enteredRewardStoreHistory: { kind: 'none' },
    });
    for (const gameName of [
      'I_Shop01',
      'I_MiniBoss03',
      'I_PreBoss01',
      'I_Boss02',
      'I_ChronosFlashback01',
      'I_DeathAreaRestored',
      'EndCredits01',
    ]) {
      expect(catalog.rooms.byKey[gameName]).toBeUndefined();
    }
  });

  it('rejects malformed filtered defaults and current-batch room references at construction', () => {
    const minibossIndex = declarations.rooms.findIndex((room) => room.gameName === 'I_MiniBoss01');
    const reprieveIndex = declarations.rooms.findIndex((room) => room.gameName === 'I_Reprieve01');
    if (minibossIndex < 0 || reprieveIndex < 0) {
      throw new Error('missing raw I fixtures');
    }

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((room, index) =>
            index === minibossIndex
              ? {
                  ...room,
                  incomingReward: {
                    ...room.incomingReward,
                    defaultRewardTypesByStore: {
                      TartarusRewards: 'RoomMoneyTripleDrop',
                    },
                  },
                }
              : room,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${minibossIndex}].incomingReward.defaultRewardTypesByStore.TartarusRewards`,
        "RoomMoneyTripleDrop is removed by this producer's filters",
      ),
    );

    const reprieve = declarations.rooms[reprieveIndex];
    const eligibility = reprieve?.eligibility;
    if (eligibility?.kind !== 'all') {
      throw new Error('I Reprieve raw eligibility is missing');
    }
    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((room, index) =>
            index === reprieveIndex
              ? {
                  ...room,
                  eligibility: {
                    ...eligibility,
                    requirements: eligibility.requirements.map((requirement) =>
                      requirement.kind === 'currentBatchRoomCount'
                        ? { ...requirement, roomGameNames: ['I_UnknownPeer'] }
                        : requirement,
                    ),
                  },
                }
              : room,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${reprieveIndex}].eligibility.requirements[3].roomGameNames[0]`,
        'unknown room I_UnknownPeer',
      ),
    );
  });
});
