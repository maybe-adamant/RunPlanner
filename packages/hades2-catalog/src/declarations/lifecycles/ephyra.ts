import type { RawRoomLifecycleProfileDeclaration } from './types';

export const ephyraRoomLifecycleProfiles = [
  {
    key: 'EphyraMainRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    runsEncounters: true,
    requiredObjects: true,
    generatesOutgoing: true,
  },
  {
    key: 'EphyraSideRoom',
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
    key: 'EphyraHubRoom',
    encounterEnvelopeKeys: ['EmptyEncounter'],
    producer: { kind: 'none' },
    runsEncounters: false,
    requiredObjects: false,
    generatesOutgoing: true,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
