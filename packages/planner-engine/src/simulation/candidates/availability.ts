import type { SemanticAddress } from '../../authored-project/addresses';
import type {
  BiomeEvaluationCheckpoint,
  BiomeEvaluationCoverage,
  ProjectEvaluation,
} from '../project';

export type CandidateContextUnavailableReason =
  | 'authoredPrerequisiteMissing'
  | 'coverageNotReached'
  | 'producerFrontierUnavailable'
  | 'targetNotReachable'
  | 'upstreamIncomplete'
  | 'upstreamInvalid';

export type CandidateAuthoredPrerequisite = {
  readonly kind: 'batchRewardStore' | 'fieldsCageOutcome' | 'biomeField';
  readonly owner: SemanticAddress;
};

export type CandidateContextUnavailableEvidence =
  | {
      readonly kind: 'authoredPrerequisiteMissing';
      readonly prerequisite: CandidateAuthoredPrerequisite;
    }
  | {
      readonly kind: 'coverageNotReached';
      readonly requiredOwner: SemanticAddress;
      readonly requiredCheckpoint: BiomeEvaluationCheckpoint;
      readonly coverage: BiomeEvaluationCoverage;
    }
  | {
      readonly kind: 'producerFrontierUnavailable';
      readonly producer: SemanticAddress;
    }
  | {
      readonly kind: 'targetNotReachable';
      readonly target: SemanticAddress;
    }
  | {
      readonly kind: 'upstreamIncomplete' | 'upstreamInvalid';
      readonly upstreamBiomeKey: string;
    };

export interface CandidateContextUnavailable {
  readonly kind: 'unavailable';
  readonly reason: CandidateContextUnavailableReason;
  /** Exact semantic evidence for the unavailable candidate context. */
  readonly evidence: CandidateContextUnavailableEvidence;
}

export function unavailable(
  evidence: CandidateContextUnavailableEvidence,
): CandidateContextUnavailable {
  return Object.freeze({
    kind: 'unavailable',
    reason: evidence.kind,
    evidence: Object.freeze(evidence),
  });
}

function coverageFor(
  evaluation: ProjectEvaluation,
  owner: SemanticAddress,
): BiomeEvaluationCoverage {
  if (!('routeKey' in owner) || !('biomeKey' in owner)) {
    return Object.freeze({ kind: 'none', reason: 'notEvaluated' });
  }
  return (
    evaluation.routes
      .find((route) => route.routeKey === owner.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === owner.biomeKey)?.coverage ??
    Object.freeze({ kind: 'none', reason: 'notEvaluated' })
  );
}

export function coverageUnavailable(
  evaluation: ProjectEvaluation,
  owner: SemanticAddress,
  checkpoint: BiomeEvaluationCheckpoint,
): CandidateContextUnavailable {
  return unavailable({
    kind: 'coverageNotReached',
    requiredOwner: owner,
    requiredCheckpoint: checkpoint,
    coverage: coverageFor(evaluation, owner),
  });
}

export function producerUnavailable(producer: SemanticAddress): CandidateContextUnavailable {
  return unavailable({ kind: 'producerFrontierUnavailable', producer });
}

export function unreachableTarget(target: SemanticAddress): CandidateContextUnavailable {
  return unavailable({ kind: 'targetNotReachable', target });
}

export function unavailableForBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
  owner: SemanticAddress,
  checkpoint: BiomeEvaluationCheckpoint,
): CandidateContextUnavailable {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  if (route === undefined) return coverageUnavailable(evaluation, owner, checkpoint);
  if (route.biomes.some((candidate) => candidate.biomeKey === biomeKey)) {
    return coverageUnavailable(evaluation, owner, checkpoint);
  }
  const requestedIndex = route.configuredBiomeKeys.indexOf(biomeKey);
  const activeIndex =
    route.processing.active === null
      ? -1
      : route.configuredBiomeKeys.indexOf(route.processing.active.biomeKey);
  if (requestedIndex > activeIndex && route.processing.active !== null) {
    return unavailable({
      kind:
        route.processing.active.kind === 'incomplete' ? 'upstreamIncomplete' : 'upstreamInvalid',
      upstreamBiomeKey: route.processing.active.biomeKey,
    });
  }
  return coverageUnavailable(evaluation, owner, checkpoint);
}
