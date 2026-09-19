import type { RawRoomDeclaration } from './types';
import { normalResourcePointSupport } from '../resources';

const dreamPostboss = (gameName: string) => ({
  gameName,
  resourcePointSupport: normalResourcePointSupport([]),
  label: 'Postboss',
  hasKeepsakeRack: true,
  hasRequiredFountain: true,
  challengeSwitchAnchorCount: 1,
  roomShop: { profileKey: 'RoomShop' as const, spawnChance: 1, forced: true as const },
  roomSetKey: 'Dream',
  advancesExperimentalHammerUses: true,
  kind: 'PostBoss' as const,
  mode: { kind: 'authored' as const, templateKey: 'PostBoss' as const },
  structuralTags: [],
  exits: [],
  incomingReward: { kind: 'none' as const },
  enteredRewardStoreHistory: { kind: 'none' as const },
  encounterEnvelopeKey: 'SingleEncounter',
  encounterSlotBindings: [
    { slotKey: 'Encounter', kind: 'fixed' as const, encounterDefinitionKey: 'Empty' },
  ],
  counters: { biomeDepthCache: 1, roomHistoryOrdinal: 1 },
  caps: { maxAppearancesThisBiome: 1 },
});

/** Source: RoomDataDream.lua Dream_PostBoss01/02/03 inherit the same rack, fountain and forced Well. */
export const dreamRooms = [
  dreamPostboss('Dream_PostBoss01'),
  dreamPostboss('Dream_PostBoss02'),
  dreamPostboss('Dream_PostBoss03'),
] satisfies readonly RawRoomDeclaration[];
