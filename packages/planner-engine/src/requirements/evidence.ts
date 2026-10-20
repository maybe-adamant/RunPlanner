import {
  evaluateRequirement,
  recordRequirementCount,
  type RequirementEvaluationContext,
} from './evaluator';
import type {
  CounterAxis,
  CurrentRunFlag,
  HistoryRecord,
  NumericRange,
  RequirementExpression,
  RoomStructuralTag,
} from './model';

/** One requirement's verdict with the concrete facts it compared. */
export type RequirementEvaluationEvidence =
  | {
      readonly kind: 'routeKeyEquals';
      readonly satisfied: boolean;
      readonly expected: string;
    }
  | {
      readonly kind: 'all' | 'any';
      readonly satisfied: boolean;
      readonly children: readonly RequirementEvaluationEvidence[];
    }
  | {
      readonly kind: 'not';
      readonly satisfied: boolean;
      readonly child: RequirementEvaluationEvidence;
    }
  | {
      readonly kind: 'counterRange';
      readonly satisfied: boolean;
      readonly axis: CounterAxis;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'recordCount' | 'distinctRecordKeyCount';
      readonly satisfied: boolean;
      readonly record: HistoryRecord;
      readonly keys: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'recentEnvelopeSlotCount';
      readonly satisfied: boolean;
      readonly envelopeKey: string;
      readonly slotKey: string;
      readonly roomWindow: number;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'encounterKeyCount';
      readonly satisfied: boolean;
      readonly scope: 'route' | 'biome';
      readonly encounterKeys: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'encounterCompletionCount';
      readonly satisfied: boolean;
      readonly encounterKeys: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'previousRoomEncounterKeyCount';
      readonly satisfied: boolean;
      readonly encounterKeys: readonly string[];
      readonly roomWindow: number;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'notInCurrentRoomShopOptions' | 'offeredRewardExcludes';
      readonly satisfied: boolean;
      readonly rewardType: string;
    }
  | {
      readonly kind: 'rewardLookupExcludes';
      readonly satisfied: boolean;
      readonly lookupKey: string;
      readonly rewardType: string;
    }
  | {
      readonly kind: 'minRoomsSinceEvent';
      readonly satisfied: boolean;
      readonly event: string;
      readonly minimum: number;
      /** Rooms since the event, or null when it has not happened this run. */
      readonly actual: number | null;
    }
  | {
      readonly kind: 'minExits';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly minimum: number;
    }
  | {
      readonly kind: 'currentRoomRewardExcludes';
      readonly satisfied: boolean;
      readonly rewardTypes: readonly string[];
      readonly actual: string | null;
    }
  | {
      readonly kind: 'currentRoomStructuralTagsInclude';
      readonly satisfied: boolean;
      readonly expected: readonly RoomStructuralTag[];
      readonly actual: readonly RoomStructuralTag[];
    }
  | {
      readonly kind: 'currentBatchTargetCount';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'currentBatchRoomCount';
      readonly satisfied: boolean;
      readonly roomGameNames: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'clockworkGoalsRemaining';
      readonly satisfied: boolean;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'clockworkNonGoalCapacity';
      readonly satisfied: boolean;
      readonly acquired: number;
      readonly maximum: number;
      readonly reserve: number;
    }
  | {
      readonly kind: 'flagEquals';
      readonly satisfied: boolean;
      readonly flag: CurrentRunFlag;
      readonly expected: boolean;
    }
  | {
      readonly kind: 'equippedAspectEquals';
      readonly satisfied: boolean;
      readonly expected: string;
      readonly actual: string | null;
    };

function encounterHistory(context: RequirementEvaluationContext) {
  if (context.encounterHistory === undefined)
    throw new Error('encounter requirement evidence has no encounter history facts');
  return context.encounterHistory;
}

function clockwork(context: RequirementEvaluationContext) {
  if (context.clockwork === undefined)
    throw new Error('Clockwork requirement evidence has no Clockwork facts');
  return context.clockwork;
}

