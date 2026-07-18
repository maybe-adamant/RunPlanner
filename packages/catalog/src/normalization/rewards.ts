import type {
  CatalogCollection,
  ConcreteReward,
  CountedRewardBinding,
  RewardPayload,
  RewardPayloadDomain,
  RewardPrimitive,
  RewardStore,
  RewardStoreEntry,
} from '@run-planner/core';

import type {
  RawCountedRewardBinding,
  RawPayloadDomainDeclaration,
  RawRewardPrimitiveDeclaration,
  RawRewardStoreDeclaration,
} from '../declarations';
import { createCollection, freezeUniqueStrings, requireNonEmpty } from './common';
import { fail } from './errors';
import { normalizeRequirement, validateRequirementReferences } from './requirements';

interface RawRewardGraph {
  readonly payloadDomains: readonly RawPayloadDomainDeclaration[];
  readonly primitives: readonly RawRewardPrimitiveDeclaration[];
}

interface NormalizedRewardGraph {
  readonly payloadDomains: CatalogCollection<RewardPayloadDomain>;
  readonly primitives: CatalogCollection<RewardPrimitive>;
}

export function normalizePayloadDomains(
  rawDomains: readonly RawPayloadDomainDeclaration[],
): CatalogCollection<RewardPayloadDomain> {
  const domains = rawDomains.map((domain, index): RewardPayloadDomain => {
    const path = `rewardPayloadDomains[${index}]`;
    requireNonEmpty(domain.key, `${path}.key`);

    if (domain.kind === 'oneOf') {
      if (domain.values.length === 0) {
        fail(`${path}.values`, 'must not be empty');
      }
      return Object.freeze({
        key: domain.key,
        kind: 'oneOf',
        values: freezeUniqueStrings(domain.values, `${path}.values`),
      });
    }

    return Object.freeze({
      key: domain.key,
      kind: 'distinctPair',
      valueDomain: requireNonEmpty(domain.valueDomain, `${path}.valueDomain`),
    });
  });

  return createCollection(domains, 'rewardPayloadDomains', (domain) => domain.key);
}

function normalizePayload(payload: RewardPayload, path: string): RewardPayload {
  if ('source' in payload) {
    return Object.freeze({ source: requireNonEmpty(payload.source, `${path}.source`) });
  }

  if (payload.sources.length !== 2) {
    fail(`${path}.sources`, 'must contain exactly two values');
  }
  return Object.freeze({
    sources: Object.freeze([
      requireNonEmpty(payload.sources[0], `${path}.sources[0]`),
      requireNonEmpty(payload.sources[1], `${path}.sources[1]`),
    ]) as readonly [string, string],
  });
}

export function normalizePrimitives(
  rawPrimitives: readonly RawRewardPrimitiveDeclaration[],
): CatalogCollection<RewardPrimitive> {
  const primitives = rawPrimitives.map((primitive, index): RewardPrimitive => {
    const path = `rewardPrimitives[${index}]`;
    requireNonEmpty(primitive.gameName, `${path}.gameName`);
    requireNonEmpty(primitive.label, `${path}.label`);

    return Object.freeze({
      gameName: primitive.gameName,
      label: primitive.label,
      acquiredAs:
        primitive.acquiredAs === undefined
          ? primitive.gameName
          : requireNonEmpty(primitive.acquiredAs, `${path}.acquiredAs`),
      ...(primitive.payloadDomain === undefined
        ? {}
        : { payloadDomain: requireNonEmpty(primitive.payloadDomain, `${path}.payloadDomain`) }),
      ...(primitive.defaultPayload === undefined
        ? {}
        : { defaultPayload: normalizePayload(primitive.defaultPayload, `${path}.defaultPayload`) }),
    });
  });

  return createCollection(
    primitives,
    'rewardPrimitives',
    (primitive) => primitive.gameName,
    'gameName',
  );
}

function validatePayload(
  payload: RewardPayload,
  domain: RewardPayloadDomain,
  domains: CatalogCollection<RewardPayloadDomain>,
  path: string,
): void {
  if (domain.kind === 'oneOf') {
    if (!('source' in payload)) {
      fail(path, `must use one source for payload domain ${domain.key}`);
    }
    if (!domain.values.includes(payload.source)) {
      fail(`${path}.source`, `${payload.source} is not in payload domain ${domain.key}`);
    }
    return;
  }

  if (!('sources' in payload)) {
    fail(path, `must use two sources for payload domain ${domain.key}`);
  }
  const valueDomain = domains.byKey[domain.valueDomain];
  if (valueDomain?.kind !== 'oneOf') {
    fail(path, `references invalid value domain ${domain.valueDomain}`);
  }
  if (payload.sources[0] === payload.sources[1]) {
    fail(`${path}.sources`, 'must contain distinct values');
  }
  for (const [index, source] of payload.sources.entries()) {
    if (!valueDomain.values.includes(source)) {
      fail(`${path}.sources[${index}]`, `${source} is not in payload domain ${valueDomain.key}`);
    }
  }
}

