import type { RawRoomDeclaration } from '../types';

/**
 * C_Boss01 remains a real room occurrence in its selected Midshop's host
 * biome. Its C room-set identity only records the game declaration that owns
 * the map; it never introduces a route biome or normal candidate pool.
 */
export const cRooms = [
  {
    gameName: 'C_Boss01',
    label: 'Zagreus',
    roomSetKey: 'C',
    advancesExperimentalHammerUses: true,
    kind: 'Boss',
    mode: { kind: 'authored', templateKey: 'ContractBoss' },
    blockGiftBoons: true,
    structuralTags: [],
    exits: [{ index: 1, type: 'AnomalyAutoExitDoor' }],
    incomingReward: {
      kind: 'fixed',
      rewardType: 'InfernalContractBoon',
      producerLifecycleKey: 'RoomReward',
    },
    enteredRewardStoreHistory: { kind: 'none' },
    encounterEnvelopeKey: 'SingleEncounter',
    encounterSlotBindings: [
      { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'BossZagreus01' },
    ],
    counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
    caps: {},
  },
] as const satisfies readonly RawRoomDeclaration[];
