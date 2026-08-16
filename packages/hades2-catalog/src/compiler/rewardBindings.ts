import type { CatalogCollection } from '@run-planner/engine/catalog-schema';
import type {
  FixedRewardBinding,
  NoneRewardBinding,
  RewardProducerBinding,
} from '@run-planner/engine/reward-kernel';
import type {
  ProducerLifecycleProfileDeclaration,
  RewardKernelCatalog,
  RewardStoreDeclaration,
} from '@run-planner/engine/reward-kernel';

import type { RawRewardProducerBinding } from '../declarations';
import { freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';
import {
  normalizeRequirement,
  rejectEncounterHistoryRequirements,
  validateRequirementReferences,
} from './requirements';

function requireProducerLifecycle(
  rewards: RewardKernelCatalog,
  lifecycleKey: string,
  rewardTypes: readonly string[],
  path: string,
): ProducerLifecycleProfileDeclaration {
  const lifecycle = rewards.producerLifecycles.byKey[lifecycleKey];
  if (lifecycle === undefined) {
    fail(path, `unknown producer lifecycle ${lifecycleKey}`);
  }
  for (const rewardType of rewardTypes) {
    if (lifecycle.rewardTypes.byKey[rewardType] === undefined) {
      fail(path, `${lifecycleKey} does not support reward type ${rewardType}`);
    }
  }
  return lifecycle;
}

export function requireRewardStoreKey(
  storeKey: string,
  stores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): string {
  requireNonEmpty(storeKey, path);
  if (stores.byKey[storeKey] === undefined) {
    fail(path, `unknown reward store ${storeKey}`);
  }
  return storeKey;
}

export function normalizeRewardBinding(
  raw: RawRewardProducerBinding,
  rewards: RewardKernelCatalog,
  path: string,
): RewardProducerBinding {
  if (raw.kind === 'countedChoice') {
    const storeKeys = freezeUniqueStrings(raw.storeKeys, `${path}.storeKeys`);
    if (storeKeys.length === 0) {
      fail(`${path}.storeKeys`, 'must not be empty');
    }
    const eligibleRewardTypes = freezeUniqueStrings(
      raw.eligibleRewardTypes,
      `${path}.eligibleRewardTypes`,
    );
    const ineligibleRewardTypes = freezeUniqueStrings(
      raw.ineligibleRewardTypes,
      `${path}.ineligibleRewardTypes`,
    );
    const storeRewardTypes = new Set<string>();
    for (const [index, storeKey] of storeKeys.entries()) {
      const store = rewards.stores.byKey[storeKey];
      if (store === undefined) {
        fail(`${path}.storeKeys[${index}]`, `unknown reward store ${storeKey}`);
      }
      for (const entry of store.entries) {
        storeRewardTypes.add(entry.rewardType);
      }
    }
    for (const [index, rewardType] of eligibleRewardTypes.entries()) {
      if (rewards.rewardTypes.byKey[rewardType] === undefined) {
        fail(`${path}.eligibleRewardTypes[${index}]`, `unknown reward type ${rewardType}`);
      }
      if (!storeRewardTypes.has(rewardType)) {
        fail(
          `${path}.eligibleRewardTypes[${index}]`,
          `${rewardType} is not produced by the referenced stores`,
        );
      }
    }
    const available = new Set(
      eligibleRewardTypes.length === 0
        ? storeRewardTypes
        : eligibleRewardTypes.filter((rewardType) => storeRewardTypes.has(rewardType)),
    );
    for (const [index, rewardType] of ineligibleRewardTypes.entries()) {
      if (rewards.rewardTypes.byKey[rewardType] === undefined) {
        fail(`${path}.ineligibleRewardTypes[${index}]`, `unknown reward type ${rewardType}`);
      }
      if (eligibleRewardTypes.includes(rewardType)) {
        fail(path, `${rewardType} appears in both eligible and ineligible filters`);
      }
      available.delete(rewardType);
    }
    const allowedRewardTypes = Object.freeze([...available]);
    if (allowedRewardTypes.length === 0) {
      fail(path, 'filters remove every reward type');
    }
    requireProducerLifecycle(
      rewards,
      raw.producerLifecycleKey,
      allowedRewardTypes,
      `${path}.producerLifecycleKey`,
    );
    return Object.freeze({
      kind: 'countedChoice',
      storeKeys,
      eligibleRewardTypes,
      ineligibleRewardTypes,
      allowedRewardTypes,
      producerLifecycleKey: raw.producerLifecycleKey,
    });
  }
  if (raw.kind === 'fixed') {
    const rewardType = rewards.rewardTypes.byKey[raw.rewardType];
    if (rewardType === undefined) {
      fail(`${path}.rewardType`, `unknown reward type ${raw.rewardType}`);
    }
    requireProducerLifecycle(
      rewards,
      raw.producerLifecycleKey,
      [raw.rewardType],
      `${path}.producerLifecycleKey`,
    );
    return Object.freeze({
      kind: 'fixed',
      rewardType: rewardType.gameName,
      producerLifecycleKey: raw.producerLifecycleKey,
    }) satisfies FixedRewardBinding;
  }
  if (raw.kind === 'none') {
    return Object.freeze({ kind: 'none' }) satisfies NoneRewardBinding;
  }
  const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
  if (raw.kind !== 'shop') {
    fail(`${path}.kind`, `unknown reward producer ${String(receivedKind)}`);
  }
  const receivedRewardType: unknown = (raw as unknown as { readonly rewardType?: unknown })
    .rewardType;
  if (receivedRewardType !== 'Shop') {
    fail(
      `${path}.rewardType`,
      `shop producer requires Shop, received ${String(receivedRewardType)}`,
    );
  }

  const shop = rewards.rewardTypes.byKey[raw.rewardType];
  if (shop === undefined) {
    fail(`${path}.rewardType`, `unknown reward type ${raw.rewardType}`);
  }
  const shopProfile = rewards.shops.byKey[raw.shopProfileKey];
  if (shopProfile === undefined) {
    fail(`${path}.shopProfileKey`, `unknown shop profile ${raw.shopProfileKey}`);
  }
  const rawRequirements = raw.additionalOptionRequirements ?? {};
  const optionKeys = new Set(
    shopProfile.groups.values.flatMap((group) => group.options.values.map((option) => option.key)),
  );
  const additionalOptionRequirements: Record<string, ReturnType<typeof normalizeRequirement>> = {};
  for (const [optionKey, rawRequirement] of Object.entries(rawRequirements)) {
    if (!optionKeys.has(optionKey)) {
      fail(`${path}.additionalOptionRequirements.${optionKey}`, 'unknown shop option');
    }
    const requirementPath = `${path}.additionalOptionRequirements.${optionKey}`;
    const requirement = normalizeRequirement(rawRequirement, requirementPath);
    validateRequirementReferences(requirement, rewards.rewardTypes, requirementPath);
    rejectEncounterHistoryRequirements(requirement, requirementPath);
    additionalOptionRequirements[optionKey] = requirement;
  }
  requireProducerLifecycle(
    rewards,
    raw.producerLifecycleKey,
    [raw.rewardType],
    `${path}.producerLifecycleKey`,
  );
  return Object.freeze({
    kind: 'shop',
    rewardType: shop.gameName,
    shopProfileKey: raw.shopProfileKey,
    producerLifecycleKey: raw.producerLifecycleKey,
    ...(Object.keys(additionalOptionRequirements).length === 0
      ? {}
      : { additionalOptionRequirements: Object.freeze(additionalOptionRequirements) }),
  });
}