export function validateRewardGraph(
  domains: CatalogCollection<RewardPayloadDomain>,
  primitives: CatalogCollection<RewardPrimitive>,
): void {
  for (const domain of domains.values) {
    if (domain.kind === 'oneOf') {
      for (const [index, value] of domain.values.entries()) {
        const primitive = primitives.byKey[value];
        if (primitive === undefined) {
          fail(`rewardPayloadDomains.${domain.key}.values[${index}]`, `unknown primitive ${value}`);
        }
        if (primitive.payloadDomain !== undefined) {
          fail(
            `rewardPayloadDomains.${domain.key}.values[${index}]`,
            `payload source ${value} must be terminal`,
          );
        }
      }
    } else if (domains.byKey[domain.valueDomain]?.kind !== 'oneOf') {
      fail(
        `rewardPayloadDomains.${domain.key}.valueDomain`,
        `must reference a oneOf domain, received ${domain.valueDomain}`,
      );
    }
  }

  for (const primitive of primitives.values) {
    if (primitives.byKey[primitive.acquiredAs] === undefined) {
      fail(
        `rewardPrimitives.${primitive.gameName}.acquiredAs`,
        `unknown primitive ${primitive.acquiredAs}`,
      );
    }
    if (primitive.payloadDomain === undefined) {
      if (primitive.defaultPayload !== undefined) {
        fail(`rewardPrimitives.${primitive.gameName}.defaultPayload`, 'requires a payloadDomain');
      }
      continue;
    }

    const domain = domains.byKey[primitive.payloadDomain];
    if (domain === undefined) {
      fail(
        `rewardPrimitives.${primitive.gameName}.payloadDomain`,
        `unknown payload domain ${primitive.payloadDomain}`,
      );
    }
    if (primitive.defaultPayload === undefined) {
      fail(
        `rewardPrimitives.${primitive.gameName}.defaultPayload`,
        `is required by payload domain ${primitive.payloadDomain}`,
      );
    }
    validatePayload(
      primitive.defaultPayload,
      domain,
      domains,
      `rewardPrimitives.${primitive.gameName}.defaultPayload`,
    );
  }
}

export function normalizeRewardGraph(input: RawRewardGraph): NormalizedRewardGraph {
  const payloadDomains = normalizePayloadDomains(input.payloadDomains);
  const primitives = normalizePrimitives(input.primitives);
  validateRewardGraph(payloadDomains, primitives);

  return Object.freeze({ payloadDomains, primitives });
}

export function normalizeStores(
  rawStores: readonly RawRewardStoreDeclaration[],
  primitives: CatalogCollection<RewardPrimitive>,
): CatalogCollection<RewardStore> {
  const stores = rawStores.map((store, storeIndex): RewardStore => {
    const path = `rewardStores[${storeIndex}]`;
    requireNonEmpty(store.key, `${path}.key`);
    if (store.entries.length === 0) {
      fail(`${path}.entries`, 'must not be empty');
    }

    const seenRewardTypes = new Set<string>();
    const rewardTypes: string[] = [];
    const entries = store.entries.map((entry, entryIndex): RewardStoreEntry => {
      const entryPath = `${path}.entries[${entryIndex}]`;
      requireNonEmpty(entry.rewardType, `${entryPath}.rewardType`);
      if (primitives.byKey[entry.rewardType] === undefined) {
        fail(`${entryPath}.rewardType`, `unknown primitive ${entry.rewardType}`);
      }
      if (!seenRewardTypes.has(entry.rewardType)) {
        seenRewardTypes.add(entry.rewardType);
        rewardTypes.push(entry.rewardType);
      }
      if (entry.requirement === undefined) {
        return Object.freeze({ rewardType: entry.rewardType });
      }

      const requirement = normalizeRequirement(entry.requirement, `${entryPath}.requirement`);
      validateRequirementReferences(requirement, primitives, `${entryPath}.requirement`);
      return Object.freeze({ rewardType: entry.rewardType, requirement });
    });

    if (!seenRewardTypes.has(store.defaultRewardType)) {
      fail(
        `${path}.defaultRewardType`,
        `${store.defaultRewardType} is not present in store ${store.key}`,
      );
    }

    return Object.freeze({
      key: store.key,
      defaultRewardType: store.defaultRewardType,
      refill: store.refill,
      entries: Object.freeze(entries),
      rewardTypes: Object.freeze(rewardTypes),
    });
  });

  return createCollection(stores, 'rewardStores', (store) => store.key);
}

