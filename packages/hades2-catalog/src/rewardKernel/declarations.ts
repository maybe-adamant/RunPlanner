import type { RequirementExpression } from '@run-planner/engine';
import type {
  RawConcreteAcquisitionDeclaration,
  RawRewardKernelInput,
  RawRewardTypeDeclaration,
  RawShopOptionEntryDeclaration,
} from './types';

export const ordinarySources = Object.freeze([
  'AphroditeUpgrade',
  'ApolloUpgrade',
  'AresUpgrade',
  'DemeterUpgrade',
  'HephaestusUpgrade',
  'HeraUpgrade',
  'HestiaUpgrade',
  'PoseidonUpgrade',
  'ZeusUpgrade',
]);

const devotionEligibilitySources = Object.freeze([
  'AphroditeUpgrade',
  'ApolloUpgrade',
  'DemeterUpgrade',
  'HephaestusUpgrade',
  'HeraUpgrade',
  'HestiaUpgrade',
  'PoseidonUpgrade',
  'ZeusUpgrade',
]);

const boonDefault = Object.freeze({
  kind: 'BoonSource' as const,
  source: 'ApolloUpgrade',
});
const devotionDefault = Object.freeze({
  kind: 'DevotionPair' as const,
  chosenSource: 'ApolloUpgrade',
  spurnedSource: 'ZeusUpgrade',
});

