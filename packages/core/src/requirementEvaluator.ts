import type {
  CounterAxis,
  CurrentRunFlag,
  HistoryRecord,
  NumericRange,
  RequirementExpression,
} from './requirements';

export type RequirementKind = RequirementExpression['kind'];

export interface RequirementEvaluationContext {
  readonly counters: Readonly<Record<CounterAxis, number>>;
  readonly records: Readonly<Record<HistoryRecord, Readonly<Record<string, number>>>>;
  readonly currentRoomShopOptionNames: ReadonlySet<string>;
  readonly currentRoomRewardType: string | undefined;
  readonly runDepthCache: number;
  readonly lastEventRunDepthCaches: Readonly<Record<string, number>>;
  readonly offeredExitCount: number;
  readonly flags: Readonly<Record<CurrentRunFlag, boolean>>;
}

type RequirementOfKind<Kind extends RequirementKind> = Extract<
  RequirementExpression,
  { readonly kind: Kind }
>;

export type RequirementEvaluator<Kind extends RequirementKind> = (
  requirement: RequirementOfKind<Kind>,
  context: RequirementEvaluationContext,
) => boolean;

export type RequirementEvaluatorRegistry = {
  readonly [Kind in RequirementKind]: RequirementEvaluator<Kind>;
};

function isInRange(value: number, range: NumericRange): boolean {
  return (
    (range.min === undefined || value >= range.min) &&
    (range.max === undefined || value <= range.max)
  );
}

export const requirementEvaluatorRegistry = Object.freeze({
  all: (requirement, context) =>
    requirement.requirements.every((child) => evaluateRequirement(child, context)),
  any: (requirement, context) =>
    requirement.requirements.some((child) => evaluateRequirement(child, context)),
  not: (requirement, context) => !evaluateRequirement(requirement.requirement, context),
  counterRange: (requirement, context) =>
    isInRange(context.counters[requirement.axis], requirement.range),
  recordCount: (requirement, context) => {
    const record = context.records[requirement.record];
    const count = requirement.keys.reduce((total, key) => total + (record[key] ?? 0), 0);
    return isInRange(count, requirement.range);
  },
  notInCurrentRoomShopOptions: (requirement, context) =>
    !context.currentRoomShopOptionNames.has(requirement.rewardType),
  minRoomsSinceEvent: (requirement, context) => {
    const lastDepth = context.lastEventRunDepthCaches[requirement.event];
    return (
      lastDepth === undefined ||
      lastDepth === context.runDepthCache ||
      context.runDepthCache - requirement.count >= lastDepth
    );
  },
  minExits: (requirement, context) => context.offeredExitCount >= requirement.count,
  currentRoomRewardExcludes: (requirement, context) =>
    context.currentRoomRewardType === undefined ||
    !requirement.rewardTypes.includes(context.currentRoomRewardType),
  flagEquals: (requirement, context) => context.flags[requirement.flag] === requirement.value,
} satisfies RequirementEvaluatorRegistry);

export function hasRequirementEvaluator(kind: string): kind is RequirementKind {
  return Object.hasOwn(requirementEvaluatorRegistry, kind);
}

export function evaluateRequirement(
  requirement: RequirementExpression,
  context: RequirementEvaluationContext,
): boolean {
  switch (requirement.kind) {
    case 'all':
      return requirementEvaluatorRegistry.all(requirement, context);
    case 'any':
      return requirementEvaluatorRegistry.any(requirement, context);
    case 'not':
      return requirementEvaluatorRegistry.not(requirement, context);
    case 'counterRange':
      return requirementEvaluatorRegistry.counterRange(requirement, context);
    case 'recordCount':
      return requirementEvaluatorRegistry.recordCount(requirement, context);
    case 'notInCurrentRoomShopOptions':
      return requirementEvaluatorRegistry.notInCurrentRoomShopOptions(requirement, context);
    case 'minRoomsSinceEvent':
      return requirementEvaluatorRegistry.minRoomsSinceEvent(requirement, context);
    case 'minExits':
      return requirementEvaluatorRegistry.minExits(requirement, context);
    case 'currentRoomRewardExcludes':
      return requirementEvaluatorRegistry.currentRoomRewardExcludes(requirement, context);
    case 'flagEquals':
      return requirementEvaluatorRegistry.flagEquals(requirement, context);
  }
}
