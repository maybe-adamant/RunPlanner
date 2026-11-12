import type { RawRoomLifecycleProfileDeclaration } from './types';

/**
 * Preboss takeover rooms and their fixed Boss/Postboss successors share the
 * same lifecycle declaration family. They are ordinary topology occurrences.
 */
export const prebossCompletionRoomLifecycleProfiles = [
  {
    key: 'PrebossFreeRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: false,
  },
  {
    key: 'PrebossShopRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'], points: [] },
    offerPoint: { key: 'shopInventory', at: 'beforeEntry' },
    runsEncounters: false,
    requiredObjects: false,
    generatesOutgoing: false,
    exitAcquisitionPoint: 'roomExit',
  },
  {
    key: 'BossRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: false,
  },
  {
    key: 'PostBossRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: false,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
