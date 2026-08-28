import type {
  BiomeDeclaration,
  BiomeLayout,
  CatalogCollection,
  CompletedHubExitDescriptor,
  CompletionDescriptor,
  ExitTypeDeclaration,
  GeneratedProgressionDescriptor,
  GeneratedProgressionPolicy,
  HubEntryNormalDecisionDescriptor,
  HubDecisionDescriptor,
  HubTerminalTakeoverDescriptor,
  NormalDoorBatchPolicy,
  NormalDecisionProgressionDescriptor,
  OceanusAnomalyReplacementDescriptor,
  ProgressionDescriptor,
  RewardStorePolicy,
  RoomDeclaration,
  RoomTemplateKey,
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
  if (room.roomSetKey !== biomeKey) {
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
  const templateKeys = freezeUniqueStrings(
    rawOverrides.map((override) => override.sourceRoomTemplateKey),
    `${path}.sourceRoomTemplateKeys`,
  ) as readonly RoomTemplateKey[];
  return Object.freeze(
    rawOverrides.map((override, index) => {
      const overridePath = `${path}[${index}]`;
      const sourceRoomTemplateKey = templateKeys[index] as RoomTemplateKey;
      if (
        !rooms.values.some(
          (room) =>
            room.roomSetKey === biomeKey &&
            room.mode.kind === 'authored' &&
            room.mode.templateKey === sourceRoomTemplateKey,
        )
      ) {
        fail(
          `${overridePath}.sourceRoomTemplateKey`,
          `${sourceRoomTemplateKey} is not used by an authored room in ${biomeKey}`,
        );
      }
      const policy = normalizeRewardStorePolicy(
        override.policy,
        rewardStores,
        `${overridePath}.policy`,
      );
      if (policy.kind === 'sourceOfferPoint' && sourceRoomTemplateKey !== 'ShipCombat') {
        fail(`${overridePath}.sourceRoomTemplateKey`, 'lastActiveWheel requires ShipCombat');
      }
      return Object.freeze({
        sourceRoomTemplateKey,
        policy,
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
  const room = requireRoom(rawExit.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
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

function normalizeCompletion(
  rawCompletion: CompletionDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): CompletionDescriptor {
  const bossRoom = requireRoom(
    rawCompletion.bossRoomGameName,
    biomeKey,
    rooms,
    `${path}.bossRoomGameName`,
  );
  if (bossRoom.kind !== 'Boss') {
    fail(`${path}.bossRoomGameName`, `${bossRoom.gameName} must be a Boss room`);
  }
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
    bossRoomGameName: bossRoom.gameName,
    transitionEffects: Object.freeze(transitionEffects),
  });
}

type RawNormalDecisionProgression = {
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides?: readonly SourceRewardStorePolicyOverride[];
  readonly bounds: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
};

function normalizeNormalDecisionProgression(
  raw: RawNormalDecisionProgression,
  progressionPolicy: GeneratedProgressionPolicy,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
): NormalDecisionProgressionDescriptor {
  const batchPolicy = normalizeBatchPolicy(raw.batchPolicy, `${path}.batchPolicy`);
  if (batchPolicy.kind === 'fields') {
    for (const room of rooms.values) {
      if (
        room.roomSetKey !== biomeKey ||
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
  const room = requireRoom(
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
  const entry = normalizeNormalDecisionProgression(
    raw,
    normalizeHubEntryProgressionPolicy(
      raw.progressionPolicy,
      biomeKey,
      rooms,
      `${path}.progressionPolicy`,
    ),
    biomeKey,
    rooms,
    rewardStores,
    path,
  );
  if (entry.batchPolicy.kind !== 'standard') {
    fail(`${path}.batchPolicy.kind`, 'must be standard');
  }
  if (entry.rewardStorePolicy.kind !== 'none') {
    fail(`${path}.rewardStorePolicy.kind`, 'must be none');
  }
  if (entry.rewardStoreOverrides.length !== 0) {
    fail(`${path}.rewardStoreOverrides`, 'must be empty');
  }
  if (entry.bounds.maxBatches !== 1 || entry.bounds.maxTargets !== 1) {
    fail(`${path}.bounds`, 'must bound the entry decision to one batch and one target');
  }
  return Object.freeze({ exitKey, ...entry });
}

function normalizeHubTerminal(
  raw: Extract<RawBiomeLayoutDeclaration['progression'], { readonly kind: 'hub' }>['terminal'],
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): HubTerminalTakeoverDescriptor {
  const room = requireRoom(raw.roomGameName, biomeKey, rooms, `${path}.roomGameName`);
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
  return Object.freeze({
    kind: 'generated',
    ...normalizeNormalDecisionProgression(
      raw,
      progressionPolicy,
      biomeKey,
      rooms,
      rewardStores,
      path,
    ),
    ...(raw.anomalyReplacement === undefined
      ? {}
      : {
          anomalyReplacement: normalizeAnomalyReplacement(
            raw.anomalyReplacement,
            biomeKey,
            rooms,
            `${path}.anomalyReplacement`,
          ),
        }),
  });
}

function normalizeAnomalyReplacement(
  raw: OceanusAnomalyReplacementDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): OceanusAnomalyReplacementDescriptor {
  if (raw.kind !== 'oceanusAnomaly') {
    fail(`${path}.kind`, `unknown target replacement ${String((raw as { kind?: unknown }).kind)}`);
  }
  const minimumBiomeDepthCache = requireNonNegativeInteger(
    raw.source.minimumBiomeDepthCache,
    `${path}.source.minimumBiomeDepthCache`,
  );
  const maxEnteredReplacementsThisRoute = requireNonNegativeInteger(
    raw.source.maxEnteredReplacementsThisRoute,
    `${path}.source.maxEnteredReplacementsThisRoute`,
  );
  const excludedRoomGameNames = freezeUniqueStrings(
    raw.source.excludedRoomGameNames,
    `${path}.source.excludedRoomGameNames`,
  );
  excludedRoomGameNames.forEach((gameName, index) => {
    if (rooms.byKey[gameName] === undefined) {
      fail(`${path}.source.excludedRoomGameNames[${index}]`, `unknown room ${gameName}`);
    }
  });
  const excludedSourceEncounterGameNames = freezeUniqueStrings(
    raw.source.excludedSourceEncounterGameNames,
    `${path}.source.excludedSourceEncounterGameNames`,
  );
  const replaceableTargetRoomGameNames = freezeUniqueStrings(
    raw.replaceableTargetRoomGameNames,
    `${path}.replaceableTargetRoomGameNames`,
  );
  if (replaceableTargetRoomGameNames.length === 0) {
    fail(`${path}.replaceableTargetRoomGameNames`, 'must not be empty');
  }
  replaceableTargetRoomGameNames.forEach((gameName, index) => {
    const room = rooms.byKey[gameName];
    if (
      room === undefined ||
      room.roomSetKey !== biomeKey ||
      room.mode.kind !== 'authored' ||
      room.kind !== 'Combat'
    ) {
      fail(
        `${path}.replaceableTargetRoomGameNames[${index}]`,
        `${gameName} must be an authored ${biomeKey} combat room`,
      );
    }
  });
  const replacementRoomGameNames = freezeUniqueStrings(
    raw.replacementRoomGameNames,
    `${path}.replacementRoomGameNames`,
  );
  if (replacementRoomGameNames.length === 0) {
    fail(`${path}.replacementRoomGameNames`, 'must not be empty');
  }
  replacementRoomGameNames.forEach((gameName, index) => {
    const room = rooms.byKey[gameName];
    if (
      room === undefined ||
      room.roomSetKey !== 'Anomaly' ||
      room.mode.kind !== 'authored' ||
      room.kind !== 'Combat' ||
      room.exits.length !== 1 ||
      room.exits[0]?.behavior.kind !== 'automaticHostContinuation'
    ) {
      fail(
        `${path}.replacementRoomGameNames[${index}]`,
        `${gameName} must be an authored Anomaly combat room with automatic host return`,
      );
    }
  });
  const defaultReplacementRoomGameName = requireNonEmpty(
    raw.defaultReplacementRoomGameName,
    `${path}.defaultReplacementRoomGameName`,
  );
  if (!replacementRoomGameNames.includes(defaultReplacementRoomGameName)) {
    fail(`${path}.defaultReplacementRoomGameName`, 'must belong to the replacement room domain');
  }
  return Object.freeze({
    kind: 'oceanusAnomaly',
    source: Object.freeze({
      minimumBiomeDepthCache,
      excludedRoomGameNames,
      excludedSourceEncounterGameNames,
      maxEnteredReplacementsThisRoute,
    }),
    replaceableTargetRoomGameNames,
    replacementRoomGameNames,
    defaultReplacementRoomGameName,
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
  const entry = normalizeHubEntry(raw.entry, biomeKey, rooms, rewardStores, `${path}.entry`);
  const terminal = normalizeHubTerminal(raw.terminal, biomeKey, rooms, `${path}.terminal`);
  const hubRoom = rooms.byKey[terminal.roomGameName] as RoomDeclaration;
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

function validateHubEntryStart(
  start: StartDescriptor,
  progression: HubDecisionDescriptor,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  path: string,
): void {
  if (start.kind !== 'fixedAuthored') {
    fail(`${path}.start`, 'a bounded Hub entry requires one fixed authored Opening');
  }
  const room = requireRoom(start.roomGameName, biomeKey, rooms, `${path}.start.roomGameName`);
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
    const start = normalizeStart(layout.start, layout.biomeKey, rooms, `${path}.start`);
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
    if (progression.kind === 'hub') {
      validateHubEntryStart(start, progression, layout.biomeKey, rooms, path);
    }
    const naturalChaos =
      layout.naturalChaos === undefined
        ? undefined
        : (() => {
            const roomGameNames = freezeUniqueStrings(
              layout.naturalChaos.roomGameNames,
              `${path}.naturalChaos.roomGameNames`,
            );
            if (roomGameNames.length === 0) {
              fail(`${path}.naturalChaos.roomGameNames`, 'must not be empty');
            }
            for (const [index, roomGameName] of roomGameNames.entries()) {
              const room = rooms.byKey[roomGameName];
              if (
                room === undefined ||
                room.roomSetKey !== 'Chaos' ||
                room.mode.kind !== 'authored' ||
                room.mode.templateKey !== 'Chaos'
              ) {
                fail(
                  `${path}.naturalChaos.roomGameNames[${index}]`,
                  'must name an authored Chaos room',
                );
              }
            }
            const defaultRoomGameName = requireNonEmpty(
              layout.naturalChaos.defaultRoomGameName,
              `${path}.naturalChaos.defaultRoomGameName`,
            );
            if (!roomGameNames.includes(defaultRoomGameName)) {
              fail(`${path}.naturalChaos.defaultRoomGameName`, 'must belong to roomGameNames');
            }
            const offerSpacingWindow = requirePositiveInteger(
              layout.naturalChaos.offerSpacingWindow,
              `${path}.naturalChaos.offerSpacingWindow`,
            );
            return Object.freeze({
              roomGameNames: roomGameNames as [string, ...string[]],
              defaultRoomGameName,
              offerSpacingWindow,
            });
          })();
    const sparkChaos =
      layout.sparkChaos === undefined
        ? undefined
        : (() => {
            const roomGameNames = freezeUniqueStrings(
              layout.sparkChaos.roomGameNames,
              `${path}.sparkChaos.roomGameNames`,
            );
            if (roomGameNames.length === 0)
              fail(`${path}.sparkChaos.roomGameNames`, 'must not be empty');
            for (const [index, roomGameName] of roomGameNames.entries()) {
              const room = rooms.byKey[roomGameName];
              if (
                room === undefined ||
                room.roomSetKey !== 'Chaos' ||
                room.mode.kind !== 'authored' ||
                room.mode.templateKey !== 'Chaos'
              )
                fail(
                  `${path}.sparkChaos.roomGameNames[${index}]`,
                  'must name an authored Chaos room',
                );
            }
            const defaultRoomGameName = requireNonEmpty(
              layout.sparkChaos.defaultRoomGameName,
              `${path}.sparkChaos.defaultRoomGameName`,
            );
            if (!roomGameNames.includes(defaultRoomGameName))
              fail(`${path}.sparkChaos.defaultRoomGameName`, 'must belong to roomGameNames');
            return Object.freeze({
              roomGameNames: roomGameNames as [string, ...string[]],
              defaultRoomGameName,
            });
          })();
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
      start,
      progression,
      ...(naturalChaos === undefined ? {} : { naturalChaos }),
      ...(sparkChaos === undefined ? {} : { sparkChaos }),
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
