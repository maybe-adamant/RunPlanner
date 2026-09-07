import { semanticAddressKey, type SemanticAddress } from '../authored-project/addresses';
import type { SemanticFinding } from './model';
import type { ReachedLevelResolutionEvaluation } from './trait-level-effects';

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

/**
 * Atomic authoring identity for generated sibling sets. This remains engine
 * vocabulary: consumers compare the opaque key and never reconstruct these
 * groupings from rendered controls.
 */
export function authoringRegion(origin: SemanticAddress): string {
  if (origin.kind === 'hubOpenSet' || origin.kind === 'hubSlot') {
    return `hubBoard:${origin.routeKey}:${origin.biomeKey}:${origin.hubKey}`;
  }
  if (
    origin.kind === 'localVisitDecision' ||
    origin.kind === 'localVisitSlot' ||
    origin.kind === 'localVisitOrder'
  ) {
    return `hubSideGeneration:${origin.routeKey}:${origin.biomeKey}:${origin.sourceOccurrenceId}:${origin.groupKey}`;
  }
  if (origin.kind === 'rewardWheelOffer') {
    return `rewardWheelOffers:${origin.routeKey}:${origin.biomeKey}:${origin.occurrenceId}:${origin.wheelKey}`;
  }
  if (origin.kind === 'localReward' && origin.groupKey === 'optionalRewards') {
    return `fieldsOptionalRewards:${origin.routeKey}:${origin.biomeKey}:${origin.occurrenceId}`;
  }

  let traitOwner = origin;
  while (
    traitOwner.kind === 'traitAcquisitionTarget' ||
    traitOwner.kind === 'circeResolution' ||
    traitOwner.kind === 'echoPomTarget' ||
    traitOwner.kind === 'naturalSelectionResult' ||
    traitOwner.kind === 'echoLastRunBoon' ||
    traitOwner.kind === 'echoLastReward' ||
    traitOwner.kind === 'allTogetherSet'
  ) {
    traitOwner = traitOwner.trait;
  }
  if (traitOwner.kind === 'traitOffer') {
    return `traitOffer:${semanticAddressKey(traitOwner)}`;
  }
  return ownerRegion(origin);
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
