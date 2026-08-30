import type { FountainRarityOutcomeAddress } from '../../authored-project/addresses';
import type { AuthoredFountainRarityResult, ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import type { FountainRarityCandidateArtifacts } from '../candidate-artifacts';
import type { ProjectEvaluation } from '../evaluation-products';
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
    readonly branchSupport: readonly boolean[];
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
  return (plan?.topology?.occurrences ?? []).find(
    (occurrence) => occurrence.occurrenceId === address.action.occurrenceId,
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
  const first = capability.frontiers[0];
  if (first === undefined)
    return unavailableForBiome(
      evaluation,
      query.outcome.routeKey,
      query.outcome.biomeKey,
      query.outcome,
      'afterRoomLifecycle',
    );
  const union = (key: 'consumptionTargetKeys' | 'mutationTargetKeys') =>
    Object.freeze([...new Set(capability.frontiers.flatMap((frontier) => frontier[key]))].sort());
  const consumptionTargetKeys = union('consumptionTargetKeys');
  const mutationTargetKeys = union('mutationTargetKeys');
  const authored =
    query.targetTraitKey === undefined
      ? authoredValue(project, query.outcome)
      : query.targetTraitKey === null
        ? undefined
        : { targetTraitKey: query.targetTraitKey };
  const targetFrontiers = capability.frontiers.filter(
    (frontier) => frontier.status === 'pending' && frontier.mutationTargetKeys.length > 0,
  );
  const targetRequired = targetFrontiers.length > 0;
  const selectedPossible = !targetRequired
    ? query.targetTraitKey === null || query.targetTraitKey === undefined
    : authored?.targetTraitKey !== undefined &&
      targetFrontiers.every((frontier) =>
        frontier.mutationTargetKeys.includes(authored.targetTraitKey!),
      );
  const branchSupport = Object.freeze(
    mutationTargetKeys.map(
      (traitKey) =>
        targetFrontiers.length > 0 &&
        targetFrontiers.every((frontier) => frontier.mutationTargetKeys.includes(traitKey)),
    ),
  );
  return Object.freeze({
    kind: 'fountainRarityOutcome',
    result: Object.freeze({
      status: capability.frontiers.some((frontier) => frontier.status === 'pending')
        ? 'pending'
        : capability.frontiers.some((frontier) => frontier.status === 'consumed')
          ? 'consumed'
          : 'unavailable',
      consumptionTargetKeys,
      mutationTargetKeys,
      branchSupport,
      selectedPossible,
      targetRequired,
    }),
  });
}
