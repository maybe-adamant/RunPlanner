import type { ProjectDocument } from '../../authored-project/model';
import type { Catalog } from '../../catalog-schema';
import {
  evaluateLinearRoomTargetCandidate,
  type LinearForcePressureLedgerEntry,
} from '../generation';
import type {
  CandidateSupport,
  ProjectCandidateEvaluation,
  RoomTargetCandidateEvidence,
  RoomTargetCandidateQuery,
  StartRoomCandidateQuery,
} from './model';

import {
  failCandidate,
  immutableQuery,
  locateCandidateLinear,
  locateLinearBiomePlan,
  requireRoute,
  type PreparedCandidateContext,
} from './context';

function targetExists(project: ProjectDocument, query: RoomTargetCandidateQuery): boolean {
  const topology = locateLinearBiomePlan(project, query).topology;
  if (topology === null) {
    failCandidate(query, 'biome topology has not been started');
  }
  const continuation = topology.continuations.find(
    (candidate) => candidate.parentOccurrenceId === query.target.parentOccurrenceId,
  );
  if (continuation?.kind !== 'batch') {
    failCandidate(query, 'target parent does not own an ordinary generated batch');
  }
  return continuation.targets.some((candidate) => candidate.exitIndex === query.target.exitIndex);
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

function support(pressure: LinearForcePressureLedgerEntry): CandidateSupport {
  if (!pressure.selectedPossible) {
    return 'impossible';
  }
  return pressure.requiredForcedRoomGameNames.length > 0 ? 'forced' : 'possible';
}

function evidence(pressure: LinearForcePressureLedgerEntry): RoomTargetCandidateEvidence {
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

export function evaluateRoomTargetCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  context: PreparedCandidateContext,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RoomTargetCandidateQuery;
  const authoredTargetExists = targetExists(project, stableQuery);
  assertCandidateExists(catalog, stableQuery);
  const route = requireRoute(context.projectEvaluation.routes, stableQuery);
  const biome = locateCandidateLinear(context, stableQuery);
  if (typeof biome === 'string') {
    return Object.freeze({ context: 'unavailable', query: stableQuery, reason: biome });
  }
  if (!authoredTargetExists) {
    failCandidate(stableQuery, `exit ${stableQuery.target.exitIndex} has no authored target`);
  }

  const enteredBiomeCount = route.configuredBiomeKeys.indexOf(stableQuery.target.biomeKey) + 1;
  if (enteredBiomeCount <= 0) {
    failCandidate(stableQuery, `${stableQuery.target.biomeKey} is not configured on the route`);
  }
  const candidate = evaluateLinearRoomTargetCandidate(
    catalog,
    biome.snapshot,
    biome.history,
    stableQuery.target,
    stableQuery.gameName,
    enteredBiomeCount,
    biome.rewards.targetHistory,
  );
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: support(candidate.pressure),
    findings: candidate.findings,
    evidence: evidence(candidate.pressure),
  });
}

export function evaluateStartRoomCandidate(
  catalog: Catalog,
  project: ProjectDocument,
  query: StartRoomCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as StartRoomCandidateQuery;
  const plan = locateLinearBiomePlan(project, stableQuery);
  const layout = catalog.biomeLayouts.byKey[plan.biomeKey];
  if (layout?.kind !== 'LinearBiome' || layout.start.kind !== 'authoredStart') {
    failCandidate(stableQuery, `${plan.biomeKey} has no authored start candidate domain`);
  }
  const room = catalog.rooms.byKey[stableQuery.gameName];
  if (room === undefined || room.biomeKey !== plan.biomeKey) {
    failCandidate(stableQuery, `catalog has no ${plan.biomeKey} room ${stableQuery.gameName}`);
  }
  if (stableQuery.owner.kind === 'occurrence') {
    if (
      plan.topology === null ||
      plan.topology.startOccurrenceId !== stableQuery.owner.occurrenceId
    ) {
      failCandidate(stableQuery, 'occurrence owner is not the authored biome start');
    }
  }
  const supported = layout.start.roomGameNames;
  const possible = supported.includes(stableQuery.gameName);
  return Object.freeze({
    context: 'evaluated',
    query: stableQuery,
    support: possible ? (supported.length === 1 ? 'forced' : 'possible') : 'impossible',
    findings: Object.freeze([]),
    evidence: Object.freeze({
      candidateGameName: stableQuery.gameName,
      supportedGameNames: supported,
    }),
  });
}
