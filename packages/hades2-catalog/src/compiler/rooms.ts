import type {
  CatalogCollection,
  EncounterDefinition,
  EncounterEnvelope,
  EncounterSet,
  EncounterSlotBinding,
  ExitTypeDeclaration,
  PrebossBatchPolicy,
  RoomCaps,
  RoomDeclaration,
  RoomExit,
  RoomForce,
  RoomTemplateKey,
  RoomMode,
  RoomStructuralTag,
} from '@run-planner/engine/catalog-schema';
import type {
  EnteredRewardStoreHistoryPolicy,
  RewardProducerBinding,
} from '@run-planner/engine/reward-kernel';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type {
  RewardKernelCatalog,
  RewardStoreDeclaration,
} from '@run-planner/engine/reward-kernel';

import type {
  RawEncounterSlotBinding,
  RawPrebossBatchPolicy,
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
import { normalizeRewardBinding, requireRewardStoreKey } from './rewardBindings';

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
    storeKey: requireRewardStoreKey(policy.storeKey, stores, `${path}.storeKey`),
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
  Devotion: 'Devotion',
  EphyraCombat: 'Combat',
  EphyraSideRoom: 'Combat',
  ClockworkCombat: 'Combat',
  FixedIntro: 'Intro',
  FixedOpening: 'Opening',
  FixedPreHub: 'PreHub',
  FieldsCombat: 'Combat',
  Fountain: 'Reprieve',
  Miniboss: 'Miniboss',
  RewardlessCombat: 'Combat',
  Shop: 'Shop',
  Preboss: 'Preboss',
  ShipCombat: 'Combat',
  StandardCombat: 'Combat',
  Story: 'Story',
} as const satisfies Readonly<Record<RoomTemplateKey, RoomDeclaration['kind']>>;

const roomTemplateRewardKinds = {
  Devotion: 'fixed',
  EphyraCombat: 'countedChoice',
  EphyraSideRoom: 'countedChoice',
  ClockworkCombat: 'countedChoice',
  FixedIntro: 'none',
  FixedOpening: 'countedChoice',
  FixedPreHub: 'countedChoice',
  FieldsCombat: 'none',
  Fountain: 'countedChoice',
  Miniboss: 'countedChoice',
  RewardlessCombat: 'none',
  Shop: 'shop',
  Preboss: 'shop',
  ShipCombat: 'none',
  StandardCombat: 'countedChoice',
  Story: 'fixed',
} as const satisfies Readonly<Record<RoomTemplateKey, RewardProducerBinding['kind']>>;

