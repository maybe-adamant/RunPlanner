import type { RawRoomLifecycleProfileDeclaration } from './types';

export const standardRoomLifecycleProfiles = [
  {
    key: 'StandardRewardRoom',
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
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'OpeningRewardRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['roomRewardPickup'],
    },
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
  {
    key: 'OpeningRewardNoEncounterRoom',
    encounterEnvelopeKeys: ['EmptyEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['roomRewardPickup'],
    },
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
  {
    key: 'RewardlessCombatRoom',
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
  {
    key: 'PCombatRoom',
    encounterEnvelopeKeys: ['PEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat', 'roomRewardPickup'],
    },
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

export const specializedRewardRoomLifecycleProfiles = [
  {
    key: 'StoryPickupRoom',
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
  {
    key: 'DevotionRoom',
    encounterEnvelopeKeys: ['SingleEncounter'],
    producer: {
      kind: 'required',
      lifecycleProfileKeys: ['RoomReward'],
      points: ['beforeCombat', 'afterCombat'],
    },
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
