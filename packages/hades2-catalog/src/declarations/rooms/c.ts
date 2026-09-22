import type { RawRoomDeclaration } from './types';
import { normalResourcePointSupport } from '../resources';

/**
 * C_Boss01 remains a real room occurrence in its selected Midshop's host
 * biome. Its C room-set identity only records the game declaration that owns
 * the map; it never introduces a route biome or normal candidate pool.
 */
export const cRooms = [
  {
    gameName: 'C_Boss01',
    resourcePointSupport: normalResourcePointSupport([]),
    label: 'Zagreus',
    roomSetKey: 'C',
    advancesExperimentalHammerUses: true,
    skipTimedDropResources: true,
    kind: 'Boss',
    effectNeutralRequiredReward: true,
    mode: { kind: 'authored', templateKey: 'ContractBoss' },
    blockGiftBoons: true,
    structuralTags: [],
    exits: [{ index: 1, type: 'AnomalyAutoExitDoor' }],
    incomingReward: {
      kind: 'fixed',
      rewardType: 'InfernalContractBoon',
      producerLifecycleKey: 'RoomReward',
    },
    // Native fixes this store at spawn, not by inheriting from the host biome.
    // EventLogic.lua:1892 calls CreateRoom with no arguments, so args carries no
    // store and RunLogic.lua:604-606 takes its fallback:
    // `args.RewardStoreName = room.ForcedRewardStore or "RunProgress"`. The value
    // is RunProgress precisely because RoomDataC declares no ForcedRewardStore,
    // and it reaches the room at RunLogic.lua:619. No host store ever reaches it.
    // The door reward pass never revisits this room either: RoomLogic.lua:3916-17
    // marks NeedsReward only on a room that pass itself creates for a door, and
    // C_Boss01 is spawned ahead of it. Its door also never depletes the store —
    // ForcedReward short-circuits at RewardLogic.lua:86-88, ahead of both the
    // store read at :141 and the RemoveIndexAndCollapse depletion at :178.
    enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'RunProgress' },
    encounterEnvelopeKey: 'SingleEncounter',
    encounterSlotBindings: [
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'BossZagreus01' },
    ],
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: {},
  },
] as const satisfies readonly RawRoomDeclaration[];
