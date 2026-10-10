import {
  chaosHammerLegal,
  hammerEarly,
  hammerLate,
  hubSpellDropExcludes,
  transitionSpellDropExcludes,
  hubWeaponUpgradeExcludes,
  inRunFirstHalf,
  inRunSecondHalf,
  routeTalentLegal,
  shopHermesLegal,
  spellLegal,
  stackLegal,
  talentLegal,
} from './requirements';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { StygianWellGrant } from '@run-planner/engine/reward-kernel';
import { notFreshFileRoute } from '../routes';

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

const dreamRoute: RequirementExpression = { kind: 'routeKeyEquals', routeKey: 'Dream' };
/** Only the Hermes shrine Spell Drop excludes a hero holding Aspect of Selene. */
const notSeleneAspect: RequirementExpression = {
  kind: 'not',
  requirement: { kind: 'equippedAspectEquals', aspectKey: 'SuitHexAspect' },
};

function routeOption(
  routeRequirement: RequirementExpression,
  declaration: RawShopOptionEntryDeclaration,
): RawShopOptionEntryDeclaration {
  return option({
    ...declaration,
    requirement:
      declaration.requirement === undefined
        ? routeRequirement
        : { kind: 'all', requirements: [routeRequirement, declaration.requirement] },
  });
}

function dreamOption(declaration: RawShopOptionEntryDeclaration): RawShopOptionEntryDeclaration {
  return routeOption(dreamRoute, declaration);
}

function ordinaryRouteOption(
  declaration: RawShopOptionEntryDeclaration,
): RawShopOptionEntryDeclaration {
  return routeOption({ kind: 'not', requirement: dreamRoute }, declaration);
}

