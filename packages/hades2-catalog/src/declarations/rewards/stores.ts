import {
  devotionLegal,
  hammerEarly,
  hammerLate,
  hermesLootLegal,
  largeEnteredBiomes,
  ordinaryLootCount,
  routeTalentLegal,
  runDevotionLegal,
  smallEnteredBiomes,
  spellLegal,
  stackLegal,
  talentLegal,
} from './requirements';
import type { RawRewardKernelInput } from './types';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import { notFreshFileRoute } from '../routes';

const gained = (resourceKey: string, range: { readonly min?: number; readonly max?: number }) =>
  ({
    kind: 'recordCount',
    record: 'resourceGains',
    keys: [resourceKey],
    range,
  }) as const satisfies RequirementExpression;

// Lifetime gains a fresh profile accumulates; a mature save is past every threshold.
const bonesUnlocked = gained('MetaCardPointsCommon', { min: 5 });
const highTierReached: RequirementExpression = {
  kind: 'all',
  requirements: [
    gained('MetaCurrency', { min: 500 }),
    gained('MetaCardPointsCommon', { min: 100 }),
  ],
};
const earlyBones: RequirementExpression = {
  kind: 'all',
  requirements: [
    smallEnteredBiomes,
    { kind: 'any', requirements: [notFreshFileRoute, bonesUnlocked] },
  ],
};
const lateLowTier: RequirementExpression = {
  kind: 'all',
  requirements: [largeEnteredBiomes, { kind: 'not', requirement: highTierReached }],
};
const lateLowTierBones: RequirementExpression = {
  kind: 'all',
  requirements: [bonesUnlocked, lateLowTier],
};
const lateHighTier: RequirementExpression = {
  kind: 'all',
  requirements: [
    largeEnteredBiomes,
    { kind: 'any', requirements: [notFreshFileRoute, highTierReached] },
  ],
};

const runProgressEntries = [
  { rewardType: 'MaxHealthDrop' },
  { rewardType: 'MaxHealthDrop', requirement: ordinaryLootCount },
  { rewardType: 'MaxManaDrop' },
  { rewardType: 'MaxManaDrop', requirement: ordinaryLootCount },
  { rewardType: 'RoomMoneyDrop' },
  { rewardType: 'RoomMoneyDrop', requirement: ordinaryLootCount },
  { rewardType: 'StackUpgrade', requirement: stackLegal },
  {
    rewardType: 'StackUpgrade',
    requirement: { kind: 'all', requirements: [stackLegal, ordinaryLootCount] },
  },
  { rewardType: 'WeaponUpgrade', requirement: hammerEarly },
  { rewardType: 'WeaponUpgrade', requirement: hammerLate },
  { rewardType: 'HermesUpgrade', requirement: hermesLootLegal },
  { rewardType: 'Devotion', requirement: runDevotionLegal },
  { rewardType: 'SpellDrop', requirement: spellLegal },
  { rewardType: 'TalentDrop', requirement: routeTalentLegal },
  { rewardType: 'Boon', allowDuplicates: true },
  { rewardType: 'Boon', allowDuplicates: true },
  { rewardType: 'Boon', allowDuplicates: true },
  { rewardType: 'Boon', allowDuplicates: true },
] as const;