const acquisitions = [
  { gameName: 'AphroditeUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'ApolloUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'AresUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'DemeterUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'HephaestusUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'HeraUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'HestiaUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'PoseidonUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'ZeusUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'HermesUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'StackUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'StackUpgradeBig', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'StackUpgradeTriple', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'WeaponUpgrade', kind: 'loot', historyProjection: 'lootAndUse' },
  { gameName: 'SpellDrop', kind: 'loot', historyProjection: 'consumableAndUse' },
  { gameName: 'MaxHealthDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'MaxHealthDropBig', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'MaxHealthDropSmall', kind: 'consumable', historyProjection: 'consumableAndUse' },
  {
    gameName: 'EmptyMaxHealthSmallDrop',
    kind: 'consumable',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'MaxManaDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'MaxManaDropBig', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'MaxManaDropSmall', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'RoomMoneyDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  {
    gameName: 'RoomMoneyTripleDrop',
    kind: 'consumable',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'RoomMoneyTinyDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'TalentDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'TalentBigDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'MinorTalentDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  {
    gameName: 'RoomRewardHealDrop',
    kind: 'consumable',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'HealBigDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'ArmorBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'ArmorBigBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'AirBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'EarthBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'FireBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'WaterBoost', kind: 'consumable', historyProjection: 'consumableAndUse' },
  {
    gameName: 'StoreRewardRandomStack',
    kind: 'consumable',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'LastStandDrop', kind: 'consumable', historyProjection: 'consumableAndUse' },
  {
    gameName: 'ChaosWeaponUpgrade',
    kind: 'consumable',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'BlindBoxLoot', kind: 'consumable', historyProjection: 'consumableAndUse' },
  { gameName: 'GiftDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
  { gameName: 'MetaCurrencyDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
  { gameName: 'MetaCurrencyBigDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
  {
    gameName: 'MetaCardPointsCommonDrop',
    kind: 'resource',
    historyProjection: 'consumableAndUse',
  },
  {
    gameName: 'MetaCardPointsCommonBigDrop',
    kind: 'resource',
    historyProjection: 'consumableAndUse',
  },
  { gameName: 'WeaponPointsRareDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
  { gameName: 'CardUpgradePointsDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
  { gameName: 'CharonPointsDrop', kind: 'resource', historyProjection: 'consumableAndUse' },
] as const satisfies readonly RawConcreteAcquisitionDeclaration[];

function directReward(
  gameName: string,
  label: string,
  kind: RawConcreteAcquisitionDeclaration['kind'],
): RawRewardTypeDeclaration {
  return {
    gameName,
    label,
    acquisitionRoles: [{ key: 'self', resolution: { kind: 'self', acquisitionKind: kind } }],
  };
}

const rewardTypes = [
  directReward('AphroditeUpgrade', 'Aphrodite', 'loot'),
  directReward('ApolloUpgrade', 'Apollo', 'loot'),
  directReward('AresUpgrade', 'Ares', 'loot'),
  directReward('DemeterUpgrade', 'Demeter', 'loot'),
  directReward('HephaestusUpgrade', 'Hephaestus', 'loot'),
  directReward('HeraUpgrade', 'Hera', 'loot'),
  directReward('HestiaUpgrade', 'Hestia', 'loot'),
  directReward('PoseidonUpgrade', 'Poseidon', 'loot'),
  directReward('ZeusUpgrade', 'Zeus', 'loot'),
  directReward('HermesUpgrade', 'Hermes', 'loot'),
  directReward('StackUpgrade', 'Pom of Power', 'loot'),
  directReward('StackUpgradeBig', 'Big Pom of Power', 'loot'),
  directReward('StackUpgradeTriple', 'Triple Pom of Power', 'loot'),
  directReward('WeaponUpgrade', 'Hammer', 'loot'),
  directReward('SpellDrop', "Selene's Gift", 'loot'),
  directReward('MaxHealthDrop', 'Max Health', 'consumable'),
  directReward('MaxHealthDropBig', 'Big Max Health', 'consumable'),
  directReward('MaxHealthDropSmall', 'Small Max Health', 'consumable'),
  directReward('EmptyMaxHealthSmallDrop', 'Empty Small Max Health', 'consumable'),
  directReward('MaxManaDrop', 'Max Magick', 'consumable'),
  directReward('MaxManaDropBig', 'Big Max Magick', 'consumable'),
  directReward('MaxManaDropSmall', 'Small Max Magick', 'consumable'),
  directReward('RoomMoneyDrop', 'Gold', 'consumable'),
  directReward('RoomMoneyTripleDrop', 'Triple Gold', 'consumable'),
  directReward('RoomMoneyTinyDrop', 'Tiny Gold', 'consumable'),
  directReward('TalentDrop', 'Path of Stars', 'consumable'),
  directReward('TalentBigDrop', 'Big Path of Stars', 'consumable'),
  directReward('MinorTalentDrop', 'Minor Path of Stars', 'consumable'),
  directReward('RoomRewardHealDrop', 'Heal', 'consumable'),
  directReward('HealBigDrop', 'Big Heal', 'consumable'),
  directReward('ArmorBoost', 'Armor', 'consumable'),
  directReward('ArmorBigBoost', 'Big Armor', 'consumable'),
  directReward('AirBoost', 'Air Essence', 'consumable'),
  directReward('EarthBoost', 'Earth Essence', 'consumable'),
  directReward('FireBoost', 'Fire Essence', 'consumable'),
  directReward('WaterBoost', 'Water Essence', 'consumable'),
  directReward('StoreRewardRandomStack', 'Pom Slice', 'consumable'),
  directReward('LastStandDrop', 'Death Defiance', 'consumable'),
  directReward('ChaosWeaponUpgrade', 'Chaos Hammer', 'consumable'),
  directReward('GiftDrop', 'Nectar', 'resource'),
  directReward('MetaCurrencyDrop', 'Bones', 'resource'),
  directReward('MetaCurrencyBigDrop', 'Big Bones', 'resource'),
  directReward('MetaCardPointsCommonDrop', 'Ashes', 'resource'),
  directReward('MetaCardPointsCommonBigDrop', 'Big Ashes', 'resource'),
  directReward('WeaponPointsRareDrop', 'Nightmare', 'resource'),
  directReward('CardUpgradePointsDrop', 'Moon Dust', 'resource'),
  directReward('CharonPointsDrop', 'Obol Points', 'resource'),
  {
    gameName: 'Boon',
    label: 'Boon',
    payloadDomain: 'BoonSource',
    defaultPayload: boonDefault,
    sourceSupport: 'ordinaryBoonPeer',
    sourceResolution: { kind: 'offer' },
    acquisitionRoles: [
      {
        key: 'source',
        resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
      },
    ],
  },
  {
    gameName: 'Devotion',
    label: 'Trial',
    payloadDomain: 'DevotionPair',
    defaultPayload: devotionDefault,
    sourceSupport: 'devotionAcquiredPair',
    sourceResolution: { kind: 'offer' },
    offerProjection: 'devotionSpacing',
    acquisitionRoles: [
      {
        key: 'chosenSource',
        resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'chosenSource' },
      },
      {
        key: 'spurnedSource',
        resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'spurnedSource' },
      },
    ],
  },
  {
    gameName: 'RandomLoot',
    label: 'Boon',
    payloadDomain: 'BoonSource',
    defaultPayload: boonDefault,
    sourceSupport: 'ordinaryNoPeer',
    sourceResolution: { kind: 'offer' },
    acquisitionRoles: [
      {
        key: 'source',
        resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
      },
    ],
  },
  {
    gameName: 'BlindBoxLoot',
    label: 'Mystery Boon',
    payloadDomain: 'BoonSource',
    defaultPayload: boonDefault,
    sourceSupport: 'ordinaryNoPeer',
    sourceResolution: { kind: 'acquisitionRole', role: 'hiddenSource' },
    acquisitionRoles: [
      { key: 'box', resolution: { kind: 'self', acquisitionKind: 'consumable' } },
      {
        key: 'hiddenSource',
        resolution: { kind: 'payloadSource', acquisitionKind: 'loot', field: 'source' },
      },
    ],
  },
  {
    gameName: 'WeaponUpgradeDrop',
    label: 'Hammer',
    acquisitionRoles: [
      {
        key: 'weaponUpgrade',
        resolution: {
          kind: 'fixed',
          acquisition: { kind: 'loot', gameName: 'WeaponUpgrade' },
        },
      },
    ],
  },
  {
    gameName: 'ShopHermesUpgrade',
    label: 'Hermes Boon',
    acquisitionRoles: [
      {
        key: 'hermes',
        resolution: {
          kind: 'fixed',
          acquisition: { kind: 'loot', gameName: 'HermesUpgrade' },
        },
      },
    ],
  },
  { gameName: 'Story', label: 'Story', acquisitionRoles: [] },
  { gameName: 'Shop', label: 'Shop', acquisitionRoles: [] },
  { gameName: 'ClockworkGoal', label: 'Clockwork Goal', acquisitionRoles: [] },
] satisfies readonly RawRewardTypeDeclaration[];

const ordinaryLootCount: RequirementExpression = {
  kind: 'recordCount',
  record: 'lootTypeHistory',
  keys: ordinarySources,
  range: { min: 1 },
};
const stackLegal: RequirementExpression = {
  kind: 'counterRange',
  axis: 'upgradableTraitCount',
  range: { min: 1 },
};
const hammerEarly: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'WeaponUpgradeDrop' },
    { kind: 'recordCount', record: 'lootTypeHistory', keys: ['WeaponUpgrade'], range: { max: 0 } },
  ],
};
const hammerLate: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'WeaponUpgradeDrop' },
    { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 3 } },
    {
      kind: 'recordCount',
      record: 'lootTypeHistory',
      keys: ['WeaponUpgrade'],
      range: { min: 1, max: 1 },
    },
  ],
};
const shopHermesLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    {
      kind: 'recordCount',
      record: 'biomeUseRecord',
      keys: ['HermesUpgrade', 'ShopHermesUpgrade'],
      range: { max: 0 },
    },
    {
      kind: 'recordCount',
      record: 'lootTypeHistory',
      keys: ['HermesUpgrade'],
      range: { max: 1 },
    },
  ],
};
const hermesLootLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'ShopHermesUpgrade' },
    shopHermesLegal,
  ],
};
const devotionLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    {
      kind: 'recordCount',
      record: 'lootTypeHistory',
      keys: devotionEligibilitySources,
      range: { min: 2 },
    },
    { kind: 'minRoomsSinceEvent', event: 'Devotion', count: 15 },
    { kind: 'minExits', count: 2 },
  ],
};
const runDevotionLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'counterRange', axis: 'encounterDepth', range: { min: 7 } },
    { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 2 } },
    devotionLegal,
  ],
};
const spellLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'SpellDrop' },
    { kind: 'currentRoomRewardExcludes', rewardTypes: ['SpellDrop'] },
    { kind: 'recordCount', record: 'useRecord', keys: ['SpellDrop'], range: { max: 0 } },
    { kind: 'flagEquals', flag: 'pendingSpellDrop', value: false },
  ],
};
const talentLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'TalentDrop' },
    { kind: 'recordCount', record: 'useRecord', keys: ['SpellDrop'], range: { min: 1 } },
    { kind: 'flagEquals', flag: 'allSpellInvested', value: false },
  ],
};
const routeTalentLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    talentLegal,
    { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2 } },
    { kind: 'recordCount', record: 'biomeUseRecord', keys: ['TalentDrop'], range: { max: 0 } },
  ],
};
const chaosHammerLegal: RequirementExpression = {
  kind: 'recordCount',
  record: 'lootTypeHistory',
  keys: ['WeaponUpgrade'],
  range: { min: 1 },
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

const smallEnteredBiomes: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { max: 1 },
};
const largeEnteredBiomes: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { min: 2 },
};

