import type {
  CounterAxis,
  NumericRange,
  RequirementExpression,
} from '@run-planner/engine/requirements';
import type { RewardStoreEntry } from '@run-planner/engine/reward-kernel';

import { fail } from '../errors';

type HistoryRecord = Extract<RequirementExpression, { kind: 'recordCount' }>['record'];

/**
 * How two same-item entries of one counted store relate. A bag draw consumes
 * one canonical eligible entry of the drawn item, which is sound only when
 * every pair is one of the accepted kinds.
 */
export type SameItemEntryRelation =
  | 'identical'
  | 'declaredInterchangeable'
  | 'mutuallyExclusive'
  | 'monotonicDifference'
  | 'divergent';

function canonicalKey(value: unknown): string {
  if (Array.isArray(value)) return `[${value.map(canonicalKey).join(',')}]`;
  if (value !== null && typeof value === 'object')
    return `{${Object.keys(value)
      .sort()
      .map(
        (key) => `${JSON.stringify(key)}:${canonicalKey((value as Record<string, unknown>)[key])}`,
      )
      .join(',')}}`;
  return JSON.stringify(value);
}

function conjuncts(
  requirement: RequirementExpression | undefined,
): readonly RequirementExpression[] {
  if (requirement === undefined) return [];
  return requirement.kind === 'all' ? requirement.requirements.flatMap(conjuncts) : [requirement];
}

function rangesDisjoint(left: NumericRange, right: NumericRange): boolean {
  return (
    (left.max !== undefined && right.min !== undefined && left.max < right.min) ||
    (right.max !== undefined && left.min !== undefined && right.max < left.min)
  );
}

/** Whether two conjuncts can never hold at one contact. */
function contradicts(left: RequirementExpression, right: RequirementExpression): boolean {
  if (left.kind === 'not') return canonicalKey(left.requirement) === canonicalKey(right);
  if (right.kind === 'not') return canonicalKey(right.requirement) === canonicalKey(left);
  if (left.kind === 'counterRange' && right.kind === 'counterRange')
    return left.axis === right.axis && rangesDisjoint(left.range, right.range);
  if (
    (left.kind === 'recordCount' && right.kind === 'recordCount') ||
    (left.kind === 'distinctRecordKeyCount' && right.kind === 'distinctRecordKeyCount')
  )
    return (
      left.record === right.record &&
      canonicalKey([...left.keys].sort()) === canonicalKey([...right.keys].sort()) &&
      rangesDisjoint(left.range, right.range)
    );
  if (left.kind === 'flagEquals' && right.kind === 'flagEquals')
    return left.flag === right.flag && left.value !== right.value;
  if (left.kind === 'routeKeyEquals' && right.kind === 'routeKeyEquals')
    return left.routeKey !== right.routeKey;
  return false;
}

/** Fixed for the whole run, so it can neither turn true nor false. */
function isRunConstant(requirement: RequirementExpression): boolean {
  switch (requirement.kind) {
    case 'routeKeyEquals':
    case 'equippedAspectEquals':
      return true;
    case 'all':
    case 'any':
      return requirement.requirements.every(isRunConstant);
    case 'not':
      return isRunConstant(requirement.requirement);
    case 'counterRange':
    case 'recordCount':
    case 'distinctRecordKeyCount':
    case 'recentEnvelopeSlotCount':
    case 'encounterKeyCount':
    case 'encounterCompletionCount':
    case 'previousRoomEncounterKeyCount':
    case 'notInCurrentRoomShopOptions':
    case 'rewardLookupExcludes':
    case 'minRoomsSinceEvent':
    case 'minExits':
    case 'currentRoomRewardExcludes':
    case 'offeredRewardExcludes':
    case 'currentRoomStructuralTagsInclude':
    case 'currentBatchTargetCount':
    case 'currentBatchRoomCount':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'flagEquals':
      return false;
  }
}

function neverDecreases(axis: CounterAxis): boolean {
  switch (axis) {
    case 'encounterDepth':
    case 'enteredBiomes':
      return true;
    case 'biomeDepthCache':
    case 'biomeEncounterDepth':
    case 'upgradableTraitCount':
      return false;
  }
}

