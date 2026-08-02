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
import { exitDecisionForSource } from '../../authored-project/topology/query';
import type { RoomTargetCandidateArtifacts } from '../candidate-artifacts';
import {
  roomTargetCandidateContextAtFrontier,
  type RoomTargetCandidateValidation,
} from '../generation';
import type { ProgressiveRoomHistoryViews } from '../history';
import type { CanonicalDecision } from '../materialization';
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
  completeBiome,
  completeBiomeCount,
  planFor,
  prefixAuthoredRooms,
  prefixBiome,
  progressiveSeed,
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

function historyBeforePhysicalTarget(
  source: ProgressiveRoomHistoryViews,
  sourceDeclaration: NonNullable<Catalog['rooms']['byKey'][string]>,
  target: TargetAddress,
): ProgressiveRoomHistoryViews['preOutgoing'] {
  const exits = [...sourceDeclaration.exits].sort((left, right) => left.index - right.index);
  const targetIndex = exits.findIndex((exit) => `exit${exit.index}` === target.exitKey);
  if (targetIndex < 0) return undefined;
  if (targetIndex === 0) return source.preOutgoing;
  const precedingExit = exits[targetIndex - 1];
  if (precedingExit === undefined) return undefined;
  return source.targetGenerations.find(
    (generation) =>
      semanticAddressKey(generation.targetOrigin) ===
      semanticAddressKey(
        createTargetAddress(
          createBiomeAddress(target.routeKey, target.biomeKey),
          target.source,
          `exit${precedingExit.index}`,
        ),
      ),
  )?.after;
}

function blockedPhysicalTargetPrecedes(
  project: ProjectDocument,
  blockedAt: SemanticAddress | undefined,
  target: TargetAddress,
): boolean {
  const biome = createBiomeAddress(target.routeKey, target.biomeKey);
  const queriedDecision = createExitDecisionAddress(biome, target.source);
  const queriedIndex = /^exit(\d+)$/.exec(target.exitKey)?.[1];
  if (blockedAt === undefined || queriedIndex === undefined) return false;
  const blockedIndex = (() => {
    if (blockedAt.kind === 'target') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? /^exit(\d+)$/.exec(blockedAt.exitKey)?.[1]
        : undefined;
    }
    if (blockedAt.kind === 'batchRewardStore') {
      const blockedDecision = createExitDecisionAddress(biome, blockedAt.source);
      return semanticAddressKey(blockedDecision) === semanticAddressKey(queriedDecision)
        ? '0'
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
    return exitKey === undefined ? undefined : /^exit(\d+)$/.exec(exitKey)?.[1];
  })();
  return blockedIndex !== undefined && Number(blockedIndex) < Number(queriedIndex);
}

function evaluatePrefixRoomTarget(
  catalog: Catalog,
  project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: RoomTargetCandidateQuery,
): EvaluatedRoomTargetCandidate | undefined {
  const biome = prefixBiome(evaluation, query.target.routeKey, query.target.biomeKey);
  const prefix = biome?.materializedPrefix;
  const frontier = prefix?.frontier;
  if (biome === undefined || prefix === undefined || frontier?.kind !== 'exitDecision') {
    return undefined;
  }
  if (
    biome.coverage.kind === 'prefix' &&
    blockedPhysicalTargetPrecedes(project, biome.coverage.blockedAt, query.target)
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
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const exitIndex = /^exit(\d+)$/.exec(query.target.exitKey)?.[1];
  const physicalExit =
    exitIndex === undefined
      ? undefined
      : sourceDeclaration?.exits.find((exit) => exit.index === Number(exitIndex));
  const sourceViews =
    source === undefined
      ? undefined
      : biome.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const sourceHistory =
    sourceDeclaration === undefined || sourceViews === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, sourceDeclaration, query.target);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined) {
    return undefined;
  }
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    Object.freeze({
      kind: 'available',
      exitKey: query.target.exitKey,
      index: physicalExit.index,
      type: physicalExit.type,
      compatibilityPolicyKey: physicalExit.compatibilityPolicyKey,
    }),
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
    progressiveSeed(evaluation, query.target.routeKey, query.target.biomeKey),
  );
  if (progressive === null) return undefined;
  const covered = progressive.candidateArtifacts.roomTargets.at(query.target);
  if (covered !== undefined) {
    return Object.freeze({ kind: 'roomTarget', result: covered.evaluateGameName(query.gameName) });
  }
  if (blockedPhysicalTargetPrecedes(project, progressive.evaluation.blockedAt, query.target)) {
    return undefined;
  }
  const prefix = progressive.evaluation.materializedPrefix;
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
  const sourceDeclaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  const exitIndex = /^exit(\d+)$/.exec(query.target.exitKey)?.[1];
  const physicalExit =
    exitIndex === undefined
      ? undefined
      : sourceDeclaration?.exits.find((exit) => exit.index === Number(exitIndex));
  const sourceViews =
    source === undefined
      ? undefined
      : progressive.evaluation.history.rooms.find(
          (room) => semanticAddressKey(room.origin) === semanticAddressKey(source.origin),
        );
  const sourceHistory =
    sourceDeclaration === undefined || sourceViews === undefined
      ? undefined
      : historyBeforePhysicalTarget(sourceViews, sourceDeclaration, query.target);
  if (source === undefined || physicalExit === undefined || sourceHistory === undefined) {
    return undefined;
  }
  const context = roomTargetCandidateContextAtFrontier(
    catalog,
    prefix.biomeKey,
    ordinaryBatchCount(catalog, prefix.decisions),
    source,
    query.target,
    Object.freeze({
      kind: 'available',
      exitKey: query.target.exitKey,
      index: physicalExit.index,
      type: physicalExit.type,
      compatibilityPolicyKey: physicalExit.compatibilityPolicyKey,
    }),
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
  const sourceOccurrenceId = target.source.occurrenceId;
  const source = topology?.occurrences.find(
    (occurrence) => occurrence.occurrenceId === sourceOccurrenceId,
  );
  const declaration = source === undefined ? undefined : catalog.rooms.byKey[source.gameName];
  if (
    declaration === undefined ||
    !declaration.exits.some((exit) => `exit${exit.index}` === target.exitKey)
  ) {
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
