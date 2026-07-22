import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const ephyraRoomLifecycleProfiles = [
  {
    key: 'EphyraOpeningRoom',
    encounterProfileKeys: ['N_Opening'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'advanceProducer',
        point: 'roomRewardPickup',
        effects: ['recordProducerPoint'],
      },
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
  {
    key: 'EphyraMainRoom',
    encounterProfileKeys: ['SingleCountedCombat', 'N_MiniBoss01', 'N_MiniBoss02', 'N_Story01'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'spawnRequiredObjects', effects: ['recordRequiredObjectSpawns'] },
      {
        kind: 'advanceProducer',
        point: 'beforeCombat',
        effects: ['recordProducerPoint'],
      },
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
      { kind: 'completeRequiredObjects', effects: ['recordRequiredObjectCompletions'] },
      {
        kind: 'advanceProducer',
        point: 'afterCombat',
        effects: ['recordProducerPoint'],
      },
      {
        kind: 'advanceProducer',
        point: 'roomRewardPickup',
        effects: ['recordProducerPoint'],
      },
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
    encounterProfileKeys: ['EphyraSideRoom', 'EphyraSideRoomHard'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'advanceProducer',
        point: 'beforeCombat',
        effects: ['recordProducerPoint'],
      },
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
      {
        kind: 'advanceProducer',
        point: 'afterCombat',
        effects: ['recordProducerPoint'],
      },
      {
        kind: 'advanceProducer',
        point: 'roomRewardPickup',
        effects: ['recordProducerPoint'],
      },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'EphyraHubRoom',
    encounterProfileKeys: ['NoEncounter'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
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
