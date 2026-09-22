import type { RequirementExpression } from '@run-planner/engine/requirements';

import { ordinarySources } from './payloads';

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

export const ordinaryLootCount: RequirementExpression = {
  kind: 'recordCount',
  record: 'lootTypeHistory',
  keys: ordinarySources,
  range: { min: 1 },
};

export const stackLegal: RequirementExpression = {
  kind: 'counterRange',
  axis: 'upgradableTraitCount',
  range: { min: 1 },
};

export const hammerEarly: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'WeaponUpgradeDrop' },
    { kind: 'recordCount', record: 'lootTypeHistory', keys: ['WeaponUpgrade'], range: { max: 0 } },
  ],
};

/**
 * StoreData's early World-Shop hammer entries consult Ephyra's offered-reward
 * lookup using the native WeaponUpgrade identity, rather than the planner's
 * WeaponUpgradeDrop option spelling.
 */
export const hubWeaponUpgradeExcludes: RequirementExpression = {
  kind: 'rewardLookupExcludes',
  lookupKey: 'hubRewardLookup',
  rewardType: 'WeaponUpgrade',
};

export const hammerLate: RequirementExpression = {
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

export const shopHermesLegal: RequirementExpression = {
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

export const hermesLootLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'ShopHermesUpgrade' },
    shopHermesLegal,
  ],
};

export const devotionLegal: RequirementExpression = {
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

export const runDevotionLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'counterRange', axis: 'encounterDepth', range: { min: 7 } },
    { kind: 'counterRange', axis: 'biomeEncounterDepth', range: { min: 2 } },
    devotionLegal,
  ],
};

export const spellLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'SpellDrop' },
    { kind: 'currentRoomRewardExcludes', rewardTypes: ['SpellDrop'] },
    { kind: 'recordCount', record: 'useRecord', keys: ['SpellDrop'], range: { max: 0 } },
    { kind: 'flagEquals', flag: 'pendingSpellDrop', value: false },
  ],
};

/**
 * Ordinary World Shop only: the transition that led into this Shop must not
 * already have offered a Spell Drop on any of its exits, taken or not. The
 * Shrine and the I/Q Shops carry no such entry rule.
 */
export const transitionSpellDropExcludes: RequirementExpression = {
  kind: 'offeredRewardExcludes',
  rewardType: 'SpellDrop',
};

/** StoreData applies this lookup only to the named shrine/shop entries. */
export const hubSpellDropExcludes: RequirementExpression = {
  kind: 'rewardLookupExcludes',
  lookupKey: 'hubRewardLookup',
  rewardType: 'SpellDrop',
};

export const talentLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    { kind: 'notInCurrentRoomShopOptions', rewardType: 'TalentDrop' },
    { kind: 'recordCount', record: 'useRecord', keys: ['SpellDrop'], range: { min: 1 } },
    { kind: 'flagEquals', flag: 'allSpellInvested', value: false },
  ],
};

export const routeTalentLegal: RequirementExpression = {
  kind: 'all',
  requirements: [
    talentLegal,
    { kind: 'counterRange', axis: 'enteredBiomes', range: { min: 2 } },
    { kind: 'recordCount', record: 'biomeUseRecord', keys: ['TalentDrop'], range: { max: 0 } },
  ],
};

export const chaosHammerLegal: RequirementExpression = {
  kind: 'recordCount',
  record: 'lootTypeHistory',
  keys: ['WeaponUpgrade'],
  range: { min: 1 },
};

export const smallEnteredBiomes: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { max: 1 },
};

export const largeEnteredBiomes: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { min: 2 },
};

/** Source-named World Shop phase predicates over the entered-biome count. */
export const inRunFirstHalf: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { max: 2 },
};

export const inRunSecondHalf: RequirementExpression = {
  kind: 'counterRange',
  axis: 'enteredBiomes',
  range: { min: 3 },
};
