import type { Catalog } from '../catalog-schema';
import type { OccurrenceAddress } from '../authored-project/addresses';
import type { ProjectDocument } from '../authored-project/model';
import { structurallyActiveOccurrenceIds } from '../authored-project/topology/query';
import type { ProjectEvaluationAssembly } from './evaluation/evaluation-products';
import { assertExactProjectEvaluationAssembly } from './evaluation/project-evaluation-assembly';
import { simulateProject } from './evaluation/project';

/**
 * Whether the plan can end after a room. `notOnRoute`: the room is not on its
 * biome's selected path, or its biome is not configured. `notSettled`: the
 * room, or something before it, is incomplete or invalid, so a plan ending
 * there would not be valid.
 */
export type PlanEndAvailability =
  | { readonly available: true }
  | { readonly available: false; readonly reason: 'notOnRoute' | 'notSettled' };

/**
 * Answers by evaluating the plan as if it ended after the room: the room
 * settles its Timeline and exit work and everything before it is valid.
 */
export function planEndAvailability(
  catalog: Catalog,
  assembly: ProjectEvaluationAssembly,
  room: OccurrenceAddress,
): PlanEndAvailability {
  assertExactProjectEvaluationAssembly(assembly);
  const route = assembly.project.route;
  const topology =
    route.routeKey === room.routeKey
      ? route.biomes.find((biome) => biome.biomeKey === room.biomeKey)?.topology
      : undefined;
  if (
    topology === undefined ||
    topology === null ||
    !structurallyActiveOccurrenceIds(topology).has(room.occurrenceId)
  )
    return Object.freeze({ available: false, reason: 'notOnRoute' });
  const ended: ProjectDocument = Object.freeze({
    ...assembly.project,
    route: Object.freeze({
      ...route,
      planEnd: Object.freeze({ biomeKey: room.biomeKey, occurrenceId: room.occurrenceId }),
    }),
  });
  return simulateProject(catalog, ended).status === 'valid'
    ? Object.freeze({ available: true })
    : Object.freeze({ available: false, reason: 'notSettled' });
}