function option(
  key: string,
  rewardType: string,
  requirement?: RequirementExpression,
  purchaseRequirement?: RequirementExpression,
  acquisitionLifecycle?: RawShopOptionEntryDeclaration['acquisitionLifecycle'],
): RawShopOptionEntryDeclaration {
  return {
    key,
    rewardType,
    ...(requirement === undefined ? {} : { requirement }),
    ...(purchaseRequirement === undefined ? {} : { purchaseRequirement }),
    ...(acquisitionLifecycle === undefined ? {} : { acquisitionLifecycle }),
  };
}

const worldGroups = [
  {
    key: 'Boon',
    offerCount: 1,
    options: [
      option('RandomLoot', 'RandomLoot'),
      option('BlindBoxLoot', 'BlindBoxLoot', undefined, undefined, [
        { role: 'box', lifecyclePoint: 'purchase' },
        { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
      ]),
      option('ShopHermesUpgrade', 'ShopHermesUpgrade', shopHermesLegal),
    ],
  },
  {
    key: 'MajorNonBoon',
    offerCount: 1,
    options: [
      option('WeaponUpgradeDropEarly', 'WeaponUpgradeDrop', hammerEarly),
      option('WeaponUpgradeDropLate', 'WeaponUpgradeDrop', hammerLate),
      option('RoomRewardHealDrop', 'RoomRewardHealDrop'),
      option('MaxHealthDrop', 'MaxHealthDrop'),
      option('ArmorBoost', 'ArmorBoost'),
      option('MetaCardPointsCommonDrop', 'MetaCardPointsCommonDrop'),
      option('MetaCurrencyDrop', 'MetaCurrencyDrop'),
      option('GiftDrop', 'GiftDrop'),
    ],
  },
  {
    key: 'Minor',
    offerCount: 1,
    options: [
      option('MaxManaDrop', 'MaxManaDrop'),
      option('StackUpgrade', 'StackUpgrade', stackLegal),
      option('StoreRewardRandomStack', 'StoreRewardRandomStack', stackLegal),
      option('SpellDrop', 'SpellDrop', spellLegal),
      option('TalentDrop', 'TalentDrop', routeTalentLegal),
    ],
  },
] as const;

const lateResourceOptions = [
  option('WeaponPointsRareDrop', 'WeaponPointsRareDrop'),
  option('CardUpgradePointsDrop', 'CardUpgradePointsDrop'),
  option('CharonPointsDrop', 'CharonPointsDrop'),
];

const stores = [
  { key: 'RunProgress', defaultRewardType: 'Boon', entries: runProgressEntries },
  {
    key: 'MetaProgress',
    defaultRewardType: 'GiftDrop',
    entries: [
      { rewardType: 'GiftDrop' },
      { rewardType: 'MetaCurrencyDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCurrencyDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonDrop', requirement: smallEnteredBiomes },
      { rewardType: 'MetaCurrencyBigDrop', requirement: largeEnteredBiomes },
      { rewardType: 'MetaCurrencyBigDrop', requirement: largeEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: largeEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: largeEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: largeEnteredBiomes },
      { rewardType: 'MetaCardPointsCommonBigDrop', requirement: largeEnteredBiomes },
    ],
  },
  {
    key: 'HubRewards',
    defaultRewardType: 'Boon',
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
    defaultRewardType: 'MaxManaDropSmall',
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
    defaultRewardType: 'MaxHealthDrop',
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
    defaultRewardType: 'MaxManaDropSmall',
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
    defaultRewardType: 'RoomMoneyTripleDrop',
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
    defaultRewardType: 'Boon',
    entries: [
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'Boon', allowDuplicates: true },
      { rewardType: 'TalentBigDrop', requirement: talentLegal },
      { rewardType: 'StackUpgradeTriple', requirement: stackLegal },
      { rewardType: 'WeaponUpgrade', requirement: hammerEarly },
      { rewardType: 'WeaponUpgrade', requirement: hammerLate },
    ],
  },
] satisfies RawRewardKernelInput['stores'];

