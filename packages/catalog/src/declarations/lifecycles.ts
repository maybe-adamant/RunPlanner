import type { RawRoomLifecycleProfileDeclaration } from './types';

export const roomLifecycleProfiles = [
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
    encounterProfileKeys: ['EphyraCombat', 'N_MiniBoss01', 'N_MiniBoss02'],
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
    key: 'ClockworkGoalRoom',
    encounterProfileKeys: ['ClockworkCombat'],
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
    key: 'FieldsCombatRoom',
    encounterProfileKeys: ['H_FieldsCombatCage2', 'H_FieldsCombatCage3'],
    producer: { kind: 'none' },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
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
  {
    key: 'WorldShopRoom',
    encounterProfileKeys: ['Shop'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
      {
        kind: 'materializeOfferPoint',
        offerPoint: 'shopInventory',
        effects: ['recordOfferPoint'],
      },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      { kind: 'generateOutgoingBatch', effects: ['recordOutgoingGeneration'] },
      {
        kind: 'applyShopPurchases',
        offerPoint: 'shopInventory',
        effects: ['recordShopPurchases'],
      },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'TerminalRewardRoom',
    encounterProfileKeys: ['Preboss'],
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
    key: 'TerminalWorldShopRoom',
    encounterProfileKeys: ['Preboss'],
    producer: { kind: 'required', lifecycleProfileKeys: ['RoomReward'] },
    operations: [
      { kind: 'prepareRoom', effects: ['recordPreparation'] },
      {
        kind: 'materializeOfferPoint',
        offerPoint: 'shopInventory',
        effects: ['recordOfferPoint'],
      },
      { kind: 'enterRoom', effects: ['recordAppearance'] },
      {
        kind: 'applyShopPurchases',
        offerPoint: 'shopInventory',
        effects: ['recordShopPurchases'],
      },
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'BossRoom',
    encounterProfileKeys: ['F_Boss01', 'G_Boss01', 'H_Boss01', 'I_Boss01', 'N_Boss01'],
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
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
  {
    key: 'PostBossRoom',
    encounterProfileKeys: [
      'F_PostBoss01',
      'G_PostBoss01',
      'H_PostBoss01',
      'I_PostBoss01',
      'N_PostBoss01',
    ],
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
      {
        kind: 'commitRoom',
        effects: ['recordCommit', 'advanceRoomCounters', 'recordEnteredRewardStore'],
      },
      { kind: 'exitRoom', effects: ['recordExit'] },
    ],
  },
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
