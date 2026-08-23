import { semanticAddressKey, type SemanticAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type {
  CompleteBlockedBiomeProjectEvaluation,
  CompleteBiomeProjectEvaluation,
  PrefixIncompleteBiomeProjectEvaluation,
  ProjectEvaluation,
} from '../project';
import type { CanonicalAuthoredRoom, MaterializedBiomePrefix } from '../materialization';
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

export type CandidateBiomeEvaluation =
  CompleteBiomeProjectEvaluation | PrefixIncompleteBiomeProjectEvaluation;
export type CandidatePrefixBiomeEvaluation =
  CompleteBlockedBiomeProjectEvaluation | PrefixIncompleteBiomeProjectEvaluation;

/** The maximum candidate-safe evaluation through the first blocking authoring boundary. */
export function candidateBiome(
  evaluation: ProjectEvaluation,
  routeKey: string,
  biomeKey: string,
): CandidateBiomeEvaluation | undefined {
  return (
    completeBiome(evaluation, routeKey, biomeKey) ?? prefixBiome(evaluation, routeKey, biomeKey)
  );
}

export function candidatePrefix(
  biome: CandidateBiomeEvaluation | undefined,
): CandidatePrefixBiomeEvaluation | undefined {
  return biome !== undefined && 'materializedPrefix' in biome ? biome : undefined;
}

/**
 * Candidate policy reads only the execution-assessed slice of an
 * authored-first prefix. The complete materialized prefix remains available
 * for structural ownership and retained-editing products, but its frontier
 * can intentionally extend past an invalid semantic boundary.
 */
export function candidateAssessmentPrefix(
  biome: CandidateBiomeEvaluation | undefined,
): MaterializedBiomePrefix | undefined {
  const prefix = candidatePrefix(biome);
  return prefix === undefined ? undefined : (prefix.assessmentPrefix ?? prefix.materializedPrefix);
}

export function candidateBlockedAt(
  biome: CandidateBiomeEvaluation | undefined,
): SemanticAddress | undefined {
  return biome?.coverage.kind === 'prefix' ? biome.coverage.blockedAt : undefined;
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
  const rooms = [
    ...(prefix.entryRoom === undefined ? [] : [prefix.entryRoom]),
    ...prefix.decisions.flatMap((decision): readonly CanonicalAuthoredRoom[] => {
      switch (decision.kind) {
        case 'batch':
          return [
            ...decision.targets.map((target) => target.room),
            ...decision.additional.map((continuation) => continuation.room),
          ];
        case 'hub':
          return [
            ...decision.board.targets.map((target) => target.room),
            ...decision.visits.flatMap((visit) => [visit.target.room, ...visit.enteredLocalRooms]),
          ];
      }
    }),
    ...(prefix.frontier?.kind === 'exitDecision'
      ? prefix.frontier.additional.map((continuation) => continuation.room)
      : []),
  ];
  const seen = new Set<string>();
  return Object.freeze(
    rooms.filter((room) => {
      const key = semanticAddressKey(room.origin);
      if (seen.has(key)) return false;
      seen.add(key);
      return true;
    }),
  );
}
