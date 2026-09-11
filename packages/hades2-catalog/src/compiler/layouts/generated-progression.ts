import type {
  CatalogCollection,
  GeneratedProgressionDescriptor,
  GeneratedProgressionPolicy,
  NormalDoorBatchPolicy,
  OceanusAnomalyReplacementDescriptor,
  RewardStorePolicy,
  RoomDeclaration,
  RoomTemplateKey,
  SourceRewardStorePolicyOverride,
} from '@run-planner/engine/catalog-schema';
import type { RewardStoreDeclaration } from '@run-planner/engine/reward-kernel';

import type { RawBiomeLayoutDeclaration } from '../../declarations/index';
import {
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from '../common';
import { normalizeAuthoredFields } from '../descriptors';
import { fail } from '../errors';
import { requireLayoutRoom } from './start-completion';

export function normalizeRewardStorePolicy(
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
            const room = requireLayoutRoom(
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

export type RawNormalDecisionProgression = {
  readonly batchPolicy: NormalDoorBatchPolicy;
  readonly rewardStorePolicy: RewardStorePolicy;
  readonly rewardStoreOverrides?: readonly SourceRewardStorePolicyOverride[];
  readonly bounds?: {
    readonly maxBatches: number;
    readonly maxTargets: number;
  };
};

export function normalizeNormalDecisionProgressionCommon(
  raw: RawNormalDecisionProgression,
  biomeKey: string,
  rooms: CatalogCollection<RoomDeclaration>,
  rewardStores: CatalogCollection<RewardStoreDeclaration>,
  path: string,
) {
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
  return Object.freeze({
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
  });
}

export function normalizeGeneratedProgression(
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
  if ('bounds' in raw && raw.bounds !== undefined) {
    fail(`${path}.bounds`, 'generated progression cannot declare structural bounds');
  }
  return Object.freeze({
    kind: 'generated',
    progressionPolicy,
    ...normalizeNormalDecisionProgressionCommon(raw, biomeKey, rooms, rewardStores, path),
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
