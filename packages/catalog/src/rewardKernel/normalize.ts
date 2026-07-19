import type { CatalogCollection, RequirementExpression } from '@run-planner/core';
import type {
  AcquisitionLifecycleBinding,
  AcquisitionRoleResolution,
  AcquisitionRoleDeclaration,
  ConcreteAcquisitionDeclaration,
  PayloadDomainDeclaration,
  ProducerLifecycleProfileDeclaration,
  ProducerLifecyclePointKey,
  ProducerRewardLifecycleDeclaration,
  ResolvedRewardOffer,
  RewardKernelCatalog,
  RewardPayload,
  RewardStoreDeclaration,
  RewardTypeDeclaration,
  ShopGroupDeclaration,
  ShopOptionEntry,
  ShopProfileDeclaration,
  ShopSlotDeclaration,
  SourceResolutionPoint,
} from '@run-planner/core/reward-kernel';

import { createCollection, requireNonEmpty, requirePositiveInteger } from '../normalization/common';
import { fail } from '../normalization/errors';
import { normalizeRequirement } from '../normalization/requirements';
import type {
  RawRewardKernelInput,
  RawRewardTypeDeclaration,
  RawShopOptionEntryDeclaration,
} from './types';

const ACQUISITION_KINDS = ['consumable', 'loot', 'resource'] as const;
const HISTORY_PROJECTIONS = ['consumableAndUse', 'lootAndUse'] as const;
const OFFER_PROJECTIONS = ['devotionSpacing', 'none'] as const;
const PAYLOAD_DOMAIN_KINDS = ['distinctPair', 'oneOf'] as const;
const PAYLOAD_KINDS = ['BoonSource', 'DevotionPair'] as const;
const ROLE_RESOLUTION_KINDS = ['fixed', 'payloadSource', 'self'] as const;
const PAYLOAD_SOURCE_FIELDS = ['chosenSource', 'source', 'spurnedSource'] as const;
const SOURCE_RESOLUTION_KINDS = ['acquisitionRole', 'offer'] as const;
const SOURCE_SUPPORT_POLICIES = [
  'devotionAcquiredPair',
  'ordinaryBoonPeer',
  'ordinaryNoPeer',
] as const;
const PRODUCER_LIFECYCLE_POINTS = [
  'afterCombat',
  'afterUnwrap',
  'beforeCombat',
  'purchase',
  'roomRewardPickup',
] as const;

function requireClosedValue<const Values extends readonly string[]>(
  value: unknown,
  values: Values,
  path: string,
): Values[number] {
  if (typeof value !== 'string' || !(values as readonly string[]).includes(value)) {
    fail(path, `must be one of ${values.join(', ')}`);
  }
  return value as Values[number];
}

function clonePayload(payload: RewardPayload, path: string): RewardPayload {
  requireClosedValue(payload.kind, PAYLOAD_KINDS, `${path}.kind`);
  if (payload.kind === 'BoonSource') {
    return Object.freeze({
      kind: 'BoonSource',
      source: requireNonEmpty(payload.source, `${path}.source`),
    });
  }
  const chosenSource = requireNonEmpty(payload.chosenSource, `${path}.chosenSource`);
  const spurnedSource = requireNonEmpty(payload.spurnedSource, `${path}.spurnedSource`);
  if (chosenSource === spurnedSource) {
    fail(path, 'chosenSource and spurnedSource must be distinct');
  }
  return Object.freeze({ kind: 'DevotionPair', chosenSource, spurnedSource });
}

function normalizeRoleResolution(
  resolution: AcquisitionRoleResolution,
  path: string,
): AcquisitionRoleResolution {
  requireClosedValue(resolution.kind, ROLE_RESOLUTION_KINDS, `${path}.kind`);
  switch (resolution.kind) {
    case 'self':
      return Object.freeze({
        kind: 'self',
        acquisitionKind: requireClosedValue(
          resolution.acquisitionKind,
          ACQUISITION_KINDS,
          `${path}.acquisitionKind`,
        ),
      });
    case 'fixed':
      return Object.freeze({
        kind: 'fixed',
        acquisition: Object.freeze({
          kind: requireClosedValue(
            resolution.acquisition.kind,
            ACQUISITION_KINDS,
            `${path}.acquisition.kind`,
          ),
          gameName: requireNonEmpty(
            resolution.acquisition.gameName,
            `${path}.acquisition.gameName`,
          ),
        }),
      });
    case 'payloadSource':
      return Object.freeze({
        kind: 'payloadSource',
        acquisitionKind: requireClosedValue(
          resolution.acquisitionKind,
          ACQUISITION_KINDS,
          `${path}.acquisitionKind`,
        ),
        field: requireClosedValue(resolution.field, PAYLOAD_SOURCE_FIELDS, `${path}.field`),
      });
  }
}

