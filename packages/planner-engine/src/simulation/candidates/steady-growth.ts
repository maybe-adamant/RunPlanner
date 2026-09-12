import type { Catalog } from '../../catalog-schema';
import {
  semanticAddressKey,
  type SteadyGrowthOutcomeAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import {
  assessSteadyGrowthTarget,
  type ReachedSteadyGrowthThreshold,
  type SteadyGrowthTargetAssessment,
} from '../traits/history/transitions';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface SteadyGrowthOutcomeCandidateQuery {
  readonly kind: 'steadyGrowthOutcome';
  readonly outcome: SteadyGrowthOutcomeAddress;
  readonly targetTraitKey: string | null | undefined;
}

export interface EvaluatedSteadyGrowthOutcomeCandidate {
  readonly kind: 'steadyGrowthOutcome';
  readonly result: {
    readonly requiredIntervals: readonly number[];
    readonly eligibleTargetKeys: readonly string[];
    readonly branchSupport: readonly boolean[];
    readonly selectedPossible: boolean;
    readonly emptyNoOp: boolean;
  };
}

/** Exact threshold frontiers retained at one automatic Steady Growth row. */
export interface SteadyGrowthCandidateCapability {
  readonly thresholds: readonly ReachedSteadyGrowthThreshold[];
  readonly evaluate: (
    targetTraitKey: string | null | undefined,
  ) => readonly SteadyGrowthTargetAssessment[];
}
export interface SteadyGrowthCandidateArtifacts {
  readonly at: (address: SteadyGrowthOutcomeAddress) => SteadyGrowthCandidateCapability | undefined;
}
export function createSteadyGrowthCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, readonly ReachedSteadyGrowthThreshold[]>,
): SteadyGrowthCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: SteadyGrowthOutcomeAddress) => {
      const thresholds = privateContexts.get(semanticAddressKey(address));
      if (thresholds === undefined) return undefined;
      return Object.freeze({
        thresholds,
        evaluate: (targetTraitKey: string | null | undefined) =>
          Object.freeze(
            thresholds.map((threshold) =>
              assessSteadyGrowthTarget(catalog, threshold, targetTraitKey),
            ),
          ),
      });
    },
  });
}
export function createEmptySteadyGrowthCandidateArtifacts(): SteadyGrowthCandidateArtifacts {
  return Object.freeze({ at: () => undefined });
}

export function evaluateSteadyGrowthOutcomeCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: SteadyGrowthCandidateArtifacts | undefined,
  query: SteadyGrowthOutcomeCandidateQuery,
): CandidateContextUnavailable | EvaluatedSteadyGrowthOutcomeCandidate {
  const capability = artifacts?.at(query.outcome);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.outcome.routeKey,
      query.outcome.biomeKey,
      query.outcome,
      'afterRoomLifecycle',
    );
  const assessments = capability.evaluate(query.targetTraitKey);
  const first = capability.thresholds[0];
  if (first === undefined)
    return unavailableForBiome(
      evaluation,
      query.outcome.routeKey,
      query.outcome.biomeKey,
      query.outcome,
      'afterRoomLifecycle',
    );
  const branchSupport = Object.freeze(assessments.map((assessment) => assessment.legal));
  const eligibleTargetKeys = capability.thresholds.every(
    (threshold) =>
      JSON.stringify(threshold.eligibleTargetKeys) === JSON.stringify(first.eligibleTargetKeys),
  )
    ? first.eligibleTargetKeys
    : Object.freeze([]);
  return Object.freeze({
    kind: 'steadyGrowthOutcome',
    result: Object.freeze({
      requiredIntervals: Object.freeze(
        capability.thresholds.map((threshold) => threshold.requiredInterval),
      ),
      eligibleTargetKeys,
      branchSupport,
      selectedPossible: branchSupport.length > 0 && branchSupport.every(Boolean),
      emptyNoOp: capability.thresholds.every(
        (threshold) => threshold.eligibleTargetKeys.length === 0,
      ),
    }),
  });
}
