import type { Catalog } from '../../catalog-schema';
import { createBiomeAddress, type SemanticAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type {
  CompleteBiomeProjectEvaluation,
  PrefixIncompleteBiomeProjectEvaluation,
  ProjectEvaluation,
} from '../project';
import type { CanonicalAuthoredRoom, MaterializedBiomePrefix } from '../materialization';
import { evaluateProgressiveBiome, type ProgressiveBiomeEvaluation } from '../progressive/biome';
import { CandidateEvaluationContractError } from './contract';

export function completeBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  return biome?.authoring === 'complete' ? biome : undefined;
}

export function prefixBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): PrefixIncompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  return biome?.authoring === 'incomplete' && 'materializedPrefix' in biome ? biome : undefined;
}

function previousValidBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CompleteBiomeProjectEvaluation | undefined {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const index = route?.biomes.findIndex((candidate) => candidate.biomeKey === biomeKey) ?? -1;
  if (index <= 0 || route === undefined) return undefined;
  for (let cursor = index - 1; cursor >= 0; cursor -= 1) {
    const candidate = route.biomes[cursor];
    if (candidate?.authoring === 'complete' && candidate.validity === 'valid') return candidate;
  }
  return undefined;
}

export function progressiveSeed(evaluation: ProjectEvaluation, routeKey: string, biomeKey: string) {
  const previous = previousValidBiome(evaluation, routeKey, biomeKey);
  return previous === undefined
    ? undefined
    : Object.freeze({ history: previous.history, rewardBranches: previous.rewards.branches });
}

export type CandidateBiomeEvaluation =
  | CompleteBiomeProjectEvaluation
  | PrefixIncompleteBiomeProjectEvaluation
  | ProgressiveBiomeEvaluation;

/** The maximum candidate-safe evaluation through the first blocking authoring boundary. */
export function candidateBiome(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CandidateBiomeEvaluation | undefined {
  const complete = completeBiome(evaluation, routeKey, biomeKey);
  if (complete?.validity !== 'invalid') {
    return complete ?? prefixBiome(evaluation, routeKey, biomeKey);
  }
  return (
    evaluateProgressiveBiome(
      catalog,
      createBiomeAddress(routeKey, biomeKey),
      planFor(project, routeKey, biomeKey),
      completeBiomeCount(evaluation, routeKey, biomeKey),
      progressiveSeed(evaluation, routeKey, biomeKey),
    ) ?? undefined
  );
}

export function candidatePrefix(
  biome: CandidateBiomeEvaluation | undefined,
): PrefixIncompleteBiomeProjectEvaluation | ProgressiveBiomeEvaluation | undefined {
  return biome !== undefined && 'materializedPrefix' in biome ? biome : undefined;
}

export function candidateBlockedAt(
  biome: CandidateBiomeEvaluation | undefined,
): SemanticAddress | undefined {
  if (biome === undefined) return undefined;
  if ('coverage' in biome) {
    return biome.coverage.kind === 'prefix' ? biome.coverage.blockedAt : undefined;
  }
  return biome.blockedAt;
}

export function planFor(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
): ProjectDocument['routes'][number]['biomes'][number] {
  const route = project.routes.find((candidate) => candidate.routeKey === routeKey);
  const plan = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (plan === undefined) {
    throw new CandidateEvaluationContractError(
      `project has no configured ${routeKey}/${biomeKey} candidate biome`,
    );
  }
  return plan;
}

export function completeBiomeCount(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): number {
  const route = evaluation.routes.find((candidate) => candidate.routeKey === routeKey);
  const index = route?.biomes.findIndex((candidate) => candidate.biomeKey === biomeKey) ?? -1;
  return index + 1;
}

export function prefixAuthoredRooms(
  prefix: MaterializedBiomePrefix,
): readonly CanonicalAuthoredRoom[] {
  return Object.freeze([
    ...(prefix.entryRoom === undefined ? [] : [prefix.entryRoom]),
    ...prefix.decisions.flatMap((decision): readonly CanonicalAuthoredRoom[] => {
      switch (decision.kind) {
        case 'batch':
          return decision.targets.map((target) => target.room);
        case 'linkedExit':
          return [decision.target.room];
        case 'hub':
          return decision.board.targets.map((target) => target.room);
      }
    }),
  ]);
}
