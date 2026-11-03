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
    readonly requiredInterval: number;
    readonly eligibleTargetKeys: readonly string[];
    readonly selectedPossible: boolean;
    readonly emptyNoOp: boolean;
  };
}

/** The exact threshold frontier retained at one automatic Steady Growth row. */
export interface SteadyGrowthCandidateCapability {
  readonly threshold: ReachedSteadyGrowthThreshold;
  readonly evaluate: (targetTraitKey: string | null | undefined) => SteadyGrowthTargetAssessment;
}
export interface SteadyGrowthCandidateArtifacts {
  readonly at: (address: SteadyGrowthOutcomeAddress) => SteadyGrowthCandidateCapability | undefined;
}
export function createSteadyGrowthCandidateArtifacts(
  catalog: Catalog,
  contexts: ReadonlyMap<string, ReachedSteadyGrowthThreshold>,
): SteadyGrowthCandidateArtifacts {
  const privateContexts = new Map(contexts);
  return Object.freeze({
    at: (address: SteadyGrowthOutcomeAddress) => {
      const threshold = privateContexts.get(semanticAddressKey(address));
      if (threshold === undefined) return undefined;
      return Object.freeze({
        threshold,
        evaluate: (targetTraitKey: string | null | undefined) =>
          assessSteadyGrowthTarget(catalog, threshold, targetTraitKey),
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
  const { threshold } = capability;
  return Object.freeze({
    kind: 'steadyGrowthOutcome',
    result: Object.freeze({
      requiredInterval: threshold.requiredInterval,
      eligibleTargetKeys: threshold.eligibleTargetKeys,
      selectedPossible: capability.evaluate(query.targetTraitKey).legal,
      emptyNoOp: threshold.eligibleTargetKeys.length === 0,
    }),
  });
}
