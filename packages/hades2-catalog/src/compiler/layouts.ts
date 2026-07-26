import type {
  BiomeDeclaration,
  BiomeLayout,
  CatalogCollection,
  CompletedHubExitDescriptor,
  CompletionDescriptor,
  ExitTypeDeclaration,
  ExitCompatibilityPolicy,
  GeneratedProgressionDescriptor,
  GeneratedProgressionPolicy,
  HubDecisionDescriptor,
  LinkedNormalExitDescriptor,
  NormalDoorBatchPolicy,
  ProgressionDescriptor,
  RewardStorePolicy,
  RoomDeclaration,
  SourceRewardStorePolicyOverride,
  StartDescriptor,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RewardStoreDeclaration } from '@run-planner/engine/reward-kernel';

import type { RawBiomeLayoutDeclaration } from '../declarations';
import {
  createCollection,
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { normalizeAuthoredFields } from './descriptors';
import { fail } from './errors';

function requireRoom(
  gameName: string,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): RoomDeclaration {
  requireNonEmpty(gameName, path);
  const room = rooms.byKey[gameName];
  if (room === undefined) {
    fail(path, `unknown room ${gameName}`);
  }
  if (room.biomeKey !== biomeKey) {
    fail(path, `${gameName} must belong to ${biomeKey}`);
  }
  return room;
}

function normalizeRewardStorePolicy(
  rawPolicy: RewardStorePolicy,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): RewardStorePolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (rawPolicy.kind === 'authoredBaseStore') {
    const storeKeys = freezeUniqueStrings(rawPolicy.storeKeys, `${path}.storeKeys`);
    if (storeKeys.length === 0) {
      fail(`${path}.storeKeys`, 'must not be empty');
    }
    for (const [index, storeKey] of storeKeys.entries()) {
      if (rewardStores.byKey[storeKey] === undefined) {
        fail(`${path}.storeKeys[${index}]`, `unknown reward store ${storeKey}`);
      }
    }
    if (
      !Number.isFinite(rawPolicy.targetMetaRewardsRatio) ||
      rawPolicy.targetMetaRewardsRatio < 0 ||
      rawPolicy.targetMetaRewardsRatio > 1
    ) {
      fail(`${path}.targetMetaRewardsRatio`, 'must be a finite ratio from 0 through 1');
    }
    if (
      !Number.isFinite(rawPolicy.targetMetaRewardsAdjustSpeed) ||
      rawPolicy.targetMetaRewardsAdjustSpeed < 0
    ) {
      fail(`${path}.targetMetaRewardsAdjustSpeed`, 'must be a finite non-negative number');
    }
    return Object.freeze({
      kind: 'authoredBaseStore',
      storeKeys,
      targetMetaRewardsRatio: rawPolicy.targetMetaRewardsRatio,
      targetMetaRewardsAdjustSpeed: rawPolicy.targetMetaRewardsAdjustSpeed,
    });
  }
  if (rawPolicy.kind === 'sourceOfferPoint') {
    if (rawPolicy.selector !== 'lastActiveWheel') {
      fail(`${path}.selector`, `unknown source offer-point selector ${String(rawPolicy.selector)}`);
    }
    return Object.freeze({ kind: 'sourceOfferPoint', selector: 'lastActiveWheel' });
  }
  if (rawPolicy.kind === 'none') {
    return Object.freeze({ kind: 'none' });
  }
  fail(`${path}.kind`, `unknown reward-store policy ${String(receivedKind)}`);
}

function normalizeRewardStoreOverrides(
  rawOverrides: readonly SourceRewardStorePolicyOverride[],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): readonly SourceRewardStorePolicyOverride[] {
  const profileKeys = freezeUniqueStrings(
    rawOverrides.map((override) => override.sourceEncounterProfileKey),
    `${path}.sourceEncounterProfileKeys`,
  );
  return Object.freeze(
    rawOverrides.map((override, index) => {
      const overridePath = `${path}[${index}]`;
      const sourceEncounterProfileKey = profileKeys[index] as string;
      if (
        !rooms.values.some(
          (room) =>
            room.biomeKey === biomeKey && room.encounterProfileKey === sourceEncounterProfileKey,
        )
      ) {
        fail(
          `${overridePath}.sourceEncounterProfileKey`,
          `${sourceEncounterProfileKey} is not used by a room in ${biomeKey}`,
        );
      }
      return Object.freeze({
        sourceEncounterProfileKey,
        policy: normalizeRewardStorePolicy(override.policy, rewardStores, `${overridePath}.policy`),
      });
    }),
  );
}

