import type { RawShopOptionSetDeclaration, RawShopProfileDeclaration } from '../types';

export const shopOptionSets = [
  {
    key: 'WorldShopBoon',
    rewardTypes: ['RandomLoot', 'BlindBoxLoot', 'ShopHermesUpgrade'],
  },
  {
    key: 'WorldShopNonBoon',
    rewardTypes: [
      'WeaponUpgradeDrop',
      'RoomRewardHealDrop',
      'MaxHealthDrop',
      'ArmorBoost',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyDrop',
      'GiftDrop',
    ],
  },
  {
    key: 'WorldShopMinor',
    rewardTypes: [
      'MaxManaDrop',
      'StackUpgrade',
      'StoreRewardRandomStack',
      'SpellDrop',
      'TalentDrop',
    ],
  },
] as const satisfies readonly RawShopOptionSetDeclaration[];

export const shopProfiles = [
  {
    key: 'WorldShop',
    slots: [
      {
        key: 'Boon',
        label: 'Offer 1',
        optionSetKey: 'WorldShopBoon',
        defaultRewardType: 'RandomLoot',
      },
      {
        key: 'MajorNonBoon',
        label: 'Offer 2',
        optionSetKey: 'WorldShopNonBoon',
        defaultRewardType: 'WeaponUpgradeDrop',
      },
      {
        key: 'Minor',
        label: 'Offer 3',
        optionSetKey: 'WorldShopMinor',
        defaultRewardType: 'MaxManaDrop',
      },
    ],
  },
] as const satisfies readonly RawShopProfileDeclaration[];
