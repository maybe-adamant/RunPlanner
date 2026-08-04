import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const clockworkRoomLifecycleProfiles = [
  {
    key: 'ClockworkGoalRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'startEncounter',
        encounter: { kind: 'only' },
        effects: ['recordEncounterStart', 'advanceEncounterDepth'],
      },
      {
        kind: 'completeEncounter',
        encounter: { kind: 'only' },
        effects: ['recordEncounterCompletion'],
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
