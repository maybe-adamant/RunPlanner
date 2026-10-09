import type { RawRewardKernelInput } from './types';

const nemesisEventRewardTypes = [
  'EmptyMaxHealthDrop',
  'HealDrop',
  'LastStandDrop',
  'ArmorBoost',
  'MaxHealthDrop',
  'MaxHealthDropBig',
  'MaxManaDrop',
  'MaxManaDropBig',
  'StackUpgrade',
  'StackUpgradeBig',
  'WeaponUpgrade',
  'RoomMoneyDrop',
  'TalentDrop',
  'RoomMoneyTripleDrop',
  'RoomRewardConsolationPrize',
] as const;

/** A fresh profile owns none of the `RunProgress` world upgrades; a mature save owns all. */
export const runProgressUnlockExcludedRouteKeys = ['FreshFile'] as const;

// ConsumableData.lua GiftDrop.RunProgress: the random boon level needs
// WorldUpgradeGiftDropRunProgress.
const giftDropRunProgressLevel = {
  kind: 'randomTargetIfAvailable',
  levelCount: 1,
  excludedRouteKeys: runProgressUnlockExcludedRouteKeys,
} as const;

export const producerLifecycles = [
  {
    key: 'RoomReward',
    // RewardLogic.lua SpawnRoomReward passes RunProgressUpgradeEligible.
    runProgressUpgradeEligible: true,
    rewardTypes: [
      'MaxHealthDrop',
      'MaxHealthDropBig',
      'MaxHealthDropSmall',
      'EmptyMaxHealthSmallDrop',
      'MaxManaDrop',
      'MaxManaDropBig',
      'MaxManaDropSmall',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'RoomMoneyTinyDrop',
      'StackUpgrade',
      'StackUpgradeBig',
      'StackUpgradeTriple',
      'WeaponUpgrade',
      'HermesUpgrade',
      'Devotion',
      'SpellDrop',
      'TalentDrop',
      'TalentBigDrop',
      'MinorTalentDrop',
      'RoomRewardHealDrop',
      'ArmorBoost',
      'Boon',
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCardPointsCommonDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonBigDrop',
      'AirBoost',
      'EarthBoost',
      'FireBoost',
      'WaterBoost',
      'InfernalContractBoon',
      'TrialUpgrade',
      'Story',
      'Shop',
    ],
    defaultLifecyclePoint: 'roomRewardPickup',
    overrides: [
      {
        rewardType: 'Devotion',
        acquisitionLifecycle: [
          { role: 'chosenSource', lifecyclePoint: 'beforeCombat' },
          { role: 'spurnedSource', lifecyclePoint: 'afterCombat' },
        ],
      },
      {
        rewardType: 'GiftDrop',
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'roomRewardPickup',
            levelResolutionEffect: giftDropRunProgressLevel,
          },
        ],
      },
    ],
  },
  // A Shrine purchase is paid, but its rush/matured object is a free room
  // pickup.  Keep that delivery lifecycle distinct from the menu profile:
  // the profile owns visible inventory while this declaration owns ordinary
  // pickup roles for every exact SurfaceShop item.
  {
    key: 'HermesShrineDelivery',
    rewardTypes: [
      'HealBigDrop',
      'RoomRewardHealDrop',
      'ArmorBigBoost',
      'ArmorBoost',
      'LastStandDrop',
      'GiftDrop',
      'SpellDrop',
      'ShopHermesUpgrade',
      'MaxHealthDrop',
      'MaxManaDrop',
      'BlindBoxLoot',
      'TalentDrop',
    ],
    defaultLifecyclePoint: 'roomRewardPickup',
    overrides: [
      {
        rewardType: 'GiftDrop',
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'roomRewardPickup',
            levelResolutionEffect: giftDropRunProgressLevel,
          },
        ],
      },
      {
        rewardType: 'BlindBoxLoot',
        acquisitionLifecycle: [
          { role: 'box', lifecyclePoint: 'roomRewardPickup' },
          { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
        ],
      },
    ],
  },
  {
    key: 'EchoLastReward',
    // EventLogic.lua EchoLastReward.
    runProgressUpgradeEligible: true,
    rewardTypes: [
      'AphroditeUpgrade',
      'ApolloUpgrade',
      'AresUpgrade',
      'DemeterUpgrade',
      'HephaestusUpgrade',
      'HeraUpgrade',
      'HestiaUpgrade',
      'PoseidonUpgrade',
      'ZeusUpgrade',
      'HermesUpgrade',
      'StackUpgrade',
      'StackUpgradeBig',
      'StackUpgradeTriple',
      'WeaponUpgrade',
      'MaxHealthDrop',
      'MaxHealthDropBig',
      'MaxManaDrop',
      'MaxManaDropBig',
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTripleDrop',
      'TalentDrop',
      'TalentBigDrop',
      'GiftDrop',
      'MetaCurrencyDrop',
      'MetaCurrencyBigDrop',
      'MetaCardPointsCommonDrop',
      'MetaCardPointsCommonBigDrop',
      'MemPointsCommonDrop',
    ],
    defaultLifecyclePoint: 'echoReplay',
    overrides: [
      ...[
        'AphroditeUpgrade',
        'ApolloUpgrade',
        'AresUpgrade',
        'DemeterUpgrade',
        'HephaestusUpgrade',
        'HeraUpgrade',
        'HestiaUpgrade',
        'PoseidonUpgrade',
        'ZeusUpgrade',
        'HermesUpgrade',
        'StackUpgrade',
        'StackUpgradeBig',
        'StackUpgradeTriple',
        'WeaponUpgrade',
        'MaxHealthDrop',
        'MaxHealthDropBig',
        'MaxManaDrop',
        'MaxManaDropBig',
        'RoomMoneyDrop',
        'RoomMoneySmallDrop',
        'RoomMoneyTripleDrop',
        'TalentDrop',
        'TalentBigDrop',
        'MetaCurrencyDrop',
        'MetaCurrencyBigDrop',
        'MetaCardPointsCommonDrop',
        'MetaCardPointsCommonBigDrop',
        'MemPointsCommonDrop',
      ].map((rewardType) => ({
        rewardType,
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'echoReplay' as const,
            blocksArtificerConversion: true as const,
          },
        ],
      })),
      {
        rewardType: 'GiftDrop',
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'echoReplay',
            levelResolutionEffect: giftDropRunProgressLevel,
            blocksArtificerConversion: true,
          },
        ],
      },
    ],
  },
  {
    key: 'NarcissusPickup',
    // TraitData_Narcissus overrides its Ashes drop's `AddResources` to 10.
    runProgressUpgradeEligible: true,
    resourceGrantOverrides: { MetaCardPointsCommonDrop: { MetaCardPointsCommon: 10 } },
    rewardTypes: [
      'StoreRewardRandomStack',
      'MaxManaDrop',
      'MaxHealthDrop',
      'Currency',
      'LastStandDrop',
      'BlindBoxLoot',
      'ElementalBoost',
      'MetaCardPointsCommonDrop',
      'MemPointsCommonDrop',
      'MetaCurrencyDrop',
    ],
    defaultLifecyclePoint: 'roomExit',
    overrides: [
      {
        rewardType: 'BlindBoxLoot',
        acquisitionLifecycle: [
          { role: 'box', lifecyclePoint: 'roomRewardPickup' },
          { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
        ],
      },
    ],
  },
  {
    key: 'GeneratedTraitPickup',
    // GiveRandomConsumables forwards Buried Treasure's RunProgressUpgradeEligible.
    runProgressUpgradeEligible: true,
    rewardTypes: [
      'RoomMoneyDrop',
      'RoomMoneySmallDrop',
      'RoomMoneyTinyDrop',
      'HealDropMinor',
      'MetaCurrencyDrop',
      'StoreRewardRandomStack',
    ],
    defaultLifecyclePoint: 'roomRewardPickup',
    overrides: [
      {
        rewardType: 'MetaCurrencyDrop',
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'roomRewardPickup',
            blocksArtificerConversion: true,
          },
        ],
      },
    ],
  },
  {
    key: 'NemesisEventPickup',
    // `NPCRewardDrop` marks each dropped consumable `NPCDrop`.
    resourceBonusExempt: true,
    rewardTypes: nemesisEventRewardTypes,
    defaultLifecyclePoint: 'roomRewardPickup',
    overrides: [
      ...nemesisEventRewardTypes.map((rewardType) => ({
        rewardType,
        acquisitionLifecycle: [
          {
            role: 'self',
            lifecyclePoint: 'roomRewardPickup' as const,
            blocksArtificerConversion: true as const,
          },
        ],
      })),
    ],
  },
  {
    key: 'ErisCursePickup',
    // RoomData{G,H,I} `SpawnErisForCurse` gift overrides: `NPCDrop`,
    // `CanDuplicate = false`, `MetaConversionEligible = false`, fixed `AddResources`.
    // H's fixed 50 Psyche (`MemPointsCommon`) is untracked, so it declares no amount.
    resourceBonusExempt: true,
    duplicationExempt: true,
    resourceGrantOverrides: {
      MetaCardPointsCommonDrop: { MetaCardPointsCommon: 20 },
      MetaCurrencyDrop: { MetaCurrency: 300 },
    },
    rewardTypes: ['MetaCardPointsCommonDrop', 'MemPointsCommonDrop', 'MetaCurrencyDrop'],
    defaultLifecyclePoint: 'roomRewardPickup',
    overrides: (
      ['MetaCardPointsCommonDrop', 'MemPointsCommonDrop', 'MetaCurrencyDrop'] as const
    ).map((rewardType) => ({
      rewardType,
      acquisitionLifecycle: [
        {
          role: 'self',
          lifecyclePoint: 'roomRewardPickup' as const,
          blocksArtificerConversion: true as const,
        },
      ],
    })),
  },
  {
    key: 'ZagPedestal',
    rewardTypes: ['BlindBoxLoot', 'StackUpgradeBig', 'StackUpgrade', 'TalentBigDrop', 'TalentDrop'],
    defaultLifecyclePoint: 'roomExit',
    overrides: [
      {
        rewardType: 'BlindBoxLoot',
        acquisitionLifecycle: [
          { role: 'box', lifecyclePoint: 'roomExit' },
          { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
        ],
      },
    ],
  },
] as const satisfies RawRewardKernelInput['producerLifecycles'];
