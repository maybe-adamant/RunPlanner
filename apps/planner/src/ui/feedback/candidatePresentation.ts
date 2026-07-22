import type { CandidateOptionProjection } from '../../projections/candidateProjection';
import { candidateSupport } from '../../projections/candidateProjection';

export function candidateSelectState(option: CandidateOptionProjection<unknown> | undefined): {
  readonly 'data-candidate-support': ReturnType<typeof candidateSupport>;
} {
  return { 'data-candidate-support': candidateSupport(option) };
}
