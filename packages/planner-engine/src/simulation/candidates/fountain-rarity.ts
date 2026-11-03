import type { FountainRarityOutcomeAddress } from '../../authored-project/addresses';
import type {
  AuthoredFountainRarityResult,
  HubDecision,
  ProjectDocument,
} from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import { type FountainRarityCandidateArtifacts } from '../keepsakes/candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';

export interface FountainRarityOutcomeCandidateQuery {
  readonly kind: 'fountainRarityOutcome';
  readonly outcome: FountainRarityOutcomeAddress;
  readonly targetTraitKey: string | null | undefined;
}

export interface EvaluatedFountainRarityOutcomeCandidate {
  readonly kind: 'fountainRarityOutcome';
  readonly result: {
    readonly status: 'pending' | 'consumed' | 'unavailable';
    readonly consumptionTargetKeys: readonly string[];
    readonly mutationTargetKeys: readonly string[];
    readonly selectedPossible: boolean;
    readonly targetRequired: boolean;
  };
}

function authoredValue(
  project: ProjectDocument,
  address: FountainRarityOutcomeAddress,
): AuthoredFountainRarityResult | undefined {
  const plan =
    project.route.routeKey === address.routeKey
      ? project.route.biomes.find((biome) => biome.biomeKey === address.biomeKey)
      : undefined;
  const action = address.action;
  if (action.kind === 'hubFountain')
    return plan?.topology?.decisions.find(
      (decision): decision is HubDecision =>
        decision.kind === 'hub' && decision.hubKey === action.hubKey,
    )?.fountainRarityResult;
  return (plan?.topology?.occurrences ?? []).find(
    (occurrence) => occurrence.occurrenceId === action.occurrenceId,
  )?.fountainRarityResult;
}

export function evaluateFountainRarityOutcomeCandidate(
  _catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  artifacts: FountainRarityCandidateArtifacts | undefined,
  query: FountainRarityOutcomeCandidateQuery,
): CandidateContextUnavailable | EvaluatedFountainRarityOutcomeCandidate {
  const capability = artifacts?.at(query.outcome);
  if (capability === undefined)
    return unavailableForBiome(
      evaluation,
      query.outcome.routeKey,
      query.outcome.biomeKey,
      query.outcome,
      'afterRoomLifecycle',
    );
  const sorted = (keys: readonly string[]) => Object.freeze([...new Set(keys)].sort());
  const authored =
    query.targetTraitKey === undefined
      ? authoredValue(project, query.outcome)
      : query.targetTraitKey === null
        ? undefined
        : { targetTraitKey: query.targetTraitKey };
  const targetRequired =
    capability.status === 'pending' && capability.mutationTargetKeys.length > 0;
  const selectedPossible = !targetRequired
    ? query.targetTraitKey === null || query.targetTraitKey === undefined
    : authored?.targetTraitKey !== undefined &&
      capability.mutationTargetKeys.includes(authored.targetTraitKey);
  return Object.freeze({
    kind: 'fountainRarityOutcome',
    result: Object.freeze({
      status:
        capability.status === 'pending' || capability.status === 'consumed'
          ? capability.status
          : 'unavailable',
      consumptionTargetKeys: sorted(capability.consumptionTargetKeys),
      mutationTargetKeys: sorted(capability.mutationTargetKeys),
      selectedPossible,
      targetRequired,
    }),
  });
}
