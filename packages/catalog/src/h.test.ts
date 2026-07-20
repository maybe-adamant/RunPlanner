import type {
  CountedRewardBinding,
  LinearBiomeLayout,
  RewardProducerBinding,
  ShopRewardBinding,
} from '@run-planner/core';
import {
  createDefaultBatchState,
  createDefaultRoomState,
  decodeBatchState,
  decodeRoomState,
  ProjectDocumentContractError,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { catalog } from './index';

function requireHLayout(): LinearBiomeLayout {
  const layout = catalog.biomeLayouts.byKey.H;
  if (layout?.kind !== 'LinearBiome') {
    throw new Error('expected H LinearBiome layout');
  }
  return layout;
}

function requireCounted(binding: RewardProducerBinding | undefined): CountedRewardBinding {
  if (binding?.kind !== 'countedChoice') {
    throw new Error('expected counted reward binding');
  }
  return binding;
}

function requireShop(binding: RewardProducerBinding | undefined): ShopRewardBinding {
  if (binding?.kind !== 'shop') {
    throw new Error('expected shop reward binding');
  }
  return binding;
}

describe('complete dormant H catalog', () => {
  it('normalizes the four-room Fields spine without a generated reward store', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'H');
    const layout = requireHLayout();

    expect(rooms).toHaveLength(22);
    expect(layout).toEqual({
      biomeKey: 'H',
      kind: 'LinearBiome',
      initialCounters: { biomeDepthCache: 1, biomeEncounterDepth: 1 },
      start: { kind: 'authoredStart', mode: 'fixed', roomGameNames: ['H_Intro'] },
      entries: [],
      continuation: {
        progressionPolicy: { kind: 'fixedCount', continuationCount: 4 },
        batchPolicy: {
          kind: 'fields',
          fields: [
            {
              key: 'cageOutcome',
              kind: 'enum',
              values: ['min', 'max'],
              defaultValue: 'min',
            },
          ],
        },
        rewardStorePolicy: { kind: 'none' },
        rewardStoreOverrides: [],
      },
      terminal: {
        kind: 'forkedTransition',
        roomGameName: 'H_PreBoss01',
        exitPolicy: { kind: 'allExitsTerminal' },
      },
      completion: {
        rooms: [
          { role: 'boss', roomGameName: 'H_Boss01' },
          { role: 'postboss', roomGameName: 'H_PostBoss01' },
        ],
        transitionEffects: [
          { kind: 'resetCounter', axis: 'biomeDepthCache' },
          { kind: 'resetCounter', axis: 'biomeEncounterDepth' },
        ],
      },
      fields: [],
      bounds: { maxBatches: 4, maxTargets: 7 },
    });
    expect(createDefaultBatchState(layout.continuation.batchPolicy)).toEqual({
      cageOutcome: 'min',
    });
    expect(
      decodeBatchState({ cageOutcome: 'max' }, layout.continuation.batchPolicy, '$.batchState'),
    ).toEqual({ cageOutcome: 'max' });
    expect(() =>
      decodeBatchState(
        { cageOutcome: 'visibleThree' },
        layout.continuation.batchPolicy,
        '$.batchState',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.batchState.cageOutcome',
        'expected min or max, received visibleThree',
      ),
    );
    expect(layout.fields.find((field) => field.key === 'fieldsMaxDoorsRolled')).toBeUndefined();
  });

  it('preserves every combat map, raw capacity, local cage default, and depth restriction', () => {
    const rawCapacities = [5, 3, 3, 4, 5, 5, 3, 3, 2, 5, 5, 3, 2, 2, 3];
    const oneExitRooms = new Set(['H_Combat01']);
    const depthRestrictedRooms = new Set([
      'H_Combat02',
      'H_Combat09',
      'H_Combat13',
      'H_Combat14',
      'H_Combat15',
    ]);

    for (let index = 1; index <= 15; index += 1) {
      const suffix = String(index).padStart(2, '0');
      const gameName = `H_Combat${suffix}`;
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing normalized room ${gameName}`);
      }
      const rawCapacity = rawCapacities[index - 1];
      const maxActiveSlots = Math.min(rawCapacity ?? 0, 3);
      const cages = room.localChildren[0];
      if (cages?.kind !== 'boundedRewardSlots') {
        throw new Error(`${gameName} has no cage descriptor`);
      }

      expect(room).toMatchObject({
        gameName,
        label: `Combat ${suffix}`,
        kind: 'Combat',
        mode: { kind: 'authored', templateKey: 'FieldsCombat' },
        incomingReward: { kind: 'none' },
        individualRewardStoreKey: 'RunProgress',
        enteredRewardStoreHistory: { kind: 'none' },
        encounterProfileKey: `H_FieldsCombatCage${maxActiveSlots}`,
        counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
        caps: { maxAppearancesThisBiome: 1 },
      });
      expect(room.caps.maxCreationsThisRun).toBeUndefined();
      expect(room.exits).toHaveLength(oneExitRooms.has(gameName) ? 1 : 2);
      expect(room.exits.every((exit) => exit.type === 'FieldsExitDoor')).toBe(true);
      expect(room.eligibility).toEqual(
        depthRestrictedRooms.has(gameName)
          ? { kind: 'counterRange', axis: 'biomeDepthCache', range: { max: 3 } }
          : undefined,
      );
      expect(cages).toMatchObject({
        key: 'cages',
        kind: 'boundedRewardSlots',
        slotKeys: ['cage1', 'cage2', 'cage3'],
        rawCapacity,
        maxActiveSlots,
        reward: {
          kind: 'countedChoice',
          storeKeys: ['RunProgress'],
          ineligibleRewardTypes: ['Devotion'],
        },
      });
      expect(cages.reward.allowedRewardTypes).not.toContain('Devotion');

      const defaultState = createDefaultRoomState(catalog, room, {
        role: 'ordinary',
        entryActive: false,
      });
      expect(defaultState).toEqual({
        kind: 'fieldsCombat',
        cages: {
          cage1: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
          cage2: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
          cage3: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
        },
      });
      expect(
        decodeRoomState(defaultState, catalog, room, { role: 'ordinary', entryActive: false }, '$'),
      ).toEqual(defaultState);
    }
  });

  it('keeps miniboss force competition and the bridge exact-two window explicit', () => {
    const expectedMinibosses = [
      ['H_MiniBoss01', 'Phantom', 2, 'H_MiniBoss02', 'MiniBossVampire'],
      ['H_MiniBoss02', 'Queen Lamia', 1, 'H_MiniBoss01', 'MiniBossLamia'],
    ] as const;

    for (const [
      gameName,
      label,
      exitCount,
      excludedRoom,
      baselineEncounterKey,
    ] of expectedMinibosses) {
      const room = catalog.rooms.byKey[gameName];
      const reward = requireCounted(room?.incomingReward);
      expect(room).toMatchObject({
        label,
        kind: 'Miniboss',
        mode: { kind: 'authored', templateKey: 'Miniboss' },
        forcedRewardStoreKey: 'RunProgress',
        individualRewardStoreKey: 'RunProgress',
        enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'RunProgress' },
        caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
        eligibility: {
          kind: 'recordCount',
          record: 'roomsEntered',
          keys: [excludedRoom],
          range: { max: 0 },
        },
        force: { kind: 'depthWindow', axis: 'biomeDepthCache', start: 2, deadline: 4 },
      });
      expect(room?.exits).toHaveLength(exitCount);
      expect(reward.allowedRewardTypes).toEqual(['Boon']);
      expect(catalog.encounterProfiles.byKey[gameName]?.phases).toEqual([
        {
          key: gameName,
          kind: 'miniboss',
          countsEncounterDepth: true,
          baselineEncounterKey,
        },
      ]);
    }

    const bridge = catalog.rooms.byKey.H_Bridge01;
    expect(bridge).toMatchObject({
      label: 'Echo',
      kind: 'Story',
      mode: { kind: 'authored', templateKey: 'Story' },
      individualRewardStoreKey: 'RunProgress',
      enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'RunProgress' },
      caps: { maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 },
      force: { kind: 'always' },
    });
    expect(bridge?.eligibility).toMatchObject({
      kind: 'recordCount',
      record: 'roomsEntered',
      range: { min: 2, max: 2 },
    });
    expect(bridge?.exits).toHaveLength(2);
    expect(bridge?.incomingReward).toMatchObject({
      kind: 'fixed',
      offer: { rewardType: 'Story' },
    });
    expect(catalog.encounterProfiles.byKey.H_Bridge01?.phases[0]).toMatchObject({
      kind: 'story',
      countsEncounterDepth: false,
      baselineEncounterKey: 'Story_Echo_01',
    });
  });

  it('rejects incomplete or filtered persisted cage values at the room boundary', () => {
    const room = catalog.rooms.byKey.H_Combat01;
    if (room === undefined) {
      throw new Error('H_Combat01 is missing');
    }
    const boon = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
    } as const;

    expect(() =>
      decodeRoomState(
        { kind: 'fieldsCombat', cages: { cage1: boon, cage2: boon } },
        catalog,
        room,
        { role: 'ordinary', entryActive: false },
        '$.state',
      ),
    ).toThrowError(new ProjectDocumentContractError('$.state.cages.cage3', 'must be an object'));
    expect(() =>
      decodeRoomState(
        {
          kind: 'fieldsCombat',
          cages: {
            cage1: {
              rewardType: 'Devotion',
              payload: {
                kind: 'DevotionPair',
                chosenSource: 'ApolloUpgrade',
                spurnedSource: 'ZeusUpgrade',
              },
            },
            cage2: boon,
            cage3: boon,
          },
        },
        catalog,
        room,
        { role: 'ordinary', entryActive: false },
        '$.state',
      ),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.state.cages.cage1.rewardType',
        'Devotion is filtered from this room',
      ),
    );
  });

  it('connects the one-free-reward preboss and declaration-owned completion history', () => {
    const preboss = catalog.rooms.byKey.H_PreBoss01;
    expect(preboss).toMatchObject({
      label: 'Preboss',
      kind: 'Preboss',
      mode: { kind: 'authored', templateKey: 'ForkedPreboss' },
      forcedRewardStoreKey: 'RunProgress',
      individualRewardStoreKey: 'RunProgress',
      enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'RunProgress' },
      eligibility: {
        kind: 'recordCount',
        record: 'roomsEntered',
        range: { min: 4 },
      },
      force: { kind: 'always' },
    });
    expect(requireShop(preboss?.incomingReward).shopProfileKey).toBe('WorldShop');
    expect(preboss?.entryOfferPolicy).toMatchObject({
      kind: 'shopThenFillRemainingExits',
      maxFreeRewards: 1,
      freeReward: {
        storeKeys: ['RunProgress'],
        ineligibleRewardTypes: ['Devotion', 'RoomMoneyDrop'],
      },
    });
    expect(catalog.rooms.byKey.H_Boss01).toMatchObject({
      label: 'Cerberus',
      mode: { kind: 'derived', classification: 'completion' },
      individualRewardStoreKey: 'RunProgress',
      enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'RunProgress' },
      encounterProfileKey: 'H_Boss01',
    });
    expect(catalog.rooms.byKey.H_PostBoss01).toMatchObject({
      mode: { kind: 'derived', classification: 'completion' },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterProfileKey: 'H_PostBoss01',
    });
    expect(catalog.rooms.byKey.H_Boss02).toBeUndefined();
    expect(catalog.encounterProfiles.byKey.H_Boss01?.phases[0]).toMatchObject({
      kind: 'boss',
      countsEncounterDepth: false,
      baselineEncounterKey: 'BossInfestedCerberus01',
    });
  });
});