function normalizeSourceResolution(
  resolution: SourceResolutionPoint,
  path: string,
): SourceResolutionPoint {
  requireClosedValue(resolution.kind, SOURCE_RESOLUTION_KINDS, `${path}.kind`);
  if (resolution.kind === 'offer') {
    return Object.freeze({ kind: 'offer' });
  }
  return Object.freeze({
    kind: 'acquisitionRole',
    role: requireNonEmpty(resolution.role, `${path}.role`),
  });
}

function normalizePayloadDomains(
  raw: RawRewardKernelInput['payloadDomains'],
): CatalogCollection<PayloadDomainDeclaration> {
  const domains = raw.map((domain, index): PayloadDomainDeclaration => {
    const path = `payloadDomains[${index}]`;
    requireNonEmpty(domain.key, `${path}.key`);
    requireClosedValue(domain.kind, PAYLOAD_DOMAIN_KINDS, `${path}.kind`);
    if (domain.kind === 'oneOf') {
      if (domain.values.length === 0) {
        fail(`${path}.values`, 'must not be empty');
      }
      const values = domain.values.map((value, valueIndex) =>
        requireNonEmpty(value, `${path}.values[${valueIndex}]`),
      );
      if (new Set(values).size !== values.length) {
        fail(`${path}.values`, 'must be unique');
      }
      return Object.freeze({ key: domain.key, kind: 'oneOf', values: Object.freeze(values) });
    }
    return Object.freeze({
      key: domain.key,
      kind: 'distinctPair',
      valueDomain: requireNonEmpty(domain.valueDomain, `${path}.valueDomain`),
    });
  });
  const collection = createCollection(domains, 'payloadDomains', (domain) => domain.key);
  for (const domain of collection.values) {
    if (domain.kind === 'distinctPair' && collection.byKey[domain.valueDomain]?.kind !== 'oneOf') {
      fail(`payloadDomains.${domain.key}.valueDomain`, 'must reference a oneOf domain');
    }
  }
  return collection;
}

function normalizeAcquisitions(
  raw: RawRewardKernelInput['acquisitions'],
): CatalogCollection<ConcreteAcquisitionDeclaration> {
  return createCollection(
    raw.map((acquisition, index) =>
      Object.freeze({
        gameName: requireNonEmpty(acquisition.gameName, `acquisitions[${index}].gameName`),
        kind: requireClosedValue(
          acquisition.kind,
          ACQUISITION_KINDS,
          `acquisitions[${index}].kind`,
        ),
        historyProjection: requireClosedValue(
          acquisition.historyProjection,
          HISTORY_PROJECTIONS,
          `acquisitions[${index}].historyProjection`,
        ),
      }),
    ),
    'acquisitions',
    (acquisition) => acquisition.gameName,
    'gameName',
  );
}

function payloadMatchesDomain(
  payload: RewardPayload,
  domain: PayloadDomainDeclaration,
  domains: CatalogCollection<PayloadDomainDeclaration>,
): boolean {
  if (domain.kind === 'oneOf') {
    return payload.kind === 'BoonSource' && domain.values.includes(payload.source);
  }
  const values = domains.byKey[domain.valueDomain];
  return (
    values?.kind === 'oneOf' &&
    payload.kind === 'DevotionPair' &&
    payload.chosenSource !== payload.spurnedSource &&
    values.values.includes(payload.chosenSource) &&
    values.values.includes(payload.spurnedSource)
  );
}

