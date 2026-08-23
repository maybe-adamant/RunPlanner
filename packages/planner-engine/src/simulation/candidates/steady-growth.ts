import type { Catalog } from '../../catalog-schema';
import type { SteadyGrowthOutcomeAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { SteadyGrowthCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../project';
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
