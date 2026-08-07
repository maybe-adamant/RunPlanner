import type { Catalog } from '../../catalog-schema';
import {
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createTargetAddress,
  semanticAddressKey,
  type SemanticAddress,
  type TargetAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import {
  declaredPhysicalExits,
  exitDecisionForSource,
} from '../../authored-project/topology/query';
import type { RoomTargetCandidateArtifacts } from '../candidate-artifacts';
import {
  normalTargetCandidateHistory,
  roomTargetCandidateContextAtFrontier,
  type RoomTargetCandidateValidation,
} from '../generation';
import type { HistoryStateView, ProgressiveRoomHistoryViews } from '../history';
import type {
  CanonicalAuthoredRoom,
  CanonicalDecision,
  CanonicalPhysicalExit,
} from '../materialization';
import type { ProjectEvaluation } from '../project';
import { evaluateProgressiveBiomeAssembly } from '../progressive/biome';
import {
  coverageUnavailable,
  unavailable,
  unavailableForBiome,
  unreachableTarget,
  type CandidateContextUnavailable,
} from './availability';
import { unresolvedBatchRewardStorePrerequisite } from './batch-reward-store';
import { CandidateEvaluationContractError } from './contract';
import {
  candidateAssessmentPrefix,
  completeBiome,
  completeBiomeCount,
  planFor,
  prefixAuthoredRooms,
  prefixBiome,
  progressiveSeed,
  traitContextFor,
} from './evaluated-biome';

export interface RoomTargetCandidateQuery {
  readonly kind: 'roomTarget';
  readonly target: TargetAddress;
  readonly gameName: string;
}

export interface EvaluatedRoomTargetCandidate {
  readonly kind: 'roomTarget';
  readonly result: RoomTargetCandidateValidation;
}

export type RoomTargetCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedRoomTargetCandidate;

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

/**
 * Normal target keys are declaration-owned. Most biomes spell those keys as
 * `exit${n}`, but N's bounded Opening entry uses the stable physical key
 * `prehub`. Candidate ordering and prefix history must consume that shared
 * topology product rather than parse a UI-shaped key.
 */
function physicalExitsForTarget(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
): readonly CanonicalPhysicalExit[] | undefined {
  const plan = planFor(project, target.routeKey, target.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout === undefined || plan.topology === null) return undefined;
  const exits = declaredPhysicalExits(catalog, layout, plan.topology, target.source);
  if (exits === undefined) return undefined;
  return Object.freeze(
    exits.flatMap((exit) =>
      exit.kind === 'normal'
        ? [
            Object.freeze({
              kind: 'available' as const,
              exitKey: exit.exitKey,
              index: exit.index,
              type: exit.type,
              compatibilityPolicyKey: exit.compatibilityPolicyKey,
            }),
          ]
        : [],
    ),
  );
}

function physicalExitForTarget(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
): CanonicalPhysicalExit | undefined {
  return physicalExitsForTarget(catalog, project, target)?.find(
    (exit) => exit.exitKey === target.exitKey,
  );
}

function physicalExitIndex(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
): number | undefined {
  return physicalExitForTarget(catalog, project, target)?.index;
}

function sourceCandidateHistory(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
  source: CanonicalAuthoredRoom,
  views: ProgressiveRoomHistoryViews,
): HistoryStateView | undefined {
  const plan = planFor(project, target.routeKey, target.biomeKey);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  return layout === undefined
    ? views.preOutgoing
    : normalTargetCandidateHistory(layout, source, views);
}

function historyBeforePhysicalTarget(
  source: ProgressiveRoomHistoryViews,
  physicalExits: readonly CanonicalPhysicalExit[],
  target: TargetAddress,
  firstTargetHistory: HistoryStateView | undefined = source.preOutgoing,
): ProgressiveRoomHistoryViews['preOutgoing'] {
  const exits = [...physicalExits].sort((left, right) => left.index - right.index);
  const targetIndex = exits.findIndex((exit) => exit.exitKey === target.exitKey);
  if (targetIndex < 0) return undefined;
  if (targetIndex === 0) return firstTargetHistory;
  const precedingExit = exits[targetIndex - 1];
  if (precedingExit === undefined) return undefined;
  return source.targetGenerations.find(
    (generation) =>
      semanticAddressKey(generation.targetOrigin) ===
      semanticAddressKey(
        createTargetAddress(
          createBiomeAddress(target.routeKey, target.biomeKey),
          target.source,
          precedingExit.exitKey,
        ),
      ),
  )?.after;
}

function blockedPhysicalTargetPrecedes(
  catalog: Catalog,
  project: ProjectDocument,
  blockedAt: SemanticAddress | undefined,
  target: TargetAddress,
): boolean {
  const biome = createBiomeAddress(target.routeKey, target.biomeKey);
  const queriedDecision = createExitDecisionAddress(biome, target.source);
  const queriedIndex = physicalExitIndex(catalog, project, target);
  if (blockedAt === undefined || queriedIndex === undefined) return false;
  const blockedIndex = (() => {
    if (blockedAt.kind === 'target') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? physicalExitIndex(catalog, project, blockedAt)
        : undefined;
    }
    if (blockedAt.kind === 'batchRewardStore') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? 0
        : undefined;
    }
    if (blockedAt.kind !== 'incomingReward') return undefined;
    const plan = planFor(project, target.routeKey, target.biomeKey);
    const decision =
      plan.topology === null ? undefined : exitDecisionForSource(plan.topology, target.source);
    const exitKey =
      decision?.normal.kind === 'batch'
        ? decision.normal.targets.find(
            (candidate) => candidate.occurrenceId === blockedAt.occurrenceId,
          )?.exitKey
        : undefined;
    return exitKey === undefined
      ? undefined
      : physicalExitIndex(catalog, project, Object.freeze({ ...target, exitKey }));
  })();
  return blockedIndex !== undefined && blockedIndex < queriedIndex;
}