export function concreteDefault(primitive: RewardPrimitive): ConcreteReward {
  return Object.freeze({
    rewardType: primitive.gameName,
    ...(primitive.defaultPayload === undefined ? {} : { payload: primitive.defaultPayload }),
  });
}

export function normalizeCountedBinding(
  raw: RawCountedRewardBinding,
  stores: CatalogCollection<RewardStore>,
  primitives: CatalogCollection<RewardPrimitive>,
  path: string,
): CountedRewardBinding {
  const storeKeys = freezeUniqueStrings(raw.storeKeys, `${path}.storeKeys`);
  if (storeKeys.length === 0) {
    fail(`${path}.storeKeys`, 'must not be empty');
  }

  const resolvedStores = storeKeys.map((storeKey, index) => {
    const store = stores.byKey[storeKey];
    if (store === undefined) {
      fail(`${path}.storeKeys[${index}]`, `unknown reward store ${storeKey}`);
    }
    return store;
  });
  const eligible = freezeUniqueStrings(raw.eligibleRewardTypes, `${path}.eligibleRewardTypes`);
  const ineligible = freezeUniqueStrings(
    raw.ineligibleRewardTypes,
    `${path}.ineligibleRewardTypes`,
  );

  for (const [index, rewardType] of eligible.entries()) {
    if (primitives.byKey[rewardType] === undefined) {
      fail(`${path}.eligibleRewardTypes[${index}]`, `unknown reward primitive ${rewardType}`);
    }
  }
  for (const [index, rewardType] of ineligible.entries()) {
    if (primitives.byKey[rewardType] === undefined) {
      fail(`${path}.ineligibleRewardTypes[${index}]`, `unknown reward primitive ${rewardType}`);
    }
  }
  for (const rewardType of eligible) {
    if (ineligible.includes(rewardType)) {
      fail(path, `${rewardType} appears in both eligible and ineligible filters`);
    }
  }

  const union: string[] = [];
  const seen = new Set<string>();
  for (const store of resolvedStores) {
    for (const rewardType of store.rewardTypes) {
      if (!seen.has(rewardType)) {
        seen.add(rewardType);
        union.push(rewardType);
      }
    }
  }
  for (const [index, rewardType] of eligible.entries()) {
    if (!seen.has(rewardType)) {
      fail(
        `${path}.eligibleRewardTypes[${index}]`,
        `${rewardType} is not produced by the referenced stores`,
      );
    }
  }

  const allowedRewardTypes = union.filter(
    (rewardType) =>
      (eligible.length === 0 || eligible.includes(rewardType)) && !ineligible.includes(rewardType),
  );
  if (allowedRewardTypes.length === 0) {
    fail(path, 'filters remove every reward');
  }

  const defaultStoreKey =
    raw.defaultStoreKey ?? (storeKeys.length === 1 ? storeKeys[0] : undefined);
  if (defaultStoreKey === undefined) {
    fail(`${path}.defaultStoreKey`, 'is required when several stores are referenced');
  }
  if (!storeKeys.includes(defaultStoreKey)) {
    fail(`${path}.defaultStoreKey`, `${defaultStoreKey} is not one of the referenced stores`);
  }
  const defaultStore = stores.byKey[defaultStoreKey];
  if (defaultStore === undefined) {
    fail(`${path}.defaultStoreKey`, `unknown reward store ${defaultStoreKey}`);
  }
  if (!allowedRewardTypes.includes(defaultStore.defaultRewardType)) {
    fail(
      path,
      `default ${defaultStore.defaultRewardType} from ${defaultStoreKey} is removed by filters`,
    );
  }
  const defaultPrimitive = primitives.byKey[defaultStore.defaultRewardType];
  if (defaultPrimitive === undefined) {
    fail(path, `default primitive ${defaultStore.defaultRewardType} is not declared`);
  }

  return Object.freeze({
    kind: 'countedChoice',
    storeKeys,
    defaultStoreKey,
    eligibleRewardTypes: eligible,
    ineligibleRewardTypes: ineligible,
    allowedRewardTypes: Object.freeze(allowedRewardTypes),
    defaultReward: concreteDefault(defaultPrimitive),
  });
}
