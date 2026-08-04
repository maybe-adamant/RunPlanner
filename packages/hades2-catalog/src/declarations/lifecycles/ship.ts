import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const shipRoomLifecycleProfiles = [
  {
    key: 'ShipCombatRoom',
    encounterEnvelopeKeys: ['ShipEncounter'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'runRewardEncounterSequence',
        effects: [
          'recordPhaseOfferPoint',
          'recordEncounterStart',
          'advanceEncounterDepth',
          'recordEncounterCompletion',
          'recordPhaseOfferAcquisition',
        ],
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
