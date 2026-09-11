import type { ExitDecisionSource } from '../model';

/** Stable internal identity for one persisted exit-decision source. */
export function exitDecisionSourceKey(source: ExitDecisionSource): string {
  return source.kind === 'occurrence'
    ? `occurrence:${source.occurrenceId}`
    : `hubDecision:${source.decisionKey}`;
}

/** Equality for structural sources, independent of public address serialization. */
export function sameExitDecisionSource(
  left: ExitDecisionSource,
  right: ExitDecisionSource,
): boolean {
  return left.kind === 'occurrence' && right.kind === 'occurrence'
    ? left.occurrenceId === right.occurrenceId
    : left.kind === 'hubDecision' &&
        right.kind === 'hubDecision' &&
        left.decisionKey === right.decisionKey;
}
