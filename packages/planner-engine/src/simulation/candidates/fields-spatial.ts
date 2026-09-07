import type { Catalog } from '../../catalog-schema';
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
import { assessFieldsSpatialPoint } from '../fields-spatial';

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
  const assessment = assessFieldsSpatialPoint(catalog, room, query.spatial.target, query.pointId);
  if (assessment === undefined) return unreachableTarget(query.spatial);
  return Object.freeze({
    kind: 'fieldsSpatialPoint',
    result: Object.freeze({
      spatial: query.spatial,
      target: query.spatial.target,
      pointId: query.pointId,
      supportPointIds: assessment.supportPointIds,
      selectedPossible: assessment.selectedPossible,
      findings: assessment.findings,
    }),
  });
}
