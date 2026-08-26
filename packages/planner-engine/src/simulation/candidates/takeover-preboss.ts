import type { Catalog } from '../../catalog-schema';
import { semanticAddressKey, type ExitDecisionAddress } from '../../authored-project/addresses';
import type { HubDecision, ProjectDocument } from '../../authored-project/model';
import { hubDecisionHandoffReadiness } from '../../authored-project/topology/query';
import {
  evaluateTakeoverPrebossBatchCandidate,
  evaluateTakeoverPrebossBatchCandidateAtFrontier,
  type TakeoverPrebossBatchCandidateSupport,
} from '../generation';
import type { ProjectEvaluation } from '../evaluation-products';
import type { CanonicalDecision } from '../materialization';
import { unavailableForBiome, type CandidateContextUnavailable } from './availability';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateAssessmentPrefix,
  candidateBiome,
  candidatePrefix,
  completeBiomeCount,
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
  if (frontier.parent.origin.kind === 'hubRoom') {
    if (!hubHandoffIsReady(catalog, project, query)) return undefined;
    const layout = catalog.biomeLayouts.byKey[prefix.biomeKey];
    if (layout?.progression.kind !== 'hub') return undefined;
    const requiredExitKeys = Object.freeze([layout.progression.completedExit.exitKey]);
    return Object.freeze({
      kind: 'takeoverPrebossBatch',
      result: Object.freeze({
        source: query.source,
        gameName: query.gameName,
        requiredExitKeys,
        requiredTargetCount: requiredExitKeys.length,
        support:
          query.gameName === layout.progression.completedExit.roomGameName
            ? ('required' as const)
            : ('impossible' as const),
        pressure: Object.freeze([]),
        selectedPossible: query.gameName === layout.progression.completedExit.roomGameName,
        findings: Object.freeze([]),
      }),
    });
  }
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
      completeBiomeCount(evaluation, query.source.routeKey, query.source.biomeKey),
      ordinaryBatchCount(catalog, prefix.decisions),
    ),
  });
}

/**
 * Generated layouts own occurrence sources; a Hub owns only its completed Hub
 * decision. The candidate domain must match the semantic command domain.
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
  if (
    layout.progression.kind === 'hub' &&
    query.source.source.kind === 'hubDecision' &&
    query.source.source.decisionKey === layout.progression.hubKey
  ) {
    return;
  }
  throw new CandidateEvaluationContractError(
    `${semanticAddressKey(query.source)} has no declaration-owned takeover Preboss candidate domain`,
  );
}

/**
 * A Hub source is a declaration-owned candidate domain before it becomes an
 * evaluated candidate.  Its Preboss handoff itself remains unavailable until
 * the shared persisted-board gate is ready; invalid reward/generation
 * findings intentionally do not participate in this structural check.
 */
function hubHandoffIsReady(
  catalog: Catalog,
  project: ProjectDocument,
  query: TakeoverPrebossBatchCandidateQuery,
): boolean {
  if (query.source.source.kind !== 'hubDecision') return true;
  const hubKey = query.source.source.decisionKey;
  const plan = planFor(project, query.source.routeKey, query.source.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.progression.kind !== 'hub') return false;
  const hub = plan.topology?.decisions.find(
    (decision): decision is HubDecision => decision.kind === 'hub' && decision.hubKey === hubKey,
  );
  return hubDecisionHandoffReadiness(layout.progression, hub).kind === 'ready';
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
      completeBiomeCount(evaluation, query.source.routeKey, query.source.biomeKey),
    ),
  });
}