export const stores = [
  {
    key: 'RunProgress',
    entries: runProgressEntries,
    interchangeableRewardTypes: ['MaxHealthDrop', 'MaxManaDrop', 'RoomMoneyDrop', 'StackUpgrade'],
  },
  {
    // The native store with its lifetime-resource tiers. A mature save is past
    // every tier, so the low tier's late entries sit only in a fresh bag.
    key: 'MetaProgress',
    entries: [
      { rewardType: 'GiftDrop', requirement: notFreshFileRoute },
      { rewardType: 'MetaCurrencyDrop', requirement: earlyBones },
      { rewardType: 'MetaCurrencyDrop', requirement: earlyBones },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCurrencyDrop', requirement: lateLowTierBones, routeKeys: ['FreshFile'] },
      { rewardType: 'MetaCurrencyDrop', requirement: lateLowTierBones, routeKeys: ['FreshFile'] },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: lateLowTier,
        routeKeys: ['FreshFile'],
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: lateLowTier,
        routeKeys: ['FreshFile'],
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: lateLowTier,
        routeKeys: ['FreshFile'],
      },
      {
        rewardType: 'MetaCardPointsCommonDrop',
        requirement: lateLowTier,
        routeKeys: ['FreshFile'],
      },
      { rewardType: 'MetaCurrencyBigDrop', requirement: lateHighTier },
      { rewardType: 'MetaCurrencyBigDrop', requirement: lateHighTier },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: lateHighTier },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: lateHighTier },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: lateHighTier },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: lateHighTier },
    ],
  },
  {
    key: 'HubRewards',
    entries: [
      { rewardType: 'MaxHealthDropBig' },
      { rewardType: 'MaxManaDropBig' },
      { rewardType: 'WeaponUpgrade', requirement: hammerEarly },
      { rewardType: 'HermesUpgrade', requirement: hermesLootLegal },
      { rewardType: 'SpellDrop', requirement: spellLegal },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
    ],
  },
  {
    key: 'SubRoomRewards',
    entries: [
      { rewardType: 'MaxManaDropSmall' },
      { rewardType: 'MaxHealthDropSmall' },
      { rewardType: 'EmptyMaxHealthSmallDrop' },
      { rewardType: 'RoomMoneyTinyDrop' },
      { rewardType: 'AirBoost' },
      { rewardType: 'EarthBoost' },
      { rewardType: 'FireBoost' },
      { rewardType: 'WaterBoost' },
      { rewardType: 'GiftDrop' },
      { rewardType: 'MetaCurrencyDrop' },
      { rewardType: 'MetaCurrencyDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'StackUpgrade', requirement: stackLegal },
      { rewardType: 'StackUpgrade', requirement: stackLegal },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'MinorTalentDrop', requirement: talentLegal },
      { rewardType: 'MinorTalentDrop', requirement: talentLegal },
    ],
  },
  {
    key: 'SubRoomRewardsHard',
    entries: [
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'MaxHealthDrop' },
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'MaxManaDrop' },
      { rewardType: 'StackUpgrade', requirement: stackLegal },
      { rewardType: 'StackUpgrade', requirement: stackLegal },
      { rewardType: 'RoomMoneyDrop' },
      { rewardType: 'RoomMoneyDrop' },
    ],
  },
  {
    key: 'FieldsOptionalRewards',
    entries: [
      { rewardType: 'MaxManaDropSmall' },
      { rewardType: 'MaxManaDropSmall' },
      { rewardType: 'MaxManaDropSmall' },
      { rewardType: 'MaxHealthDropSmall' },
      { rewardType: 'MaxHealthDropSmall' },
      { rewardType: 'MaxHealthDropSmall' },
      { rewardType: 'RoomMoneyTinyDrop' },
      { rewardType: 'RoomMoneyTinyDrop' },
      { rewardType: 'RoomMoneyTinyDrop' },
      { rewardType: 'RoomRewardHealDrop' },
      { rewardType: 'ArmorBoost' },
      { rewardType: 'GiftDrop' },
      { rewardType: 'MetaCurrencyDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MetaCardPointsCommonDrop' },
      { rewardType: 'MinorTalentDrop', requirement: talentLegal },
      { rewardType: 'MinorTalentDrop', requirement: talentLegal },
    ],
  },
  {
    key: 'TartarusRewards',
    entries: [
      { rewardType: 'RoomMoneyTripleDrop' },
      { rewardType: 'StackUpgradeTriple', requirement: stackLegal },
      { rewardType: 'WeaponUpgrade', requirement: hammerEarly },
      { rewardType: 'WeaponUpgrade', requirement: hammerLate },
      { rewardType: 'Devotion', requirement: devotionLegal },
      { rewardType: 'TalentBigDrop', requirement: talentLegal },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
    ],
  },
  {
    key: 'TyphonBossRewards',
    entries: [
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'TalentBigDrop', requirement: talentLegal },
      { rewardType: 'StackUpgradeTriple', requirement: stackLegal },
      { rewardType: 'WeaponUpgrade', requirement: hammerEarly },
      { rewardType: 'WeaponUpgrade', requirement: hammerLate },
    ],
  },
  {
    // Chaos gate rooms draw from this store: native BaseChaos sets
    // ForcedRewardStore = "Secrets" and the store itself holds one entry
    // (LootData.lua:807-812). Native also lists it in
    // RewardStoreData.InvalidOverrides (LootData.lua:802-805), so it never
    // becomes a sibling door's store through the per-door override path.
    key: 'Secrets',
    entries: [{ rewardType: 'TrialUpgrade' }],
  },
] satisfies RawRewardKernelInput['stores'];
