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
import type { ShopOptionCost, StygianWellGrant } from '@run-planner/engine/reward-kernel';
import { notFreshFileRoute } from '../routes';

import type { RawRewardKernelInput, RawShopOptionEntryDeclaration } from './types';

const boostedBoonRarity = { Rare: 0.9, Epic: 0.25, Legendary: 0.1 } as const;

/**
 * A base price: the item's `ResourceCosts.Money` (ConsumableData, TraitData_Store,
 * LootData) unless the StoreData entry overrides it with `Cost`.
 */
function gold(amount: number): ShopOptionCost {
  return { kind: 'fixed', gold: amount };
}
/** A Well item priced from an amount rolled when it is stocked. */
function rolledGold(min: number, max: number, step: number): ShopOptionCost {
  return { kind: 'uniform', min, max, step };
}

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
        cost: gold(150),
        rewardType: 'RandomLoot',
        purchaseInteraction: { kind: 'resolvedOfferSource' },
      }),
      matureSaveOption({
        key: 'BlindBoxLoot',
        cost: gold(125),
        rewardType: 'BlindBoxLoot',
        acquisitionLifecycle: [
          { role: 'box', lifecyclePoint: 'purchase' },
          { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
        ],
      }),
      option({
        key: 'ShopHermesUpgrade',
        cost: gold(150),
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
        cost: gold(200),
        rewardType: 'WeaponUpgradeDrop',
        purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
        requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
      }),
      option({
        key: 'WeaponUpgradeDropLate',
        cost: gold(200),
        rewardType: 'WeaponUpgradeDrop',
        purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
        requirement: hammerLate,
      }),
      option({
        key: 'RoomRewardHealDrop',
        cost: gold(50),
        rewardType: 'RoomRewardHealDrop',
      }),
      option({
        key: 'MaxHealthDrop',
        cost: gold(125),
        rewardType: 'MaxHealthDrop',
      }),
      matureSaveOption({
        key: 'ArmorBoost',
        cost: gold(40),
        rewardType: 'ArmorBoost',
      }),
      ordinaryRouteOption({
        key: 'MetaCardPointsCommonDrop',
        cost: gold(50),
        rewardType: 'MetaCardPointsCommonDrop',
      }),
      ordinaryRouteOption({
        key: 'MetaCurrencyDrop',
        cost: gold(90),
        rewardType: 'MetaCurrencyDrop',
      }),
      matureSaveOption(
        ordinaryRouteOption({
          key: 'GiftDrop',
          cost: gold(75),
          rewardType: 'GiftDrop',
        }),
      ),
      dreamOption({ key: 'FireBoost', cost: gold(20), rewardType: 'FireBoost' }),
      dreamOption({ key: 'AirBoost', cost: gold(20), rewardType: 'AirBoost' }),
      dreamOption({ key: 'EarthBoost', cost: gold(20), rewardType: 'EarthBoost' }),
      dreamOption({ key: 'WaterBoost', cost: gold(20), rewardType: 'WaterBoost' }),
    ],
  },
  {
    key: 'Minor',
    offerCount: 1,
    options: [
      option({
        key: 'MaxManaDrop',
        cost: gold(100),
        rewardType: 'MaxManaDrop',
      }),
      option({
        key: 'StackUpgrade',
        cost: gold(100),
        rewardType: 'StackUpgrade',
        requirement: stackLegal,
      }),
      option({
        key: 'StoreRewardRandomStack',
        cost: gold(50),
        rewardType: 'StoreRewardRandomStack',
        requirement: stackLegal,
      }),
      option({
        key: 'SpellDrop',
        cost: gold(100),
        rewardType: 'SpellDrop',
        requirement: {
          kind: 'all',
          requirements: [spellLegal, hubSpellDropExcludes, transitionSpellDropExcludes],
        },
      }),
      option({
        key: 'TalentDrop',
        cost: gold(60),
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
      cost: gold(1300),
      rewardType: 'WeaponPointsRareDrop',
    }),
  ),
  matureSaveOption(
    ordinaryRouteOption({
      key: 'CardUpgradePointsDrop',
      cost: gold(1000),
      rewardType: 'CardUpgradePointsDrop',
    }),
  ),
  matureSaveOption(
    ordinaryRouteOption({
      key: 'CharonPointsDrop',
      cost: gold(600),
      rewardType: 'CharonPointsDrop',
    }),
  ),
  dreamOption({ key: 'ElementalBoost', cost: gold(40), rewardType: 'ElementalBoost' }),
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
  cost: ShopOptionCost,
  grant: StygianWellGrant,
  extra: WellExtra = {},
) {
  return option({
    key,
    label,
    rewardType,
    cost,
    ...extra,
    stygianWell: { grant, ...extra.stygianWell },
  });
}
/** TraitData_Store `RemainingUses` with its `UsesAs*` clock; the trait key is the item key. */
function timedTrait(
  traitKey: string,
  initialUses: number,
  clock: 'encounters' | 'rooms',
  publishedEffect?: 'discount' | 'emptySlot',
  priceMultiplier?: number,
): StygianWellGrant {
  return {
    kind: 'timedTrait',
    traitKey,
    initialUses,
    clock,
    ...(publishedEffect === undefined ? {} : { publishedEffect }),
    ...(priceMultiplier === undefined ? {} : { priceMultiplier }),
  };
}
const ledger: StygianWellGrant = { kind: 'ledger' };
const immediate: StygianWellGrant = { kind: 'immediate' };

