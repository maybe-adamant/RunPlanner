import type { RawRoomLifecycleProfileDeclaration } from './types';

export const shipRoomLifecycleProfiles = [
  {
    key: 'ShipCombatRoom',
    encounterEnvelopeKeys: ['ShipEncounter'],
    producer: { kind: 'none' },
    runsEncounters: true,
    requiredObjects: false,
    generatesOutgoing: true,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
