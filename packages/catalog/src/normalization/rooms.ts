import type {
  CatalogCollection,
  EnteredRewardStoreHistoryPolicy,
  EncounterProfile,
  ExitTypeDeclaration,
  FixedRewardBinding,
  ForkedPrebossEntryPolicy,
  NoneRewardBinding,
  RequirementExpression,
  RewardProducerBinding,
  RoomCaps,
  RoomDeclaration,
  RoomExit,
  RoomForce,
  RoomTemplateKey,
  RoomMode,
  RoomStructuralTag,
  ShopRewardBinding,
} from '@run-planner/core';
import type {
  ProducerLifecycleProfileDeclaration,
  ResolvedRewardOffer,
  RewardKernelCatalog,
  RewardStoreDeclaration,
  RewardTypeDeclaration,
} from '@run-planner/core/reward-kernel';

import type {
  RawForkedPrebossEntryPolicy,
  RawRewardProducerBinding,
  RawRoomDeclaration,
} from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import { normalizeLocalChildren } from './descriptors';
import { normalizeRequirement, validateRequirementReferences } from './requirements';

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

function requireStoreKey(
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

function normalizeEnteredStoreHistory(
  policy: EnteredRewardStoreHistoryPolicy,
  stores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): EnteredRewardStoreHistoryPolicy {
  const receivedKind: unknown = (policy as { readonly kind?: unknown }).kind;
  if (policy.kind === 'none' || policy.kind === 'resolvedOffer') {
    return Object.freeze({ kind: policy.kind });
  }
  if (policy.kind !== 'fixed') {
    fail(`${path}.kind`, `unknown entered-store history policy ${String(receivedKind)}`);
  }
  return Object.freeze({
    kind: 'fixed',
    storeKey: requireStoreKey(policy.storeKey, stores, `${path}.storeKey`),
  });
}

function normalizeCaps(caps: RoomCaps, path: string): RoomCaps {
  return Object.freeze({
    ...(caps.maxAppearancesThisBiome === undefined
      ? {}
      : {
          maxAppearancesThisBiome: requirePositiveInteger(
            caps.maxAppearancesThisBiome,
            `${path}.maxAppearancesThisBiome`,
          ),
        }),
    ...(caps.maxCreationsThisRun === undefined
      ? {}
      : {
          maxCreationsThisRun: requirePositiveInteger(
            caps.maxCreationsThisRun,
            `${path}.maxCreationsThisRun`,
          ),
        }),
    ...(caps.maxCreationsPerRoom === undefined
      ? {}
      : {
          maxCreationsPerRoom: requirePositiveInteger(
            caps.maxCreationsPerRoom,
            `${path}.maxCreationsPerRoom`,
          ),
        }),
  });
}

const roomTemplateKinds = {
  FixedIntro: 'Intro',
  FixedOpening: 'Opening',
  ForkedPreboss: 'Preboss',
  Fountain: 'Reprieve',
  Miniboss: 'Miniboss',
  RewardlessCombat: 'Combat',
  Shop: 'Shop',
  ShopPreboss: 'Preboss',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const satisfies Readonly<Record<RoomTemplateKey, RoomDeclaration['kind']>>;

const roomTemplateRewardKinds = {
  FixedIntro: 'none',
  FixedOpening: 'countedChoice',
  ForkedPreboss: 'shop',
  Fountain: 'countedChoice',
  Miniboss: 'countedChoice',
  RewardlessCombat: 'none',
  Shop: 'shop',
  ShopPreboss: 'shop',
  StandardCombat: 'countedChoice',
  Story: 'fixed',
} as const satisfies Readonly<Record<RoomTemplateKey, RewardProducerBinding['kind']>>;

function validateMode(room: RawRoomDeclaration, path: string): RoomMode {
  const receivedModeKind: unknown = (room.mode as { readonly kind?: unknown } | undefined)?.kind;
  if (room.mode?.kind === 'derived') {
    const classification = room.mode.classification;
    if (
      classification !== 'completion' &&
      classification !== 'fixedEntry' &&
      classification !== 'hub'
    ) {
      fail(
        `${path}.mode.classification`,
        `unknown derived classification ${String(classification)}`,
      );
    }
    if (room.entryOfferPolicy !== undefined) {
      fail(`${path}.entryOfferPolicy`, 'is only valid for authored ForkedPreboss rooms');
    }
    return Object.freeze({ kind: 'derived', classification });
  }
  if (room.mode?.kind !== 'authored') {
    fail(`${path}.mode.kind`, `unknown room mode ${String(receivedModeKind)}`);
  }
  const templateKey = room.mode.templateKey;
  if (!Object.hasOwn(roomTemplateKinds, templateKey)) {
    fail(`${path}.mode.templateKey`, `unknown room template ${String(templateKey)}`);
  }
  const expectedKind = roomTemplateKinds[templateKey];
  if (room.kind !== expectedKind) {
    fail(`${path}.kind`, `${templateKey} requires room kind ${expectedKind}`);
  }
  const expectedRewardKind = roomTemplateRewardKinds[templateKey];
  if (room.incomingReward.kind !== expectedRewardKind) {
    fail(
      `${path}.incomingReward.kind`,
      `${templateKey} requires reward producer ${expectedRewardKind}`,
    );
  }
  if (templateKey === 'ForkedPreboss' && room.entryOfferPolicy === undefined) {
    fail(`${path}.entryOfferPolicy`, 'is required by ForkedPreboss');
  }
  if (templateKey !== 'ForkedPreboss' && room.entryOfferPolicy !== undefined) {
    fail(`${path}.entryOfferPolicy`, 'is only valid for ForkedPreboss');
  }
  return Object.freeze({ kind: 'authored', templateKey });
}

const structuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);

function normalizeStructuralTags(
  rawTags: readonly RoomStructuralTag[],
  path: string,
): readonly RoomStructuralTag[] {
  const tags = freezeUniqueStrings(rawTags, path);
  for (const [index, tag] of tags.entries()) {
    if (!structuralTags.has(tag as RoomStructuralTag)) {
      fail(`${path}[${index}]`, `unknown structural tag ${tag}`);
    }
  }
  return tags as readonly RoomStructuralTag[];
}

function normalizeRewardBinding(
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
  }) satisfies ShopRewardBinding;
}

