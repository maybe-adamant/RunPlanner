import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const standardRoomLifecycleProfiles = [
  {
    key: 'StandardRewardRoom',
    encounterProfileKeys: [
      'F_Opening',
      'StandardCombat',
      'Story',
      'HealthRestore',
      'F_MiniBoss01',
      'F_MiniBoss02',
      'F_MiniBoss03',
      'G_MiniBoss01',
      'G_MiniBoss02',
      'G_MiniBoss03',
      'H_MiniBoss01',
      'H_MiniBoss02',
      'H_Bridge01',
      'ClockworkCombat',
      'I_Story01',
      'I_MiniBoss01',
      'I_MiniBoss02',
      'N_PreHub',
      'O_MiniBoss01',
      'O_MiniBoss02',
      'O_Story01',
      'OlympusCombat',
      'P_MiniBoss01',
      'P_MiniBoss02',
      'Q_MiniBoss02',
      'Q_MiniBoss05',
      'Q_MiniBoss03',
      'Q_MiniBoss04',
    ],
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
    encounterProfileKeys: ['SummitCombat'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
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

export const specializedRewardRoomLifecycleProfiles = [
  {
    key: 'RewardlessRoom',
    encounterProfileKeys: ['FixedIntro'],
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
  {
    key: 'DevotionRoom',
    encounterProfileKeys: ['O_Devotion01'],
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
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
