import type { RawRoomDeclaration } from '../types';

const chaosMaps = ['Chaos_01', 'Chaos_02', 'Chaos_03', 'Chaos_04', 'Chaos_05', 'Chaos_06'] as const;

export const chaosRooms = chaosMaps.map(
  (gameName, index) =>
    ({
      gameName,
      label: `Chaos ${String(index + 1).padStart(2, '0')}`,
      roomSetKey: 'Chaos',
      advancesExperimentalHammerUses: true,
      kind: 'Combat',
      mode: { kind: 'authored', templateKey: 'Chaos' },
      structuralTags: [],
      exits: [{ index: 1, type: 'ChaosReturnExitDoor' }],
      incomingReward: {
        kind: 'fixed',
        rewardType: 'TrialUpgrade',
        producerLifecycleKey: 'RoomReward',
      },
      enteredRewardStoreHistory: { kind: 'none' },
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'Empty_Chaos' },
      ],
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: {},
    }) as const,
) satisfies readonly RawRoomDeclaration[];
