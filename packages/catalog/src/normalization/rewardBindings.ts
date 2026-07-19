import type {
  CatalogCollection,
  FixedRewardBinding,
  NoneRewardBinding,
  RewardProducerBinding,
} from '@run-planner/core';
import type {
  ProducerLifecycleProfileDeclaration,
  ResolvedRewardOffer,
  RewardKernelCatalog,
  RewardStoreDeclaration,
  RewardTypeDeclaration,
} from '@run-planner/core/reward-kernel';

import type { RawRewardProducerBinding } from '../declarations';
import { freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';

function defaultOffer(rewardType: RewardTypeDeclaration): ResolvedRewardOffer {
  return Object.freeze({
    rewardType: rewardType.gameName,
    ...(rewardType.defaultPayload === undefined ? {} : { payload: rewardType.defaultPayload }),
  });
}

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
    const defaultOffersByStore: Record<string, ResolvedRewardOffer> = {};
    for (const [index, storeKey] of storeKeys.entries()) {
      const store = rewards.stores.byKey[storeKey];
      if (store === undefined) {
        fail(`${path}.storeKeys[${index}]`, `unknown reward store ${storeKey}`);
      }
      defaultOffersByStore[storeKey] = store.defaultOffer;
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
    for (const storeKey of storeKeys) {
      const defaultOffer = defaultOffersByStore[storeKey];
      if (defaultOffer !== undefined && !allowedRewardTypes.includes(defaultOffer.rewardType)) {
        fail(path, `default ${defaultOffer.rewardType} from ${storeKey} is removed by filters`);
      }
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
      defaultOffersByStore: Object.freeze(defaultOffersByStore),
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
      offer: defaultOffer(rewardType),
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
  if (rewards.shops.byKey[raw.shopProfileKey] === undefined) {
    fail(`${path}.shopProfileKey`, `unknown shop profile ${raw.shopProfileKey}`);
  }
  requireProducerLifecycle(
    rewards,
    raw.producerLifecycleKey,
    [raw.rewardType],
    `${path}.producerLifecycleKey`,
  );
  return Object.freeze({
    kind: 'shop',
    offer: defaultOffer(shop),
    shopProfileKey: raw.shopProfileKey,
    producerLifecycleKey: raw.producerLifecycleKey,
  });
}
