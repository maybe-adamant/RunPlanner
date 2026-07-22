import type { RawRoomLifecycleProfileDeclaration } from '../types';

export const shopsRoomLifecycleProfiles = [
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
] as const satisfies readonly RawRoomLifecycleProfileDeclaration[];