function normalizeProgressionPolicy(
  rawPolicy: GeneratedProgressionPolicy,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): GeneratedProgressionPolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (rawPolicy.kind === 'eligibilityDriven') {
    return Object.freeze({ kind: 'eligibilityDriven' });
  }
  if (rawPolicy.kind === 'fixedCount') {
    return Object.freeze({
      kind: 'fixedCount',
      continuationCount: requirePositiveInteger(
        rawPolicy.continuationCount,
        `${path}.continuationCount`,
      ),
    });
  }
  if (rawPolicy.kind === 'staged') {
    const stageKeys = freezeUniqueStrings(
      rawPolicy.stages.map((stage) => stage.key),
      `${path}.stages.keys`,
    );
    if (stageKeys.length === 0) {
      fail(`${path}.stages`, 'must not be empty');
    }
    return Object.freeze({
      kind: 'staged',
      stages: Object.freeze(
        rawPolicy.stages.map((stage, stageIndex) => {
          const stagePath = `${path}.stages[${stageIndex}]`;
          const roomGameNames = freezeUniqueStrings(
            stage.roomGameNames,
            `${stagePath}.roomGameNames`,
          );
          if (roomGameNames.length === 0) {
            fail(`${stagePath}.roomGameNames`, 'must not be empty');
          }
          roomGameNames.forEach((gameName, roomIndex) => {
            const room = requireRoom(
              gameName,
              biomeKey,
              rooms,
              `${stagePath}.roomGameNames[${roomIndex}]`,
            );
            if (
              room.mode.kind !== 'authored' ||
              room.kind === 'Intro' ||
              room.kind === 'Opening' ||
              room.kind === 'PreHub' ||
              room.kind === 'Preboss'
            ) {
              fail(
                `${stagePath}.roomGameNames[${roomIndex}]`,
                `${gameName} must be an authored normal-door room`,
              );
            }
          });
          return Object.freeze({ key: stageKeys[stageIndex] as string, roomGameNames });
        }),
      ),
    });
  }
  fail(`${path}.kind`, `unknown progression policy ${String(receivedKind)}`);
}

function normalizeBatchPolicy(
  rawPolicy: NormalDoorBatchPolicy,
  path: string,
): NormalDoorBatchPolicy {
  const receivedKind: unknown = (rawPolicy as { readonly kind?: unknown }).kind;
  if (
    rawPolicy.kind !== 'standard' &&
    rawPolicy.kind !== 'fields' &&
    rawPolicy.kind !== 'clockwork'
  ) {
    fail(`${path}.kind`, `unknown normal-door batch policy ${String(receivedKind)}`);
  }
  const fields = normalizeAuthoredFields(rawPolicy.fields, `${path}.fields`);
  if (rawPolicy.kind === 'standard') {
    if (fields.length !== 0) {
      fail(`${path}.fields`, 'standard policy does not own authored batch fields');
    }
    return Object.freeze({ kind: 'standard', fields });
  }
  if (rawPolicy.kind === 'clockwork') {
    if (fields.length !== 0) {
      fail(`${path}.fields`, 'clockwork policy does not own authored batch fields');
    }
    return Object.freeze({
      kind: 'clockwork',
      initialGoalCount: requirePositiveInteger(
        rawPolicy.initialGoalCount,
        `${path}.initialGoalCount`,
      ),
      fields,
    });
  }
  if (
    fields.length !== 1 ||
    fields[0]?.key !== 'cageOutcome' ||
    fields[0].kind !== 'enum' ||
    fields[0].values.length !== 2 ||
    fields[0].values[0] !== 'min' ||
    fields[0].values[1] !== 'max' ||
    fields[0].initialization.kind !== 'required'
  ) {
    fail(`${path}.fields`, 'fields policy requires authored cageOutcome enum [min, max]');
  }
  const minDoorCageRewards = requirePositiveInteger(
    rawPolicy.minDoorCageRewards,
    `${path}.minDoorCageRewards`,
  );
  const maxDoorCageRewards = requirePositiveInteger(
    rawPolicy.maxDoorCageRewards,
    `${path}.maxDoorCageRewards`,
  );
  if (minDoorCageRewards > maxDoorCageRewards) {
    fail(`${path}.minDoorCageRewards`, 'must not exceed maxDoorCageRewards');
  }
  const maxDoorCageCeiling = requirePositiveInteger(
    rawPolicy.maxDoorCageCeiling,
    `${path}.maxDoorCageCeiling`,
  );
  const optionalBiomeDepths = rawPolicy.maxOutcomeSupport.optionalBiomeDepths.map((depth, index) =>
    requirePositiveInteger(depth, `${path}.maxOutcomeSupport.optionalBiomeDepths[${index}]`),
  );
  const requiredBiomeDepths = rawPolicy.maxOutcomeSupport.requiredBiomeDepths.map((depth, index) =>
    requirePositiveInteger(depth, `${path}.maxOutcomeSupport.requiredBiomeDepths[${index}]`),
  );
  if (
    new Set(optionalBiomeDepths).size !== optionalBiomeDepths.length ||
    new Set(requiredBiomeDepths).size !== requiredBiomeDepths.length ||
    optionalBiomeDepths.some((depth) => requiredBiomeDepths.includes(depth))
  ) {
    fail(`${path}.maxOutcomeSupport`, 'must contain disjoint, unique depth sets');
  }
  return Object.freeze({
    kind: 'fields',
    fields,
    minDoorCageRewards,
    maxDoorCageRewards,
    maxDoorCageCeiling,
    maxOutcomeSupport: Object.freeze({
      optionalBiomeDepths: Object.freeze(optionalBiomeDepths),
      requiredBiomeDepths: Object.freeze(requiredBiomeDepths),
    }),
  });
}