function neverDecrements(record: HistoryRecord): boolean {
  switch (record) {
    case 'lootTypeHistory':
    case 'useRecord':
    case 'lifetimeGodUseRecord':
    case 'lifetimeGodPickupRecord':
    case 'resourceGains':
      return true;
    case 'biomeUseRecord':
    case 'roomsEntered':
      return false;
  }
}

/** Once true at a contact, true at every later contact of the run. */
function onlyTurnsTrue(requirement: RequirementExpression): boolean {
  switch (requirement.kind) {
    case 'routeKeyEquals':
    case 'equippedAspectEquals':
      return true;
    case 'all':
    case 'any':
      return requirement.requirements.every(onlyTurnsTrue);
    case 'not':
      return isRunConstant(requirement.requirement);
    case 'counterRange':
      return requirement.range.max === undefined && neverDecreases(requirement.axis);
    case 'recordCount':
    case 'distinctRecordKeyCount':
      return requirement.range.max === undefined && neverDecrements(requirement.record);
    case 'recentEnvelopeSlotCount':
    case 'encounterKeyCount':
    case 'encounterCompletionCount':
    case 'previousRoomEncounterKeyCount':
    case 'notInCurrentRoomShopOptions':
    case 'rewardLookupExcludes':
    case 'minRoomsSinceEvent':
    case 'minExits':
    case 'currentRoomRewardExcludes':
    case 'offeredRewardExcludes':
    case 'currentRoomStructuralTagsInclude':
    case 'currentBatchTargetCount':
    case 'currentBatchRoomCount':
    case 'clockworkGoalsRemaining':
    case 'clockworkNonGoalCapacity':
    case 'flagEquals':
      return false;
  }
}

function routesDisjoint(left: RewardStoreEntry, right: RewardStoreEntry): boolean {
  return (
    left.routeKeys !== undefined &&
    right.routeKeys !== undefined &&
    !left.routeKeys.some((routeKey) => right.routeKeys!.includes(routeKey))
  );
}

/** Classifies two normalized entries of the same reward type in one store. */
export function classifySameItemEntries(
  left: RewardStoreEntry,
  right: RewardStoreEntry,
  declaredInterchangeable: boolean,
): SameItemEntryRelation {
  const sameDuplicates = left.allowDuplicates === right.allowDuplicates;
  if (sameDuplicates && canonicalKey(left.requirement) === canonicalKey(right.requirement))
    return 'identical';
  if (declaredInterchangeable) return 'declaredInterchangeable';
  const leftConjuncts = conjuncts(left.requirement);
  const rightConjuncts = conjuncts(right.requirement);
  if (
    routesDisjoint(left, right) ||
    leftConjuncts.some((one) => rightConjuncts.some((other) => contradicts(one, other)))
  )
    return 'mutuallyExclusive';
  const leftKeys = new Set(leftConjuncts.map(canonicalKey));
  const rightKeys = new Set(rightConjuncts.map(canonicalKey));
  const differing = [
    ...leftConjuncts.filter((conjunct) => !rightKeys.has(canonicalKey(conjunct))),
    ...rightConjuncts.filter((conjunct) => !leftKeys.has(canonicalKey(conjunct))),
  ];
  return sameDuplicates && differing.every(onlyTurnsTrue) ? 'monotonicDifference' : 'divergent';
}

/** Rejects a store whose same-item entries can both be eligible and later diverge. */
export function rejectDivergentSameItemEntries(
  storeKey: string,
  entries: readonly RewardStoreEntry[],
  interchangeableRewardTypes: ReadonlySet<string>,
  path: string,
): void {
  entries.forEach((left, leftIndex) =>
    entries.slice(leftIndex + 1).forEach((right) => {
      if (right.rewardType !== left.rewardType) return;
      const relation = classifySameItemEntries(
        left,
        right,
        interchangeableRewardTypes.has(left.rewardType),
      );
      if (relation === 'divergent')
        fail(
          `${path}.entries`,
          `store ${storeKey} declares ${left.rewardType} entries ${left.index} and ${right.index} that can both be eligible and later diverge; make their requirements identical, mutually exclusive or differ only by conditions that never turn false`,
        );
    }),
  );
}