function validateMode(room: RawRoomDeclaration, path: string): RoomMode {
  const receivedModeKind: unknown = (room.mode as { readonly kind?: unknown } | undefined)?.kind;
  if (room.mode?.kind === 'derived') {
    const classification = room.mode.classification;
    if (classification !== 'completion' && classification !== 'hub') {
      fail(
        `${path}.mode.classification`,
        `unknown derived classification ${String(classification)}`,
      );
    }
    if (room.prebossBatchPolicy !== undefined) {
      fail(`${path}.prebossBatchPolicy`, 'is only valid for authored Preboss rooms');
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
  if (templateKey === 'Preboss' && room.prebossBatchPolicy === undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is required by Preboss');
  }
  if (templateKey !== 'Preboss' && room.prebossBatchPolicy !== undefined) {
    fail(`${path}.prebossBatchPolicy`, 'is only valid for Preboss');
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

function normalizePrebossBatchPolicy(
  raw: RawPrebossBatchPolicy,
  rewards: RewardKernelCatalog,
  path: string,
): PrebossBatchPolicy {
  if (raw.kind === 'retainNormalPeers') {
    return Object.freeze({ kind: 'retainNormalPeers' });
  }
  if (raw.kind !== 'takeOverNormalDoors') {
    fail(
      `${path}.kind`,
      `unknown Preboss batch policy ${String((raw as { kind?: unknown }).kind)}`,
    );
  }
  if (raw.remainingOffers.kind === 'none') {
    return Object.freeze({
      kind: 'takeOverNormalDoors',
      remainingOffers: Object.freeze({ kind: 'none' }),
    });
  }
  if (raw.remainingOffers.kind !== 'counted') {
    fail(
      `${path}.remainingOffers.kind`,
      `unknown remaining Preboss offer policy ${String(
        (raw.remainingOffers as { kind?: unknown }).kind,
      )}`,
    );
  }
  const reward = normalizeRewardBinding(
    raw.remainingOffers.reward,
    rewards,
    `${path}.remainingOffers.reward`,
  );
  if (reward.kind !== 'countedChoice') {
    fail(`${path}.remainingOffers.reward.kind`, 'must be countedChoice');
  }
  return Object.freeze({
    kind: 'takeOverNormalDoors',
    remainingOffers: Object.freeze({ kind: 'counted', reward }),
  });
}

function normalizeForce(force: RoomForce, rewards: RewardKernelCatalog, path: string): RoomForce {
  if (force.kind === 'always') {
    return Object.freeze({ kind: 'always' });
  }
  if (force.kind === 'requirement') {
    const requirement = normalizeRequirement(force.requirement, `${path}.requirement`);
    validateRequirementReferences(requirement, rewards.rewardTypes, `${path}.requirement`);
    return Object.freeze({ kind: 'requirement', requirement });
  }
  if (force.kind !== 'depthWindow') {
    fail(`${path}.kind`, `unknown room force ${String((force as { kind?: unknown }).kind)}`);
  }
  const start = requireNonNegativeInteger(force.start, `${path}.start`);
  const deadline = requireNonNegativeInteger(force.deadline, `${path}.deadline`);
  if (deadline < start) {
    fail(`${path}.deadline`, 'must be greater than or equal to start');
  }
  return Object.freeze({ kind: force.kind, axis: force.axis, start, deadline });
}

function validateContextRequirementReferences(
  requirement: RequirementExpression,
  rooms: CatalogCollection<RoomDeclaration>,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  path: string,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child, index) =>
      validateContextRequirementReferences(
        child,
        rooms,
        encounterEnvelopes,
        `${path}.requirements[${index}]`,
      ),
    );
    return;
  }
  if (requirement.kind === 'not') {
    validateContextRequirementReferences(
      requirement.requirement,
      rooms,
      encounterEnvelopes,
      `${path}.requirement`,
    );
    return;
  }
  if (requirement.kind === 'recordCount' && requirement.record === 'roomsEntered') {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'distinctRecordKeyCount' && requirement.record === 'roomsEntered') {
    requirement.keys.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.keys[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'currentBatchRoomCount') {
    requirement.roomGameNames.forEach((gameName, index) => {
      if (rooms.byKey[gameName] === undefined) {
        fail(`${path}.roomGameNames[${index}]`, `unknown room ${gameName}`);
      }
    });
  }
  if (requirement.kind === 'recentEnvelopeSlotCount') {
    const envelope = encounterEnvelopes.byKey[requirement.envelopeKey];
    if (envelope === undefined) {
      fail(`${path}.envelopeKey`, `unknown encounter envelope ${requirement.envelopeKey}`);
    }
    if (!envelope.slots.some((slot) => slot.key === requirement.slotKey)) {
      fail(`${path}.slotKey`, `unknown slot ${requirement.slotKey} in ${requirement.envelopeKey}`);
    }
  }
}

function normalizeEncounterSlotBindings(
  rawBindings: readonly RawEncounterSlotBinding[],
  envelope: EncounterEnvelope,
  definitions: CatalogCollection<EncounterDefinition>,
  sets: CatalogCollection<EncounterSet>,
  path: string,
): readonly EncounterSlotBinding[] {
  const bindings = rawBindings.map((raw, bindingIndex): EncounterSlotBinding => {
    const bindingPath = `${path}[${bindingIndex}]`;
    const receivedKind: unknown = (raw as { readonly kind?: unknown }).kind;
    const slotKey = requireNonEmpty(raw.slotKey, `${bindingPath}.slotKey`);
    if (!envelope.slots.some((slot) => slot.key === slotKey)) {
      fail(`${bindingPath}.slotKey`, `${slotKey} is not a slot in ${envelope.key}`);
    }
    if (raw.kind === 'set') {
      const encounterSetKey = requireNonEmpty(
        raw.encounterSetKey,
        `${bindingPath}.encounterSetKey`,
      );
      if (sets.byKey[encounterSetKey] === undefined) {
        fail(`${bindingPath}.encounterSetKey`, `unknown encounter set ${encounterSetKey}`);
      }
      return Object.freeze({ slotKey, kind: 'set', encounterSetKey });
    }
    if (raw.kind === 'fixed') {
      const encounterDefinitionKey = requireNonEmpty(
        raw.encounterDefinitionKey,
        `${bindingPath}.encounterDefinitionKey`,
      );
      if (definitions.byKey[encounterDefinitionKey] === undefined) {
        fail(
          `${bindingPath}.encounterDefinitionKey`,
          `unknown encounter definition ${encounterDefinitionKey}`,
        );
      }
      return Object.freeze({ slotKey, kind: 'fixed', encounterDefinitionKey });
    }
    fail(`${bindingPath}.kind`, `unknown encounter slot binding ${String(receivedKind)}`);
  });
  const seenSlots = new Set<string>();
  for (const [bindingIndex, binding] of bindings.entries()) {
    if (seenSlots.has(binding.slotKey)) {
      fail(`${path}[${bindingIndex}].slotKey`, `duplicates slot ${binding.slotKey}`);
    }
    seenSlots.add(binding.slotKey);
  }
  if (bindings.length !== envelope.slots.length) {
    fail(path, `must bind every slot in ${envelope.key} exactly once`);
  }
  for (const slot of envelope.slots) {
    if (!seenSlots.has(slot.key)) {
      fail(path, `is missing binding for ${envelope.key}.${slot.key}`);
    }
  }
  return Object.freeze(bindings);
}

export function normalizeRooms(
  rawRooms: readonly RawRoomDeclaration[],
  biomeKeys: ReadonlySet<string>,
  rewards: RewardKernelCatalog,
  encounterEnvelopes: CatalogCollection<EncounterEnvelope>,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  encounterSets: CatalogCollection<EncounterSet>,
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
    const encounterEnvelopeKey = requireNonEmpty(
      room.encounterEnvelopeKey,
      `${path}.encounterEnvelopeKey`,
    );
    const encounterEnvelope = encounterEnvelopes.byKey[encounterEnvelopeKey];
    if (encounterEnvelope === undefined) {
      fail(`${path}.encounterEnvelopeKey`, `unknown encounter envelope ${encounterEnvelopeKey}`);
    }
    const encounterSlotBindings = normalizeEncounterSlotBindings(
      room.encounterSlotBindings,
      encounterEnvelope,
      encounterDefinitions,
      encounterSets,
      `${path}.encounterSlotBindings`,
    );
    if (room.exits.length === 0 && !(mode.kind === 'derived' && mode.classification === 'hub')) {
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
    const prebossBatchPolicy =
      room.prebossBatchPolicy === undefined
        ? undefined
        : normalizePrebossBatchPolicy(
            room.prebossBatchPolicy,
            rewards,
            `${path}.prebossBatchPolicy`,
          );
    const requiredObjectKeys = new Set<string>();
    const requiredObjects = room.requiredObjects?.map((object, objectIndex) => {
      const objectPath = `${path}.requiredObjects[${objectIndex}]`;
      if (object.key !== 'SoulPylon') {
        fail(`${objectPath}.key`, `unknown required room object ${String(object.key)}`);
      }
      if (object.spawnTiming !== 'roomEntry') {
        fail(`${objectPath}.spawnTiming`, `unknown spawn timing ${String(object.spawnTiming)}`);
      }
      if (object.completionRequirement !== 'destroyBeforeExit') {
        fail(
          `${objectPath}.completionRequirement`,
          `unknown completion requirement ${String(object.completionRequirement)}`,
        );
      }
      if (requiredObjectKeys.has(object.key)) {
        fail(`${objectPath}.key`, `duplicates ${object.key}`);
      }
      requiredObjectKeys.add(object.key);
      return Object.freeze({
        key: 'SoulPylon' as const,
        spawnTiming: 'roomEntry' as const,
        completionRequirement: 'destroyBeforeExit' as const,
      });
    });
    if (requiredObjects !== undefined && requiredObjects.length === 0) {
      fail(`${path}.requiredObjects`, 'must not be empty when declared');
    }
    const forcedRewardStoreKey =
      room.forcedRewardStoreKey === undefined
        ? undefined
        : requireRewardStoreKey(
            room.forcedRewardStoreKey,
            rewards.stores,
            `${path}.forcedRewardStoreKey`,
          );
    const individualRewardStoreKey =
      room.individualRewardStoreKey === undefined
        ? undefined
        : requireRewardStoreKey(
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
      const remainingReward =
        prebossBatchPolicy?.kind === 'takeOverNormalDoors' &&
        prebossBatchPolicy.remainingOffers.kind === 'counted'
          ? prebossBatchPolicy.remainingOffers.reward
          : undefined;
      if (storeKey !== undefined && !remainingReward?.storeKeys.includes(storeKey)) {
        if (remainingReward !== undefined) {
          fail(`${path}.${field}`, `${storeKey} is not accepted by the remaining-offer producer`);
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
      ...(prebossBatchPolicy === undefined ? {} : { prebossBatchPolicy }),
      encounterEnvelopeKey,
      encounterSlotBindings,
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
      ...(room.force === undefined
        ? {}
        : { force: normalizeForce(room.force, rewards, `${path}.force`) }),
      ...(requiredObjects === undefined ? {} : { requiredObjects: Object.freeze(requiredObjects) }),
      localChildren: normalizeLocalChildren(
        room.localChildren ?? [],
        `${path}.localChildren`,
        (binding, bindingPath) => {
          const normalized = normalizeRewardBinding(binding, rewards, bindingPath);
          if (normalized.kind !== 'countedChoice') {
            fail(`${bindingPath}.kind`, 'bounded reward slots require countedChoice');
          }
          return normalized;
        },
      ),
    });
  });

  const collection = createCollection(rooms, 'rooms', (room) => room.gameName, 'gameName');
  collection.values.forEach((room, roomIndex) => {
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'Preboss') {
      const path = `rooms[${roomIndex}]`;
      if (room.prebossBatchPolicy?.kind === 'retainNormalPeers') {
        if (room.caps.maxCreationsPerRoom !== 1) {
          fail(
            `${path}.caps.maxCreationsPerRoom`,
            'retainNormalPeers requires maxCreationsPerRoom: 1',
          );
        }
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'FieldsCombat') {
      const path = `rooms[${roomIndex}]`;
      if (room.individualRewardStoreKey === undefined) {
        fail(`${path}.individualRewardStoreKey`, 'is required by FieldsCombat');
      }
      if (room.localChildren.length !== 1) {
        fail(`${path}.localChildren`, 'FieldsCombat requires exactly one cages descriptor');
      }
      const cages = room.localChildren[0];
      if (cages?.kind !== 'boundedRewardSlots' || cages.key !== 'cages') {
        fail(`${path}.localChildren[0]`, 'FieldsCombat requires boundedRewardSlots named cages');
      }
      if (
        cages.slotKeys.length !== 3 ||
        cages.slotKeys[0] !== 'cage1' ||
        cages.slotKeys[1] !== 'cage2' ||
        cages.slotKeys[2] !== 'cage3'
      ) {
        fail(`${path}.localChildren[0].slotKeys`, 'FieldsCombat requires cage1, cage2, cage3');
      }
      if (cages.fields.length !== 0) {
        fail(`${path}.localChildren[0].fields`, 'FieldsCombat cages do not own authored fields');
      }
      if (
        cages.reward.storeKeys.length !== 1 ||
        cages.reward.storeKeys[0] !== room.individualRewardStoreKey
      ) {
        fail(
          `${path}.localChildren[0].reward.storeKeys`,
          `must contain only the FieldsCombat individual store ${room.individualRewardStoreKey}`,
        );
      }
      const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
      const expectedSlots = ['Passive', 'Cage01', 'Cage02', 'Cage03'];
      if (
        envelope?.key !== 'FieldsEncounter' ||
        envelope.slots.length !== expectedSlots.length ||
        envelope.slots.some((slot, index) => slot.key !== expectedSlots[index]) ||
        envelope.slots[0]?.activation !== 'always' ||
        envelope.slots.slice(1).some((slot) => slot.activation !== 'templateControlled') ||
        envelope.slots[0]?.rewardAttachment !== undefined ||
        envelope.slots.slice(1).some((slot, index) => {
          const attachment = slot.rewardAttachment;
          return (
            attachment?.kind !== 'localReward' ||
            attachment.groupKey !== cages.key ||
            attachment.slotKey !== cages.slotKeys[index]
          );
        }) ||
        room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
      ) {
        fail(
          `${path}.encounterEnvelopeKey`,
          'FieldsCombat requires FieldsEncounter Passive/Cage01/Cage02/Cage03 slot topology and local reward attachments',
        );
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'ShipCombat') {
      const path = `rooms[${roomIndex}]`;
      const envelope = encounterEnvelopes.byKey[room.encounterEnvelopeKey];
      const intro = envelope?.slots[0];
      const combat1 = envelope?.slots[1];
      const combat2 = envelope?.slots[2];
      const wheel1 = combat1?.rewardAttachment;
      const wheel2 = combat2?.rewardAttachment;
      if (
        envelope?.key !== 'ShipEncounter' ||
        envelope.slots.length !== 3 ||
        intro?.key !== 'Intro' ||
        intro.activation !== 'always' ||
        intro.rewardAttachment !== undefined ||
        combat1?.key !== 'Combat1' ||
        combat1.activation !== 'always' ||
        wheel1?.kind !== 'rewardWheel' ||
        wheel1.key !== 'wheel1' ||
        wheel1.offerKeys.length !== 2 ||
        wheel1.offerKeys[0] !== 'offer1' ||
        wheel1.offerKeys[1] !== 'offer2' ||
        wheel1.offerCount.min !== 1 ||
        wheel1.offerCount.max !== 2 ||
        wheel1.offerCount.defaultValue !== 1 ||
        combat2?.key !== 'Combat2' ||
        combat2.activation !== 'templateControlled' ||
        wheel2?.kind !== 'rewardWheel' ||
        wheel2.key !== 'wheel2' ||
        wheel2.offerKeys.length !== 2 ||
        wheel2.offerKeys[0] !== 'offer1' ||
        wheel2.offerKeys[1] !== 'offer2' ||
        wheel2.offerCount.min !== 1 ||
        wheel2.offerCount.max !== 2 ||
        wheel2.offerCount.defaultValue !== 1 ||
        room.encounterSlotBindings.some((binding) => binding.kind !== 'set')
      ) {
        fail(
          `${path}.encounterEnvelopeKey`,
          'ShipCombat requires ShipEncounter Intro, Combat1/wheel1, and template-controlled Combat2/wheel2 slots',
        );
      }
      if (room.localChildren.length !== 0) {
        fail(`${path}.localChildren`, 'ShipCombat wheels belong to its encounter envelope');
      }
      if (room.enteredRewardStoreHistory.kind !== 'none') {
        fail(
          `${path}.enteredRewardStoreHistory`,
          'ShipCombat history is emitted by its active wheel offer points',
        );
      }
    }
    if (room.eligibility !== undefined) {
      validateContextRequirementReferences(
        room.eligibility,
        collection,
        encounterEnvelopes,
        `rooms[${roomIndex}].eligibility`,
      );
    }
    if (room.force?.kind === 'requirement') {
      validateContextRequirementReferences(
        room.force.requirement,
        collection,
        encounterEnvelopes,
        `rooms[${roomIndex}].force.requirement`,
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
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraCombat') {
      if (
        room.localChildren.length > 1 ||
        room.localChildren.some((child) => child.kind !== 'fixedRoomSlots')
      ) {
        fail(
          `rooms[${roomIndex}].localChildren`,
          'EphyraCombat accepts at most one fixed-room side group',
        );
      }
      if (room.requiredObjects?.length !== 1 || room.requiredObjects[0]?.key !== 'SoulPylon') {
        fail(`rooms[${roomIndex}].requiredObjects`, 'EphyraCombat requires one SoulPylon');
      }
    }
    if (room.mode.kind === 'authored' && room.mode.templateKey === 'EphyraSideRoom') {
      if (room.localChildren.length !== 0) {
        fail(`rooms[${roomIndex}].localChildren`, 'EphyraSideRoom cannot own local children');
      }
      if (room.requiredObjects !== undefined) {
        fail(`rooms[${roomIndex}].requiredObjects`, 'EphyraSideRoom cannot require room objects');
      }
    }
  });
  return collection;
}
