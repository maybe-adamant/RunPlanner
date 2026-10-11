import { resolveRoutePosition } from '../../authored-project/route-context';
import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type ExitDecisionAddress } from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import {
  evaluateTakeoverPrebossBatchCandidate,
  evaluateTakeoverPrebossBatchCandidateAtFrontier,
  type TakeoverPrebossBatchCandidateSupport,
} from '../generation';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import type { CanonicalDecision } from '../materialization';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateAssessmentPrefix,
  candidateBiome,
  candidatePrefix,
  planFor,
  prefixAuthoredRooms,
  prefixBiome,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';

export interface TakeoverPrebossBatchCandidateQuery {
  readonly kind: 'takeoverPrebossBatch';
  readonly source: ExitDecisionAddress;
  readonly gameName: string;
}

export interface EvaluatedTakeoverPrebossBatchCandidate {
  readonly kind: 'takeoverPrebossBatch';
  readonly result: TakeoverPrebossBatchCandidateSupport;
}

export type TakeoverPrebossBatchCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedTakeoverPrebossBatchCandidate;

function ordinaryBatchCount(catalog: Catalog, decisions: readonly CanonicalDecision[]): number {
  return decisions.filter(
    (decision) =>
      decision.kind === 'batch' &&
      decision.parent.origin.kind === 'occurrence' &&
      !decision.targets.some(
        (target) =>
          catalog.rooms.byKey[target.room.gameName]?.prebossBatchPolicy?.kind ===
          'takeOverNormalDoors',
      ),
  ).length;
}

function evaluatePrefixTakeover(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: TakeoverPrebossBatchCandidateQuery,
  candidate?: CandidateBiomeEvaluation,
): EvaluatedTakeoverPrebossBatchCandidate | undefined {
  const biome = candidatePrefix(
    candidate ?? prefixBiome(evaluation, query.source.routeKey, query.source.biomeKey),
  );
  const prefix = candidateAssessmentPrefix(biome);
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (frontier.targets.length > 0) {
    return undefined;
  }
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(query.source)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const owner = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const ownerHistory =
    owner === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(owner.origin),
        )?.preOutgoing;
  if (owner === undefined || ownerHistory === undefined) return undefined;
  return Object.freeze({
    kind: 'takeoverPrebossBatch',
    result: evaluateTakeoverPrebossBatchCandidateAtFrontier(
      catalog,
      query.source,
      owner,
      ownerHistory,
      query.gameName,
      resolveRoutePosition(catalog, project.route, query.source.biomeKey).ordinal,
      ordinaryBatchCount(catalog, prefix.decisions),
      biome.rewards.targetHistory,
    ),
  });
}

/**
 * Only generated layouts own takeover sources; a Hub's completed-Hub exit is
 * created with the Hub. The candidate domain matches the command domain.
 */
function assertTakeoverPrebossBatchDomain(
  catalog: Catalog,
  project: ProjectDocument,
  query: TakeoverPrebossBatchCandidateQuery,
): void {
  const plan = planFor(project, query.source.routeKey, query.source.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined) {
    throw new CandidateEvaluationContractError(`${plan.biomeKey} has no catalog layout`);
  }
  if (layout.progression.kind === 'generated' && query.source.source.kind === 'occurrence') {
    return;
  }
  throw new CandidateEvaluationContractError(
    `${semanticAddressKey(query.source)} has no declaration-owned takeover Preboss candidate domain`,
  );
}

export function evaluateTakeoverPrebossBatch(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: TakeoverPrebossBatchCandidateQuery,
): TakeoverPrebossBatchCandidateEvaluation {
  assertTakeoverPrebossBatchDomain(catalog, project, query);
  const candidate = candidateBiome(evaluation, query.source.routeKey, query.source.biomeKey);
  if (candidate === undefined || !('snapshot' in candidate)) {
    return (
      evaluatePrefixTakeover(catalog, project, evaluation, query, candidate) ??
      unavailableForBiome(
        evaluation,
        query.source.routeKey,
        query.source.biomeKey,
        query.source,
        'afterTargetGeneration',
      )
    );
  }
  return Object.freeze({
    kind: 'takeoverPrebossBatch',
    result: evaluateTakeoverPrebossBatchCandidate(
      catalog,
      candidate.snapshot,
      candidate.history,
      query.source,
      query.gameName,
      resolveRoutePosition(catalog, project.route, query.source.biomeKey).ordinal,
      candidate.rewards.targetHistory,
    ),
  });
}
