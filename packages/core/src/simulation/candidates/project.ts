import type { Catalog } from '../../catalog';
import { semanticAddressKey } from '../../project/addresses';
import type { LinearBiomePlan, ProjectDocument } from '../../project/model';
import { evaluateFRoomTargetCandidate, type FForcePressureLedgerEntry } from '../generation';
import type {
  CompleteFProjectEvaluation,
  ProjectEvaluation,
  ProjectRouteEvaluation,
} from '../project';
import { simulateProject } from '../project';
import type {
  CandidateContextUnavailableReason,
  CandidateSupport,
  ProjectCandidateEvaluation,
  ProjectCandidateQuery,
  RoomTargetCandidateEvidence,
  RoomTargetCandidateQuery,
} from './model';

export class CandidateEvaluationContractError extends Error {
  readonly queryKind: ProjectCandidateQuery['kind'];
  readonly targetKey: string;
  readonly detail: string;

  constructor(query: ProjectCandidateQuery, detail: string) {
    const targetKey = semanticAddressKey(query.target);
    super(`${query.kind} at ${targetKey}: ${detail}`);
    this.name = 'CandidateEvaluationContractError';
    this.queryKind = query.kind;
    this.targetKey = targetKey;
    this.detail = detail;
  }
}

function failCandidate(query: ProjectCandidateQuery, detail: string): never {
  throw new CandidateEvaluationContractError(query, detail);
}

function immutableQuery(query: RoomTargetCandidateQuery): RoomTargetCandidateQuery {
  return Object.freeze({
    kind: 'roomTarget',
    target: Object.freeze({ ...query.target }),
    gameName: query.gameName,
  });
}

function locateBiomePlan(
  project: ProjectDocument,
  query: RoomTargetCandidateQuery,
): LinearBiomePlan {
  const route = project.routes.find((candidate) => candidate.routeKey === query.target.routeKey);
  if (route === undefined) {
    failCandidate(query, `project has no route ${query.target.routeKey}`);
  }
  const biome = route.biomes.find((candidate) => candidate.biomeKey === query.target.biomeKey);
  if (biome === undefined) {
    failCandidate(query, `project has no configured biome ${query.target.biomeKey}`);
  }
  return biome;
}

function assertTargetExists(project: ProjectDocument, query: RoomTargetCandidateQuery): void {
  const topology = locateBiomePlan(project, query).topology;
  if (topology === null) {
    failCandidate(query, 'biome topology has not been started');
  }
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === query.target.parentOccurrenceId,
  );
  if (continuation?.kind !== 'batch') {
    failCandidate(query, 'target parent does not own an ordinary generated batch');
  }
  if (!continuation.targets.some((candidate) => candidate.exitIndex === query.target.exitIndex)) {
    failCandidate(query, `exit ${query.target.exitIndex} has no authored target`);
  }
}

function assertCandidateExists(catalog: Catalog, query: RoomTargetCandidateQuery): void {
  const room = catalog.rooms.byKey[query.gameName];
  if (room === undefined) {
    failCandidate(query, `catalog has no room ${query.gameName}`);
  }
  if (room.biomeKey !== query.target.biomeKey) {
    failCandidate(query, `${query.gameName} belongs to biome ${room.biomeKey}`);
  }
}

function requireRoute(
  routes: readonly ProjectRouteEvaluation[],
  query: RoomTargetCandidateQuery,
): ProjectRouteEvaluation {
  const route = routes.find((candidate) => candidate.routeKey === query.target.routeKey);
  if (route === undefined) {
    failCandidate(query, `simulation has no route ${query.target.routeKey}`);
  }
  return route;
}

function unavailableReason(
  route: ProjectRouteEvaluation,
  query: RoomTargetCandidateQuery,
): CandidateContextUnavailableReason {
  const { horizon } = route;
  if (horizon.kind === 'incomplete') {
    return horizon.biomeKey === query.target.biomeKey ? 'biomeIncomplete' : 'upstreamIncomplete';
  }
  if (horizon.kind === 'invalid') {
    return 'upstreamInvalid';
  }
  if (horizon.kind === 'simulatorBoundary') {
    return 'simulatorUnavailable';
  }
  failCandidate(query, 'simulation omitted the candidate biome without a processing horizon');
}

function locateCompleteF(
  route: ProjectRouteEvaluation,
  query: RoomTargetCandidateQuery,
): CompleteFProjectEvaluation | CandidateContextUnavailableReason {
  const evaluation = route.biomes.find((candidate) => candidate.biomeKey === query.target.biomeKey);
  if (evaluation === undefined) {
    return unavailableReason(route, query);
  }
  if (evaluation.completion === 'incomplete') {
    return 'biomeIncomplete';
  }
  return evaluation;
}

function support(pressure: FForcePressureLedgerEntry): CandidateSupport {
  if (!pressure.selectedPossible) {
    return 'impossible';
  }
  return pressure.requiredForcedRoomGameNames.length > 0 ? 'forced' : 'possible';
}

function evidence(pressure: FForcePressureLedgerEntry): RoomTargetCandidateEvidence {
  return Object.freeze({
    beforeSequence: pressure.beforeSequence,
    sourceGameName: pressure.sourceGameName,
    candidateGameName: pressure.selectedGameName,
    exitIndex: pressure.exitIndex,
    biomeDepthCache: pressure.biomeDepthCache,
    biomeEncounterDepth: pressure.biomeEncounterDepth,
    candidateCreationCount: pressure.selectedCreationCount,
    candidateAppearanceCount: pressure.selectedAppearanceCount,
    candidateParentCreationCount: pressure.selectedParentCreationCount,
    eligibleRoomGameNames: pressure.eligibleRoomGameNames,
    optionalForcedRoomGameNames: pressure.optionalForcedRoomGameNames,
    requiredForcedRoomGameNames: pressure.requiredForcedRoomGameNames,
    supportRoomGameNames: pressure.supportRoomGameNames,
    exclusionReasons: pressure.selectedExclusionReasons,
  });
}

function evaluateRoomTargetCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  projectEvaluation: ProjectEvaluation,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query);
  assertTargetExists(project, stableQuery);
  assertCandidateExists(catalog, stableQuery);
  const route = requireRoute(projectEvaluation.routes, stableQuery);
  const biome = locateCompleteF(route, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }

  const candidate = evaluateFRoomTargetCandidate(
    catalog,
    biome.snapshot,
    biome.history,
    stableQuery.target,
    stableQuery.gameName,
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: support(candidate.pressure),
    findings: candidate.findings,
    evidence: evidence(candidate.pressure),
  });
}

export function evaluateProjectCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: ProjectCandidateQuery,
): ProjectCandidateEvaluation {
  const evaluation = evaluateProjectCandidates(catalog, project, Object.freeze([query]))[0];
  if (evaluation === undefined) {
    throw new Error('single candidate evaluation returned no result');
  }
  return evaluation;
}

export function evaluateProjectCandidates(
  catalog: Catalog,
  project: ProjectDocument,
  queries: readonly ProjectCandidateQuery[],
): readonly ProjectCandidateEvaluation[] {
  if (queries.length === 0) {
    return Object.freeze([]);
  }
  const projectEvaluation = simulateProject(catalog, project);
  return Object.freeze(
    queries.map((query): ProjectCandidateEvaluation => {
      switch (query.kind) {
        case 'roomTarget':
          return evaluateRoomTargetCandidate(catalog, project, projectEvaluation, query);
      }
    }),
  );
}
