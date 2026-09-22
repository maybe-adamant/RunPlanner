import type { RawRoomDeclaration } from './types';
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
      skipTimedDropResources: true,
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
      // Every Chaos gate room is pinned to the Secrets store:
      // RoomDataChaos.lua:160 sets ForcedRewardStore = "Secrets" on BaseChaos,
      // and that store holds exactly one entry (LootData.lua:807-812). Entering
      // one is therefore a counted room whose store is Secrets, not none — it
      // feeds the run-scoped ratio as a non-MetaProgress entry. Secrets is also
      // listed in RewardStoreData.InvalidOverrides (LootData.lua:802-805), so it
      // never leaks onto a sibling door through the per-door override path.
      enteredRewardStoreHistory: { kind: 'fixed', storeKey: 'Secrets' },
      encounterEnvelopeKey: 'SingleEncounter',
      encounterSlotBindings: [
        { slotKey: 'Encounter', kind: 'fixed', encounterDefinitionKey: 'Empty_Chaos' },
      ],
      counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
      caps: {},
    }) as const,
) satisfies readonly RawRoomDeclaration[];
