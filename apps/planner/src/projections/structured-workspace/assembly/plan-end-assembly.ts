import {
  createOccurrenceAddress,
  createBiomeAddress,
  createRouteAddress,
  routeRoomDeclaration,
  type AuthoredRoutePlan,
  type OccurrenceAddress,
} from '@run-planner/engine/authored-project';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { PlanEndAvailability, ProjectRouteEvaluation } from '@run-planner/engine/simulation';

import type {
  WorkspacePlanEndAvailability,
  WorkspacePlanEndRelation,
  WorkspaceRoomPlanEnd,
  WorkspaceRoutePlanEnd,
} from '../contracts/structure';
import { requireWorkspaceRoom } from './catalog-room';

const unknownAvailability: WorkspacePlanEndAvailability = Object.freeze({
  available: false,
  reason: 'unknown',
});

/** One room's plan-end action: set the route's single end to it, or remove the end. */
export function assembleRoomPlanEnd(input: {
  readonly room: OccurrenceAddress;
  readonly relation: WorkspacePlanEndRelation | undefined;
  readonly availability: () => PlanEndAvailability | undefined;
}): WorkspaceRoomPlanEnd {
  const route = createRouteAddress(input.room.routeKey);
  return Object.freeze({
    ...(input.relation === undefined ? {} : { relation: input.relation }),
    availability: () => input.availability() ?? unknownAvailability,
    endIntent: Object.freeze({
      command: Object.freeze({
        kind: 'ReplacePlanEnd' as const,
        route,
        planEnd: Object.freeze({
          biomeKey: input.room.biomeKey,
          occurrenceId: input.room.occurrenceId,
        }),
      }),
    }),
    removeIntent: Object.freeze({
      command: Object.freeze({ kind: 'ReplacePlanEnd' as const, route, planEnd: null }),
    }),
  });
}

/** Where the route's plan ends, named for the Route panel; absent while no end is set. */
export function projectRoutePlanEnd(
  catalog: Catalog,
  route: AuthoredRoutePlan,
  evaluation: ProjectRouteEvaluation | undefined,
): WorkspaceRoutePlanEnd | undefined {
  const end = route.planEnd;
  if (end === undefined) return undefined;
  const occurrence = route.biomes
    .find((biome) => biome.biomeKey === end.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === end.occurrenceId);
  const unreached = (evaluation?.findings ?? []).some(
    (finding) => finding.code === 'planEndUnreached',
  );
  return Object.freeze({
    biomeKey: end.biomeKey,
    biomeLabel: catalog.biomes.byKey[end.biomeKey]?.label ?? end.biomeKey,
    roomLabel:
      occurrence === undefined
        ? end.occurrenceId
        : routeRoomDeclaration(requireWorkspaceRoom(catalog, occurrence.gameName), route.routeKey)
            .label,
    room: createOccurrenceAddress(
      createBiomeAddress(route.routeKey, end.biomeKey),
      end.occurrenceId,
    ),
    ...(unreached ? { unreached: true as const } : {}),
    removeIntent: Object.freeze({
      command: Object.freeze({
        kind: 'ReplacePlanEnd' as const,
        route: createRouteAddress(route.routeKey),
        planEnd: null,
      }),
    }),
  });
}
