import type {
  CatalogCollection,
  NumericRange,
  RequirementExpression,
  RewardPrimitive,
} from '@run-planner/core';
import { hasRequirementEvaluator } from '@run-planner/core';

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

export function normalizeRequirement(
  requirement: RequirementExpression,
  path: string,
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
            normalizeRequirement(child, `${path}.requirements[${index}]`),
          ),
        ),
      });
    }
    case 'not':
      return Object.freeze({
        kind: 'not',
        requirement: normalizeRequirement(requirement.requirement, `${path}.requirement`),
      });
    case 'counterRange':
      return Object.freeze({
        kind: 'counterRange',
        axis: requirement.axis,
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'recordCount':
      if (requirement.keys.length === 0) {
        fail(`${path}.keys`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'recordCount',
        record: requirement.record,
        keys: freezeUniqueStrings(requirement.keys, `${path}.keys`),
        range: normalizeRange(requirement.range, `${path}.range`),
      });
    case 'notInCurrentRoomShopOptions':
      return Object.freeze({
        kind: 'notInCurrentRoomShopOptions',
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
    case 'currentRoomRewardExcludes':
      if (requirement.rewardTypes.length === 0) {
        fail(`${path}.rewardTypes`, 'must not be empty');
      }
      return Object.freeze({
        kind: 'currentRoomRewardExcludes',
        rewardTypes: freezeUniqueStrings(requirement.rewardTypes, `${path}.rewardTypes`),
      });
    case 'flagEquals':
      return Object.freeze({
        kind: 'flagEquals',
        flag: requirement.flag,
        value: requirement.value,
      });
  }
}

export function validateRequirementReferences(
  requirement: RequirementExpression,
  primitives: CatalogCollection<RewardPrimitive>,
  path: string,
): void {
  switch (requirement.kind) {
    case 'all':
    case 'any':
      requirement.requirements.forEach((child, index) =>
        validateRequirementReferences(child, primitives, `${path}.requirements[${index}]`),
      );
      return;
    case 'not':
      validateRequirementReferences(requirement.requirement, primitives, `${path}.requirement`);
      return;
    case 'notInCurrentRoomShopOptions':
      if (primitives.byKey[requirement.rewardType] === undefined) {
        fail(`${path}.rewardType`, `unknown reward primitive ${requirement.rewardType}`);
      }
      return;
    case 'currentRoomRewardExcludes':
      requirement.rewardTypes.forEach((rewardType, index) => {
        if (primitives.byKey[rewardType] === undefined) {
          fail(`${path}.rewardTypes[${index}]`, `unknown reward primitive ${rewardType}`);
        }
      });
      return;
    case 'recordCount':
      if (requirement.record !== 'roomsEntered') {
        requirement.keys.forEach((key, index) => {
          if (primitives.byKey[key] === undefined) {
            fail(`${path}.keys[${index}]`, `unknown reward primitive ${key}`);
          }
        });
      }
      return;
    case 'counterRange':
    case 'flagEquals':
    case 'minExits':
    case 'minRoomsSinceEvent':
      return;
  }
}
