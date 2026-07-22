import type { RawConcreteAcquisitionDeclaration, RawRewardTypeDeclaration } from './types';

const boonDefault = Object.freeze({
  kind: 'BoonSource' as const,
  source: 'ApolloUpgrade',
});

const devotionDefault = Object.freeze({
  kind: 'DevotionPair' as const,
  chosenSource: 'ApolloUpgrade',
  spurnedSource: 'ZeusUpgrade',
});

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

export const rewardTypes = [
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