const shops = [
  {
    key: 'WorldShop',
    groups: worldGroups,
    slots: [
      { key: 'Boon', label: 'Offer 1', groupKey: 'Boon', defaultOptionKey: 'RandomLoot' },
      {
        key: 'MajorNonBoon',
        label: 'Offer 2',
        groupKey: 'MajorNonBoon',
        defaultOptionKey: 'WeaponUpgradeDropEarly',
      },
      {
        key: 'Minor',
        label: 'Offer 3',
        groupKey: 'Minor',
        defaultOptionKey: 'MaxManaDrop',
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
          option('BoostedRandomLoot', 'RandomLoot'),
          option('StackUpgradeBig', 'StackUpgradeBig', stackLegal),
        ],
      },
      {
        key: 'MixedProgress',
        offerCount: 1,
        options: [
          option('RandomLoot', 'RandomLoot'),
          option('BlindBoxLoot', 'BlindBoxLoot', undefined, undefined, [
            { role: 'box', lifecyclePoint: 'purchase' },
            { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
          ]),
          option('MaxHealthDrop', 'MaxHealthDrop'),
          option('MaxManaDrop', 'MaxManaDrop'),
          option('StackUpgrade', 'StackUpgrade', stackLegal),
          option('TalentDrop', 'TalentDrop', talentLegal),
          option('SpellDrop', 'SpellDrop', spellLegal),
        ],
      },
      {
        key: 'Survival',
        offerCount: 1,
        options: [
          option('HealBigDrop', 'HealBigDrop'),
          option('ArmorBigBoost', 'ArmorBigBoost'),
          option('LastStandDrop', 'LastStandDrop'),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          option('ShopHermesUpgrade', 'ShopHermesUpgrade', shopHermesLegal),
          option('ChaosWeaponUpgrade', 'ChaosWeaponUpgrade', chaosHammerLegal),
          option('BoostedRandomLoot', 'RandomLoot'),
          option('MaxHealthDropBig', 'MaxHealthDropBig'),
          option('MaxManaDropBig', 'MaxManaDropBig'),
        ],
      },
      { key: 'MetaProgress', offerCount: 1, options: lateResourceOptions },
    ],
    slots: [
      {
        key: 'BoostedBoon',
        label: 'Offer 1',
        groupKey: 'BoostedBoon',
        defaultOptionKey: 'BoostedRandomLoot',
      },
      {
        key: 'MixedProgress',
        label: 'Offer 2',
        groupKey: 'MixedProgress',
        defaultOptionKey: 'RandomLoot',
      },
      {
        key: 'Survival',
        label: 'Offer 3',
        groupKey: 'Survival',
        defaultOptionKey: 'HealBigDrop',
      },
      {
        key: 'PremiumProgress',
        label: 'Offer 4',
        groupKey: 'PremiumProgress',
        defaultOptionKey: 'ShopHermesUpgrade',
      },
      {
        key: 'MetaProgress',
        label: 'Offer 5',
        groupKey: 'MetaProgress',
        defaultOptionKey: 'WeaponPointsRareDrop',
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
          option('BoostedRandomLoot', 'RandomLoot'),
          option('StackUpgradeBig', 'StackUpgradeBig', stackLegal),
          option('RandomLoot', 'RandomLoot'),
          option('BlindBoxLoot', 'BlindBoxLoot', undefined, undefined, [
            { role: 'box', lifecyclePoint: 'purchase' },
            { role: 'hiddenSource', lifecyclePoint: 'afterUnwrap' },
          ]),
          option('MaxHealthDrop', 'MaxHealthDrop'),
          option('MaxManaDrop', 'MaxManaDrop'),
          option('TalentDrop', 'TalentDrop', talentLegal),
          option('SpellDrop', 'SpellDrop', spellLegal),
        ],
      },
      {
        key: 'LargeSurvival',
        offerCount: 1,
        options: [option('HealBigDrop', 'HealBigDrop'), option('ArmorBigBoost', 'ArmorBigBoost')],
      },
      {
        key: 'Survival',
        offerCount: 1,
        options: [
          option('HealBigDrop', 'HealBigDrop'),
          option('ArmorBigBoost', 'ArmorBigBoost'),
          option('LastStandDrop', 'LastStandDrop'),
        ],
      },
      {
        key: 'PremiumProgress',
        offerCount: 1,
        options: [
          option('ShopHermesUpgrade', 'ShopHermesUpgrade', shopHermesLegal),
          option('ChaosWeaponUpgrade', 'ChaosWeaponUpgrade', chaosHammerLegal),
          option('BoostedRandomLoot', 'RandomLoot'),
          option('MaxHealthDropBig', 'MaxHealthDropBig'),
          option('MaxManaDropBig', 'MaxManaDropBig'),
        ],
      },
      { key: 'MetaProgress', offerCount: 1, options: lateResourceOptions },
    ],
    slots: [
      {
        key: 'MixedProgress1',
        label: 'Offer 1',
        groupKey: 'MixedProgress',
        defaultOptionKey: 'BoostedRandomLoot',
      },
      {
        key: 'MixedProgress2',
        label: 'Offer 2',
        groupKey: 'MixedProgress',
        defaultOptionKey: 'StackUpgradeBig',
      },
      {
        key: 'LargeSurvival',
        label: 'Offer 3',
        groupKey: 'LargeSurvival',
        defaultOptionKey: 'HealBigDrop',
      },
      {
        key: 'Survival',
        label: 'Offer 4',
        groupKey: 'Survival',
        defaultOptionKey: 'HealBigDrop',
      },
      {
        key: 'PremiumProgress',
        label: 'Offer 5',
        groupKey: 'PremiumProgress',
        defaultOptionKey: 'ShopHermesUpgrade',
      },
      {
        key: 'MetaProgress',
        label: 'Offer 6',
        groupKey: 'MetaProgress',
        defaultOptionKey: 'WeaponPointsRareDrop',
      },
    ],
  },
] satisfies RawRewardKernelInput['shops'];

export const rewardKernelDeclarations = {
  payloadDomains: [
    { key: 'BoonSource', kind: 'oneOf', values: ordinarySources },
    { key: 'DevotionPair', kind: 'distinctPair', valueDomain: 'BoonSource' },
  ],
  acquisitions,
  rewardTypes,
  stores,
  shops,
  producerLifecycles: [
    {
      key: 'RoomReward',
      rewardTypes: [
        'MaxHealthDrop',
        'MaxHealthDropBig',
        'MaxHealthDropSmall',
        'EmptyMaxHealthSmallDrop',
        'MaxManaDrop',
        'MaxManaDropBig',
        'MaxManaDropSmall',
        'RoomMoneyDrop',
        'RoomMoneyTripleDrop',
        'RoomMoneyTinyDrop',
        'StackUpgrade',
        'StackUpgradeTriple',
        'WeaponUpgrade',
        'HermesUpgrade',
        'Devotion',
        'SpellDrop',
        'TalentDrop',
        'TalentBigDrop',
        'MinorTalentDrop',
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
      ],
    },
  ],
} satisfies RawRewardKernelInput;