function normalizeEntryOfferPolicy(
  raw: RawForkedPrebossEntryPolicy,
  rewards: RewardKernelCatalog,
  path: string,
): ForkedPrebossEntryPolicy {
  if (raw.kind !== 'shopThenFillRemainingExits') {
    fail(`${path}.kind`, `unknown entry offer policy ${String(raw.kind)}`);
  }
  const freeReward = normalizeRewardBinding(raw.freeReward, rewards, `${path}.freeReward`);
  if (freeReward.kind !== 'countedChoice') {
    fail(`${path}.freeReward.kind`, 'must be countedChoice');
  }
  return Object.freeze({
    kind: raw.kind,
    freeReward,
    maxFreeRewards: requirePositiveInteger(raw.maxFreeRewards, `${path}.maxFreeRewards`),
  });
}

function normalizeForce(force: RoomForce, path: string): RoomForce {
  const start = requireNonNegativeInteger(force.start, `${path}.start`);
  const deadline = requireNonNegativeInteger(force.deadline, `${path}.deadline`);
  if (deadline < start) {
    fail(`${path}.deadline`, 'must be greater than or equal to start');
  }
  return Object.freeze({ kind: force.kind, axis: force.axis, start, deadline });
}

function validateRoomRequirementReferences(
  requirement: RequirementExpression,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child, index) =>
      validateRoomRequirementReferences(child, rooms, `${path}.requirements[${index}]`),
    );
    return;
  }
  if (requirement.kind === 'not') {
    validateRoomRequirementReferences(requirement.requirement, rooms, `${path}.requirement`);
    return;
  }
  if (requirement.kind === 'recordCount' && requirement.record === 'roomsEntered') {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
}

