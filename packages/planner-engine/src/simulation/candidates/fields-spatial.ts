import type { Catalog, FieldsSpatialDeclaration } from '../../catalog-schema';
import {
  semanticAddressKey,
  type FieldsSpatialAddress,
  type FieldsSpatialTarget,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { SemanticFinding } from '../model';
import type { ProjectEvaluation } from '../evaluation-products';
import type { CanonicalAuthoredRoom, CanonicalBiome } from '../materialization';
import {
  candidateBiome,
  prefixAuthoredRooms,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';
import type { CandidateContextUnavailable } from './availability';
import { unavailableForBiome, unreachableTarget } from './availability';

/** One exact physical point assignment in an occurrence-owned Fields layout. */
export interface FieldsSpatialPointCandidateQuery {
  readonly kind: 'fieldsSpatialPoint';
  readonly spatial: FieldsSpatialAddress;
  readonly pointId: number | null;
}

export interface FieldsSpatialPointCandidateSupport {
  readonly spatial: FieldsSpatialAddress;
  readonly target: FieldsSpatialTarget;
  readonly pointId: number | null;
  /** Declaration points still available after active sibling assignments. */
  readonly supportPointIds: readonly number[];
  readonly selectedPossible: boolean;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedFieldsSpatialPointCandidate {
  readonly kind: 'fieldsSpatialPoint';
  readonly result: FieldsSpatialPointCandidateSupport;
}

export type FieldsSpatialPointCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedFieldsSpatialPointCandidate;

function canonicalRooms(biome: CandidateBiomeEvaluation): readonly CanonicalAuthoredRoom[] {
  if ('snapshot' in biome) return snapshotRooms(biome.snapshot);
  return prefixAuthoredRooms(biome.materializedPrefix);
}

function snapshotRooms(snapshot: CanonicalBiome): readonly CanonicalAuthoredRoom[] {
  const rooms: CanonicalAuthoredRoom[] = [snapshot.entryRoom];
  for (const decision of snapshot.decisions) {
    if (decision.kind === 'batch') {
      rooms.push(
        ...decision.targets.map((target) => target.room),
        ...decision.additional.map((continuation) => continuation.room),
      );
      continue;
    }
    rooms.push(
      ...decision.board.targets.map((target) => target.room),
      ...decision.visits.flatMap((visit) => [visit.target.room, ...visit.enteredLocalRooms]),
    );
  }
  rooms.push(...snapshot.fixedRoomLinks.map((link) => link.target));
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

function roomFor(
  biome: CandidateBiomeEvaluation,
  occurrence: OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  return canonicalRooms(biome).find(
    (room) => semanticAddressKey(room.origin) === semanticAddressKey(occurrence),
  );
}

function activeSlots(
  room: CanonicalAuthoredRoom,
  groupKey: string,
  optional: boolean,
): ReadonlySet<string> {
  const resolved = optional ? (room.fieldsOptionalRewards ?? []) : (room.localRewards ?? []);
  const unresolved = optional
    ? (room.unresolvedFieldsOptionalRewards ?? [])
    : (room.unresolvedLocalRewards ?? []);
  return new Set(
    [...resolved, ...unresolved]
      .filter((reward) => reward.groupKey === groupKey)
      .map((reward) => reward.slotKey),
  );
}

function pointDomain(
  declaration: FieldsSpatialDeclaration,
  target: FieldsSpatialTarget,
): readonly number[] {
  switch (target.kind) {
    case 'entry':
      return declaration.entryPairs.map((pair) => pair.startPointId);
    case 'cage':
      return declaration.cagePointIds;
    case 'optional':
    case 'nemesis':
      return declaration.optionalPointIds;
  }
}

function targetActive(
  room: CanonicalAuthoredRoom,
  catalog: Catalog,
  target: FieldsSpatialTarget,
): boolean {
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration?.fieldsOptionalRewards === undefined) return false;
  switch (target.kind) {
    case 'entry':
      return true;
    case 'cage': {
      const cage = declaration.localChildren.find(
        (child) =>
          child.kind === 'boundedRewardSlots' && child.offerRewardCapability === 'fieldsCages',
      );
      return cage !== undefined && activeSlots(room, cage.key, false).has(target.slotKey);
    }
    case 'optional':
      return activeSlots(room, declaration.fieldsOptionalRewards.key, true).has(target.slotKey);
    case 'nemesis':
      return room.encounterPhases.some((phase) => phase.encounterKey === 'NemesisRandomEvent');
  }
}

function occupiedSiblingPoints(
  room: CanonicalAuthoredRoom,
  catalog: Catalog,
  target: FieldsSpatialTarget,
): ReadonlySet<number> {
  const state = room.fieldsSpatial;
  if (state === undefined) return new Set();
  const declaration = catalog.rooms.byKey[room.gameName];
  if (declaration?.fieldsSpatial === undefined) return new Set();
  const occupied = new Set<number>();
  if (target.kind === 'cage') {
    const cage = declaration.localChildren.find(
      (child) =>
        child.kind === 'boundedRewardSlots' && child.offerRewardCapability === 'fieldsCages',
    );
    const active = cage === undefined ? new Set<string>() : activeSlots(room, cage.key, false);
    for (const [slotKey, pointId] of Object.entries(state.cagePointIdBySlot)) {
      if (slotKey !== target.slotKey && active.has(slotKey) && pointId !== null)
        occupied.add(pointId);
    }
    return occupied;
  }
  if (target.kind === 'optional' || target.kind === 'nemesis') {
    const active = activeSlots(room, declaration.fieldsOptionalRewards!.key, true);
    for (const [slotKey, pointId] of Object.entries(state.optionalPointIdBySlot)) {
      if (target.kind === 'optional' && slotKey === target.slotKey) continue;
      if (active.has(slotKey) && pointId !== null) occupied.add(pointId);
    }
    if (target.kind === 'optional') {
      if (targetActive(room, catalog, { kind: 'nemesis' }) && state.nemesisPointId !== null)
        occupied.add(state.nemesisPointId);
    }
  }
  return occupied;
}

function finding(
  code:
    'fieldsSpatialPointMissing' | 'fieldsSpatialPointUnavailable' | 'fieldsSpatialPointDuplicate',
  query: FieldsSpatialPointCandidateQuery,
  evidence: SemanticFinding['evidence'],
): SemanticFinding {
  return Object.freeze({
    code,
    severity: 'error',
    phase: 'roomGeneration',
    origin: query.spatial,
    evidence,
  });
}

export function evaluateFieldsSpatialPointCandidate(
  catalog: Catalog,
  _project: ProjectDocument,
  evaluation: ProjectEvaluation,
  query: FieldsSpatialPointCandidateQuery,
): FieldsSpatialPointCandidateEvaluation {
  const biome = candidateBiome(evaluation, query.spatial.routeKey, query.spatial.biomeKey);
  if (biome === undefined) {
    return unavailableForBiome(
      evaluation,
      query.spatial.routeKey,
      query.spatial.biomeKey,
      query.spatial,
      'afterRoomLifecycle',
    );
  }
  const room = roomFor(
    biome,
    Object.freeze({
      kind: 'occurrence',
      routeKey: query.spatial.routeKey,
      biomeKey: query.spatial.biomeKey,
      occurrenceId: query.spatial.occurrenceId,
    }),
  );
  if (room === undefined) return unreachableTarget(query.spatial);
  const declaration = catalog.rooms.byKey[room.gameName]?.fieldsSpatial;
  if (declaration === undefined) return unreachableTarget(query.spatial);
  const active = targetActive(room, catalog, query.spatial.target);
  const domain = pointDomain(declaration, query.spatial.target);
  const excluded =
    query.spatial.target.kind === 'nemesis'
      ? new Set(declaration.nemesisExcludedOptionalPointIds)
      : new Set<number>();
  const occupied = occupiedSiblingPoints(room, catalog, query.spatial.target);
  const supportPointIds = Object.freeze(
    domain.filter((pointId) => !excluded.has(pointId) && !occupied.has(pointId)),
  );
  const findings: SemanticFinding[] = [];
  if (active && query.pointId === null) {
    findings.push(
      finding('fieldsSpatialPointMissing', query, {
        target: query.spatial.target.kind,
        supportPointIds,
      }),
    );
  } else if (query.pointId !== null && !domain.includes(query.pointId)) {
    findings.push(
      finding('fieldsSpatialPointUnavailable', query, {
        pointId: query.pointId,
        domain,
      }),
    );
  } else if (active && query.pointId !== null && excluded.has(query.pointId)) {
    findings.push(
      finding('fieldsSpatialPointUnavailable', query, {
        pointId: query.pointId,
        reason: 'sourceExcluded',
      }),
    );
  } else if (active && query.pointId !== null && occupied.has(query.pointId)) {
    findings.push(
      finding('fieldsSpatialPointDuplicate', query, {
        pointId: query.pointId,
        occupiedPointIds: [...occupied],
      }),
    );
  }
  const selectedPossible =
    !active || (query.pointId !== null && supportPointIds.includes(query.pointId));
  return Object.freeze({
    kind: 'fieldsSpatialPoint',
    result: Object.freeze({
      spatial: query.spatial,
      target: query.spatial.target,
      pointId: query.pointId,
      supportPointIds,
      selectedPossible,
      findings: Object.freeze(findings),
    }),
  });
}
