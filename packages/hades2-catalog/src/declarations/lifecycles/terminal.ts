import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const terminalRoomLifecycleProfiles = [
  {
    key: 'TerminalRewardRoom',
    encounterProfileKeys: ['Shop'],
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
    encounterProfileKeys: [
      'F_Boss01',
      'G_Boss01',
      'H_Boss01',
      'I_Boss01',
      'N_Boss01',
      'O_Boss01',
      'P_Boss01',
      'Q_Boss01',
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
  {
    key: 'PostBossRoom',
    encounterProfileKeys: [
      'F_PostBoss01',
      'G_PostBoss01',
      'H_PostBoss01',
      'I_PostBoss01',
      'N_PostBoss01',
      'O_PostBoss01',
      'P_PostBoss01',
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
