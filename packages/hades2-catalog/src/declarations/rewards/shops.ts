import {
  chaosHammerLegal,
  deathDefianceConditionMet,
  hammerEarly,
  hammerLate,
  routeTalentLegal,
  shopHermesLegal,
  spellLegal,
  stackLegal,
  talentLegal,
} from './requirements';
import type { RawRewardKernelInput, RawShopOptionEntryDeclaration } from './types';

function option(declaration: RawShopOptionEntryDeclaration): RawShopOptionEntryDeclaration {
  return {
    ...declaration,
    purchaseInteraction: declaration.purchaseInteraction ?? {
      kind: 'fixed',
      gameName: declaration.rewardType,
    },
  };
}

const worldGroups = [
  {
    key: 'Boon',
    offerCount: 1,
    options: [
      option({
        key: 'RandomLoot',
        rewardType: 'RandomLoot',
        purchaseInteraction: { kind: 'resolvedOfferSource' },
      }),
      option({
        key: 'BlindBoxLoot',
        rewardType: 'BlindBoxLoot',
        acquisitionLifecycle: [
          { role: 'box', lifecyclePoint: 'purchase' },
          { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
        ],
      }),
      option({
        key: 'ShopHermesUpgrade',
        rewardType: 'ShopHermesUpgrade',
        purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
        requirement: shopHermesLegal,
      }),
    ],
  },
  {
    key: 'MajorNonBoon',
    offerCount: 1,
    options: [
      option({
        key: 'WeaponUpgradeDropEarly',
        rewardType: 'WeaponUpgradeDrop',
        purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
        requirement: hammerEarly,
      }),
      option({
        key: 'WeaponUpgradeDropLate',
        rewardType: 'WeaponUpgradeDrop',
        purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
        requirement: hammerLate,
      }),
      option({
        key: 'RoomRewardHealDrop',
        rewardType: 'RoomRewardHealDrop',
      }),
      option({
        key: 'MaxHealthDrop',
        rewardType: 'MaxHealthDrop',
      }),
      option({
        key: 'ArmorBoost',
        rewardType: 'ArmorBoost',
      }),
      option({
        key: 'MetaCardPointsCommonDrop',
        rewardType: 'MetaCardPointsCommonDrop',
      }),
      option({
        key: 'MetaCurrencyDrop',
        rewardType: 'MetaCurrencyDrop',
      }),
      option({
        key: 'GiftDrop',
        rewardType: 'GiftDrop',
      }),
    ],
  },
  {
    key: 'Minor',
    offerCount: 1,
    options: [
      option({
        key: 'MaxManaDrop',
        rewardType: 'MaxManaDrop',
      }),
      option({
        key: 'StackUpgrade',
        rewardType: 'StackUpgrade',
        requirement: stackLegal,
      }),
      option({
        key: 'StoreRewardRandomStack',
        rewardType: 'StoreRewardRandomStack',
        requirement: stackLegal,
      }),
      option({
        key: 'SpellDrop',
        rewardType: 'SpellDrop',
        requirement: spellLegal,
      }),
      option({
        key: 'TalentDrop',
        rewardType: 'TalentDrop',
        requirement: routeTalentLegal,
      }),
    ],
  },
] as const;

const lateResourceOptions = [
  option({
    key: 'WeaponPointsRareDrop',
    rewardType: 'WeaponPointsRareDrop',
  }),
  option({
    key: 'CardUpgradePointsDrop',
    rewardType: 'CardUpgradePointsDrop',
  }),
  option({
    key: 'CharonPointsDrop',
    rewardType: 'CharonPointsDrop',
  }),
];

export const shops = [
  {
    key: 'WorldShop',
    groups: worldGroups,
    slots: [
      { key: 'Boon', label: 'Offer 1', groupKey: 'Boon' },
      {
        key: 'MajorNonBoon',
        label: 'Offer 2',
        groupKey: 'MajorNonBoon',
      },
      {
        key: 'Minor',
        label: 'Offer 3',
        groupKey: 'Minor',
      },
    ],
  },
  {
    key: 'I_WorldShop',
    groups: [
      {
        key: 'BoostedBoon',
        offerCount: 1,
        options: [
          option({
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'StackUpgradeBig',
            rewardType: 'StackUpgradeBig',
            requirement: stackLegal,
          }),
        ],
      },
      {
        key: 'MixedProgress',
        offerCount: 1,
        options: [
          option({
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'BlindBoxLoot',
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          option({
            key: 'MaxHealthDrop',
            rewardType: 'MaxHealthDrop',
          }),
          option({
            key: 'MaxManaDrop',
            rewardType: 'MaxManaDrop',
          }),
          option({
            key: 'StackUpgrade',
            rewardType: 'StackUpgrade',
            requirement: stackLegal,
          }),
          option({
            key: 'TalentDrop',
            rewardType: 'TalentDrop',
            requirement: talentLegal,
          }),
          option({
            key: 'SpellDrop',
            rewardType: 'SpellDrop',
            requirement: spellLegal,
          }),
        ],
      },
      {
        key: 'Survival',
        offerCount: 1,
        options: [
          option({
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          option({
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
          }),
          option({
            key: 'LastStandDrop',
            rewardType: 'LastStandDrop',
            requirement: deathDefianceConditionMet,
            purchaseRequirement: deathDefianceConditionMet,
          }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          option({
            key: 'ShopHermesUpgrade',
            rewardType: 'ShopHermesUpgrade',
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          option({
            key: 'ChaosWeaponUpgrade',
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          option({
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'MaxHealthDropBig',
            rewardType: 'MaxHealthDropBig',
          }),
          option({
            key: 'MaxManaDropBig',
            rewardType: 'MaxManaDropBig',
          }),
        ],
      },
      { key: 'MetaProgress', offerCount: 1, options: lateResourceOptions },
    ],
    slots: [
      {
        key: 'BoostedBoon',
        label: 'Offer 1',
        groupKey: 'BoostedBoon',
      },
      {
        key: 'MixedProgress',
        label: 'Offer 2',
        groupKey: 'MixedProgress',
      },
      {
        key: 'Survival',
        label: 'Offer 3',
        groupKey: 'Survival',
      },
      {
        key: 'PremiumProgress',
        label: 'Offer 4',
        groupKey: 'PremiumProgress',
      },
      {
        key: 'MetaProgress',
        label: 'Offer 5',
        groupKey: 'MetaProgress',
      },
    ],
  },
  {
    key: 'Q_WorldShop',
    groups: [
      {
        key: 'MixedProgress',
        offerCount: 2,
        options: [
          option({
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'StackUpgradeBig',
            rewardType: 'StackUpgradeBig',
            requirement: stackLegal,
          }),
          option({
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'BlindBoxLoot',
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          option({
            key: 'MaxHealthDrop',
            rewardType: 'MaxHealthDrop',
          }),
          option({
            key: 'MaxManaDrop',
            rewardType: 'MaxManaDrop',
          }),
          option({
            key: 'TalentDrop',
            rewardType: 'TalentDrop',
            requirement: talentLegal,
          }),
          option({
            key: 'SpellDrop',
            rewardType: 'SpellDrop',
            requirement: spellLegal,
          }),
        ],
      },
      {
        key: 'LargeSurvival',
        offerCount: 1,
        options: [
          option({
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          option({
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
          }),
        ],
      },
      {
        key: 'Survival',
        offerCount: 1,
        options: [
          option({
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          option({
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
          }),
          option({
            key: 'LastStandDrop',
            rewardType: 'LastStandDrop',
            requirement: deathDefianceConditionMet,
            purchaseRequirement: deathDefianceConditionMet,
          }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          option({
            key: 'ShopHermesUpgrade',
            rewardType: 'ShopHermesUpgrade',
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          option({
            key: 'ChaosWeaponUpgrade',
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          option({
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'MaxHealthDropBig',
            rewardType: 'MaxHealthDropBig',
          }),
          option({
            key: 'MaxManaDropBig',
            rewardType: 'MaxManaDropBig',
          }),
        ],
      },
      { key: 'MetaProgress', offerCount: 1, options: lateResourceOptions },
    ],
    slots: [
      {
        key: 'MixedProgress1',
        label: 'Offer 1',
        groupKey: 'MixedProgress',
      },
      {
        key: 'MixedProgress2',
        label: 'Offer 2',
        groupKey: 'MixedProgress',
      },
      {
        key: 'LargeSurvival',
        label: 'Offer 3',
        groupKey: 'LargeSurvival',
      },
      {
        key: 'Survival',
        label: 'Offer 4',
        groupKey: 'Survival',
      },
      {
        key: 'PremiumProgress',
        label: 'Offer 5',
        groupKey: 'PremiumProgress',
      },
      {
        key: 'MetaProgress',
        label: 'Offer 6',
        groupKey: 'MetaProgress',
      },
    ],
  },
] satisfies RawRewardKernelInput['shops'];
