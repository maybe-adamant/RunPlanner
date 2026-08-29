import {
  chaosHammerLegal,
  hammerEarly,
  hammerLate,
  inRunFirstHalf,
  inRunSecondHalf,
  routeTalentLegal,
  shopHermesLegal,
  spellLegal,
  stackLegal,
  talentLegal,
} from './requirements';
import type { RequirementExpression } from '@run-planner/engine/requirements';

import type { RawRewardKernelInput, RawShopOptionEntryDeclaration } from './types';

const boostedBoonRarity = { Rare: 0.9, Epic: 0.25, Legendary: 0.1 } as const;

function option(declaration: RawShopOptionEntryDeclaration): RawShopOptionEntryDeclaration {
  return {
    ...declaration,
    purchaseInteraction: declaration.purchaseInteraction ?? {
      kind: 'fixed',
      gameName: declaration.rewardType,
    },
  };
}

function phaseOption(
  phase: RequirementExpression,
  declaration: RawShopOptionEntryDeclaration,
): RawShopOptionEntryDeclaration {
  return option({
    ...declaration,
    requirement:
      declaration.requirement === undefined
        ? phase
        : { kind: 'all', requirements: [phase, declaration.requirement] },
  });
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

const extendedWellItemKeys = [
  'TemporaryDoorHealTrait',
  'TemporaryImprovedSecondaryTrait',
  'TemporaryImprovedCastTrait',
  'TemporaryMoveSpeedTrait',
  'TemporaryImprovedExTrait',
  'TemporaryImprovedDefenseTrait',
  'TemporaryDiscountTrait',
  'TemporaryEmptySlotDamageTrait',
] as const;
const twistWellItemKeys = [
  'TemporaryImprovedSecondaryTrait',
  'TemporaryImprovedCastTrait',
  'TemporaryMoveSpeedTrait',
  'TemporaryBoonRarityTrait',
  'TemporaryImprovedExTrait',
  'TemporaryImprovedDefenseTrait',
  'TemporaryDiscountTrait',
  'TemporaryHealExpirationTrait',
  'TemporaryDoorHealTrait',
  'LastStandShopItem',
  'EmptyMaxHealthShopItem',
  'HealDropRange',
  'MetaCurrencyRange',
  'MetaCardPointsCommonRange',
  'MemPointsCommonRange',
  'SeedMysteryRange',
] as const;
function wellOption(
  key: string,
  label: string,
  rewardType: string,
  effect: NonNullable<RawShopOptionEntryDeclaration['stygianWell']>['effect'] = 'neutral',
  extra: Omit<RawShopOptionEntryDeclaration, 'key' | 'rewardType' | 'stygianWell'> & {
    readonly stygianWell?: Omit<
      NonNullable<RawShopOptionEntryDeclaration['stygianWell']>,
      'effect'
    >;
  } = {},
) {
  return option({
    key,
    label,
    rewardType,
    ...extra,
    stygianWell: { effect, ...extra.stygianWell },
  });
}

export const shops = [
  // RoomShop is the game's Stygian Well profile, kept separate because its
  // options are immediate paid effects, not World-Shop reward acquisition. The option key is the game
  // identity consumed by the Well simulation; neutral effects deliberately
  // share a neutral reward representation for the current planner scope.
  {
    key: 'RoomShop',
    groups: [
      {
        key: 'Healing',
        offerCount: 1,
        options: [
          wellOption('ArmorBoostStore', 'Splintered Shield', 'ArmorBoost', 'neutral', {
            runtimeOfferFallbackRewardTypes: ['MaxHealthDrop'],
          }),
          wellOption('DamageSelfDrop', 'Price of Midas', 'RoomMoneyDrop'),
          wellOption('HealDropRange', 'Life Essence', 'RoomRewardHealDrop'),
          wellOption('EmptyMaxHealthShopItem', 'Centaur Soul', 'MaxHealthDrop'),
          wellOption('FirstHitHealTrait', 'Breath of Eros', 'RoomRewardHealDrop'),
          wellOption('TemporaryDoorHealTrait', 'HydraLite', 'RoomRewardHealDrop'),
          wellOption('TemporaryHealExpirationTrait', 'Charity Bottle', 'RoomRewardHealDrop'),
          wellOption('LastStandShopItem', 'Kiss of Styx', 'LastStandDrop', 'lastStand', {
            runtimeOfferRequirement: 'missingLastStand',
            runtimeOfferFallbackRewardTypes: ['ArmorBoost'],
          }),
        ],
      },
      {
        key: 'Other',
        offerCount: 2,
        options: [
          wellOption('TemporaryImprovedSecondaryTrait', 'Chimaera Jerky', 'RoomMoneyDrop'),
          wellOption('TemporaryImprovedCastTrait', 'Braid of Atlas', 'RoomMoneyDrop'),
          wellOption('TemporaryMoveSpeedTrait', 'Ignited Ichor', 'RoomMoneyDrop'),
          wellOption('TemporaryBoonRarityTrait', 'Yarn of Ariadne', 'RandomLoot', 'yarn'),
          wellOption('TemporaryImprovedExTrait', "Witch's Mark", 'RoomMoneyDrop'),
          wellOption('TemporaryImprovedDefenseTrait', 'Python Scales', 'RoomMoneyDrop'),
          wellOption('TemporaryDiscountTrait', 'Ferry Voucher', 'RoomMoneyDrop', 'discount', {
            stygianWell: { offerRequirements: ['inactive'] },
          }),
          wellOption('TemporaryForcedSecretDoorTrait', 'Spark of Ixion', 'RoomMoneyDrop', 'spark'),
          wellOption(
            'TemporaryEmptySlotDamageTrait',
            'Danaid Dagger',
            'RoomMoneyDrop',
            'emptySlot',
            {
              stygianWell: { offerRequirements: ['inactive', 'emptyAttackOrSpecial'] },
            },
          ),
          wellOption('ExtendedShopTrait', 'Archaic Seal', 'RoomMoneyDrop', 'extended', {
            stygianWell: { extendedDirectPurchaseItemKeys: extendedWellItemKeys },
          }),
          wellOption('MetaCurrencyRange', 'Exhumed Remains', 'MetaCurrencyDrop'),
          wellOption('MetaCardPointsCommonRange', 'Dust Parcel', 'MetaCardPointsCommonDrop'),
          wellOption('MemPointsCommonRange', 'Faint Flicker', 'RoomMoneyDrop'),
          wellOption('SeedMysteryRange', "Gaia's Gift", 'RoomMoneyDrop'),
          wellOption('RandomStoreItem', 'Fateful Twist', 'RoomMoneyDrop', 'twist', {
            stygianWell: {
              nestedResultItemKeys: twistWellItemKeys,
              nestedRuntimeOfferFallbacks: [
                {
                  preferredItemKey: 'LastStandShopItem',
                  fallbackItemKey: 'EmptyMaxHealthShopItem',
                },
              ],
            },
          }),
          wellOption('LimitedManaRegenDrop', 'Mist Veil', 'MaxManaDrop'),
          wellOption('LimitedSwapTraitDrop', 'Sacrificial Hymn', 'RoomMoneyDrop', 'hymn'),
        ],
      },
    ],
    slots: [
      { key: 'healing', label: 'Offer 1', groupKey: 'Healing' },
      { key: 'secondLeft', label: 'Offer 2', groupKey: 'Other' },
      { key: 'secondRight', label: 'Offer 3', groupKey: 'Other' },
    ],
  },
  // SurfaceShop is intentionally a separate declaration-owned profile.  Its
  // inventory is consumed by the Shrine lifecycle rather than by World Shop
  // purchase settlement, but it uses the same normalized slot/pool contract.
  {
    key: 'SurfaceShop',
    groups: [
      {
        key: 'First',
        offerCount: 1,
        options: [
          option({ key: 'HealBigDrop', rewardType: 'HealBigDrop' }),
          option({ key: 'RoomRewardHealDrop', rewardType: 'RoomRewardHealDrop' }),
          option({ key: 'ArmorBigBoost', rewardType: 'ArmorBigBoost' }),
          option({
            key: 'ArmorBoost',
            rewardType: 'ArmorBoost',
            runtimeOfferFallbackRewardTypes: ['ArmorBigBoost'],
          }),
          option({
            key: 'LastStandDrop',
            rewardType: 'LastStandDrop',
            runtimeOfferRequirement: 'missingLastStand',
            // One generated action takes one fallback edge.  The next
            // SurfaceShop generation can independently fall from Armor to
            // Big Armor when Travel Deal cannot repeat the acquired Armor.
            runtimeOfferFallbackRewardTypes: ['ArmorBoost'],
          }),
          option({ key: 'GiftDrop', rewardType: 'GiftDrop' }),
        ],
      },
      {
        key: 'Second',
        offerCount: 2,
        options: [
          option({ key: 'SpellDrop', rewardType: 'SpellDrop', requirement: spellLegal }),
          option({
            key: 'ShopHermesUpgrade',
            rewardType: 'ShopHermesUpgrade',
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          option({ key: 'MaxHealthDrop', rewardType: 'MaxHealthDrop' }),
          option({ key: 'MaxManaDrop', rewardType: 'MaxManaDrop' }),
          option({ key: 'BlindBoxLoot', rewardType: 'BlindBoxLoot' }),
          option({ key: 'TalentDrop', rewardType: 'TalentDrop', requirement: talentLegal }),
        ],
      },
    ],
    slots: [
      { key: 'first', label: 'Offer 1', groupKey: 'First' },
      { key: 'secondLeft', label: 'Offer 2', groupKey: 'Second' },
      { key: 'secondRight', label: 'Offer 3', groupKey: 'Second' },
    ],
  },
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
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
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
          phaseOption(inRunFirstHalf, {
            key: 'RoomRewardHealDrop',
            rewardType: 'RoomRewardHealDrop',
          }),
          phaseOption(inRunFirstHalf, {
            key: 'ArmorBoost',
            rewardType: 'ArmorBoost',
            runtimeOfferFallbackRewardTypes: ['RoomRewardHealDrop'],
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
            runtimeOfferFallbackRewardTypes: ['HealBigDrop'],
          }),
          option({
            key: 'LastStandDrop',
            rewardType: 'LastStandDrop',
            runtimeOfferRequirement: 'missingLastStand',
            runtimeOfferFallbackRewardTypes: ['ArmorBoost', 'ArmorBigBoost'],
          }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'WeaponUpgradeDrop',
            rewardType: 'WeaponUpgradeDrop',
            purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
            requirement: hammerEarly,
          }),
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'BlindBoxLoot',
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ShopHermesUpgrade',
            rewardType: 'ShopHermesUpgrade',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ChaosWeaponUpgrade',
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxHealthDropBig',
            rewardType: 'MaxHealthDropBig',
          }),
          phaseOption(inRunSecondHalf, {
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
          phaseOption(inRunFirstHalf, {
            key: 'StackUpgrade',
            rewardType: 'StackUpgrade',
            requirement: stackLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'StackUpgradeBig',
            rewardType: 'StackUpgradeBig',
            requirement: stackLegal,
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
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
          }),
        ],
      },
      {
        key: 'Survival',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'RoomRewardHealDrop',
            rewardType: 'RoomRewardHealDrop',
          }),
          phaseOption(inRunFirstHalf, {
            key: 'ArmorBoost',
            rewardType: 'ArmorBoost',
            runtimeOfferFallbackRewardTypes: ['RoomRewardHealDrop'],
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
            runtimeOfferFallbackRewardTypes: ['HealBigDrop'],
          }),
          option({
            key: 'LastStandDrop',
            rewardType: 'LastStandDrop',
            runtimeOfferRequirement: 'missingLastStand',
            runtimeOfferFallbackRewardTypes: ['ArmorBoost', 'ArmorBigBoost'],
          }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'WeaponUpgradeDrop',
            rewardType: 'WeaponUpgradeDrop',
            purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
            requirement: hammerEarly,
          }),
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ShopHermesUpgrade',
            rewardType: 'ShopHermesUpgrade',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ChaosWeaponUpgrade',
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxHealthDropBig',
            rewardType: 'MaxHealthDropBig',
          }),
          phaseOption(inRunSecondHalf, {
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
