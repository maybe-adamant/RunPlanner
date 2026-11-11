import type { RawRoomLifecycleProfileDeclaration } from './types';

export const clockworkRoomLifecycleProfiles = [
  {
    key: 'ClockworkGoalRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'none' },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'runEncounterScripts' },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