function evaluatePrefixRoomTarget(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RoomTargetCandidateQuery,
): EvaluatedRoomTargetCandidate | undefined {
  const biome = prefixBiome(evaluation, query.target.routeKey, query.target.biomeKey);
  const prefix = candidateAssessmentPrefix(biome);
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (
    biome.coverage.kind === 'prefix' &&
    blockedPhysicalTargetPrecedes(catalog, project, biome.coverage.blockedAt, query.target)
  ) {
    return undefined;
  }
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    query.target.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const physicalExits = physicalExitsForTarget(catalog, project, query.target);
  const physicalExit = physicalExits?.find((exit) => exit.exitKey === query.target.exitKey);
  const sourceViews =
    source === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const firstTargetHistory =
    source === undefined || sourceViews === undefined
      ? undefined
      : sourceCandidateHistory(catalog, project, query.target, source, sourceViews);
  const sourceHistory =
    physicalExits === undefined || sourceViews === undefined || firstTargetHistory === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, physicalExits, query.target, firstTargetHistory);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined) {
    return undefined;
  }
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    physicalExit,
    sourceHistory,
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
    frontier.targets.length === 0,
    biome.rewards.targetHistory,
  );
  return Object.freeze({
    kind: 'roomTarget',
    result: context.evaluateGameName(query.gameName),
  });
}

function evaluateInvalidCompleteRoomTarget(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RoomTargetCandidateQuery,
): EvaluatedRoomTargetCandidate | undefined {
  const biome = completeBiome(evaluation, query.target.routeKey, query.target.biomeKey);
  if (biome?.validity !== 'invalid') return undefined;
  const progressive = evaluateProgressiveBiomeAssembly(
    catalog,
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    planFor(project, query.target.routeKey, query.target.biomeKey),
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
    traitContextFor(project, query.target.routeKey),
    progressiveSeed(evaluation, query.target.routeKey, query.target.biomeKey),
  );
  if (progressive === null) return undefined;
  const covered = progressive.candidateArtifacts.roomTargets.at(query.target);
  if (covered !== undefined) {
    return Object.freeze({ kind: 'roomTarget', result: covered.evaluateGameName(query.gameName) });
  }
  if (
    blockedPhysicalTargetPrecedes(catalog, project, progressive.evaluation.blockedAt, query.target)
  ) {
    return undefined;
  }
  const prefix =
    progressive.evaluation.assessmentPrefix ?? progressive.evaluation.materializedPrefix;
  const frontier = prefix.frontier;
  if (frontier?.kind !== 'exitDecision') return undefined;
  const decision = createExitDecisionAddress(
    createBiomeAddress(query.target.routeKey, query.target.biomeKey),
    query.target.source,
  );
  if (semanticAddressKey(frontier.origin) !== semanticAddressKey(decision)) return undefined;
  if (frontier.parent.origin.kind !== 'occurrence') return undefined;
  const source = prefixAuthoredRooms(prefix).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(frontier.parent.origin),
  );
  const physicalExits = physicalExitsForTarget(catalog, project, query.target);
  const physicalExit = physicalExits?.find((exit) => exit.exitKey === query.target.exitKey);
  const sourceViews =
    source === undefined
      ? undefined
      : progressive.evaluation.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const firstTargetHistory =
    source === undefined || sourceViews === undefined
      ? undefined
      : sourceCandidateHistory(catalog, project, query.target, source, sourceViews);
  const sourceHistory =
    physicalExits === undefined || sourceViews === undefined || firstTargetHistory === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, physicalExits, query.target, firstTargetHistory);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined) {
    return undefined;
  }
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    physicalExit,
    sourceHistory,
    completeBiomeCount(evaluation, query.target.routeKey, query.target.biomeKey),
    frontier.targets.length === 0,
    progressive.evaluation.rewards.targetHistory,
  );
  return Object.freeze({ kind: 'roomTarget', result: context.evaluateGameName(query.gameName) });
}