function normalizeRewardTypes(
  raw: readonly RawRewardTypeDeclaration[],
  domains: CatalogCollection<PayloadDomainDeclaration>,
  acquisitions: CatalogCollection<ConcreteAcquisitionDeclaration>,
): CatalogCollection<RewardTypeDeclaration> {
  const rewardTypes = raw.map((rewardType, index): RewardTypeDeclaration => {
    const path = `rewardTypes[${index}]`;
    const gameName = requireNonEmpty(rewardType.gameName, `${path}.gameName`);
    const roles = createCollection(
      rewardType.acquisitionRoles.map((role, roleIndex): AcquisitionRoleDeclaration =>
        Object.freeze({
          key: requireNonEmpty(role.key, `${path}.acquisitionRoles[${roleIndex}].key`),
          resolution: normalizeRoleResolution(
            role.resolution,
            `${path}.acquisitionRoles[${roleIndex}].resolution`,
          ),
        }),
      ),
      `${path}.acquisitionRoles`,
      (role) => role.key,
    );
    return Object.freeze({
      gameName,
      label: requireNonEmpty(rewardType.label, `${path}.label`),
      ...(rewardType.payloadDomain === undefined
        ? {}
        : { payloadDomain: requireNonEmpty(rewardType.payloadDomain, `${path}.payloadDomain`) }),
      ...(rewardType.defaultPayload === undefined
        ? {}
        : { defaultPayload: clonePayload(rewardType.defaultPayload, `${path}.defaultPayload`) }),
      ...(rewardType.sourceSupport === undefined
        ? {}
        : {
            sourceSupport: requireClosedValue(
              rewardType.sourceSupport,
              SOURCE_SUPPORT_POLICIES,
              `${path}.sourceSupport`,
            ),
          }),
      ...(rewardType.sourceResolution === undefined
        ? {}
        : {
            sourceResolution: normalizeSourceResolution(
              rewardType.sourceResolution,
              `${path}.sourceResolution`,
            ),
          }),
      offerProjection: requireClosedValue(
        rewardType.offerProjection ?? 'none',
        OFFER_PROJECTIONS,
        `${path}.offerProjection`,
      ),
      acquisitionRoles: roles,
    });
  });
  const collection = createCollection(
    rewardTypes,
    'rewardTypes',
    (rewardType) => rewardType.gameName,
    'gameName',
  );

  for (const rewardType of collection.values) {
    const path = `rewardTypes.${rewardType.gameName}`;
    const domain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (rewardType.payloadDomain !== undefined && domain === undefined) {
      fail(`${path}.payloadDomain`, `unknown payload domain ${rewardType.payloadDomain}`);
    }
    if ((domain === undefined) !== (rewardType.defaultPayload === undefined)) {
      fail(`${path}.defaultPayload`, 'must exist exactly when payloadDomain exists');
    }
    if (
      domain !== undefined &&
      rewardType.defaultPayload !== undefined &&
      !payloadMatchesDomain(rewardType.defaultPayload, domain, domains)
    ) {
      fail(`${path}.defaultPayload`, `does not match payload domain ${domain.key}`);
    }
    if ((rewardType.sourceSupport === undefined) !== (rewardType.sourceResolution === undefined)) {
      fail(path, 'sourceSupport and sourceResolution must be declared together');
    }
    if (domain !== undefined && rewardType.sourceSupport === undefined) {
      fail(`${path}.sourceSupport`, 'is required by a source-bearing payload domain');
    }
    if (rewardType.sourceSupport !== undefined && domain === undefined) {
      fail(`${path}.sourceSupport`, 'requires a payload domain');
    }
    if (
      (rewardType.sourceSupport === 'ordinaryBoonPeer' ||
        rewardType.sourceSupport === 'ordinaryNoPeer') &&
      domain?.kind !== 'oneOf'
    ) {
      fail(`${path}.sourceSupport`, 'ordinary source policies require a oneOf payload domain');
    }
    if (rewardType.sourceSupport === 'devotionAcquiredPair' && domain?.kind !== 'distinctPair') {
      fail(
        `${path}.sourceSupport`,
        'Devotion source policy requires a distinctPair payload domain',
      );
    }
    if (rewardType.sourceResolution?.kind === 'acquisitionRole') {
      const sourceRole = rewardType.acquisitionRoles.byKey[rewardType.sourceResolution.role];
      if (sourceRole === undefined) {
        fail(`${path}.sourceResolution.role`, 'must reference a declared acquisition role');
      }
      if (sourceRole.resolution.kind !== 'payloadSource') {
        fail(`${path}.sourceResolution.role`, 'must reference a payloadSource acquisition role');
      }
    }
    for (const role of rewardType.acquisitionRoles.values) {
      const rolePath = `${path}.acquisitionRoles.${role.key}.resolution`;
      if (role.resolution.kind === 'self') {
        const acquisition = acquisitions.byKey[rewardType.gameName];
        if (acquisition?.kind !== role.resolution.acquisitionKind) {
          fail(rolePath, 'self role must reference a matching concrete acquisition');
        }
      } else if (role.resolution.kind === 'fixed') {
        const acquisition = acquisitions.byKey[role.resolution.acquisition.gameName];
        if (acquisition?.kind !== role.resolution.acquisition.kind) {
          fail(rolePath, 'fixed role must reference a matching concrete acquisition');
        }
      } else if (domain === undefined) {
        fail(rolePath, 'payloadSource role requires a payload domain');
      } else if (
        (domain.kind === 'oneOf' && role.resolution.field !== 'source') ||
        (domain.kind === 'distinctPair' && role.resolution.field === 'source')
      ) {
        fail(rolePath, `field is incompatible with payload domain ${domain.key}`);
      } else {
        const acquisitionKind = role.resolution.acquisitionKind;
        const valueDomain = domain.kind === 'oneOf' ? domain : domains.byKey[domain.valueDomain];
        if (
          valueDomain?.kind !== 'oneOf' ||
          valueDomain.values.some((source) => acquisitions.byKey[source]?.kind !== acquisitionKind)
        ) {
          fail(rolePath, 'payload source domain must resolve matching concrete acquisitions');
        }
      }
    }
  }

  const ordinaryTypes = collection.values.filter(
    (rewardType) =>
      rewardType.sourceSupport === 'ordinaryBoonPeer' ||
      rewardType.sourceSupport === 'ordinaryNoPeer',
  );
  const ordinaryDomain = ordinaryTypes[0]?.payloadDomain;
  if (ordinaryDomain === undefined) {
    fail('rewardTypes', 'must declare at least one ordinary-source policy');
  }
  for (const rewardType of ordinaryTypes) {
    if (rewardType.payloadDomain !== ordinaryDomain) {
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `ordinary-source policies must share ${ordinaryDomain}`,
      );
    }
  }
  for (const rewardType of collection.values) {
    if (rewardType.sourceSupport !== 'devotionAcquiredPair') {
      continue;
    }
    const pairDomain =
      rewardType.payloadDomain === undefined ? undefined : domains.byKey[rewardType.payloadDomain];
    if (pairDomain?.kind !== 'distinctPair' || pairDomain.valueDomain !== ordinaryDomain) {
      fail(
        `rewardTypes.${rewardType.gameName}.payloadDomain`,
        `Devotion source policy must use the ordinary-source domain ${ordinaryDomain}`,
      );
    }
  }
  return collection;
}

