import type {
  CatalogCollection,
  EncounterProfile,
  FixedRewardBinding,
  ForkedPrebossEntryPolicy,
  NoneRewardBinding,
  RequirementExpression,
  RewardProducerBinding,
  RewardPrimitive,
  RewardStore,
  RoomCaps,
  RoomDeclaration,
  RoomExit,
  RoomForce,
  ShopProfile,
  ShopRewardBinding,
} from '@run-planner/core';

import type {
  RawForkedPrebossEntryPolicy,
  RawRewardProducerBinding,
  RawRoomDeclaration,
} from '../declarations';
import {
  createCollection,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';
import { normalizeRequirement, validateRequirementReferences } from './requirements';
import { concreteDefault, normalizeCountedBinding } from './rewards';

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
  Shop: 'Shop',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const;

const roomTemplateRewardKinds = {
  FixedIntro: 'none',
  FixedOpening: 'countedChoice',
  ForkedPreboss: 'shop',
  Fountain: 'countedChoice',
  Miniboss: 'countedChoice',
  Shop: 'shop',
  StandardCombat: 'countedChoice',
  Story: 'fixed',
} as const;

function validateTemplate(room: RawRoomDeclaration, path: string): void {
  const expectedKind = roomTemplateKinds[room.templateKey as keyof typeof roomTemplateKinds];
  if (expectedKind === undefined) {
    fail(`${path}.templateKey`, `unknown room template ${room.templateKey}`);
  }
  if (room.kind !== expectedKind) {
    fail(`${path}.kind`, `${room.templateKey} requires room kind ${expectedKind}`);
  }
  const expectedRewardKind =
    roomTemplateRewardKinds[room.templateKey as keyof typeof roomTemplateRewardKinds];
  if (room.incomingReward.kind !== expectedRewardKind) {
    fail(
      `${path}.incomingReward.kind`,
      `${room.templateKey} requires reward producer ${expectedRewardKind}`,
    );
  }
  if (room.templateKey === 'ForkedPreboss' && room.entryOfferPolicy === undefined) {
    fail(`${path}.entryOfferPolicy`, 'is required by ForkedPreboss');
  }
  if (room.templateKey !== 'ForkedPreboss' && room.entryOfferPolicy !== undefined) {
    fail(`${path}.entryOfferPolicy`, 'is only valid for ForkedPreboss');
  }
}

function normalizeRewardBinding(
  raw: RawRewardProducerBinding,
  stores: CatalogCollection<RewardStore>,
  primitives: CatalogCollection<RewardPrimitive>,
  shops: CatalogCollection<ShopProfile>,
  path: string,
): RewardProducerBinding {
  if (raw.kind === 'countedChoice') {
    return normalizeCountedBinding(raw, stores, primitives, path);
  }
  if (raw.kind === 'fixed') {
    const primitive = primitives.byKey[raw.rewardType];
    if (primitive === undefined) {
      fail(`${path}.rewardType`, `unknown reward primitive ${raw.rewardType}`);
    }
    return Object.freeze({
      kind: 'fixed',
      reward: concreteDefault(primitive),
    }) satisfies FixedRewardBinding;
  }
  if (raw.kind === 'none') {
    return Object.freeze({ kind: 'none' }) satisfies NoneRewardBinding;
  }

  if (shops.byKey[raw.shopProfileKey] === undefined) {
    fail(`${path}.shopProfileKey`, `unknown shop profile ${raw.shopProfileKey}`);
  }
  return Object.freeze({
    kind: 'shop',
    shopProfileKey: raw.shopProfileKey,
  }) satisfies ShopRewardBinding;
}

function normalizeEntryOfferPolicy(
  raw: RawForkedPrebossEntryPolicy,
  stores: CatalogCollection<RewardStore>,
  primitives: CatalogCollection<RewardPrimitive>,
  path: string,
): ForkedPrebossEntryPolicy {
  return Object.freeze({
    kind: raw.kind,
    freeReward: normalizeCountedBinding(raw.freeReward, stores, primitives, `${path}.freeReward`),
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
  routeSteps: ReadonlySet<string>,
  stores: CatalogCollection<RewardStore>,
  primitives: CatalogCollection<RewardPrimitive>,
  shops: CatalogCollection<ShopProfile>,
  encounters: CatalogCollection<EncounterProfile>,
): CatalogCollection<RoomDeclaration> {
  const rooms = rawRooms.map((room, roomIndex): RoomDeclaration => {
    const path = `rooms[${roomIndex}]`;
    requireNonEmpty(room.gameName, `${path}.gameName`);
    requireNonEmpty(room.label, `${path}.label`);
    if (!routeSteps.has(room.biomeStepKey)) {
      fail(`${path}.biomeStepKey`, `unknown biome step ${room.biomeStepKey}`);
    }
    validateTemplate(room, path);
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
      return Object.freeze({
        index: exit.index,
        targetMode: exit.targetMode,
        type: requireNonEmpty(exit.type, `${exitPath}.type`),
      });
    });
    const eligibility =
      room.eligibility === undefined
        ? undefined
        : normalizeRequirement(room.eligibility, `${path}.eligibility`);
    if (eligibility !== undefined) {
      validateRequirementReferences(eligibility, primitives, `${path}.eligibility`);
    }

    return Object.freeze({
      gameName: room.gameName,
      label: room.label,
      biomeStepKey: room.biomeStepKey,
      kind: room.kind,
      templateKey: room.templateKey,
      exits: Object.freeze(exits),
      incomingReward: normalizeRewardBinding(
        room.incomingReward,
        stores,
        primitives,
        shops,
        `${path}.incomingReward`,
      ),
      ...(room.entryOfferPolicy === undefined
        ? {}
        : {
            entryOfferPolicy: normalizeEntryOfferPolicy(
              room.entryOfferPolicy,
              stores,
              primitives,
              `${path}.entryOfferPolicy`,
            ),
          }),
      encounterProfileKey: room.encounterProfileKey,
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
  });
  return collection;
}
