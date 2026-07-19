import type { LinearBiomeLayout, RequirementExpression } from '@run-planner/core';
import {
  createDefaultRoomState,
  decodeRoomState,
  evaluateRequirement,
  ProjectDocumentContractError,
  type RequirementEvaluationContext,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

function requireOLayout(): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey.O;
  if (layout?.kind !== 'LinearBiome') {
    throw new Error('expected O LinearBiome layout');
  }
  return layout;
}

function context(
  overrides: Partial<RequirementEvaluationContext> = {},
): RequirementEvaluationContext {
  return {
    counters: {
      biomeDepthCache: 1,
      biomeEncounterDepth: 0,
      encounterDepth: 0,
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
    runDepthCache: 1,
    lastEventRunDepthCaches: {},
    recentEncounterPhases: [],
    offeredExitCount: 1,
    flags: { allSpellInvested: false, pendingSpellDrop: false },
    ...overrides,
  };
}

function requireEligibility(gameName: string): RequirementExpression {
  const eligibility = catalog.rooms.byKey[gameName]?.eligibility;
  if (eligibility === undefined) {
    throw new Error(`${gameName} has no eligibility`);
  }
  return eligibility;
}

describe('complete dormant O catalog', () => {
  it('normalizes the six-batch ship spine, direct preboss, and fixed completion', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'O');
    const layout = requireOLayout();

    expect(rooms).toHaveLength(25);
    expect(layout).toEqual({
      biomeKey: 'O',
      kind: 'LinearBiome',
      start: { kind: 'authoredStart', mode: 'fixed', roomGameNames: ['O_Intro'] },
      entries: [],
      continuation: {
        progressionPolicy: { kind: 'fixedCount', continuationCount: 6 },
        batchPolicy: { kind: 'standard', fields: [] },
        rewardStorePolicy: {
          kind: 'authoredBaseStore',
          storeKeys: ['RunProgress', 'MetaProgress'],
          defaultStoreKey: 'RunProgress',
        },
        rewardStoreOverrides: [
          {
            sourceEncounterProfileKey: 'ShipCombat',
            policy: { kind: 'sourceOfferPoint', selector: 'lastActiveWheel' },
          },
        ],
      },
      terminal: { kind: 'directTransition', roomGameName: 'O_PreBoss01' },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: 'O_Boss01' },
          { role: 'postboss', roomGameName: 'O_PostBoss01' },
        ],
      },
      fields: [],
      bounds: { maxBatches: 6, maxTargets: 6 },
    });
    expect(
      rooms
        .filter((room) => room.mode.kind === 'authored')
        .every((room) => room.exits.length === 1 && room.exits[0]?.type === 'ShipsExitDoor'),
    ).toBe(true);
  });

  it('owns complete two-wheel state on every ShipCombat occurrence', () => {
    const room = catalog.rooms.byKey.O_Combat01;
    if (room === undefined) {
      throw new Error('O_Combat01 is missing');
    }
    const profile = catalog.encounterProfiles.byKey.ShipCombat;
    expect(profile?.phases.map((phase) => phase.key)).toEqual(['Intro', 'Combat1', 'Combat2']);
    expect(profile?.phases.map((phase) => phase.countsEncounterDepth)).toEqual([false, true, true]);
    expect(profile?.phases[2]?.presence).toEqual({
      kind: 'authoredOptional',
      decisionPoint: 'prepareRoom',
      requirement: {
        kind: 'counterRange',
        axis: 'biomeEncounterDepth',
        range: { min: 2, max: 5 },
      },
      defaultActive: false,
    });
    expect(profile?.phases.slice(1).map((phase) => phase.offerPoint?.key)).toEqual([
      'wheel1',
      'wheel2',
    ]);

    const state = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      entryActive: true,
    });
    if (state.kind !== 'shipCombat') {
      throw new Error('expected ShipCombat state');
    }
    expect(state).toEqual({
      kind: 'shipCombat',
      encounterCount: 2,
      wheels: {
        wheel1: {
          storeKey: 'RunProgress',
          offerCount: 1,
          offers: {
            offer1: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
            offer2: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
          },
          pickedOfferIndex: 1,
        },
        wheel2: {
          storeKey: 'RunProgress',
          offerCount: 1,
          offers: {
            offer1: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
            offer2: {
              rewardType: 'Boon',
              payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
            },
          },
          pickedOfferIndex: 1,
        },
      },
    });
    expect(
      decodeRoomState(state, catalog, room, { role: 'ordinary', entryActive: true }, '$'),
    ).toEqual(state);
    expect(() =>
      decodeRoomState(
        {
          ...state,
          wheels: {
            ...state.wheels,
            wheel1: { ...state.wheels.wheel1, offerCount: 1, pickedOfferIndex: 2 },
          },
        },
        catalog,
        room,
        { role: 'ordinary', entryActive: true },
        '$.state',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.wheels.wheel1.pickedOfferIndex',
        'must select an active offer',
      ),
    );
  });

  it('keeps the three combat eligibility families distinct', () => {
    const recentTwo = context({
      recentEncounterPhases: [
        { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1'] },
        { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1'] },
      ],
    });
    const recentThree = context({
      counters: { ...context().counters, biomeDepthCache: 6 },
      recentEncounterPhases: [
        { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1'] },
        { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1', 'Combat2'] },
        { profileKey: 'ShipCombat', phaseKeys: ['Intro', 'Combat1'] },
      ],
    });

    expect(evaluateRequirement(requireEligibility('O_Combat01'), recentTwo)).toBe(true);
    expect(evaluateRequirement(requireEligibility('O_Combat01'), recentThree)).toBe(false);
    expect(requireEligibility('O_Combat04')).toEqual({
      kind: 'counterRange',
      axis: 'biomeDepthCache',
      range: { max: 3 },
    });
    expect(evaluateRequirement(requireEligibility('O_Combat13'), recentThree)).toBe(true);
  });

  it('preserves special-room force competition, BED asymmetry, and fixed Devotion support', () => {
    for (const gameName of ['O_Shop01', 'O_Story01']) {
      expect(catalog.rooms.byKey[gameName]?.force).toEqual({
        kind: 'requirement',
        requirement: {
          kind: 'all',
          requirements: [
            { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 5, max: 5 } },
            {
              kind: 'recordCount',
              record: 'roomsEntered',
              keys: ['O_Shop01', 'O_Story01'],
              range: { max: 0 },
            },
          ],
        },
      });
    }
    expect(catalog.encounterProfiles.byKey.O_MiniBoss01?.phases[0]).toMatchObject({
      baselineEncounterKey: 'MiniBossCharybdis',
      countsEncounterDepth: false,
    });
    expect(catalog.encounterProfiles.byKey.O_MiniBoss02?.phases[0]).toMatchObject({
      baselineEncounterKey: 'MiniBossCaptain',
      countsEncounterDepth: true,
    });
    expect(catalog.rooms.byKey.O_Devotion01).toMatchObject({
      kind: 'Devotion',
      mode: { kind: 'authored', templateKey: 'Devotion' },
      forcedRewardStoreKey: 'RunProgress',
      incomingReward: { kind: 'fixed', offer: { rewardType: 'Devotion' } },
      encounterProfileKey: 'O_Devotion01',
    });
    expect(
      evaluateRequirement(
        requireEligibility('O_Devotion01'),
        context({
          counters: { ...context().counters, biomeEncounterDepth: 2 },
          records: {
            ...context().records,
            lootTypeHistory: { ApolloUpgrade: 4, ZeusUpgrade: 1 },
          },
        }),
      ),
    ).toBe(true);
  });

  it('keeps the direct shop-only terminal and neutral completion variants explicit', () => {
    expect(catalog.rooms.byKey.O_PreBoss01).toMatchObject({
      mode: { kind: 'authored', templateKey: 'ShopPreboss' },
      incomingReward: { kind: 'shop', shopProfileKey: 'WorldShop' },
      eligibility: { kind: 'counterRange', axis: 'biomeDepthCache', range: { min: 7 } },
      force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 7, deadline: 7 },
    });
    expect(catalog.rooms.byKey.O_Boss01).toMatchObject({
      label: 'Eris',
      mode: { kind: 'derived', classification: 'completion' },
      enteredRewardStoreHistory: { kind: 'resolvedOffer' },
      encounterProfileKey: 'O_Boss01',
    });
    expect(catalog.rooms.byKey.O_PostBoss01).toMatchObject({
      mode: { kind: 'derived', classification: 'completion' },
      enteredRewardStoreHistory: { kind: 'none' },
    });
    expect(catalog.rooms.byKey.O_Boss02).toBeUndefined();
  });
});
