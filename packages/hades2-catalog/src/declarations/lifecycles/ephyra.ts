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
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'spawnRequiredObjects', effects: ['recordRequiredObjectSpawns'] },
      { kind: 'runEncounterScripts' },
      { kind: 'completeRequiredObjects', effects: ['recordRequiredObjectCompletions'] },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'EphyraSideRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'runEncounterScripts' },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'EphyraHubRoom',
    encounterEnvelopeKeys: ['EmptyEncounter'],
    producer: { kind: 'none' },
    steps: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
