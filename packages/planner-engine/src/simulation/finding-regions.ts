import { semanticAddressKey, type SemanticAddress } from '../authored-project/addresses';
import type { SemanticFinding } from './model';
import type { ReachedLevelResolutionEvaluation } from './traits';

/** Internal evaluator product; never exported through the public simulation API. */
export interface FindingRegionEntry {
  readonly finding: SemanticFinding;
  readonly atomicRegion: string;
  /** Evaluator-owned chronology for non-linear structures. */
  readonly chronology?: FindingChronology;
  readonly aggregate?: FindingAggregate;
  /** Exact reached Pom contexts retained if later policy eliminates their branches. */
  readonly levelResolutionEvaluations?: readonly ReachedLevelResolutionEvaluation[];
}

export type FindingAggregate = 'generation' | 'reward' | 'encounter';

export interface HistoryFindingChronology {
  readonly kind: 'history';
  readonly sequence: number;
  readonly boundary: 'before' | 'at' | 'after';
}

export type FindingChronology =
  | HistoryFindingChronology
  | { readonly kind: 'hubBoard'; readonly history?: HistoryFindingChronology }
  | {
      readonly kind: 'hubVisit';
      readonly visitIndex: number;
      readonly phase: 'targetLifecycle' | 'sideGeneration' | 'localRoomLifecycle';
      readonly localLifecycleIndex?: number;
      readonly history?: HistoryFindingChronology;
    };

/**
 * Stable semantic identity for a finding, independent of evidence object
 * insertion order. This is intentionally kept beside the internal finding
 * region product so every simulation stage uses the same deduplication key.
 */
export function findingIdentityKey(finding: SemanticFinding): string {
  return JSON.stringify([
    finding.code,
    finding.severity,
    finding.phase,
    semanticAddressKey(finding.origin),
    sortFindingEvidence(finding.evidence),
  ]);
}

function sortFindingEvidence(value: unknown): unknown {
  if (Array.isArray(value)) return value.map((entry) => sortFindingEvidence(entry));
  if (value !== null && typeof value === 'object') {
    return Object.fromEntries(
      Object.entries(value)
        .sort(([left], [right]) => left.localeCompare(right))
        .map(([key, entry]) => [key, sortFindingEvidence(entry)]),
    );
  }
  return value;
}

export function ownerRegion(origin: SemanticAddress): string {
  return `owner:${semanticAddressKey(origin)}`;
}

export function findingRegion(
  finding: SemanticFinding,
  atomicRegion: string = ownerRegion(finding.origin),
  chronology?: FindingChronology,
  aggregate?: FindingAggregate,
): FindingRegionEntry {
  return Object.freeze({
    finding,
    atomicRegion,
    ...(chronology === undefined ? {} : { chronology }),
    ...(aggregate === undefined ? {} : { aggregate }),
  });
}
