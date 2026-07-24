import {
  createBiomeAddress,
  createContinuationAddress,
  semanticAddressKey,
} from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import type { LinearForcePressureLedgerEntry } from '../generation';
import type {
  CandidateSupport,
  ProjectCandidateEvaluation,
  RoomTargetCandidateEvidence,
  RoomTargetCandidateQuery,
  StartRoomCandidateQuery,
} from './model';

import {
  failCandidate,
  coverageNotReached,
  immutableQuery,
  isCandidateContextUnavailable,
  locateCandidateLinear,
  locateIndexedLinearPlan,
  unavailableCandidate,
  type PreparedCandidateContext,
} from './context';

function assertTargetSlotExists(
  context: PreparedCandidateContext,
  query: RoomTargetCandidateQuery,
): void {
  const targetKey = semanticAddressKey(query.target);
  if (context.index.targetsByOwner.has(targetKey)) {
    return;
  }
  const topology = locateIndexedLinearPlan(context, query).topology;
  if (topology === null) {
    failCandidate(query, 'biome topology has not been started');
  }
  const parentKey = semanticAddressKey(
    createContinuationAddress(
      createBiomeAddress(query.target.routeKey, query.target.biomeKey),
      query.target.parentOccurrenceId,
    ),
  );
  if (!context.index.batchTargetParentsByOwner.has(parentKey)) {
    failCandidate(query, 'target parent does not own an ordinary generated batch');
  }
  if (!context.index.targetSlotsByOwner.has(targetKey)) {
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
    exclusions: pressure.selectedExclusions,
  });
}

export function evaluateRoomTargetCandidate(
  catalog: Catalog,
  context: PreparedCandidateContext,
  query: RoomTargetCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as RoomTargetCandidateQuery;
  assertTargetSlotExists(context, stableQuery);
  assertCandidateExists(catalog, stableQuery);
  const biome = locateCandidateLinear(context, stableQuery);
  if (isCandidateContextUnavailable(biome)) {
    return unavailableCandidate(stableQuery, biome);
  }
  const candidateContext = context.index.roomTargetContextsByOwner.get(
    semanticAddressKey(stableQuery.target),
  );
  if (candidateContext === undefined) {
    return unavailableCandidate(stableQuery, coverageNotReached(stableQuery, biome));
  }
  const candidate = candidateContext.evaluateGameName(stableQuery.gameName);
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
  context: PreparedCandidateContext,
  query: StartRoomCandidateQuery,
): ProjectCandidateEvaluation {
  const stableQuery = immutableQuery(query) as StartRoomCandidateQuery;
  const plan = locateIndexedLinearPlan(context, stableQuery);
  const domain = context.index.startRoomDomainsByOwner.get(semanticAddressKey(stableQuery.owner));
  if (domain === undefined) {
    failCandidate(stableQuery, `${plan.biomeKey} has no authored start candidate domain`);
  }
  const room = catalog.rooms.byKey[stableQuery.gameName];
  if (room === undefined || room.biomeKey !== plan.biomeKey) {
    failCandidate(stableQuery, `catalog has no ${plan.biomeKey} room ${stableQuery.gameName}`);
  }
  const supported = domain.supportedGameNames;
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
