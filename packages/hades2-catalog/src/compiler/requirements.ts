import type { CatalogCollection, EncounterDefinition } from '@run-planner/engine/catalog-schema';
import type {
  NumericRange,
  RequirementExpression,
  RoomStructuralTag,
} from '@run-planner/engine/requirements';
import type { RewardTypeDeclaration } from '@run-planner/engine/reward-kernel';
import { hasRequirementEvaluator } from '@run-planner/engine/requirements';

import {
  freezeUniqueStrings,
  requireNonEmpty,
  requireNonNegativeInteger,
  requirePositiveInteger,
} from './common';
import { fail } from './errors';

function normalizeRange(range: NumericRange, path: string): NumericRange {
  if (range.min === undefined && range.max === undefined) {
    fail(path, 'must declare min, max, or both');
  }

  if (range.min !== undefined) {
    requireNonNegativeInteger(range.min, `${path}.min`);
  }
  if (range.max !== undefined) {
    requireNonNegativeInteger(range.max, `${path}.max`);
  }
  if (range.min !== undefined && range.max !== undefined && range.min > range.max) {
    fail(path, 'min must be less than or equal to max');
  }

  return Object.freeze({
    ...(range.min === undefined ? {} : { min: range.min }),
    ...(range.max === undefined ? {} : { max: range.max }),
  });
}

const knownRoomStructuralTags = new Set<RoomStructuralTag>(['Indoor', 'Outdoor']);

function normalizeRoomStructuralTags(
  tags: readonly RoomStructuralTag[],
  path: string,
): readonly RoomStructuralTag[] {
  if (tags.length === 0) {
    fail(path, 'must not be empty');
  }
  const normalized = freezeUniqueStrings(tags, path);
  for (const tag of normalized) {
    if (!knownRoomStructuralTags.has(tag as RoomStructuralTag)) {
      fail(path, `unknown room structural tag ${String(tag)}`);
    }
  }
  return normalized as readonly RoomStructuralTag[];
}

const saveFileRecords = new Set<string>(['lifetimeGodPickupRecord', 'lifetimeGodUseRecord']);

/**
 * Which derived records a contact carries: every contact has the run ledgers,
 * Encounter Definitions add known encountered enemies, reward-history contacts
 * add resource gains, and ordinary-god loot requirements also add the
 * save-file god records.
 */
type RecordScope = 'run' | 'encounter' | 'rewardHistory' | 'loot';

export function normalizeRequirement(
  requirement: RequirementExpression,
  path: string,
): RequirementExpression {
  return normalizeRequirementWith(requirement, path, 'run');
}

/** An Encounter Definition requirement, evaluated at encounter preparation. */
export function normalizeEncounterDefinitionRequirement(
  requirement: RequirementExpression,
  path: string,
): RequirementExpression {
  return normalizeRequirementWith(requirement, path, 'encounter');
}

/** A reward-store or Shop requirement, evaluated with the branch's reward history. */
export function normalizeRewardHistoryRequirement(
  requirement: RequirementExpression,
  path: string,
): RequirementExpression {
  return normalizeRequirementWith(requirement, path, 'rewardHistory');
}

/** An ordinary god's loot requirement, which may read save-file god records. */
export function normalizeLootRequirement(
  requirement: RequirementExpression,
  path: string,
): RequirementExpression {
  return normalizeRequirementWith(requirement, path, 'loot');
}

