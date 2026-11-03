import type { TranscendentEmbryoOutcomeAddress } from '../../authored-project/addresses';
import type { AuthoredKeepsakeEquipResults } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { ProjectDocument } from '../../authored-project/model';
import { type TranscendentEmbryoCandidateArtifacts } from '../keepsakes/candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface TranscendentEmbryoOutcomeCandidateQuery {
  readonly kind: 'transcendentEmbryoOutcome';
  readonly outcome: TranscendentEmbryoOutcomeAddress;
  readonly value: AuthoredKeepsakeEquipResults['transcendentEmbryo'] | null | undefined;
}

export interface EvaluatedTranscendentEmbryoOutcomeCandidate {
  readonly kind: 'transcendentEmbryoOutcome';
  readonly result: {
    readonly eligibleBlessingKeys: readonly string[];
    readonly selectedPossible: boolean;
    readonly emptyNoOp: boolean;
    readonly rarity: import('../../catalog-schema').InRunTraitRarity;
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
  const { threshold } = capability;
  return Object.freeze({
    kind: 'transcendentEmbryoOutcome',
    result: Object.freeze({
      eligibleBlessingKeys: threshold.eligibleBlessingKeys,
      selectedPossible: capability.evaluate(query.value).legal,
      emptyNoOp: threshold.eligibleBlessingKeys.length === 0,
      rarity: threshold.source.rarity,
    }),
  });
}