/** An item whose native gate needs progression a fresh profile's first attempt cannot reach. */
function matureSaveOption(
  declaration: RawShopOptionEntryDeclaration,
): RawShopOptionEntryDeclaration {
  return routeOption(notFreshFileRoute, declaration);
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
      matureSaveOption({
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
        requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
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
      matureSaveOption({
        key: 'ArmorBoost',
        rewardType: 'ArmorBoost',
      }),
      ordinaryRouteOption({
        key: 'MetaCardPointsCommonDrop',
        rewardType: 'MetaCardPointsCommonDrop',
      }),
      ordinaryRouteOption({
        key: 'MetaCurrencyDrop',
        rewardType: 'MetaCurrencyDrop',
      }),
      matureSaveOption(
        ordinaryRouteOption({
          key: 'GiftDrop',
          rewardType: 'GiftDrop',
        }),
      ),
      dreamOption({ key: 'FireBoost', rewardType: 'FireBoost' }),
      dreamOption({ key: 'AirBoost', rewardType: 'AirBoost' }),
      dreamOption({ key: 'EarthBoost', rewardType: 'EarthBoost' }),
      dreamOption({ key: 'WaterBoost', rewardType: 'WaterBoost' }),
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
        requirement: {
          kind: 'all',
          requirements: [spellLegal, hubSpellDropExcludes, transitionSpellDropExcludes],
        },
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
  // Each needs a lifetime gain of its resource, which F–I never provide on a fresh profile.
  matureSaveOption(
    ordinaryRouteOption({
      key: 'WeaponPointsRareDrop',
      rewardType: 'WeaponPointsRareDrop',
    }),
  ),
  matureSaveOption(
    ordinaryRouteOption({
      key: 'CardUpgradePointsDrop',
      rewardType: 'CardUpgradePointsDrop',
    }),
  ),
  matureSaveOption(
    ordinaryRouteOption({
      key: 'CharonPointsDrop',
      rewardType: 'CharonPointsDrop',
    }),
  ),
  dreamOption({ key: 'ElementalBoost', rewardType: 'ElementalBoost' }),
];

// TraitData_Store ExtendedShopTrait.ValidPermanentItemsLookup.
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
// ConsumableData RandomStoreItem Traits and Consumables.
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
type WellExtra = Omit<RawShopOptionEntryDeclaration, 'key' | 'rewardType' | 'stygianWell'> & {
  readonly stygianWell?: Omit<NonNullable<RawShopOptionEntryDeclaration['stygianWell']>, 'grant'>;
};
function wellOption(
  key: string,
  label: string,
  rewardType: string,
  grant: StygianWellGrant,
  extra: WellExtra = {},
) {
  return option({ key, label, rewardType, ...extra, stygianWell: { grant, ...extra.stygianWell } });
}
/** TraitData_Store `RemainingUses` with its `UsesAs*` clock; the trait key is the item key. */
function timedTrait(
  traitKey: string,
  initialUses: number,
  clock: 'encounters' | 'rooms',
  publishedEffect?: 'discount' | 'emptySlot',
): StygianWellGrant {
  return {
    kind: 'timedTrait',
    traitKey,
    initialUses,
    clock,
    ...(publishedEffect === undefined ? {} : { publishedEffect }),
  };
}
const ledger: StygianWellGrant = { kind: 'ledger' };
const immediate: StygianWellGrant = { kind: 'immediate' };

export const shops = [
  // EventLogic.SpawnZagContractRewards generates this free pedestal on room entry.
  // Only the Talent items have modeled run requirements in this native pool.
  {
    key: 'ZagPedestalOptions',
    groups: [
      {
        key: 'Reward',
        offerCount: 1,
        options: [
          option({ key: 'BlindBoxLoot', rewardType: 'BlindBoxLoot' }),
          option({ key: 'StackUpgradeBig', rewardType: 'StackUpgradeBig' }),
          option({ key: 'StackUpgrade', rewardType: 'StackUpgrade' }),
          option({ key: 'TalentBigDrop', rewardType: 'TalentBigDrop', requirement: talentLegal }),
          option({ key: 'TalentDrop', rewardType: 'TalentDrop', requirement: talentLegal }),
        ],
      },
    ],
    slots: [
      { key: 'infernalContractReward', label: 'Champion of Elysium reward', groupKey: 'Reward' },
    ],
  },
  // RoomShop is the game's Stygian Well profile, kept separate because its
  // options are immediate paid effects, not World-Shop reward acquisition. The
  // option key is the game identity; each option declares what it grants.
  {
    key: 'RoomShop',
    groups: [
      {
        key: 'Healing',
        offerCount: 1,
        options: [
          wellOption('ArmorBoostStore', 'Splintered Shield', 'ArmorBoost', ledger),
          wellOption('DamageSelfDrop', 'Price of Midas', 'RoomMoneyDrop', immediate),
          wellOption('HealDropRange', 'Life Essence', 'RoomRewardHealDrop', immediate),
          wellOption('EmptyMaxHealthShopItem', 'Centaur Soul', 'MaxHealthDrop', {
            kind: 'consumable',
            acquisitionGameName: 'EmptyMaxHealthShopItem',
          }),
          wellOption('FirstHitHealTrait', 'Breath of Eros', 'RoomRewardHealDrop', ledger),
          wellOption(
            'TemporaryDoorHealTrait',
            'HydraLite',
            'RoomRewardHealDrop',
            timedTrait('TemporaryDoorHealTrait', 3, 'rooms'),
          ),
          wellOption(
            'TemporaryHealExpirationTrait',
            'Charity Bottle',
            'RoomRewardHealDrop',
            timedTrait('TemporaryHealExpirationTrait', 4, 'encounters'),
          ),
          wellOption('LastStandShopItem', 'Kiss of Styx', 'LastStandDrop', {
            kind: 'consumable',
            acquisitionGameName: 'LastStandShopItem',
            publishedEffect: 'lastStand',
          }),
        ],
      },
      {
        key: 'Other',
        offerCount: 2,
        options: [
          wellOption(
            'TemporaryImprovedSecondaryTrait',
            'Chimaera Jerky',
            'RoomMoneyDrop',
            timedTrait('TemporaryImprovedSecondaryTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryImprovedCastTrait',
            'Braid of Atlas',
            'RoomMoneyDrop',
            timedTrait('TemporaryImprovedCastTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryMoveSpeedTrait',
            'Ignited Ichor',
            'RoomMoneyDrop',
            timedTrait('TemporaryMoveSpeedTrait', 8, 'encounters'),
          ),
          wellOption('TemporaryBoonRarityTrait', 'Yarn of Ariadne', 'RandomLoot', {
            kind: 'charge',
            charge: 'yarn',
          }),
          wellOption(
            'TemporaryImprovedExTrait',
            "Witch's Mark",
            'RoomMoneyDrop',
            timedTrait('TemporaryImprovedExTrait', 6, 'encounters'),
          ),
          wellOption(
            'TemporaryImprovedDefenseTrait',
            'Python Scales',
            'RoomMoneyDrop',
            timedTrait('TemporaryImprovedDefenseTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryDiscountTrait',
            'Ferry Voucher',
            'RoomMoneyDrop',
            timedTrait('TemporaryDiscountTrait', 6, 'encounters', 'discount'),
            { stygianWell: { offerRequirements: ['inactive'] } },
          ),
          wellOption(
            'TemporaryForcedSecretDoorTrait',
            'Spark of Ixion',
            'RoomMoneyDrop',
            { kind: 'charge', charge: 'spark' },
            { stygianWell: { excludedRouteKeys: ['Dream'] } },
          ),
          wellOption(
            'TemporaryEmptySlotDamageTrait',
            'Danaid Dagger',
            'RoomMoneyDrop',
            timedTrait('TemporaryEmptySlotDamageTrait', 6, 'encounters', 'emptySlot'),
            { stygianWell: { offerRequirements: ['inactive', 'emptyAttackOrSpecial'] } },
          ),
          wellOption('ExtendedShopTrait', 'Archaic Seal', 'RoomMoneyDrop', {
            kind: 'charge',
            charge: 'extended',
            eligibleItemKeys: extendedWellItemKeys,
            bossExtension: 2,
          }),
          wellOption('MetaCurrencyRange', 'Exhumed Remains', 'MetaCurrencyDrop', immediate),
          wellOption(
            'MetaCardPointsCommonRange',
            'Dust Parcel',
            'MetaCardPointsCommonDrop',
            immediate,
          ),
          wellOption('MemPointsCommonRange', 'Faint Flicker', 'RoomMoneyDrop', immediate),
          wellOption('SeedMysteryRange', "Gaia's Gift", 'RoomMoneyDrop', immediate),
          wellOption('RandomStoreItem', 'Fateful Twist', 'RoomMoneyDrop', {
            kind: 'twist',
            pool: twistWellItemKeys,
          }),
          wellOption('LimitedManaRegenDrop', 'Mist Veil', 'MaxManaDrop', ledger),
          wellOption('LimitedSwapTraitDrop', 'Sacrificial Hymn', 'RoomMoneyDrop', {
            kind: 'charge',
            charge: 'hymn',
          }),
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
          option({ key: 'ArmorBoost', rewardType: 'ArmorBoost' }),
          option({ key: 'LastStandDrop', rewardType: 'LastStandDrop' }),
          option({ key: 'GiftDrop', rewardType: 'GiftDrop' }),
        ],
      },
      {
        key: 'Second',
        offerCount: 2,
        options: [
          option({
            key: 'SpellDrop',
            rewardType: 'SpellDrop',
            requirement: {
              kind: 'all',
              requirements: [spellLegal, hubSpellDropExcludes, notSeleneAspect],
            },
          }),
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
            label: 'Boosted Boon',
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
          matureSaveOption({
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
            requirement: notFreshFileRoute,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            rewardType: 'ArmorBigBoost',
            requirement: notFreshFileRoute,
          }),
          // A fresh profile has no Death Defiance to refill.
          matureSaveOption({ key: 'LastStandDrop', rewardType: 'LastStandDrop' }),
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
            requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'BlindBoxLoot',
            requirement: notFreshFileRoute,
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
            label: 'Boosted Boon',
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
            label: 'Boosted Boon',
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
          phaseOption(inRunFirstHalf, { key: 'ArmorBoost', rewardType: 'ArmorBoost' }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, { key: 'ArmorBigBoost', rewardType: 'ArmorBigBoost' }),
          option({ key: 'LastStandDrop', rewardType: 'LastStandDrop' }),
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
            requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
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
            label: 'Boosted Boon',
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
