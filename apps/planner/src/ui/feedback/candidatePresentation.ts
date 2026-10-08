import type {
  CandidateOptionProjection,
  CandidateProjectionEvaluation,
} from '@planner/projections/candidates/candidateProjection';
import { candidateSupport } from '@planner/projections/candidates/candidateProjection';

export function candidateSelectState(
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): {
  readonly 'data-candidate-support': ReturnType<typeof candidateSupport>;
} {
  return { 'data-candidate-support': candidateSupport(option) };
}

/** Hint of a control whose candidate context is unreached. */
export const candidateWaitingHint = 'Waits on an earlier choice';

/** Whether this evaluated candidate's context is unreached. */
export function candidateWaits(
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): boolean {
  return option?.evaluation.kind === 'unavailable';
}

/**
 * UI controls retain an invalid or unevaluated selected value, but cannot
 * introduce a declaration-impossible or unevaluated one. Layout permits
 * engine-approved conflict edits without treating the conflicting placement
 * as valid.
 */
export function candidateMayBeAuthored(
  option: CandidateOptionProjection<unknown, CandidateProjectionEvaluation> | undefined,
): boolean {
  if (option?.evaluation.kind === 'fieldsSpatialPoint') return option.evaluation.result.assignable;
  return (
    option !== undefined &&
    candidateSupport(option) !== 'impossible' &&
    candidateSupport(option) !== 'unavailable'
  );
}
