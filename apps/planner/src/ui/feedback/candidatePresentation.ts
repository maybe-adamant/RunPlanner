import type { CandidateOptionProjection } from '@planner/projections/candidateProjection';
import { candidateSupport } from '@planner/projections/candidateProjection';

export function candidateSelectState(option: CandidateOptionProjection<unknown> | undefined): {
  readonly 'data-candidate-support': ReturnType<typeof candidateSupport>;
} {
  return { 'data-candidate-support': candidateSupport(option) };
}

/**
 * UI controls retain an invalid selected value for repair, but cannot introduce
 * a new declaration-impossible value. Context-unavailable values remain
 * visible: their explanation belongs to the picker rather than this generic
 * affordance rule.
 */
export function candidateMayBeAuthored(
  option: CandidateOptionProjection<unknown> | undefined,
): boolean {
  return option !== undefined && candidateSupport(option) !== 'impossible';
}
