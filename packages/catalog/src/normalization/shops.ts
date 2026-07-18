import type {
  CatalogCollection,
  RewardPrimitive,
  ShopOptionSet,
  ShopProfile,
  ShopSlot,
} from '@run-planner/core';

import type { RawShopOptionSetDeclaration, RawShopProfileDeclaration } from '../declarations';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';
import { concreteDefault } from './rewards';

export function normalizeShopOptionSets(
  rawOptionSets: readonly RawShopOptionSetDeclaration[],
  primitives: CatalogCollection<RewardPrimitive>,
): CatalogCollection<ShopOptionSet> {
  const optionSets = rawOptionSets.map((optionSet, optionSetIndex): ShopOptionSet => {
    const path = `shopOptionSets[${optionSetIndex}]`;
    requireNonEmpty(optionSet.key, `${path}.key`);
    if (optionSet.rewardTypes.length === 0) {
      fail(`${path}.rewardTypes`, 'must not be empty');
    }
    const rewardTypes = freezeUniqueStrings(optionSet.rewardTypes, `${path}.rewardTypes`);
    rewardTypes.forEach((rewardType, rewardIndex) => {
      if (primitives.byKey[rewardType] === undefined) {
        fail(`${path}.rewardTypes[${rewardIndex}]`, `unknown reward primitive ${rewardType}`);
      }
    });

    return Object.freeze({ key: optionSet.key, rewardTypes });
  });

  return createCollection(optionSets, 'shopOptionSets', (optionSet) => optionSet.key);
}

export function normalizeShopProfiles(
  rawProfiles: readonly RawShopProfileDeclaration[],
  optionSets: CatalogCollection<ShopOptionSet>,
  primitives: CatalogCollection<RewardPrimitive>,
): CatalogCollection<ShopProfile> {
  const profiles = rawProfiles.map((profile, profileIndex): ShopProfile => {
    const path = `shopProfiles[${profileIndex}]`;
    requireNonEmpty(profile.key, `${path}.key`);
    if (profile.slots.length === 0) {
      fail(`${path}.slots`, 'must not be empty');
    }

    const slots = profile.slots.map((slot, slotIndex): ShopSlot => {
      const slotPath = `${path}.slots[${slotIndex}]`;
      requireNonEmpty(slot.key, `${slotPath}.key`);
      requireNonEmpty(slot.label, `${slotPath}.label`);
      const optionSet = optionSets.byKey[slot.optionSetKey];
      if (optionSet === undefined) {
        fail(`${slotPath}.optionSetKey`, `unknown shop option set ${slot.optionSetKey}`);
      }
      if (!optionSet.rewardTypes.includes(slot.defaultRewardType)) {
        fail(
          `${slotPath}.defaultRewardType`,
          `${slot.defaultRewardType} is not available from ${slot.optionSetKey}`,
        );
      }
      const defaultPrimitive = primitives.byKey[slot.defaultRewardType];
      if (defaultPrimitive === undefined) {
        fail(`${slotPath}.defaultRewardType`, `unknown reward primitive ${slot.defaultRewardType}`);
      }

      return Object.freeze({
        key: slot.key,
        label: slot.label,
        optionSetKey: slot.optionSetKey,
        defaultReward: concreteDefault(defaultPrimitive),
      });
    });

    return Object.freeze({
      key: profile.key,
      slots: createCollection(slots, `${path}.slots`, (slot) => slot.key),
    });
  });

  return createCollection(profiles, 'shopProfiles', (profile) => profile.key);
}
