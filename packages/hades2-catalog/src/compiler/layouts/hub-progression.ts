import type {
  CatalogCollection,
  CompletedHubExitDescriptor,
  ExitTypeDeclaration,
  GeneratedProgressionPolicy,
  HubDecisionDescriptor,
  HubEntryNormalDecisionDescriptor,
  HubTerminalTakeoverDescriptor,
  RoomDeclaration,
  StartDescriptor,
} from '@run-planner/engine/catalog-schema';
import type { RequirementExpression } from '@run-planner/engine/requirements';
import type { RewardStoreDeclaration } from '@run-planner/engine/reward-kernel';

import type { RawBiomeLayoutDeclaration } from '../../declarations/index';
import { freezeUniqueStrings, requireNonEmpty, requirePositiveInteger } from '../common';
import { normalizeAuthoredFields } from '../descriptors';
import { fail } from '../errors';
import {
  normalizeNormalDecisionProgressionCommon,
  normalizeRewardStorePolicy,
} from './generated-progression';
import { requireLayoutRoom } from './start-completion';

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
  const exitKey = requireNonEmpty(rawExit.exitKey, `${path}.exitKey`);
  const room = requireLayoutRoom(rawExit.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (room.mode.kind !== 'authored' || room.kind !== 'Preboss') {
    fail(`${path}.roomGameName`, `${room.gameName} must be an authored Preboss`);
  }
  const index = requirePositiveInteger(rawExit.physicalExit.index, `${path}.physicalExit.index`);
  const type = requireNonEmpty(rawExit.physicalExit.type, `${path}.physicalExit.type`);
  const exitType = exitTypes.byKey[type];
  if (exitType === undefined) {
    fail(`${path}.physicalExit.type`, `unknown exit type ${type}`);
  }
  return Object.freeze({
    exitKey,
    roomGameName: room.gameName,
    physicalExit: Object.freeze({
      index,
      type: exitType.key,
      compatibilityPolicyKey: exitType.compatibilityPolicyKey,
      behavior: exitType.behavior,
    }),
  });
}

function isExactBiomeDepthRequirement(
  requirement: RequirementExpression | undefined,
  depth: number,
): boolean {
  return (
    requirement?.kind === 'counterRange' &&
    requirement.axis === 'biomeDepthCache' &&
    requirement.range.min === depth &&
    requirement.range.max === depth
  );
}

function normalizeExactBiomeDepthRequirement(
  requirement: RequirementExpression,
  depth: number,
  path: string,
): RequirementExpression {
  if (!isExactBiomeDepthRequirement(requirement, depth)) {
    fail(path, `must be biomeDepthCache exactly ${depth}`);
  }
  return Object.freeze({
    kind: 'counterRange' as const,
    axis: 'biomeDepthCache' as const,
    range: Object.freeze({ min: depth, max: depth }),
  });
}

function normalizeHubEntryProgressionPolicy(
  rawPolicy: GeneratedProgressionPolicy,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): Extract<GeneratedProgressionPolicy, { readonly kind: 'staged' }> {
  if (rawPolicy.kind !== 'staged') {
    fail(`${path}.kind`, 'must be staged');
  }
  if (rawPolicy.stages.length !== 1) {
    fail(`${path}.stages`, 'must declare exactly one entry stage');
  }
  const stage = rawPolicy.stages[0];
  if (stage === undefined) {
    fail(`${path}.stages`, 'must declare exactly one entry stage');
  }
  const key = requireNonEmpty(stage.key, `${path}.stages[0].key`);
  if (key !== 'entry') {
    fail(`${path}.stages[0].key`, 'must be entry');
  }
  const roomGameNames = freezeUniqueStrings(stage.roomGameNames, `${path}.stages[0].roomGameNames`);
  if (roomGameNames.length !== 1) {
    fail(`${path}.stages[0].roomGameNames`, 'must contain exactly one PreHub room');
  }
  const room = requireLayoutRoom(
    roomGameNames[0] as string,
    biomeKey,
    rooms,
    `${path}.stages[0].roomGameNames[0]`,
  );
  if (room.mode.kind !== 'authored' || room.kind !== 'PreHub') {
    fail(`${path}.stages[0].roomGameNames[0]`, `${room.gameName} must be an authored PreHub`);
  }
  if (!isExactBiomeDepthRequirement(room.eligibility, 1)) {
    fail(`${path}.stages[0].roomGameNames[0]`, `${room.gameName} must be eligible at depth 1`);
  }
  return Object.freeze({
    kind: 'staged',
    stages: Object.freeze([Object.freeze({ key, roomGameNames })]),
  });
}

