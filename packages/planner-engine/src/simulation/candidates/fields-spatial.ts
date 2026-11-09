import type { Catalog } from '../../catalog-schema';
import {
  semanticAddressKey,
  type FieldsSpatialAddress,
  type FieldsSpatialTarget,
  type OccurrenceAddress,
} from '../../authored-project/addresses';
import type { ProjectDocument } from '../../authored-project/model';
import type { SemanticFinding } from '../model';
import type { ProjectEvaluation } from '../evaluation/evaluation-products';
import type { CanonicalAuthoredRoom } from '../materialization';
import {
  candidateBiome,
  candidateBiomeRooms,
  type CandidateBiomeEvaluation,
} from './evaluated-biome';
import type { CandidateContextUnavailable } from './availability';
import { unavailableForBiome, unreachableTarget } from './availability';
import { assessFieldsSpatialPoint } from '../fields/spatial';

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
  /** Legal placement domain; occupied points remain assignable for explicit repair. */
  readonly assignable: boolean;
  /** Declaration points still available after active sibling assignments. */
  readonly supportPointIds: readonly number[];
  readonly selectedPossible: boolean;
  /** The point the target stands on by default while it has no stored point. */
  readonly defaultPointId?: number;
  readonly findings: readonly SemanticFinding[];
}

export interface EvaluatedFieldsSpatialPointCandidate {
  readonly kind: 'fieldsSpatialPoint';
  readonly result: FieldsSpatialPointCandidateSupport;
}

export type FieldsSpatialPointCandidateEvaluation =
  CandidateContextUnavailable | EvaluatedFieldsSpatialPointCandidate;

/** Memoizes each immutable biome product's rooms by occurrence key. */
const roomIndexes = new WeakMap<
  CandidateBiomeEvaluation,
  ReadonlyMap<string, CanonicalAuthoredRoom>
>();

function roomFor(
  biome: CandidateBiomeEvaluation,
  occurrence: OccurrenceAddress,
): CanonicalAuthoredRoom | undefined {
  let index = roomIndexes.get(biome);
  if (index === undefined) {
    index = new Map(
      candidateBiomeRooms(biome).map((room) => [semanticAddressKey(room.origin), room]),
    );
    roomIndexes.set(biome, index);
  }
  return index.get(semanticAddressKey(occurrence));
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
      assignable: assessment.assignable,
      supportPointIds: assessment.supportPointIds,
      selectedPossible: assessment.selectedPossible,
      ...(assessment.defaultPointId === undefined
        ? {}
        : { defaultPointId: assessment.defaultPointId }),
      findings: assessment.findings,
    }),
  });
}

/** Whether the room is materialized in its retained biome product with this spatial target. */
export function fieldsSpatialPointContextReached(
  catalog: Catalog,
  evaluation: ProjectEvaluation,
  spatial: FieldsSpatialAddress,
): boolean {
  const biome = candidateBiome(evaluation, spatial.routeKey, spatial.biomeKey);
  if (biome === undefined) return false;
  const room = roomFor(
    biome,
    Object.freeze({
      kind: 'occurrence',
      routeKey: spatial.routeKey,
      biomeKey: spatial.biomeKey,
      occurrenceId: spatial.occurrenceId,
    }),
  );
  return (
    room !== undefined &&
    assessFieldsSpatialPoint(catalog, room, spatial.target, null) !== undefined
  );
}
