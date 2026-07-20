import type { CandidateOptionProjection } from '../application/candidateProjection';
import { candidateSupport } from '../application/candidateProjection';

export function candidateSelectState(option: CandidateOptionProjection<unknown> | undefined): {
  readonly 'data-candidate-support': ReturnType<typeof candidateSupport>;
} {
  return { 'data-candidate-support': candidateSupport(option) };
}