function normalizeStart(
  rawStart: RawBiomeLayoutDeclaration['start'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): StartDescriptor {
  if (rawStart.kind === 'authoredChoice') {
    const roomGameNames = freezeUniqueStrings(rawStart.roomGameNames, `${path}.roomGameNames`);
    if (roomGameNames.length === 0) {
      fail(`${path}.roomGameNames`, 'must not be empty');
    }
    roomGameNames.forEach((gameName, index) => {
      const room = requireRoom(gameName, biomeKey, rooms, `${path}.roomGameNames[${index}]`);
      if (room.mode.kind !== 'authored' || room.kind !== 'Opening') {
        fail(`${path}.roomGameNames[${index}]`, `${gameName} must be an authored Opening`);
      }
    });
    return Object.freeze({
      kind: 'authoredChoice',
      roomGameNames: roomGameNames as readonly [string, ...string[]],
    });
  }
  if (rawStart.kind !== 'fixedAuthored') {
    fail(
      `${path}.kind`,
      `unknown start descriptor ${String((rawStart as { kind?: unknown }).kind)}`,
    );
  }
  const room = requireRoom(rawStart.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (room.mode.kind !== 'authored' || (room.kind !== 'Intro' && room.kind !== 'Opening')) {
    fail(`${path}.roomGameName`, `${room.gameName} must be an authored Intro or Opening`);
  }
  return Object.freeze({ kind: 'fixedAuthored', roomGameName: room.gameName });
}

function normalizeLinkedExit(
  rawExit: LinkedNormalExitDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  expectedKind: 'PreHub' | 'Preboss',
  path: string,
): LinkedNormalExitDescriptor {
  if (rawExit.kind !== 'linked') {
    fail(`${path}.kind`, `unknown linked normal exit ${String(rawExit.kind)}`);
  }
  const exitKey = requireNonEmpty(rawExit.exitKey, `${path}.exitKey`);
  const room = requireRoom(rawExit.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (room.mode.kind !== 'authored' || room.kind !== expectedKind) {
    fail(`${path}.roomGameName`, `${room.gameName} must be an authored ${expectedKind}`);
  }
  return Object.freeze({ kind: 'linked', exitKey, roomGameName: room.gameName });
}

function normalizeCompletedHubExit(
  rawExit: Extract<
    RawBiomeLayoutDeclaration['progression'],
    { readonly kind: 'hub' }
  >['completedExit'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  path: string,
): CompletedHubExitDescriptor {
  const linked = normalizeLinkedExit(rawExit, biomeKey, rooms, 'Preboss', path);
  const index = requirePositiveInteger(rawExit.physicalExit.index, `${path}.physicalExit.index`);
  const type = requireNonEmpty(rawExit.physicalExit.type, `${path}.physicalExit.type`);
  const exitType = exitTypes.byKey[type];
  if (exitType === undefined) {
    fail(`${path}.physicalExit.type`, `unknown exit type ${type}`);
  }
  return Object.freeze({
    ...linked,
    physicalExit: Object.freeze({
      index,
      type: exitType.key,
      compatibilityPolicyKey: exitType.compatibilityPolicyKey,
    }),
  });
}

function normalizeCompletion(
  rawCompletion: CompletionDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): CompletionDescriptor {
  if (rawCompletion.rooms.length === 0 || rawCompletion.rooms.length > 2) {
    fail(`${path}.rooms`, 'must contain boss and optional postboss only');
  }
  const roles = freezeUniqueStrings(
    rawCompletion.rooms.map((room) => room.role),
    `${path}.rooms.roles`,
  );
  const completionRooms = rawCompletion.rooms.map((entry, index) => {
    const expectedRole = index === 0 ? 'boss' : 'postboss';
    if (entry.role !== expectedRole) {
      fail(`${path}.rooms[${index}].role`, `completion role ${expectedRole} is required`);
    }
    const room = requireRoom(
      entry.roomGameName,
      biomeKey,
      rooms,
      `${path}.rooms[${index}].roomGameName`,
    );
    const expectedKind = entry.role === 'boss' ? 'Boss' : 'PostBoss';
    if (
      room.kind !== expectedKind ||
      room.mode.kind !== 'derived' ||
      room.mode.classification !== 'completion'
    ) {
      fail(
        `${path}.rooms[${index}].roomGameName`,
        `${room.gameName} must be a derived ${expectedKind} completion room`,
      );
    }
    return Object.freeze({
      role: roles[index] as 'boss' | 'postboss',
      roomGameName: room.gameName,
    });
  });
  const expectedAxes = ['biomeDepthCache', 'biomeEncounterDepth'] as const;
  if (rawCompletion.transitionEffects.length !== expectedAxes.length) {
    fail(`${path}.transitionEffects`, `requires resets for ${expectedAxes.join(', ')}`);
  }
  const transitionEffects = rawCompletion.transitionEffects.map((effect, index) => {
    if (effect.kind !== 'resetCounter' || effect.axis !== expectedAxes[index]) {
      fail(`${path}.transitionEffects[${index}]`, `must reset ${expectedAxes[index]}`);
    }
    return Object.freeze({ kind: 'resetCounter' as const, axis: effect.axis });
  });
  return Object.freeze({
    rooms: Object.freeze(completionRooms),
    transitionEffects: Object.freeze(transitionEffects),
  });
}

function normalizeGeneratedProgression(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'generated' }>,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): GeneratedProgressionDescriptor {
  const progressionPolicy = normalizeProgressionPolicy(
    raw.progressionPolicy,
    biomeKey,
    rooms,
    `${path}.progressionPolicy`,
  );
  const batchPolicy = normalizeBatchPolicy(raw.batchPolicy, `${path}.batchPolicy`);
  if (batchPolicy.kind === 'fields') {
    for (const room of rooms.values) {
      if (
        room.biomeKey !== biomeKey ||
        room.mode.kind !== 'authored' ||
        room.mode.templateKey !== 'FieldsCombat'
      ) {
        continue;
      }
      const cages = room.localChildren[0];
      if (
        cages?.kind !== 'boundedRewardSlots' ||
        cages.maxActiveSlots < batchPolicy.minDoorCageRewards ||
        cages.maxActiveSlots > batchPolicy.maxDoorCageRewards
      ) {
        fail(
          `${path}.batchPolicy`,
          `${room.gameName} cage capacity must be within ${batchPolicy.minDoorCageRewards}..${batchPolicy.maxDoorCageRewards}`,
        );
      }
    }
  }
  const maxBatches = requirePositiveInteger(raw.bounds.maxBatches, `${path}.bounds.maxBatches`);
  const maxTargets = requirePositiveInteger(raw.bounds.maxTargets, `${path}.bounds.maxTargets`);
  const requiredBatchCount =
    progressionPolicy.kind === 'fixedCount'
      ? progressionPolicy.continuationCount
      : progressionPolicy.kind === 'staged'
        ? progressionPolicy.stages.length
        : undefined;
  if (requiredBatchCount !== undefined && requiredBatchCount > maxBatches) {
    fail(`${path}.bounds.maxBatches`, 'must cover every declared normal-door batch');
  }
  return Object.freeze({
    kind: 'generated',
    progressionPolicy,
    batchPolicy,
    rewardStorePolicy: normalizeRewardStorePolicy(
      raw.rewardStorePolicy,
      rewardStores,
      `${path}.rewardStorePolicy`,
    ),
    rewardStoreOverrides: normalizeRewardStoreOverrides(
      raw.rewardStoreOverrides ?? [],
      biomeKey,
      rooms,
      rewardStores,
      `${path}.rewardStoreOverrides`,
    ),
    bounds: Object.freeze({ maxBatches, maxTargets }),
  });
}

function normalizeHubDecision(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'hub' }>,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  path: string,
): HubDecisionDescriptor {
  const linkedExit = normalizeLinkedExit(
    raw.linkedExit,
    biomeKey,
    rooms,
    'PreHub',
    `${path}.linkedExit`,
  );
  if (linkedExit.exitKey !== 'prehub') {
    fail(`${path}.linkedExit.exitKey`, 'must be prehub');
  }
  const hubRoom = requireRoom(raw.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (
    hubRoom.kind !== 'Hub' ||
    hubRoom.mode.kind !== 'derived' ||
    hubRoom.mode.classification !== 'hub'
  ) {
    fail(`${path}.roomGameName`, `${hubRoom.gameName} must be a derived Hub room`);
  }
  const restoreRoom = requireRoom(
    raw.restoreRoomGameName,
    biomeKey,
    rooms,
    `${path}.restoreRoomGameName`,
  );
  if (restoreRoom.gameName !== hubRoom.gameName) {
    fail(`${path}.restoreRoomGameName`, 'must reference the persistent hub room');
  }
  const slotKeys = freezeUniqueStrings(
    raw.slots.map((slot) => slot.slotKey),
    `${path}.slots.slotKeys`,
  );
  const physicalDoorIds = new Set<number>();
  const slots = raw.slots.map((slot, index) => {
    const slotPath = `${path}.slots[${index}]`;
    const room = requireRoom(slot.roomGameName, biomeKey, rooms, `${slotPath}.roomGameName`);
    if (room.mode.kind !== 'authored') {
      fail(`${slotPath}.roomGameName`, `${room.gameName} must be authored`);
    }
    const physicalDoorId = requirePositiveInteger(
      slot.physicalDoorId,
      `${slotPath}.physicalDoorId`,
    );
    if (physicalDoorIds.has(physicalDoorId)) {
      fail(`${slotPath}.physicalDoorId`, `duplicates ${physicalDoorId}`);
    }
    physicalDoorIds.add(physicalDoorId);
    return Object.freeze({
      slotKey: slotKeys[index] as string,
      roomGameName: room.gameName,
      physicalDoorId,
    });
  });
  if (slots.length === 0) {
    fail(`${path}.slots`, 'must not be empty');
  }
  const min = requirePositiveInteger(raw.openCount.min, `${path}.openCount.min`);
  const max = requirePositiveInteger(raw.openCount.max, `${path}.openCount.max`);
  if (max < min || max > slots.length) {
    fail(`${path}.openCount.max`, 'must be between min and the declared slot count');
  }
  const requiredVisits = requirePositiveInteger(raw.requiredVisits, `${path}.requiredVisits`);
  if (requiredVisits > min) {
    fail(`${path}.requiredVisits`, 'must not exceed the minimum open slot count');
  }
  if (
    raw.targetCompletion.kind !== 'requiredRoomObject' ||
    raw.targetCompletion.objectKey !== 'SoulPylon'
  ) {
    fail(
      `${path}.targetCompletion`,
      'must name one supported required room object completion policy',
    );
  }
  for (const [slotIndex, slot] of slots.entries()) {
    const room = rooms.byKey[slot.roomGameName] as RoomDeclaration;
    if (room.requiredObjects?.length !== 1 || room.requiredObjects[0]?.key !== 'SoulPylon') {
      fail(
        `${path}.slots[${slotIndex}].roomGameName`,
        `${room.gameName} must require one SoulPylon`,
      );
    }
  }
  const openSlotConstraints = raw.openSlotConstraints.map((constraint, index) => {
    const constraintPath = `${path}.openSlotConstraints[${index}]`;
    if (constraint.kind !== 'maxOpenFromSlots') {
      fail(`${constraintPath}.kind`, `unknown open-slot constraint ${String(constraint.kind)}`);
    }
    const constrainedSlotKeys = freezeUniqueStrings(
      constraint.slotKeys,
      `${constraintPath}.slotKeys`,
    );
    if (constrainedSlotKeys.length === 0) {
      fail(`${constraintPath}.slotKeys`, 'must not be empty');
    }
    constrainedSlotKeys.forEach((slotKey, slotIndex) => {
      if (!slotKeys.includes(slotKey)) {
        fail(`${constraintPath}.slotKeys[${slotIndex}]`, `unknown hub slot ${slotKey}`);
      }
    });
    const constraintMax = requirePositiveInteger(constraint.max, `${constraintPath}.max`);
    if (constraintMax > constrainedSlotKeys.length) {
      fail(`${constraintPath}.max`, 'must not exceed the constrained slot count');
    }
    return Object.freeze({
      kind: 'maxOpenFromSlots' as const,
      slotKeys: constrainedSlotKeys,
      max: constraintMax,
    });
  });
  if (raw.rewardLookup.source !== 'allOpenTargetOffers') {
    fail(
      `${path}.rewardLookup.source`,
      `unknown reward lookup source ${String(raw.rewardLookup.source)}`,
    );
  }
  const generation = raw.sideRoomGeneration;
  if (
    generation.kind !== 'visitPressure' ||
    generation.remainingSlots !== 'optional' ||
    generation.forcedOrder !== 'availabilityRankPrefix'
  ) {
    fail(`${path}.sideRoomGeneration`, 'must preserve optional remainder and ranked prefix');
  }
  const minimumPerVisit = Object.freeze({
    numerator: requirePositiveInteger(
      generation.minimumPerVisit.numerator,
      `${path}.sideRoomGeneration.minimumPerVisit.numerator`,
    ),
    denominator: requirePositiveInteger(
      generation.minimumPerVisit.denominator,
      `${path}.sideRoomGeneration.minimumPerVisit.denominator`,
    ),
  });
  if (minimumPerVisit.numerator > minimumPerVisit.denominator) {
    fail(`${path}.sideRoomGeneration.minimumPerVisit`, 'numerator must not exceed denominator');
  }
  const completedExit = normalizeCompletedHubExit(
    raw.completedExit,
    biomeKey,
    rooms,
    exitTypes,
    `${path}.completedExit`,
  );
  if (completedExit.exitKey !== 'preboss') {
    fail(`${path}.completedExit.exitKey`, 'must be preboss');
  }
  return Object.freeze({
    kind: 'hub',
    hubKey: requireNonEmpty(raw.hubKey, `${path}.hubKey`),
    linkedExit,
    roomGameName: hubRoom.gameName,
    slots: Object.freeze(slots),
    openCount: Object.freeze({ min, max }),
    openSlotConstraints: Object.freeze(openSlotConstraints),
    requiredVisits,
    targetCompletion: Object.freeze({ kind: 'requiredRoomObject', objectKey: 'SoulPylon' }),
    restoreRoomGameName: restoreRoom.gameName,
    rewardStorePolicy: normalizeRewardStorePolicy(
      raw.rewardStorePolicy,
      rewardStores,
      `${path}.rewardStorePolicy`,
    ),
    rewardLookup: Object.freeze({
      key: requireNonEmpty(raw.rewardLookup.key, `${path}.rewardLookup.key`),
      source: 'allOpenTargetOffers',
    }),
    sideRoomGeneration: Object.freeze({
      kind: 'visitPressure',
      generatedCountKey: requireNonEmpty(
        generation.generatedCountKey,
        `${path}.sideRoomGeneration.generatedCountKey`,
      ),
      minimumPerVisit,
      remainingSlots: 'optional',
      forcedOrder: 'availabilityRankPrefix',
    }),
    fields: normalizeAuthoredFields(raw.fields ?? [], `${path}.fields`),
    completedExit,
  });
}

function compatibleWithExit(
  source: RoomDeclaration,
  target: RoomDeclaration,
  policy: ExitCompatibilityPolicy,
): boolean {
  if (policy.kind === 'unconstrained') return true;
  if (policy.kind === 'targetHasTag') return target.structuralTags.includes(policy.targetTag);
  return (
    !source.structuralTags.includes(policy.sourceTag) ||
    target.structuralTags.includes(policy.targetTag)
  );
}

function knownTakeoverSourceWidths(
  layout: BiomeLayout,
  rooms: CatalogCollection<RoomDeclaration>,
  preboss: RoomDeclaration,
): readonly number[] | undefined {
  if (
    layout.progression.kind === 'hub' &&
    layout.progression.completedExit.roomGameName === preboss.gameName
  ) {
    return [1];
  }
  if (layout.progression.kind !== 'generated') return undefined;
  const policy = layout.progression.progressionPolicy;
  if (policy.kind !== 'staged') {
    return rooms.values
      .filter(
        (room) =>
          room.biomeKey === preboss.biomeKey &&
          room.mode.kind === 'authored' &&
          room.kind !== 'Preboss' &&
          room.exits.length > 0,
      )
      .map((room) => room.exits.length);
  }
  const finalStage = policy.stages.at(-1);
  if (finalStage === undefined) return undefined;
  return finalStage.roomGameNames.map((gameName) => rooms.byKey[gameName]?.exits.length ?? 0);
}

/**
 * Preboss policy is declaration-owned, but its asserted batch shape must be
 * possible at the layout's supported normal-door frontier. This deliberately
 * checks only static facts: door width, per-source creation caps, and physical
 * exit compatibility. Dynamic eligibility and force pressure remain simulator
 * inputs rather than compiler guesses.
 */
export function validatePrebossBatchPolicies(
  layouts: CatalogCollection<BiomeLayout>,
  rooms: CatalogCollection<RoomDeclaration>,
  exitPolicies: CatalogCollection<ExitCompatibilityPolicy>,
): void {
  for (const preboss of rooms.values) {
    if (preboss.prebossBatchPolicy?.kind !== 'takeOverNormalDoors') continue;
    const layout = layouts.byKey[preboss.biomeKey];
    if (layout === undefined) continue;
    const path = `prebossBatchPolicy.${preboss.gameName}`;
    const sources = rooms.values.filter(
      (room) =>
        room.biomeKey === preboss.biomeKey &&
        room.mode.kind === 'authored' &&
        room.kind !== 'Preboss' &&
        room.exits.length > 0,
    );
    const maximumNormalExitWidth = Math.max(0, ...sources.map((source) => source.exits.length));
    if (
      preboss.caps.maxCreationsPerRoom !== undefined &&
      preboss.caps.maxCreationsPerRoom < maximumNormalExitWidth
    ) {
      fail(
        `${path}.caps.maxCreationsPerRoom`,
        `cannot fill a supported ${maximumNormalExitWidth}-door normal batch`,
      );
    }
    if (
      preboss.caps.maxCreationsThisRun !== undefined &&
      preboss.caps.maxCreationsThisRun < maximumNormalExitWidth
    ) {
      fail(
        `${path}.caps.maxCreationsThisRun`,
        `cannot fill a supported ${maximumNormalExitWidth}-door normal batch`,
      );
    }
    for (const source of sources) {
      for (const exit of source.exits) {
        const policy = exitPolicies.byKey[exit.compatibilityPolicyKey];
        if (policy === undefined || compatibleWithExit(source, preboss, policy)) continue;
        fail(
          `${path}.compatibility`,
          `${preboss.gameName} is incompatible with ${source.gameName} exit ${exit.index}`,
        );
      }
    }
    const widths = knownTakeoverSourceWidths(layout, rooms, preboss);
    if (widths === undefined) continue;
    const maximumSupportedWidth = Math.max(...widths);
    if (preboss.prebossBatchPolicy.remainingOffers.kind === 'none' && maximumSupportedWidth > 1) {
      fail(
        `${path}.remainingOffers`,
        'none is only valid when every supported normal-door source is width one',
      );
    }
    if (
      preboss.prebossBatchPolicy.remainingOffers.kind === 'counted' &&
      maximumSupportedWidth === 1
    ) {
      fail(
        `${path}.remainingOffers`,
        'counted remaining offers are unreachable when every supported source is width one',
      );
    }
  }
}

export function normalizeBiomeLayouts(
  rawLayouts: readonly RawBiomeLayoutDeclaration[],
  biomes: CatalogCollection<BiomeDeclaration>,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
): CatalogCollection<BiomeLayout> {
  const layouts = rawLayouts.map((layout, layoutIndex): BiomeLayout => {
    const path = `biomeLayouts[${layoutIndex}]`;
    requireNonEmpty(layout.biomeKey, `${path}.biomeKey`);
    if (biomes.byKey[layout.biomeKey] === undefined) {
      fail(`${path}.biomeKey`, `unknown biome ${layout.biomeKey}`);
    }
    const progression: ProgressionDescriptor =
      layout.progression.kind === 'generated'
        ? normalizeGeneratedProgression(
            layout.progression,
            layout.biomeKey,
            rooms,
            rewardStores,
            `${path}.progression`,
          )
        : layout.progression.kind === 'hub'
          ? normalizeHubDecision(
              layout.progression,
              layout.biomeKey,
              rooms,
              rewardStores,
              exitTypes,
              `${path}.progression`,
            )
          : fail(
              `${path}.progression.kind`,
              `unknown progression ${String((layout.progression as { kind?: unknown }).kind)}`,
            );
    return Object.freeze({
      biomeKey: layout.biomeKey,
      initialCounters: Object.freeze({
        biomeDepthCache: requireNonNegativeInteger(
          layout.initialCounters.biomeDepthCache,
          `${path}.initialCounters.biomeDepthCache`,
        ),
        biomeEncounterDepth: requireNonNegativeInteger(
          layout.initialCounters.biomeEncounterDepth,
          `${path}.initialCounters.biomeEncounterDepth`,
        ),
      }),
      start: normalizeStart(layout.start, layout.biomeKey, rooms, `${path}.start`),
      progression,
      completion: normalizeCompletion(
        layout.completion,
        layout.biomeKey,
        rooms,
        `${path}.completion`,
      ),
      fields: normalizeAuthoredFields(layout.fields ?? [], `${path}.fields`),
    });
  });
  return createCollection(layouts, 'biomeLayouts', (layout) => layout.biomeKey, 'biomeKey');
}

export function validateDerivedRoomOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
): void {
  const owners = new Map<string, string>();
  const register = (gameName: string, owner: string) => {
    const previous = owners.get(gameName);
    if (previous !== undefined) {
      fail(owner, `${gameName} is already owned by ${previous}`);
    }
    owners.set(gameName, owner);
  };
  for (const layout of layouts.values) {
    const path = `biomeLayouts.${layout.biomeKey}`;
    if (layout.progression.kind === 'hub') {
      register(layout.progression.roomGameName, `${path}.progression`);
    }
    layout.completion.rooms.forEach((completion, index) =>
      register(completion.roomGameName, `${path}.completion.rooms[${index}]`),
    );
  }
  rooms.values.forEach((room, index) => {
    if (room.mode.kind === 'derived' && !owners.has(room.gameName)) {
      fail(`rooms[${index}].mode`, `${room.gameName} has no layout owner`);
    }
  });
}

function visitRewardLookupRequirements(
  requirement: RequirementExpression,
  visit: (lookupKey: string) => void,
): void {
  if (requirement.kind === 'all' || requirement.kind === 'any') {
    requirement.requirements.forEach((child) => visitRewardLookupRequirements(child, visit));
  } else if (requirement.kind === 'not') {
    visitRewardLookupRequirements(requirement.requirement, visit);
  } else if (requirement.kind === 'rewardLookupExcludes') {
    visit(requirement.lookupKey);
  }
}

export function validateRewardLookupOwnership(
  rooms: CatalogCollection<RoomDeclaration>,
  layouts: CatalogCollection<BiomeLayout>,
): void {
  rooms.values.forEach((room, roomIndex) => {
    if (
      room.incomingReward.kind !== 'shop' ||
      room.incomingReward.additionalOptionRequirements === undefined
    ) {
      return;
    }
    const layout = layouts.byKey[room.biomeKey];
    for (const [optionKey, requirement] of Object.entries(
      room.incomingReward.additionalOptionRequirements,
    )) {
      visitRewardLookupRequirements(requirement, (lookupKey) => {
        if (
          layout?.progression.kind !== 'hub' ||
          layout.progression.rewardLookup.key !== lookupKey
        ) {
          fail(
            `rooms[${roomIndex}].incomingReward.additionalOptionRequirements.${optionKey}.lookupKey`,
            `${lookupKey} is not produced by ${room.biomeKey}`,
          );
        }
      });
    }
  });
}
