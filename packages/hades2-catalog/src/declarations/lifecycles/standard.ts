import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const standardRoomLifecycleProfiles = [
  {
    key: 'StandardRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
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
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'RewardlessCombatRoom',
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
  {
    key: 'PCombatRoom',
    encounterEnvelopeKeys: ['PEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'advanceProducer',
        point: 'beforeCombat',
        effects: ['recordProducerPoint'],
      },
      {
        kind: 'runEncounterSequence',
        effects: ['recordEncounterStart', 'advanceEncounterDepth', 'recordEncounterCompletion'],
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
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];

export const specializedRewardRoomLifecycleProfiles = [
  {
    key: 'StoryPickupRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'advanceProducer', point: 'beforeCombat', effects: ['recordProducerPoint'] },
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
      { kind: 'advanceProducer', point: 'afterCombat', effects: ['recordProducerPoint'] },
      { kind: 'advanceProducer', point: 'roomRewardPickup', effects: ['recordProducerPoint'] },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      { kind: 'settleAcquisitionPoint', point: 'roomExit', effects: ['recordAcquisitionPoint'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'RewardlessRoom',
    encounterEnvelopeKeys: ['EmptyEncounter'],
    producer: { kind: 'none' },
    operations: [
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
  {
    key: 'DevotionRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation', 'recordEncounter'] },
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
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