function validateRequirementRewardReferences(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRequirementRewardReferences(child, rewardTypes, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      validateRequirementRewardReferences(
        requirement.requirement,
        rewardTypes,
        `${path}.requirement`,
      );
      return;
    case 'notInCurrentRoomShopOptions':
    case 'currentRoomRewardExcludes': {
      const values =
        requirement.kind === 'notInCurrentRoomShopOptions'
          ? [requirement.rewardType]
          : requirement.rewardTypes;
      values.forEach((value, index) => {
        if (rewardTypes.byKey[value] === undefined) {
          fail(`${path}.rewardTypes[${index}]`, `unknown reward type ${value}`);
        }
      });
      return;
    }
    case 'recordCount':
    case 'counterRange':
    case 'flagEquals':
    case 'minExits':
    case 'minRoomsSinceEvent':
      return;
  }
}

function normalizeAndValidateRequirement(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): RequirementExpression {
  const normalized = normalizeRequirement(requirement, path);
  validateRequirementRewardReferences(normalized, rewardTypes, path);
  return normalized;
}

function normalizeOffer(
  rewardTypeName: string,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): ResolvedRewardOffer {
  const rewardType = rewardTypes.byKey[rewardTypeName];
  if (rewardType === undefined) {
    fail(path, `unknown reward type ${rewardTypeName}`);
  }
  return Object.freeze({
    rewardType: rewardType.gameName,
    ...(rewardType.defaultPayload === undefined ? {} : { payload: rewardType.defaultPayload }),
  });
}

