import type { SemanticAddress } from '../authored-project/addresses';
import { findingIdentityKey } from './finding-regions';
import { isRequiredMissingInputFinding, type SemanticFinding } from './model';

/** One chronological assessment stop; its reasons retain their exact repair leaves. */
export interface AssessmentIssue {
  readonly kind: 'incomplete' | 'invalid';
  readonly owner: SemanticAddress;
  readonly regionKey: string;
  readonly reasons: readonly SemanticFinding[];
}

export function createAssessmentIssue(
  owner: SemanticAddress,
  regionKey: string,
  findings: readonly SemanticFinding[],
): AssessmentIssue {
  const reasons = Object.freeze([
    ...new Map(
      findings
        .filter((finding) => finding.severity === 'error')
        .map((finding) => [findingIdentityKey(finding), finding]),
    ).values(),
  ]);
  if (reasons.length === 0) throw new Error('assessment issue requires a blocking reason');
  return Object.freeze({
    kind: reasons.some(isRequiredMissingInputFinding) ? 'incomplete' : 'invalid',
    owner,
    regionKey,
    reasons,
  });
}