export const shops = [
  // EventLogic.SpawnZagContractRewards generates this free pedestal on room entry.
  // Only the Talent items have modeled run requirements in this native pool.
  {
    key: 'ZagPedestalOptions',
    screenReroll: false,
    pricing: { kind: 'free' },
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
    // The Well screen's reroll button (StoreData WellShop).
    screenReroll: true,
    pricing: { kind: 'gold' },
    groups: [
      {
        key: 'Healing',
        offerCount: 1,
        options: [
          wellOption('ArmorBoostStore', 'Splintered Shield', 'ArmorBoost', gold(40), {
            kind: 'consumable',
            acquisitionGameName: 'ArmorBoostStore',
          }),
          // ConsumableData.lua:1329-1347 HealthCost 10-30 AsInt, PayoutPerHealthPoint 1.1-1.8;
          // InteractLogic.lua:1233-1238 DropMoney = round(PayoutPerHealthPoint x HealthCost).
          wellOption('DamageSelfDrop', 'Price of Midas', 'RoomMoneyDrop', gold(0), immediate, {
            goldPayout: {
              healthCost: { min: 10, max: 30 },
              goldPerHealthHundredths: { min: 110, max: 180 },
            },
          }),
          wellOption(
            'HealDropRange',
            'Life Essence',
            'RoomRewardHealDrop',
            rolledGold(21, 39, 1),
            immediate,
          ),
          wellOption('EmptyMaxHealthShopItem', 'Centaur Soul', 'MaxHealthDrop', gold(110), {
            kind: 'consumable',
            acquisitionGameName: 'EmptyMaxHealthShopItem',
          }),
          wellOption('FirstHitHealTrait', 'Breath of Eros', 'RoomRewardHealDrop', gold(15), ledger),
          wellOption(
            'TemporaryDoorHealTrait',
            'HydraLite',
            'RoomRewardHealDrop',
            gold(45),
            timedTrait('TemporaryDoorHealTrait', 3, 'rooms'),
          ),
          wellOption(
            'TemporaryHealExpirationTrait',
            'Charity Bottle',
            'RoomRewardHealDrop',
            gold(115),
            timedTrait('TemporaryHealExpirationTrait', 4, 'encounters'),
          ),
          wellOption('LastStandShopItem', 'Kiss of Styx', 'LastStandDrop', gold(200), {
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
            gold(35),
            timedTrait('TemporaryImprovedSecondaryTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryImprovedCastTrait',
            'Braid of Atlas',
            'RoomMoneyDrop',
            gold(30),
            timedTrait('TemporaryImprovedCastTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryMoveSpeedTrait',
            'Ignited Ichor',
            'RoomMoneyDrop',
            gold(10),
            timedTrait('TemporaryMoveSpeedTrait', 8, 'encounters'),
          ),
          wellOption('TemporaryBoonRarityTrait', 'Yarn of Ariadne', 'RandomLoot', gold(70), {
            kind: 'charge',
            charge: 'yarn',
          }),
          wellOption(
            'TemporaryImprovedExTrait',
            "Witch's Mark",
            'RoomMoneyDrop',
            gold(45),
            timedTrait('TemporaryImprovedExTrait', 6, 'encounters'),
          ),
          wellOption(
            'TemporaryImprovedDefenseTrait',
            'Python Scales',
            'RoomMoneyDrop',
            gold(30),
            timedTrait('TemporaryImprovedDefenseTrait', 5, 'encounters'),
          ),
          wellOption(
            'TemporaryDiscountTrait',
            'Ferry Voucher',
            'RoomMoneyDrop',
            gold(80),
            timedTrait('TemporaryDiscountTrait', 6, 'encounters', 'discount', 0.7),
            { stygianWell: { offerRequirements: ['inactive'] } },
          ),
          wellOption(
            'TemporaryForcedSecretDoorTrait',
            'Spark of Ixion',
            'RoomMoneyDrop',
            gold(55),
            { kind: 'charge', charge: 'spark' },
            { stygianWell: { excludedRouteKeys: ['Dream'] } },
          ),
          wellOption(
            'TemporaryEmptySlotDamageTrait',
            'Danaid Dagger',
            'RoomMoneyDrop',
            gold(10),
            timedTrait('TemporaryEmptySlotDamageTrait', 6, 'encounters', 'emptySlot'),
            { stygianWell: { offerRequirements: ['inactive', 'emptyAttackOrSpecial'] } },
          ),
          wellOption('ExtendedShopTrait', 'Archaic Seal', 'RoomMoneyDrop', gold(90), {
            kind: 'charge',
            charge: 'extended',
            eligibleItemKeys: extendedWellItemKeys,
            bossExtension: 2,
          }),
          wellOption(
            'MetaCurrencyRange',
            'Exhumed Remains',
            'MetaCurrencyDrop',
            rolledGold(40, 80, 2),
            immediate,
          ),
          wellOption(
            'MetaCardPointsCommonRange',
            'Dust Parcel',
            'MetaCardPointsCommonDrop',
            rolledGold(30, 60, 5),
            immediate,
          ),
          wellOption(
            'MemPointsCommonRange',
            'Faint Flicker',
            'RoomMoneyDrop',
            rolledGold(20, 30, 1),
            immediate,
          ),
          wellOption('SeedMysteryRange', "Gaia's Gift", 'RoomMoneyDrop', gold(30), immediate),
          wellOption('RandomStoreItem', 'Fateful Twist', 'RoomMoneyDrop', gold(45), {
            kind: 'twist',
            pool: twistWellItemKeys,
          }),
          wellOption('LimitedManaRegenDrop', 'Mist Veil', 'MaxManaDrop', gold(10), ledger),
          wellOption('LimitedSwapTraitDrop', 'Sacrificial Hymn', 'RoomMoneyDrop', gold(25), {
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
    // The Hermes Shrine screen has no reroll button.
    screenReroll: false,
    // SurfaceShopData DelayPriceDiscount (delays 1-8) and ImpatienceMultiplier.
    pricing: {
      kind: 'delayedDelivery',
      delayPriceFactors: [1.3, 1.2, 1.1, 1.0, 0.9, 0.8, 0.7, 0.6],
      rushPriceMultiplier: 1.5,
    },
    groups: [
      {
        key: 'First',
        offerCount: 1,
        options: [
          option({ key: 'HealBigDrop', cost: gold(90), rewardType: 'HealBigDrop' }),
          option({ key: 'RoomRewardHealDrop', cost: gold(50), rewardType: 'RoomRewardHealDrop' }),
          option({ key: 'ArmorBigBoost', cost: gold(80), rewardType: 'ArmorBigBoost' }),
          option({ key: 'ArmorBoost', cost: gold(40), rewardType: 'ArmorBoost' }),
          option({ key: 'LastStandDrop', cost: gold(200), rewardType: 'LastStandDrop' }),
          option({ key: 'GiftDrop', cost: gold(75), rewardType: 'GiftDrop' }),
        ],
      },
      {
        key: 'Second',
        offerCount: 2,
        options: [
          option({
            key: 'SpellDrop',
            cost: gold(100),
            rewardType: 'SpellDrop',
            requirement: {
              kind: 'all',
              requirements: [spellLegal, hubSpellDropExcludes, notSeleneAspect],
            },
          }),
          option({
            key: 'ShopHermesUpgrade',
            cost: gold(150),
            rewardType: 'ShopHermesUpgrade',
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            requirement: shopHermesLegal,
          }),
          option({ key: 'MaxHealthDrop', cost: gold(125), rewardType: 'MaxHealthDrop' }),
          option({ key: 'MaxManaDrop', cost: gold(100), rewardType: 'MaxManaDrop' }),
          option({ key: 'BlindBoxLoot', cost: gold(125), rewardType: 'BlindBoxLoot' }),
          option({
            key: 'TalentDrop',
            cost: gold(60),
            rewardType: 'TalentDrop',
            requirement: talentLegal,
          }),
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
    // World items, not a screen.
    screenReroll: false,
    pricing: { kind: 'gold' },
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
    screenReroll: false,
    pricing: { kind: 'gold' },
    groups: [
      {
        key: 'BoostedBoon',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            cost: gold(450),
            label: 'Boosted Boon',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'StackUpgradeBig',
            cost: gold(300),
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
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          matureSaveOption({
            key: 'BlindBoxLoot',
            cost: gold(125),
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          option({
            key: 'MaxHealthDrop',
            cost: gold(125),
            rewardType: 'MaxHealthDrop',
          }),
          option({
            key: 'MaxManaDrop',
            cost: gold(100),
            rewardType: 'MaxManaDrop',
          }),
          option({
            key: 'StackUpgrade',
            cost: gold(100),
            rewardType: 'StackUpgrade',
            requirement: stackLegal,
          }),
          option({
            key: 'TalentDrop',
            cost: gold(60),
            rewardType: 'TalentDrop',
            requirement: talentLegal,
          }),
          option({
            key: 'SpellDrop',
            cost: gold(100),
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
            cost: gold(50),
            rewardType: 'RoomRewardHealDrop',
          }),
          phaseOption(inRunFirstHalf, {
            key: 'ArmorBoost',
            cost: gold(40),
            rewardType: 'ArmorBoost',
            requirement: notFreshFileRoute,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            cost: gold(90),
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            cost: gold(80),
            rewardType: 'ArmorBigBoost',
            requirement: notFreshFileRoute,
          }),
          // A fresh profile has no Death Defiance to refill.
          matureSaveOption({ key: 'LastStandDrop', cost: gold(200), rewardType: 'LastStandDrop' }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'WeaponUpgradeDrop',
            cost: gold(200),
            rewardType: 'WeaponUpgradeDrop',
            purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
            requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'BlindBoxLoot',
            cost: gold(125),
            requirement: notFreshFileRoute,
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ShopHermesUpgrade',
            cost: gold(500),
            rewardType: 'ShopHermesUpgrade',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            // StoreData replaces Hermes's own requirements here: only HermesFirstPickUp remains.
            requirement: notFreshFileRoute,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ChaosWeaponUpgrade',
            cost: gold(650),
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            cost: gold(450),
            label: 'Boosted Boon',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxHealthDropBig',
            cost: gold(250),
            rewardType: 'MaxHealthDropBig',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxManaDropBig',
            cost: gold(200),
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
    screenReroll: false,
    pricing: { kind: 'gold' },
    groups: [
      {
        key: 'MixedProgress',
        offerCount: 2,
        options: [
          option({
            key: 'RandomLoot',
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          option({
            key: 'BlindBoxLoot',
            cost: gold(125),
            rewardType: 'BlindBoxLoot',
            acquisitionLifecycle: [
              { role: 'box', lifecyclePoint: 'purchase' },
              { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
            ],
          }),
          phaseOption(inRunFirstHalf, {
            key: 'StackUpgrade',
            cost: gold(100),
            rewardType: 'StackUpgrade',
            requirement: stackLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            cost: gold(450),
            label: 'Boosted Boon',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'StackUpgradeBig',
            cost: gold(300),
            rewardType: 'StackUpgradeBig',
            requirement: stackLegal,
          }),
          option({
            key: 'MaxHealthDrop',
            cost: gold(125),
            rewardType: 'MaxHealthDrop',
          }),
          option({
            key: 'MaxManaDrop',
            cost: gold(100),
            rewardType: 'MaxManaDrop',
          }),
          option({
            key: 'TalentDrop',
            cost: gold(60),
            rewardType: 'TalentDrop',
            requirement: talentLegal,
          }),
          option({
            key: 'SpellDrop',
            cost: gold(100),
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
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            cost: gold(90),
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            cost: gold(80),
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
            cost: gold(50),
            rewardType: 'RoomRewardHealDrop',
          }),
          phaseOption(inRunFirstHalf, {
            key: 'ArmorBoost',
            cost: gold(40),
            rewardType: 'ArmorBoost',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'HealBigDrop',
            cost: gold(90),
            rewardType: 'HealBigDrop',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ArmorBigBoost',
            cost: gold(80),
            rewardType: 'ArmorBigBoost',
          }),
          option({ key: 'LastStandDrop', cost: gold(200), rewardType: 'LastStandDrop' }),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          phaseOption(inRunFirstHalf, {
            key: 'WeaponUpgradeDrop',
            cost: gold(200),
            rewardType: 'WeaponUpgradeDrop',
            purchaseInteraction: { kind: 'fixed', gameName: 'WeaponUpgrade' },
            requirement: { kind: 'all', requirements: [hammerEarly, hubWeaponUpgradeExcludes] },
          }),
          phaseOption(inRunFirstHalf, {
            key: 'RandomLoot',
            cost: gold(150),
            rewardType: 'RandomLoot',
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ShopHermesUpgrade',
            cost: gold(500),
            rewardType: 'ShopHermesUpgrade',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'fixed', gameName: 'HermesUpgrade' },
            // StoreData replaces Hermes's own requirements here: only HermesFirstPickUp remains.
            requirement: notFreshFileRoute,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'ChaosWeaponUpgrade',
            cost: gold(650),
            rewardType: 'ChaosWeaponUpgrade',
            requirement: chaosHammerLegal,
          }),
          phaseOption(inRunSecondHalf, {
            key: 'BoostedRandomLoot',
            cost: gold(450),
            label: 'Boosted Boon',
            rewardType: 'RandomLoot',
            boonRarityOverride: boostedBoonRarity,
            purchaseInteraction: { kind: 'resolvedOfferSource' },
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxHealthDropBig',
            cost: gold(250),
            rewardType: 'MaxHealthDropBig',
          }),
          phaseOption(inRunSecondHalf, {
            key: 'MaxManaDropBig',
            cost: gold(200),
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