function normalizeStores(
  raw: RawRewardKernelInput['stores'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<RewardStoreDeclaration> {
  return createCollection(
    raw.map((store, storeIndex): RewardStoreDeclaration => {
      const path = `stores[${storeIndex}]`;
      requireNonEmpty(store.key, `${path}.key`);
      if (store.entries.length === 0) {
        fail(`${path}.entries`, 'must not be empty');
      }
      const entries = store.entries.map((entry, entryIndex) => {
        const entryPath = `${path}.entries[${entryIndex}]`;
        if (rewardTypes.byKey[entry.rewardType] === undefined) {
          fail(`${entryPath}.rewardType`, `unknown reward type ${entry.rewardType}`);
        }
        return Object.freeze({
          index: entryIndex,
          rewardType: entry.rewardType,
          allowDuplicates: entry.allowDuplicates ?? false,
          ...(entry.requirement === undefined
            ? {}
            : {
                requirement: normalizeAndValidateRequirement(
                  entry.requirement,
                  rewardTypes,
                  `${entryPath}.requirement`,
                ),
              }),
        });
      });
      const defaultOffer = normalizeOffer(
        store.defaultRewardType,
        rewardTypes,
        `${path}.defaultRewardType`,
      );
      if (!entries.some((entry) => entry.rewardType === defaultOffer.rewardType)) {
        fail(`${path}.defaultOffer`, 'reward type must be present in the store');
      }
      return Object.freeze({ key: store.key, defaultOffer, entries: Object.freeze(entries) });
    }),
    'stores',
    (store) => store.key,
  );
}

function normalizeShopOption(
  raw: RawShopOptionEntryDeclaration,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
): ShopOptionEntry {
  const defaultOffer = normalizeOffer(raw.rewardType, rewardTypes, `${path}.rewardType`);
  const rewardType = rewardTypes.byKey[defaultOffer.rewardType];
  if (rewardType === undefined) {
    fail(`${path}.rewardType`, `unknown reward type ${defaultOffer.rewardType}`);
  }
  const acquisitionLifecycle = normalizeAcquisitionLifecycle(
    raw.acquisitionLifecycle,
    rewardType,
    'purchase',
    path,
  );
  return Object.freeze({
    key: requireNonEmpty(raw.key, `${path}.key`),
    defaultOffer,
    ...(raw.requirement === undefined
      ? {}
      : {
          requirement: normalizeAndValidateRequirement(
            raw.requirement,
            rewardTypes,
            `${path}.requirement`,
          ),
        }),
    ...(raw.purchaseRequirement === undefined
      ? {}
      : {
          purchaseRequirement: normalizeAndValidateRequirement(
            raw.purchaseRequirement,
            rewardTypes,
            `${path}.purchaseRequirement`,
          ),
        }),
    acquisitionLifecycle,
  });
}

function normalizeAcquisitionLifecycle(
  raw: readonly AcquisitionLifecycleBinding[] | undefined,
  rewardType: RewardTypeDeclaration,
  defaultLifecyclePoint: ProducerLifecyclePointKey,
  path: string,
): readonly AcquisitionLifecycleBinding[] {
  const rawLifecycle =
    raw ??
    rewardType.acquisitionRoles.values.map((role) => ({
      role: role.key,
      lifecyclePoint: defaultLifecyclePoint,
    }));
  const seenRoles = new Set<string>();
  const acquisitionLifecycle = rawLifecycle.map((binding, index) => {
    const bindingPath = `${path}.acquisitionLifecycle[${index}]`;
    requireNonEmpty(binding.role, `${bindingPath}.role`);
    if (seenRoles.has(binding.role)) {
      fail(`${bindingPath}.role`, `duplicates ${binding.role}`);
    }
    if (rewardType.acquisitionRoles.byKey[binding.role] === undefined) {
      fail(`${bindingPath}.role`, `unknown acquisition role ${binding.role}`);
    }
    seenRoles.add(binding.role);
    return Object.freeze({
      role: binding.role,
      lifecyclePoint: requireClosedValue(
        binding.lifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${bindingPath}.lifecyclePoint`,
      ),
    });
  });
  if (seenRoles.size !== rewardType.acquisitionRoles.values.length) {
    fail(`${path}.acquisitionLifecycle`, 'must bind every reward acquisition role exactly once');
  }
  return Object.freeze(acquisitionLifecycle);
}

function normalizeShops(
  raw: RawRewardKernelInput['shops'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ShopProfileDeclaration> {
  return createCollection(
    raw.map((profile, profileIndex): ShopProfileDeclaration => {
      const path = `shops[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      if (profile.groups.length === 0) {
        fail(`${path}.groups`, 'must not be empty');
      }
      const groups = createCollection(
        profile.groups.map((group, groupIndex): ShopGroupDeclaration => {
          const groupPath = `${path}.groups[${groupIndex}]`;
          const offerCount = requirePositiveInteger(group.offerCount, `${groupPath}.offerCount`);
          if (offerCount > group.options.length) {
            fail(`${groupPath}.offerCount`, 'cannot exceed the number of option entries');
          }
          const options = createCollection(
            group.options.map((option, optionIndex) =>
              normalizeShopOption(option, rewardTypes, `${groupPath}.options[${optionIndex}]`),
            ),
            `${groupPath}.options`,
            (option) => option.key,
          );
          const groupRewardTypes = Object.freeze([
            ...new Set(options.values.map((option) => option.defaultOffer.rewardType)),
          ]);
          return Object.freeze({
            key: requireNonEmpty(group.key, `${groupPath}.key`),
            offerCount,
            options,
            rewardTypes: groupRewardTypes,
          });
        }),
        `${path}.groups`,
        (group) => group.key,
      );
      const expectedGroupKeys = groups.values.flatMap((group) =>
        Array.from({ length: group.offerCount }, () => group.key),
      );
      if (profile.slots.length !== expectedGroupKeys.length) {
        fail(`${path}.slots`, `must declare exactly ${expectedGroupKeys.length} emitted slots`);
      }
      const defaultOptionsByGroup = new Map<string, Set<string>>();
      const slots = createCollection(
        profile.slots.map((slot, slotIndex): ShopSlotDeclaration => {
          const slotPath = `${path}.slots[${slotIndex}]`;
          const groupKey = requireNonEmpty(slot.groupKey, `${slotPath}.groupKey`);
          const expectedGroupKey = expectedGroupKeys[slotIndex];
          if (groupKey !== expectedGroupKey) {
            fail(`${slotPath}.groupKey`, `expected ${String(expectedGroupKey)}`);
          }
          const group = groups.byKey[groupKey];
          if (group === undefined) {
            fail(`${slotPath}.groupKey`, `unknown shop group ${groupKey}`);
          }
          const defaultOptionKey = requireNonEmpty(
            slot.defaultOptionKey,
            `${slotPath}.defaultOptionKey`,
          );
          const defaultOption = group.options.byKey[defaultOptionKey];
          if (defaultOption === undefined) {
            fail(
              `${slotPath}.defaultOptionKey`,
              `unknown option ${defaultOptionKey} in ${groupKey}`,
            );
          }
          const usedDefaults = defaultOptionsByGroup.get(groupKey) ?? new Set<string>();
          if (usedDefaults.has(defaultOptionKey)) {
            fail(`${slotPath}.defaultOptionKey`, `duplicates ${defaultOptionKey} in ${groupKey}`);
          }
          usedDefaults.add(defaultOptionKey);
          defaultOptionsByGroup.set(groupKey, usedDefaults);
          return Object.freeze({
            key: requireNonEmpty(slot.key, `${slotPath}.key`),
            label: requireNonEmpty(slot.label, `${slotPath}.label`),
            groupKey,
            defaultOptionKey,
            defaultOffer: defaultOption.defaultOffer,
          });
        }),
        `${path}.slots`,
        (slot) => slot.key,
      );
      return Object.freeze({
        key,
        groups,
        slots,
        slotCount: slots.values.length,
      });
    }),
    'shops',
    (shop) => shop.key,
  );
}

function normalizeProducerLifecycles(
  raw: RawRewardKernelInput['producerLifecycles'],
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
): CatalogCollection<ProducerLifecycleProfileDeclaration> {
  return createCollection(
    raw.map((profile, profileIndex): ProducerLifecycleProfileDeclaration => {
      const path = `producerLifecycles[${profileIndex}]`;
      const key = requireNonEmpty(profile.key, `${path}.key`);
      const defaultLifecyclePoint = requireClosedValue(
        profile.defaultLifecyclePoint,
        PRODUCER_LIFECYCLE_POINTS,
        `${path}.defaultLifecyclePoint`,
      );
      if (profile.rewardTypes.length === 0) {
        fail(`${path}.rewardTypes`, 'must not be empty');
      }
      const supportedRewardTypes = profile.rewardTypes.map((rewardTypeName, rewardTypeIndex) => {
        const rewardTypePath = `${path}.rewardTypes[${rewardTypeIndex}]`;
        const normalizedName = requireNonEmpty(rewardTypeName, rewardTypePath);
        const rewardType = rewardTypes.byKey[normalizedName];
        if (rewardType === undefined) {
          fail(rewardTypePath, `unknown reward type ${normalizedName}`);
        }
        return rewardType;
      });
      if (
        new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName)).size !==
        supportedRewardTypes.length
      ) {
        fail(`${path}.rewardTypes`, 'must be unique');
      }
      const supportedNames = new Set(supportedRewardTypes.map((rewardType) => rewardType.gameName));
      const overrides = new Map<string, readonly AcquisitionLifecycleBinding[]>();
      for (const [overrideIndex, override] of (profile.overrides ?? []).entries()) {
        const overridePath = `${path}.overrides[${overrideIndex}]`;
        const rewardTypeName = requireNonEmpty(override.rewardType, `${overridePath}.rewardType`);
        const rewardType = rewardTypes.byKey[rewardTypeName];
        if (rewardType === undefined) {
          fail(`${overridePath}.rewardType`, `unknown reward type ${rewardTypeName}`);
        }
        if (!supportedNames.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `${rewardTypeName} is not supported by ${key}`);
        }
        if (overrides.has(rewardTypeName)) {
          fail(`${overridePath}.rewardType`, `duplicates ${rewardTypeName}`);
        }
        overrides.set(
          rewardTypeName,
          normalizeAcquisitionLifecycle(
            override.acquisitionLifecycle,
            rewardType,
            defaultLifecyclePoint,
            overridePath,
          ),
        );
      }
      const normalizedRewardTypes = createCollection(
        supportedRewardTypes.map((rewardType): ProducerRewardLifecycleDeclaration =>
          Object.freeze({
            rewardType: rewardType.gameName,
            acquisitionLifecycle:
              overrides.get(rewardType.gameName) ??
              normalizeAcquisitionLifecycle(
                undefined,
                rewardType,
                defaultLifecyclePoint,
                `${path}.rewardTypes.${rewardType.gameName}`,
              ),
          }),
        ),
        `${path}.rewardTypes`,
        (rewardType) => rewardType.rewardType,
        'rewardType',
      );
      return Object.freeze({ key, rewardTypes: normalizedRewardTypes });
    }),
    'producerLifecycles',
    (profile) => profile.key,
  );
}

export function createRewardKernelCatalog(input: RawRewardKernelInput): RewardKernelCatalog {
  const payloadDomains = normalizePayloadDomains(input.payloadDomains);
  const acquisitions = normalizeAcquisitions(input.acquisitions);
  const rewardTypes = normalizeRewardTypes(input.rewardTypes, payloadDomains, acquisitions);
  const stores = normalizeStores(input.stores, rewardTypes);
  const shops = normalizeShops(input.shops, rewardTypes);
  const producerLifecycles = normalizeProducerLifecycles(input.producerLifecycles, rewardTypes);
  return Object.freeze({
    payloadDomains,
    acquisitions,
    rewardTypes,
    stores,
    shops,
    producerLifecycles,
  });
}
