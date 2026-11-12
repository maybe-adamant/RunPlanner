import type { RawRoomLifecycleProfileDeclaration } from './types';

export const fieldsRoomLifecycleProfiles = [
  {
    key: 'FieldsCombatRoom',
    encounterEnvelopeKeys: ['FieldsEncounter'],
    producer: { kind: 'none' },
    offerPoint: { key: 'fieldsOptionalRewards', at: 'afterEntry' },
    requiredObjects: false,
    generatesOutgoing: true,
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