function normalizeHubEntry(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'hub' }>['entry'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): HubEntryNormalDecisionDescriptor {
  const exitKey = requireNonEmpty(raw.exitKey, `${path}.exitKey`);
  if (exitKey !== 'prehub') {
    fail(`${path}.exitKey`, 'must be prehub');
  }
  const progressionPolicy = normalizeHubEntryProgressionPolicy(
    raw.progressionPolicy,
    biomeKey,
    rooms,
    `${path}.progressionPolicy`,
  );
  const common = normalizeNormalDecisionProgressionCommon(raw, biomeKey, rooms, rewardStores, path);
  if (common.batchPolicy.kind !== 'standard') {
    fail(`${path}.batchPolicy.kind`, 'must be standard');
  }
  if (common.rewardStorePolicy.kind !== 'none') {
    fail(`${path}.rewardStorePolicy.kind`, 'must be none');
  }
  if (common.rewardStoreOverrides.length !== 0) {
    fail(`${path}.rewardStoreOverrides`, 'must be empty');
  }
  if (raw.bounds === undefined) {
    fail(`${path}.bounds`, 'Hub entry progression requires structural bounds');
  }
  const maxBatches = requirePositiveInteger(raw.bounds.maxBatches, `${path}.bounds.maxBatches`);
  const maxTargets = requirePositiveInteger(raw.bounds.maxTargets, `${path}.bounds.maxTargets`);
  if (maxBatches !== 1 || maxTargets !== 1) {
    fail(`${path}.bounds`, 'must bound the entry decision to one batch and one target');
  }
  return Object.freeze({
    exitKey,
    progressionPolicy,
    ...common,
    bounds: Object.freeze({ maxBatches, maxTargets }),
  });
}

function normalizeHubTerminal(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'hub' }>['terminal'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): HubTerminalTakeoverDescriptor {
  const room = requireLayoutRoom(raw.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
  if (room.kind !== 'Hub' || room.mode.kind !== 'derived' || room.mode.classification !== 'hub') {
    fail(`${path}.roomGameName`, `${room.gameName} must be a derived Hub room`);
  }
  if (raw.force !== 'required') {
    fail(`${path}.force`, 'must be required');
  }
  return Object.freeze({
    roomGameName: room.gameName,
    eligibility: normalizeExactBiomeDepthRequirement(raw.eligibility, 2, `${path}.eligibility`),
    force: 'required',
  });
}

export function normalizeHubDecision(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'hub' }>,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  exitTypes: CatalogCollection<ExitTypeDeclaration>,
  path: string,
): HubDecisionDescriptor {
  const entry = normalizeHubEntry(raw.entry, biomeKey, rooms, rewardStores, `${path}.entry`);
  const terminal = normalizeHubTerminal(raw.terminal, biomeKey, rooms, `${path}.terminal`);
  const hubRoom = rooms.byKey[terminal.roomGameName] as RoomDeclaration;
  const restoreRoom = requireLayoutRoom(
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
    const room = requireLayoutRoom(slot.roomGameName, biomeKey, rooms, `${slotPath}.roomGameName`);
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
    entry,
    terminal,
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

export function validateHubEntryStart(
  start: StartDescriptor,
  progression: HubDecisionDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): void {
  if (start.kind !== 'fixedAuthored') {
    fail(`${path}.start`, 'a bounded Hub entry requires one fixed authored Opening');
  }
  const room = requireLayoutRoom(start.roomGameName, biomeKey, rooms, `${path}.start.roomGameName`);
  if (room.mode.kind !== 'authored' || room.kind !== 'Opening') {
    fail(`${path}.start.roomGameName`, `${room.gameName} must be an authored Opening`);
  }
  if (room.exits.length !== 1) {
    fail(`${path}.start.roomGameName`, `${room.gameName} must have exactly one normal exit`);
  }
  if (progression.entry.bounds.maxTargets !== room.exits.length) {
    fail(`${path}.progression.entry.bounds.maxTargets`, 'must cover the fixed Opening exit count');
  }
}