/** Explains a requirement over the same context its evaluator reads. */
export function requirementEvidence(
  requirement: RequirementExpression,
  context: RequirementEvaluationContext,
): RequirementEvaluationEvidence {
  const satisfied = evaluateRequirement(requirement, context);
  switch (requirement.kind) {
    case 'routeKeyEquals':
      return Object.freeze({ kind: requirement.kind, satisfied, expected: requirement.routeKey });
    case 'all':
    case 'any':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        children: Object.freeze(
          requirement.requirements.map((child) => requirementEvidence(child, context)),
        ),
      });
    case 'not':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        child: requirementEvidence(requirement.requirement, context),
      });
    case 'counterRange':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        axis: requirement.axis,
        actual: context.counters[requirement.axis],
        expected: requirement.range,
      });
    case 'recordCount':
    case 'distinctRecordKeyCount':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        record: requirement.record,
        keys: requirement.keys,
        actual: recordRequirementCount(requirement, context),
        expected: requirement.range,
      });
    case 'recentEnvelopeSlotCount': {
      const recentRooms = context.recentEncounterEnvelopeSlots.slice(-requirement.roomWindow);
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        envelopeKey: requirement.envelopeKey,
        slotKey: requirement.slotKey,
        roomWindow: requirement.roomWindow,
        actual: recentRooms.reduce(
          (total, room) =>
            total +
            (room.envelopeKey === requirement.envelopeKey &&
            room.slotKeys.includes(requirement.slotKey)
              ? 1
              : 0),
          0,
        ),
        expected: requirement.range,
      });
    }
    case 'encounterKeyCount': {
      const history = encounterHistory(context);
      const counts =
        requirement.scope === 'route'
          ? history.routeEncounterKeyCounts
          : history.biomeEncounterKeyCounts;
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        scope: requirement.scope,
        encounterKeys: requirement.encounterKeys,
        actual: requirement.encounterKeys.reduce((total, key) => total + (counts[key] ?? 0), 0),
        expected: requirement.range,
      });
    }
    case 'encounterCompletionCount': {
      const counts = encounterHistory(context).routeEncounterCompletionCounts;
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        encounterKeys: requirement.encounterKeys,
        actual: requirement.encounterKeys.reduce((total, key) => total + (counts[key] ?? 0), 0),
        expected: requirement.range,
      });
    }
    case 'previousRoomEncounterKeyCount': {
      const previousRooms = encounterHistory(context).previousRoomEncounterKeys.slice(
        -requirement.roomWindow,
      );
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        encounterKeys: requirement.encounterKeys,
        roomWindow: requirement.roomWindow,
        actual: previousRooms.reduce(
          (total, keys) =>
            total + keys.filter((key) => requirement.encounterKeys.includes(key)).length,
          0,
        ),
        expected: requirement.range,
      });
    }
    case 'notInCurrentRoomShopOptions':
    case 'offeredRewardExcludes':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        rewardType: requirement.rewardType,
      });
    case 'rewardLookupExcludes':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        lookupKey: requirement.lookupKey,
        rewardType: requirement.rewardType,
      });
    case 'minRoomsSinceEvent': {
      const lastDepth = context.lastEventRunDepthCaches[requirement.event];
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        event: requirement.event,
        minimum: requirement.count,
        actual: lastDepth === undefined ? null : context.runDepthCache - lastDepth,
      });
    }
    case 'minExits':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: context.offeredExitCount,
        minimum: requirement.count,
      });
    case 'currentRoomRewardExcludes':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        rewardTypes: requirement.rewardTypes,
        actual: context.currentRoomRewardType ?? null,
      });
    case 'currentRoomStructuralTagsInclude':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        expected: requirement.tags,
        actual: context.currentRoomStructuralTags,
      });
    case 'currentBatchTargetCount':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: context.currentBatchRoomGameNames.length,
        expected: requirement.range,
      });
    case 'currentBatchRoomCount':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        roomGameNames: requirement.roomGameNames,
        actual: context.currentBatchRoomGameNames.filter((gameName) =>
          requirement.roomGameNames.includes(gameName),
        ).length,
        expected: requirement.range,
      });
    case 'clockworkGoalsRemaining':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        actual: clockwork(context).remainingGoals,
        expected: requirement.range,
      });
    case 'clockworkNonGoalCapacity': {
      const facts = clockwork(context);
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        acquired: facts.nonGoalRewardsAcquired,
        maximum: facts.maxNonGoalRewards,
        reserve: requirement.reserve,
      });
    }
    case 'flagEquals':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        flag: requirement.flag,
        expected: requirement.value,
      });
    case 'equippedAspectEquals':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        expected: requirement.aspectKey,
        actual: context.equippedAspectKey ?? null,
      });
  }
}