function assertRoomTargetDomain(
  catalog: Catalog,
  project: ProjectDocument,
  target: TargetAddress,
): void {
  const plan = planFor(project, target.routeKey, target.biomeKey);
  const topology = plan.topology;
  const decision = topology === null ? undefined : exitDecisionForSource(topology, target.source);
  if (decision?.normal.kind === 'batch') {
    const authored = decision.normal.targets.find(
      (candidate) => candidate.exitKey === target.exitKey,
    );
    if (authored !== undefined) {
      const occurrence = topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === authored.occurrenceId,
      );
      const declaration =
        occurrence === undefined ? undefined : catalog.rooms.byKey[occurrence.gameName];
      if (declaration?.prebossBatchPolicy?.kind === 'takeOverNormalDoors') {
        throw new CandidateEvaluationContractError(
          `${semanticAddressKey(target)} belongs to a source-owned takeover Preboss batch`,
        );
      }
      return;
    }
  }
  if (target.source.kind !== 'occurrence') {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(target)} has no authored ordinary target domain`,
    );
  }
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  const exits =
    topology === null || layout === undefined
      ? undefined
      : declaredPhysicalExits(catalog, layout, topology, target.source);
  if (!exits?.some((exit) => exit.kind === 'normal' && exit.exitKey === target.exitKey)) {
    throw new CandidateEvaluationContractError(
      `${semanticAddressKey(target)} has no declaration-owned physical exit`,
    );
  }
}

export function evaluateRoomTargetCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  candidateArtifacts: RoomTargetCandidateArtifacts | undefined,
  query: RoomTargetCandidateQuery,
): RoomTargetCandidateEvaluation {
  assertRoomTargetDomain(catalog, project, query.target);
  const biome = completeBiome(evaluation, query.target.routeKey, query.target.biomeKey);
  if (biome?.validity === 'invalid') {
    return (
      evaluateInvalidCompleteRoomTarget(catalog, project, evaluation, query) ??
      coverageUnavailable(evaluation, query.target, 'afterTargetGeneration')
    );
  }
  if (biome === undefined) {
    const storePrerequisite = unresolvedBatchRewardStorePrerequisite(
      project,
      createBatchRewardStoreAddress(
        createBiomeAddress(query.target.routeKey, query.target.biomeKey),
        query.target.source,
      ),
    );
    if (storePrerequisite !== undefined) return unavailable(storePrerequisite);
    const selectedContext = candidateArtifacts?.at(query.target);
    if (selectedContext !== undefined) {
      return Object.freeze({
        kind: 'roomTarget',
        result: selectedContext.evaluateGameName(query.gameName),
      });
    }
    const prefix = evaluatePrefixRoomTarget(catalog, project, evaluation, query);
    if (prefix !== undefined) return prefix;
    return unavailableForBiome(
      evaluation,
      query.target.routeKey,
      query.target.biomeKey,
      query.target,
      'afterTargetGeneration',
    );
  }
  const context = candidateArtifacts?.at(query.target);
  if (context === undefined) return unreachableTarget(query.target);
  return Object.freeze({
    kind: 'roomTarget',
    result: context.evaluateGameName(query.gameName),
  });
}
