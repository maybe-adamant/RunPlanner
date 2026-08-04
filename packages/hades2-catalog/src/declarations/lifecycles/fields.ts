import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const fieldsRoomLifecycleProfiles = [
  {
    key: 'FieldsCombatRoom',
    encounterEnvelopeKeys: ['FieldsEncounter'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'runEncounterSequence',
        effects: ['recordEncounterStart', 'advanceEncounterDepth', 'recordEncounterCompletion'],
      },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
