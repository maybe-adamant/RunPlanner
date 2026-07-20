import {
  createDefaultRoomState,
  decodeRoomState,
  ProjectDocumentContractError,
  type CountedRewardBinding,
  type HubBiomeLayout,
  type RewardProducerBinding,
  type ShopRewardBinding,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { CatalogContractError, createCatalog } from './catalog';
import { declarations, type RawCatalogInput } from './declarations';
import { catalog } from './index';

function raw(value: unknown): RawCatalogInput {
  return value as RawCatalogInput;
}

function roomIndex(gameName: string): number {
  const index = declarations.rooms.findIndex((room) => room.gameName === gameName);
  if (index < 0) {
    throw new Error(`missing room fixture ${gameName}`);
  }
  return index;
}

function layoutIndex(biomeKey: string): number {
  const index = declarations.biomeLayouts.findIndex((layout) => layout.biomeKey === biomeKey);
  if (index < 0) {
    throw new Error(`missing layout fixture ${biomeKey}`);
  }
  return index;
}

function requireNLayout(): HubBiomeLayout {
  const layout = catalog.biomeLayouts.byKey.N;
  if (layout?.kind !== 'HubBiome') {
    throw new Error('expected N HubBiome layout');
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

describe('complete dormant N catalog', () => {
  it('normalizes one fixed persistent hub board and its completion sequence', () => {
    const rooms = catalog.rooms.values.filter((room) => room.biomeKey === 'N');
    const layout = requireNLayout();

    expect(rooms).toHaveLength(46);
    expect(layout.entries).toEqual([
      { kind: 'fixedAuthoredSlot', slotKey: 'opening', roomGameName: 'N_Opening01' },
      { kind: 'fixedAuthoredSlot', slotKey: 'preHub', roomGameName: 'N_PreHub01' },
    ]);
    expect(layout.hub.slots).toHaveLength(25);
    expect(layout.hub.slots.slice(0, 3)).toEqual([
      { slotKey: 'combat01', roomGameName: 'N_Combat01', physicalDoorId: 617113 },
      { slotKey: 'combat02', roomGameName: 'N_Combat02', physicalDoorId: 560725 },
      { slotKey: 'combat03', roomGameName: 'N_Combat03', physicalDoorId: 560702 },
    ]);
    expect(layout.hub.slots.slice(-2)).toEqual([
      { slotKey: 'miniBoss01', roomGameName: 'N_MiniBoss01', physicalDoorId: 617043 },
      { slotKey: 'miniBoss02', roomGameName: 'N_MiniBoss02', physicalDoorId: 560889 },
    ]);
    expect(layout.hub.openCount).toEqual({ min: 9, max: 10 });
    expect(layout.hub.openSlotConstraints).toEqual([
      { kind: 'maxOpenFromSlots', slotKeys: ['miniBoss01', 'miniBoss02'], max: 1 },
    ]);
    expect(layout.hub.requiredVisits).toBe(6);
    expect(layout.hub.targetCompletion).toEqual({
      kind: 'requiredRoomObject',
      objectKey: 'SoulPylon',
    });
    expect(layout.hub.restoreRoomGameName).toBe('N_Hub');
    expect(layout.hub.rewardStorePolicy).toEqual({ kind: 'none' });
    expect(layout.hub.rewardLookup).toEqual({
      key: 'hubRewardLookup',
      source: 'allOpenTargetOffers',
    });
    expect(layout.hub.sideRoomGeneration).toEqual({
      kind: 'visitPressure',
      generatedCountKey: 'numSubRoomsSpawned',
      minimumPerVisit: { numerator: 1, denominator: 2 },
      remainingSlots: 'optional',
      forcedOrder: 'availabilityRankPrefix',
    });
    expect(layout.terminal).toEqual({
      kind: 'fixedAuthoredSlot',
      slotKey: 'preboss',
      roomGameName: 'N_PreBoss01',
    });
    expect(layout.completion.rooms).toEqual([
      { role: 'boss', roomGameName: 'N_Boss01' },
      { role: 'postboss', roomGameName: 'N_PostBoss01' },
    ]);
  });

  it('keeps Opening and PreHub as separate fixed authored counted leaves', () => {
    for (const [gameName, templateKey, profileKey, countsEncounterDepth] of [
      ['N_Opening01', 'FixedOpening', 'N_Opening', true],
      ['N_PreHub01', 'FixedPreHub', 'N_PreHub', false],
    ] as const) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing ${gameName}`);
      }
      const binding = requireCounted(room.incomingReward);
      expect(room.mode).toEqual({ kind: 'authored', templateKey });
      expect(room.forcedRewardStoreKey).toBe('RunProgress');
      expect(room.enteredRewardStoreHistory).toEqual({ kind: 'none' });
      expect(binding.ineligibleRewardTypes).toEqual([
        'Devotion',
        'RoomMoneyDrop',
        'MaxHealthDrop',
        'MaxManaDrop',
      ]);
      expect(catalog.encounterProfiles.byKey[profileKey]?.phases[0]?.countsEncounterDepth).toBe(
        countsEncounterDepth,
      );
      const state = createDefaultRoomState(catalog, room, {
        role: 'ordinary',
        resolvedStoreKey: 'RunProgress',
        entryActive: true,
      });
      expect(state.kind).toBe('counted');
      expect(
        decodeRoomState(state, catalog, room, { role: 'ordinary', entryActive: true }, '$'),
      ).toEqual(state);
    }
  });

  it('declares every pylon target with exact store ownership and physical uniqueness', () => {
    const layout = requireNLayout();
    const physicalDoorIds = layout.hub.slots.map((slot) => slot.physicalDoorId);
    expect(new Set(physicalDoorIds).size).toBe(25);

    for (let index = 1; index <= 23; index += 1) {
      const suffix = String(index).padStart(2, '0');
      const room = catalog.rooms.byKey[`N_Combat${suffix}`];
      if (room === undefined) {
        throw new Error(`missing N_Combat${suffix}`);
      }
      expect(room.mode).toEqual({ kind: 'authored', templateKey: 'EphyraCombat' });
      expect(room.forcedRewardStoreKey).toBe('HubRewards');
      expect(room.requiredObjects).toEqual([
        {
          key: 'SoulPylon',
          spawnTiming: 'roomEntry',
          completionRequirement: 'destroyBeforeExit',
        },
      ]);
      expect(room.counters).toEqual({ biomeDepthCache: 1, roomHistoryOrdinal: 1 });
      expect(requireCounted(room.incomingReward).ineligibleRewardTypes).toEqual(
        index === 12 || index === 17 ? ['WeaponUpgrade', 'HermesUpgrade'] : [],
      );
    }

    for (const gameName of ['N_MiniBoss01', 'N_MiniBoss02']) {
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing ${gameName}`);
      }
      expect(room.requiredObjects?.[0]?.key).toBe('SoulPylon');
      expect(room.forcedRewardStoreKey).toBe('RunProgress');
      expect(room.caps).toEqual({ maxAppearancesThisBiome: 1, maxCreationsThisRun: 1 });
      expect(requireCounted(room.incomingReward).allowedRewardTypes).toEqual(['Boon']);
    }
  });

  it('preserves physical side slots, availability rank, and jointly generated rewards', () => {
    const expected = {
      N_Combat02: [
        ['sideDoor1', 'N_Sub01', 558353, 2],
        ['sideDoor2', 'N_Sub03', 558352, 1],
      ],
      N_Combat03: [['sideDoor1', 'N_Sub04', 558353, 1]],
      N_Combat04: [
        ['sideDoor1', 'N_Sub02', 558834, 2],
        ['sideDoor2', 'N_Sub06', 558410, 1],
      ],
      N_Combat05: [
        ['sideDoor1', 'N_Sub02', 558354, 1],
        ['sideDoor2', 'N_Sub07', 558378, 2],
        ['sideDoor3', 'N_Sub03', 558379, 3],
      ],
      N_Combat06: [
        ['sideDoor1', 'N_Sub10', 558378, 2],
        ['sideDoor2', 'N_Sub05', 560794, 1],
      ],
      N_Combat09: [
        ['sideDoor1', 'N_Sub11', 566392, 2],
        ['sideDoor2', 'N_Sub08', 566536, 1],
        ['sideDoor3', 'N_Sub14', 566394, 3],
      ],
      N_Combat10: [
        ['sideDoor1', 'N_Sub05', 558352, 2],
        ['sideDoor2', 'N_Sub09', 567015, 1],
      ],
      N_Combat11: [['sideDoor1', 'N_Sub01', 558352, 1]],
      N_Combat12: [
        ['sideDoor1', 'N_Sub09', 558352, 1],
        ['sideDoor2', 'N_Sub10', 566544, 2],
        ['sideDoor3', 'N_Sub07', 566545, 3],
      ],
      N_Combat15: [['sideDoor1', 'N_Sub03', 657623, 1]],
      N_Combat16: [['sideDoor1', 'N_Sub04', 558352, 1]],
      N_Combat17: [['sideDoor1', 'N_Sub11', 558352, 1]],
      N_Combat18: [['sideDoor1', 'N_Sub12', 658853, 1]],
      N_Combat20: [['sideDoor1', 'N_Sub06', 659508, 1]],
      N_Combat22: [
        ['sideDoor1', 'N_Sub14', 558352, 1],
        ['sideDoor2', 'N_Sub02', 661338, 2],
      ],
      N_Combat23: [
        ['sideDoor1', 'N_Sub12', 755971, 3],
        ['sideDoor2', 'N_Sub13', 755184, 1],
        ['sideDoor3', 'N_Sub15', 755185, 2],
      ],
    } as const;

    for (const [gameName, expectedSlots] of Object.entries(expected)) {
      const descriptor = catalog.rooms.byKey[gameName]?.localChildren[0];
      if (descriptor?.kind !== 'fixedRoomSlots') {
        throw new Error(`${gameName} has no fixed side rooms`);
      }
      expect(descriptor.rewardGeneration).toBe('jointUnordered');
      expect(
        descriptor.slots.map((slot) => [
          slot.slotKey,
          slot.roomGameName,
          slot.physicalDoorId,
          slot.availabilityRank,
        ]),
      ).toEqual(expectedSlots);
    }
  });

  it('keeps side generation and player entry order as separate authored facts', () => {
    const room = catalog.rooms.byKey.N_Combat05;
    if (room === undefined) {
      throw new Error('missing N_Combat05');
    }
    const defaultState = createDefaultRoomState(catalog, room, {
      role: 'ordinary',
      resolvedStoreKey: 'HubRewards',
      entryActive: false,
    });
    if (defaultState.kind !== 'ephyraCombat') {
      throw new Error('expected Ephyra combat state');
    }
    expect(defaultState.sideRooms).toMatchObject({
      sideDoor1: { generation: 'notGenerated', enteredOrdinal: null },
      sideDoor2: { generation: 'notGenerated', enteredOrdinal: null },
      sideDoor3: { generation: 'notGenerated', enteredOrdinal: null },
    });

    const enteredOutOfAvailabilityOrder = {
      ...defaultState,
      sideRooms: {
        ...defaultState.sideRooms,
        sideDoor1: { ...defaultState.sideRooms.sideDoor1!, generation: 'generated' as const },
        sideDoor2: {
          ...defaultState.sideRooms.sideDoor2!,
          generation: 'generated' as const,
          enteredOrdinal: 2,
        },
        sideDoor3: {
          ...defaultState.sideRooms.sideDoor3!,
          generation: 'generated' as const,
          enteredOrdinal: 1,
        },
      },
    };
    expect(
      decodeRoomState(
        enteredOutOfAvailabilityOrder,
        catalog,
        room,
        { role: 'ordinary', entryActive: true },
        '$',
      ),
    ).toEqual(enteredOutOfAvailabilityOrder);

    const impossibleEntry = {
      ...defaultState,
      sideRooms: {
        ...defaultState.sideRooms,
        sideDoor1: { ...defaultState.sideRooms.sideDoor1!, enteredOrdinal: 1 },
      },
    };
    expect(() =>
      decodeRoomState(impossibleEntry, catalog, room, { role: 'ordinary', entryActive: true }, '$'),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.sideRooms.sideDoor1.enteredOrdinal',
        'requires a generated side room',
      ),
    );

    const skippedOrdinal = {
      ...defaultState,
      sideRooms: {
        ...defaultState.sideRooms,
        sideDoor1: {
          ...defaultState.sideRooms.sideDoor1!,
          generation: 'generated' as const,
          enteredOrdinal: 2,
        },
      },
    };
    expect(() =>
      decodeRoomState(skippedOrdinal, catalog, room, { role: 'ordinary', entryActive: true }, '$'),
    ).toThrowError(
      new ProjectDocumentContractError(
        '$.sideRooms.enteredOrdinals',
        'must contain contiguous ordinal 1',
      ),
    );
  });

  it('assigns ordinary and hard side-room stores without adding a false global identity', () => {
    const hard = new Set(['N_Sub09', 'N_Sub10', 'N_Sub11', 'N_Sub14']);
    for (let index = 1; index <= 15; index += 1) {
      const gameName = `N_Sub${String(index).padStart(2, '0')}`;
      const room = catalog.rooms.byKey[gameName];
      if (room === undefined) {
        throw new Error(`missing ${gameName}`);
      }
      const expectedStore = hard.has(gameName) ? 'SubRoomRewardsHard' : 'SubRoomRewards';
      expect(room.mode).toEqual({ kind: 'authored', templateKey: 'EphyraSideRoom' });
      expect(room.individualRewardStoreKey).toBe(expectedStore);
      expect(requireCounted(room.incomingReward).storeKeys).toEqual([expectedStore]);
      expect(room.encounterProfileKey).toBe(
        hard.has(gameName) ? 'EphyraSideRoomHard' : 'EphyraSideRoom',
      );
      expect(room.caps).toEqual({ maxAppearancesThisBiome: 999 });
    }
  });

  it('binds the fixed preboss shop to the complete hub offer lookup', () => {
    const preboss = catalog.rooms.byKey.N_PreBoss01;
    if (preboss === undefined) {
      throw new Error('missing N_PreBoss01');
    }
    const binding = requireShop(preboss.incomingReward);
    expect(binding.shopProfileKey).toBe('WorldShop');
    expect(binding.additionalOptionRequirements).toEqual({
      WeaponUpgradeDropEarly: {
        kind: 'rewardLookupExcludes',
        lookupKey: 'hubRewardLookup',
        rewardType: 'WeaponUpgrade',
      },
      SpellDrop: {
        kind: 'rewardLookupExcludes',
        lookupKey: 'hubRewardLookup',
        rewardType: 'SpellDrop',
      },
    });
    expect(preboss.mode).toEqual({ kind: 'authored', templateKey: 'ShopPreboss' });
    expect(preboss.enteredRewardStoreHistory).toEqual({ kind: 'none' });
  });

  it('excludes unsupported Story, midshop, and alternate boss declarations', () => {
    expect(catalog.rooms.byKey.N_Story01).toBeUndefined();
    expect(catalog.rooms.byKey.N_Shop01).toBeUndefined();
    expect(catalog.rooms.byKey.N_Boss02).toBeUndefined();
  });

  it('rejects malformed physical, ranked, pylon, and lookup ownership at construction', () => {
    const nLayoutIndex = layoutIndex('N');
    const nCombat01Index = roomIndex('N_Combat01');
    const nCombat02Index = roomIndex('N_Combat02');
    const nPrebossIndex = roomIndex('N_PreBoss01');

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          biomeLayouts: declarations.biomeLayouts.map((layout) =>
            layout.biomeKey === 'N'
              ? {
                  ...layout,
                  hub: {
                    ...layout.hub,
                    slots: layout.hub.slots.map((slot, index) =>
                      index === 1 ? { ...slot, physicalDoorId: 617113 } : slot,
                    ),
                  },
                }
              : layout,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `biomeLayouts[${nLayoutIndex}].hub.slots[1].physicalDoorId`,
        'duplicates 617113',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          biomeLayouts: declarations.biomeLayouts.map((layout) =>
            layout.biomeKey === 'N'
              ? {
                  ...layout,
                  hub: {
                    ...layout.hub,
                    sideRoomGeneration: {
                      ...layout.hub.sideRoomGeneration,
                      minimumPerVisit: { numerator: 3, denominator: 2 },
                    },
                  },
                }
              : layout,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `biomeLayouts[${nLayoutIndex}].hub.sideRoomGeneration.minimumPerVisit`,
        'numerator must not exceed denominator',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((room) =>
            room.gameName === 'N_Combat02'
              ? {
                  ...room,
                  localChildren: room.localChildren?.map((child) =>
                    child.kind === 'fixedRoomSlots'
                      ? {
                          ...child,
                          slots: child.slots.map((slot) =>
                            slot.slotKey === 'sideDoor1' ? { ...slot, availabilityRank: 3 } : slot,
                          ),
                        }
                      : child,
                  ),
                }
              : room,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${nCombat02Index}].localChildren[0].slots.availabilityRanks`,
        'must contain contiguous rank 2',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((room) =>
            room.gameName === 'N_Combat01' ? { ...room, requiredObjects: undefined } : room,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${nCombat01Index}].requiredObjects`,
        'EphyraCombat requires one SoulPylon',
      ),
    );

    expect(() =>
      createCatalog(
        raw({
          ...declarations,
          rooms: declarations.rooms.map((room) =>
            room.gameName === 'N_PreBoss01' && room.incomingReward.kind === 'shop'
              ? {
                  ...room,
                  incomingReward: {
                    ...room.incomingReward,
                    additionalOptionRequirements: {
                      ...room.incomingReward.additionalOptionRequirements,
                      SpellDrop: {
                        kind: 'rewardLookupExcludes',
                        lookupKey: 'missingLookup',
                        rewardType: 'SpellDrop',
                      },
                    },
                  },
                }
              : room,
          ),
        }),
      ),
    ).toThrowError(
      new CatalogContractError(
        `rooms[${nPrebossIndex}].incomingReward.additionalOptionRequirements.SpellDrop.lookupKey`,
        'missingLookup is not produced by N',
      ),
    );
  });
});