function normalizeRequirementWith(
  requirement: RequirementExpression,
  path: string,
  scope: RecordScope,
): RequirementExpression {
  if (!hasRequirementEvaluator(requirement.kind)) {
    fail(`${path}.kind`, `has no current-run evaluator: ${String(requirement.kind)}`);
  }

  switch (requirement.kind) {
    case 'all':
    case 'any': {
      if (requirement.requirements.length === 0) {
        fail(`${path}.requirements`, 'must not be empty');
      }
      return Object.freeze({
        kind: requirement.kind,
        requirements: Object.freeze(
          requirement.requirements.map((child, index) =>
            normalizeRequirementWith(child, `${path}.requirements[${index}]`, scope),
          ),
        ),
      });
    }
    case 'not':
      return Object.freeze({
        kind: 'not',
        requirement: normalizeRequirementWith(
          requirement.requirement,
          `${path}.requirement`,
          scope,
        ),
      });
    case 'counterRange':
      return Object.freeze({
        kind: 'counterRange',
        axis: requirement.axis,
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'recordCount':
    case 'distinctRecordKeyCount':
      if (requirement.keys.length === 0) {
        fail(`${path}.keys`, 'must not be empty');
      }
      if (scope !== 'loot' && saveFileRecords.has(requirement.record)) {
        fail(`${path}.record`, `${requirement.record} is only available to loot requirements`);
      }
      if ((scope === 'run' || scope === 'encounter') && requirement.record === 'resourceGains') {
        fail(`${path}.record`, 'resourceGains is only available where reward history is evaluated');
      }
      if (scope !== 'encounter' && requirement.record === 'knownEncounteredEnemies') {
        fail(
          `${path}.record`,
          'knownEncounteredEnemies is only available to encounter definitions',
        );
      }
      return Object.freeze({
        kind: requirement.kind,
        record: requirement.record,
        keys: freezeUniqueStrings(requirement.keys, `${path}.keys`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'recentEnvelopeSlotCount':
      return Object.freeze({
        kind: 'recentEnvelopeSlotCount',
        envelopeKey: requireNonEmpty(requirement.envelopeKey, `${path}.envelopeKey`),
        slotKey: requireNonEmpty(requirement.slotKey, `${path}.slotKey`),
        roomWindow: requirePositiveInteger(requirement.roomWindow, `${path}.roomWindow`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'encounterKeyCount':
      if (requirement.scope !== 'route' && requirement.scope !== 'biome') {
        fail(`${path}.scope`, `unknown encounter history scope ${String(requirement.scope)}`);
      }
      if (requirement.encounterKeys.length === 0) {
        fail(`${path}.encounterKeys`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'encounterKeyCount',
        scope: requirement.scope,
        encounterKeys: freezeUniqueStrings(requirement.encounterKeys, `${path}.encounterKeys`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'previousRoomEncounterKeyCount':
      if (requirement.encounterKeys.length === 0) {
        fail(`${path}.encounterKeys`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'previousRoomEncounterKeyCount',
        encounterKeys: freezeUniqueStrings(requirement.encounterKeys, `${path}.encounterKeys`),
        roomWindow: requirePositiveInteger(requirement.roomWindow, `${path}.roomWindow`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'notInCurrentRoomShopOptions':
      return Object.freeze({
        kind: 'notInCurrentRoomShopOptions',
        rewardType: requireNonEmpty(requirement.rewardType, `${path}.rewardType`),
      });
    case 'rewardLookupExcludes':
      return Object.freeze({
        kind: 'rewardLookupExcludes',
        lookupKey: requireNonEmpty(requirement.lookupKey, `${path}.lookupKey`),
        rewardType: requireNonEmpty(requirement.rewardType, `${path}.rewardType`),
      });
    case 'minRoomsSinceEvent':
      return Object.freeze({
        kind: 'minRoomsSinceEvent',
        event: requireNonEmpty(requirement.event, `${path}.event`),
        count: requirePositiveInteger(requirement.count, `${path}.count`),
      });
    case 'minExits':
      return Object.freeze({
        kind: 'minExits',
        count: requirePositiveInteger(requirement.count, `${path}.count`),
      });
    case 'offeredRewardExcludes':
      return Object.freeze({
        kind: 'offeredRewardExcludes',
        rewardType: requireNonEmpty(requirement.rewardType, `${path}.rewardType`),
      });
    case 'currentRoomRewardExcludes':
      if (requirement.rewardTypes.length === 0) {
        fail(`${path}.rewardTypes`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'currentRoomRewardExcludes',
        rewardTypes: freezeUniqueStrings(requirement.rewardTypes, `${path}.rewardTypes`),
      });
    case 'currentRoomStructuralTagsInclude':
      return Object.freeze({
        kind: 'currentRoomStructuralTagsInclude',
        tags: normalizeRoomStructuralTags(requirement.tags, `${path}.tags`),
      });
    case 'currentBatchTargetCount':
    case 'clockworkGoalsRemaining':
      return Object.freeze({
        kind: requirement.kind,
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'currentBatchRoomCount':
      if (requirement.roomGameNames.length === 0) {
        fail(`${path}.roomGameNames`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'currentBatchRoomCount',
        roomGameNames: freezeUniqueStrings(requirement.roomGameNames, `${path}.roomGameNames`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'clockworkNonGoalCapacity':
      return Object.freeze({
        kind: 'clockworkNonGoalCapacity',
        reserve: requireNonNegativeInteger(requirement.reserve, `${path}.reserve`),
      });
    case 'flagEquals':
      return Object.freeze({
        kind: 'flagEquals',
        flag: requirement.flag,
        value: requirement.value,
      });
    case 'routeKeyEquals':
      return Object.freeze({
        kind: 'routeKeyEquals',
        routeKey: requireNonEmpty(requirement.routeKey, `${path}.routeKey`),
      });
  }
}

/** Resource-gain record keys must name a resource some declared pickup grants. */
export function validateResourceGainKeys(
  keys: readonly string[],
  resourceKeys: ReadonlySet<string>,
  path: string,
): void {
  keys.forEach((key, index) => {
    if (!resourceKeys.has(key)) {
      fail(`${path}.keys[${index}]`, `unknown resource ${key}`);
    }
  });
}

export function validateRequirementReferences(
  requirement: RequirementExpression,
  rewardTypes: CatalogCollection<RewardTypeDeclaration>,
  path: string,
  resourceKeys?: ReadonlySet<string>,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRequirementReferences(
          child,
          rewardTypes,
          `${path}.requirements[${index}]`,
          resourceKeys,
        ),
      );
      return;
    case 'not':
      validateRequirementReferences(
        requirement.requirement,
        rewardTypes,
        `${path}.requirement`,
        resourceKeys,
      );
      return;
    case 'notInCurrentRoomShopOptions':
    case 'rewardLookupExcludes':
      if (rewardTypes.byKey[requirement.rewardType] === undefined) {
        fail(`${path}.rewardType`, `unknown reward type ${requirement.rewardType}`);
      }
      return;
    case 'offeredRewardExcludes':
      if (rewardTypes.byKey[requirement.rewardType] === undefined) {
        fail(`${path}.rewardType`, `unknown reward type ${requirement.rewardType}`);
      }
      return;
    case 'currentRoomRewardExcludes':
      requirement.rewardTypes.forEach((rewardType, index) => {
        if (rewardTypes.byKey[rewardType] === undefined) {
          fail(`${path}.rewardTypes[${index}]`, `unknown reward type ${rewardType}`);
        }
      });
      return;
    case 'currentRoomStructuralTagsInclude':
      return;
    case 'recordCount':
    case 'distinctRecordKeyCount':
      switch (requirement.record) {
        case 'roomsEntered':
          return;
        case 'knownEncounteredEnemies':
          // Encounter closure validates enemy names.
          return;
        case 'resourceGains':
          if (resourceKeys === undefined) {
            fail(
              `${path}.record`,
              'resourceGains is only available where reward history is evaluated',
            );
          }
          validateResourceGainKeys(requirement.keys, resourceKeys, path);
          return;
        case 'biomeUseRecord':
        case 'lootTypeHistory':
        case 'useRecord':
          requirement.keys.forEach((key, index) => {
            if (rewardTypes.byKey[key] === undefined) {
              fail(`${path}.keys[${index}]`, `unknown reward type ${key}`);
            }
          });
          return;
        case 'lifetimeGodUseRecord':
        case 'lifetimeGodPickupRecord':
          return fail(
            `${path}.record`,
            `${requirement.record} is only available to loot requirements`,
          );
      }
      return;
    case 'encounterKeyCount':
    case 'previousRoomEncounterKeyCount':
    case 'counterRange':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'currentBatchRoomCount':
    case 'currentBatchTargetCount':
    case 'flagEquals':
    case 'minExits':
    case 'minRoomsSinceEvent':
    case 'recentEnvelopeSlotCount':
    case 'routeKeyEquals':
      return;
  }
}

function visitEncounterHistoryRequirementKeys(
  requirement: RequirementExpression,
  visit: (keys: readonly string[], path: string) => void,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        visitEncounterHistoryRequirementKeys(child, visit, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      visitEncounterHistoryRequirementKeys(requirement.requirement, visit, `${path}.requirement`);
      return;
    case 'encounterKeyCount':
    case 'previousRoomEncounterKeyCount':
      visit(requirement.encounterKeys, `${path}.encounterKeys`);
      return;
    default:
      return;
  }
}

/** Known encountered enemy keys must name an enemy some generated composition can record. */
export function validateKnownEnemyRequirementReferences(
  requirement: RequirementExpression,
  recordableEnemyKeys: ReadonlySet<string>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateKnownEnemyRequirementReferences(
          child,
          recordableEnemyKeys,
          `${path}.requirements[${index}]`,
        ),
      );
      return;
    case 'not':
      validateKnownEnemyRequirementReferences(
        requirement.requirement,
        recordableEnemyKeys,
        `${path}.requirement`,
      );
      return;
    case 'recordCount':
    case 'distinctRecordKeyCount':
      if (requirement.record !== 'knownEncounteredEnemies') return;
      requirement.keys.forEach((key, index) => {
        if (!recordableEnemyKeys.has(key)) fail(`${path}.keys[${index}]`, `unknown enemy ${key}`);
      });
      return;
    default:
      return;
  }
}

/** Verifies exact Encounter Definition references after their full collection exists. */
export function validateEncounterRequirementReferences(
  requirement: RequirementExpression,
  encounterDefinitions: CatalogCollection<EncounterDefinition>,
  path: string,
): void {
  visitEncounterHistoryRequirementKeys(
    requirement,
    (keys, keysPath) => {
      keys.forEach((key, index) => {
        if (encounterDefinitions.byKey[key] === undefined) {
          fail(`${keysPath}[${index}]`, `unknown encounter definition ${key}`);
        }
      });
    },
    path,
  );
}

/**
 * Encounter occurrence facts are intentionally available only while resolving
 * Encounter Definitions. Other catalog consumers do not fabricate an
 * encounter-history view merely because the expression type can represent one.
 */
export function rejectEncounterHistoryRequirements(
  requirement: RequirementExpression,
  path: string,
): void {
  visitEncounterHistoryRequirementKeys(
    requirement,
    (_keys, keysPath) => {
      fail(keysPath, 'encounter-history requirements are only supported by encounter definitions');
    },
    path,
  );
}
