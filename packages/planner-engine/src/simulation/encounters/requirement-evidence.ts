import {
  evaluateRequirement,
  type CounterAxis,
  type NumericRange,
  type RequirementEvaluationContext,
  type RequirementExpression,
  type RoomStructuralTag,
} from '../../requirements';

/** Concrete observations at encounter preparation; eligibility remains requirement-owned. */
export type EncounterRequirementEvidence = { readonly satisfied: boolean } & (
  | {
      readonly kind: 'all' | 'any';
      readonly children: readonly EncounterRequirementEvidence[];
    }
  | { readonly kind: 'not'; readonly child: EncounterRequirementEvidence }
  | { readonly kind: 'routeKeyEquals'; readonly expected: string; readonly actual: string }
  | {
      readonly kind: 'counterRange';
      readonly axis: CounterAxis;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'encounterKeyCount';
      readonly scope: 'route' | 'biome';
      readonly encounterKeys: readonly string[];
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'previousRoomEncounterKeyCount';
      readonly encounterKeys: readonly string[];
      readonly matchingEncounterKeys: readonly string[];
      readonly roomWindow: number;
      readonly actual: number;
      readonly expected: NumericRange;
    }
  | {
      readonly kind: 'currentRoomRewardExcludes';
      readonly rewardTypes: readonly string[];
      readonly actual: string | undefined;
    }
  | {
      readonly kind: 'currentRoomStructuralTagsInclude';
      readonly expected: readonly RoomStructuralTag[];
      readonly actual: readonly RoomStructuralTag[];
    }
);

export type EncounterCandidateExclusion =
  | {
      readonly encounterKey: string;
      readonly kind: 'requirements';
      /** Alternative concrete definitions, not jointly required conditions. */
      readonly definitions: readonly {
        readonly encounterDefinitionKey: string;
        readonly evaluation: EncounterRequirementEvidence;
      }[];
    }
  | { readonly encounterKey: string; readonly kind: 'gorgonConsumed' }
  | { readonly encounterKey: string; readonly kind: 'resolutionUnavailable' };

export function encounterRequirementEvidence(
  requirement: RequirementExpression,
  context: RequirementEvaluationContext,
): EncounterRequirementEvidence {
  const satisfied = evaluateRequirement(requirement, context);
  switch (requirement.kind) {
    case 'all':
    case 'any':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        children: Object.freeze(
          requirement.requirements.map((child) => encounterRequirementEvidence(child, context)),
        ),
      });
    case 'not':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        child: encounterRequirementEvidence(requirement.requirement, context),
      });
    case 'counterRange':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        axis: requirement.axis,
        actual: context.counters[requirement.axis],
        expected: requirement.range,
      });
    case 'routeKeyEquals':
      if (context.routeKey === undefined) throw new Error('Missing encounter route');
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        expected: requirement.routeKey,
        actual: context.routeKey,
      });
    case 'encounterKeyCount': {
      if (context.encounterHistory === undefined) throw new Error('Missing encounter history');
      const counts =
        requirement.scope === 'route'
          ? context.encounterHistory.routeEncounterKeyCounts
          : context.encounterHistory.biomeEncounterKeyCounts;
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        scope: requirement.scope,
        encounterKeys: requirement.encounterKeys,
        actual: requirement.encounterKeys.reduce((total, key) => total + (counts[key] ?? 0), 0),
        expected: requirement.range,
      });
    }
    case 'previousRoomEncounterKeyCount': {
      if (context.encounterHistory === undefined) throw new Error('Missing encounter history');
      const previous = context.encounterHistory.previousRoomEncounterKeys.slice(
        -requirement.roomWindow,
      );
      const matches = previous.flatMap((keys) =>
        keys.filter((key) => requirement.encounterKeys.includes(key)),
      );
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        encounterKeys: requirement.encounterKeys,
        matchingEncounterKeys: Object.freeze(matches),
        roomWindow: requirement.roomWindow,
        actual: matches.length,
        expected: requirement.range,
      });
    }
    case 'currentRoomRewardExcludes':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        rewardTypes: requirement.rewardTypes,
        actual: context.currentRoomRewardType,
      });
    case 'currentRoomStructuralTagsInclude':
      return Object.freeze({
        kind: requirement.kind,
        satisfied,
        expected: requirement.tags,
        actual: context.currentRoomStructuralTags,
      });
    default:
      throw new Error(`Encounter preparation cannot explain ${requirement.kind}`);
  }
}
