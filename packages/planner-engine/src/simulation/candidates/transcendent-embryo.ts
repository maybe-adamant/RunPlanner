import type { TranscendentEmbryoOutcomeAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../../authored-project/model';
import type { TranscendentEmbryoCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface TranscendentEmbryoOutcomeCandidateQuery {
  readonly kind: 'transcendentEmbryoOutcome';
  readonly outcome: TranscendentEmbryoOutcomeAddress;
  readonly blessingKey: string | null | undefined;
}

export interface EvaluatedTranscendentEmbryoOutcomeCandidate {
  readonly kind: 'transcendentEmbryoOutcome';
  readonly result: {
    readonly eligibleBlessingKeys: readonly string[];
    readonly branchSupport: readonly boolean[];
    readonly selectedPossible: boolean;
    readonly emptyNoOp: boolean;
  };
}

export function evaluateTranscendentEmbryoOutcomeCandidate(
  _catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: TranscendentEmbryoCandidateArtifacts | undefined,
  query: TranscendentEmbryoOutcomeCandidateQuery,
): CandidateContextUnavailable | EvaluatedTranscendentEmbryoOutcomeCandidate {
  const capability = artifacts?.at(query.outcome);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.outcome.routeKey,
      query.outcome.biomeKey,
      query.outcome,
      'afterRoomLifecycle',
    );
  const assessments = capability.evaluate(query.blessingKey);
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
  const eligibleBlessingKeys = capability.thresholds.every(
    (threshold) =>
      JSON.stringify(threshold.eligibleBlessingKeys) === JSON.stringify(first.eligibleBlessingKeys),
  )
    ? first.eligibleBlessingKeys
    : Object.freeze([]);
  return Object.freeze({
    kind: 'transcendentEmbryoOutcome',
    result: Object.freeze({
      eligibleBlessingKeys,
      branchSupport,
      selectedPossible: branchSupport.length > 0 && branchSupport.every(Boolean),
      emptyNoOp: capability.thresholds.every(
        (threshold) => threshold.eligibleBlessingKeys.length === 0,
      ),
    }),
  });
}
