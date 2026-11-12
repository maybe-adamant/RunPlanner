import type { OccurrenceAddress } from '../../authored-project/addresses';
import type { Catalog } from '../../catalog-schema';
import { fieldsSpatialPositions, type FieldsSpatialPosition } from '../fields/spatial';
import { authoredRoom } from './evaluated-room';
import type { ProjectEvaluationAssembly } from './evaluation-products';

/**
 * Where each active Fields slot of an evaluated room stands, marked chosen or
 * default; undefined for a room the evaluation does not hold.
 */
export function fieldsSpatialPositionsForProjectEvaluationAssembly(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  occurrence: OccurrenceAddress,
): readonly FieldsSpatialPosition[] | undefined {
  const room = authoredRoom(assembly, occurrence);
  return room === undefined ? undefined : fieldsSpatialPositions(catalog, room);
}