export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  biomeKeys: ReadonlySet<string>,
  rewards: RewardKernelCatalog,
  encounters: CatalogCollection<EncounterProfile>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<RoomDeclaration> {
  const rooms = rawRooms.map((room, roomIndex): RoomDeclaration => {
    const path = `rooms[${roomIndex}]`;
    requireNonEmpty(room.gameName, `${path}.gameName`);
    requireNonEmpty(room.label, `${path}.label`);
    if (!biomeKeys.has(room.biomeKey)) {
      fail(`${path}.biomeKey`, `unknown biome ${room.biomeKey}`);
    }
    if (room.structuralTags === undefined) {
      fail(`${path}.structuralTags`, 'is required');
    }
    const mode = validateMode(room, path);
    if (encounters.byKey[room.encounterProfileKey] === undefined) {
      fail(`${path}.encounterProfileKey`, `unknown encounter profile ${room.encounterProfileKey}`);
    }
    if (room.exits.length === 0) {
      fail(`${path}.exits`, 'must not be empty');
    }
    const exits = room.exits.map((exit, exitIndex): RoomExit => {
      const exitPath = `${path}.exits[${exitIndex}]`;
      if (exit.index !== exitIndex + 1) {
        fail(`${exitPath}.index`, `must equal physical exit index ${exitIndex + 1}`);
      }
      const type = requireNonEmpty(exit.type, `${exitPath}.type`);
      const exitType = exitTypes.byKey[type];
      if (exitType === undefined) {
        fail(`${exitPath}.type`, `unknown physical exit type ${type}`);
      }
      return Object.freeze({
        index: exit.index,
        type,
        compatibilityPolicyKey: exitType.compatibilityPolicyKey,
      });
    });
    const eligibility =
      room.eligibility === undefined
        ? undefined
        : normalizeRequirement(room.eligibility, `${path}.eligibility`);
    if (eligibility !== undefined) {
      validateRequirementReferences(eligibility, rewards.rewardTypes, `${path}.eligibility`);
    }
    const incomingReward = normalizeRewardBinding(
      room.incomingReward,
      rewards,
      `${path}.incomingReward`,
    );
    const entryOfferPolicy =
      room.entryOfferPolicy === undefined
        ? undefined
        : normalizeEntryOfferPolicy(room.entryOfferPolicy, rewards, `${path}.entryOfferPolicy`);
    const forcedRewardStoreKey =
      room.forcedRewardStoreKey === undefined
        ? undefined
        : requireStoreKey(
            room.forcedRewardStoreKey,
            rewards.stores,
            `${path}.forcedRewardStoreKey`,
          );
    const individualRewardStoreKey =
      room.individualRewardStoreKey === undefined
        ? undefined
        : requireStoreKey(
            room.individualRewardStoreKey,
            rewards.stores,
            `${path}.individualRewardStoreKey`,
          );
    for (const [field, storeKey] of [
      ['forcedRewardStoreKey', forcedRewardStoreKey],
      ['individualRewardStoreKey', individualRewardStoreKey],
    ] as const) {
      if (
        storeKey !== undefined &&
        incomingReward.kind === 'countedChoice' &&
        !incomingReward.storeKeys.includes(storeKey)
      ) {
        fail(`${path}.${field}`, `${storeKey} is not accepted by the incoming producer`);
      }
      if (storeKey !== undefined && !entryOfferPolicy?.freeReward.storeKeys.includes(storeKey)) {
        if (entryOfferPolicy !== undefined) {
          fail(`${path}.${field}`, `${storeKey} is not accepted by the free-reward producer`);
        }
      }
    }

    return Object.freeze({
      gameName: room.gameName,
      label: room.label,
      biomeKey: room.biomeKey,
      kind: room.kind,
      mode,
      structuralTags: normalizeStructuralTags(room.structuralTags, `${path}.structuralTags`),
      exits: Object.freeze(exits),
      incomingReward,
      ...(entryOfferPolicy === undefined ? {} : { entryOfferPolicy }),
      encounterProfileKey: room.encounterProfileKey,
      ...(forcedRewardStoreKey === undefined ? {} : { forcedRewardStoreKey }),
      ...(individualRewardStoreKey === undefined ? {} : { individualRewardStoreKey }),
      enteredRewardStoreHistory: normalizeEnteredStoreHistory(
        room.enteredRewardStoreHistory,
        rewards.stores,
        `${path}.enteredRewardStoreHistory`,
      ),
      counters: Object.freeze({
        biomeDepthCache: requireNonNegativeInteger(
          room.counters.biomeDepthCache,
          `${path}.counters.biomeDepthCache`,
        ),
        roomHistoryOrdinal: requirePositiveInteger(
          room.counters.roomHistoryOrdinal,
          `${path}.counters.roomHistoryOrdinal`,
        ),
      }),
      caps: normalizeCaps(room.caps, `${path}.caps`),
      ...(eligibility === undefined ? {} : { eligibility }),
      ...(room.force === undefined ? {} : { force: normalizeForce(room.force, `${path}.force`) }),
      localChildren: normalizeLocalChildren(room.localChildren ?? [], `${path}.localChildren`),
    });
  });

  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  collection.values.forEach((room, roomIndex) => {
    if (room.eligibility !== undefined) {
      validateRoomRequirementReferences(
        room.eligibility,
        collection,
        `rooms[${roomIndex}].eligibility`,
      );
    }
    for (const [childIndex, child] of room.localChildren.entries()) {
      if (child.kind !== 'fixedRoomSlots') {
        continue;
      }
      for (const [slotIndex, slot] of child.slots.entries()) {
        const referenced = collection.byKey[slot.roomGameName];
        const path = `rooms[${roomIndex}].localChildren[${childIndex}].slots[${slotIndex}].roomGameName`;
        if (referenced === undefined) {
          fail(path, `unknown room ${slot.roomGameName}`);
        }
        if (referenced.biomeKey !== room.biomeKey || referenced.mode.kind !== 'authored') {
          fail(path, `${slot.roomGameName} must be an authored room in ${room.biomeKey}`);
        }
      }
    }
  });
  return collection;
}
