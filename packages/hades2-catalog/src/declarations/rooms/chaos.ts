import type { RawRoomDeclaration } from '../types';
import { chaosResourcePointSupport } from '../resources';

const chaosMaps = [
  { gameName: 'Chaos_01', exitCount: 2 },
  { gameName: 'Chaos_02', exitCount: 2 },
  { gameName: 'Chaos_03', exitCount: 1 },
  { gameName: 'Chaos_04', exitCount: 2 },
  { gameName: 'Chaos_05', exitCount: 3 },
  { gameName: 'Chaos_06', exitCount: 1 },
] as const;

export const chaosRooms = chaosMaps.map(
  ({ gameName, exitCount }, index) =>
    ({
      gameName,
      resourcePointSupport: chaosResourcePointSupport(['Pickaxe', 'Shovel', 'Fishing'], {
        ignoresBiomeLimit: true,
      }),
      label: `Chaos ${String(index + 1).padStart(2, '0')}`,
      roomSetKey: 'Chaos',
      advancesExperimentalHammerUses: true,
      kind: 'Combat',
      mode: { kind: 'authored', templateKey: 'Chaos' },
      structuralTags: [],
      exits: Array.from({ length: exitCount }, (_, exitIndex) => ({
        index: exitIndex + 1,
        type: 'ChaosReturnExitDoor' as const,
      })),
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
