import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  ProjectCommandContractError,
  roomActionKey,
  semanticAddressKey,
  createBiomeAddress,
  createOccurrenceAddress,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../src/simulation/candidates/evaluated-biome';
import {
  liveRoomForProjectEvaluationAssembly,
  type LiveVerb,
} from '../../src/simulation/evaluation/live-room';

/** Golden Underworld and Surface plans, the live product's witnesses. */
export const goldenCheckpoints = checkpointRegistry.filter(
  ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
);

/** Findings an action placed out of its window, order or dependencies raises. */
export const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionOrderUnavailable',
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

export function roomOrder(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
): readonly RoomActionReference[] {
  return (
    project.route.biomes
      .find((biome) => biome.biomeKey === occurrence.biomeKey)
      ?.topology?.occurrences.find(
        (candidate) => candidate.occurrenceId === occurrence.occurrenceId,
      )?.roomActions.order ?? []
  );
}

export function canonicalRoom(assembly: ProjectEvaluationAssembly, address: OccurrenceAddress) {
  const biome = candidateBiome(assembly.evaluation, address.routeKey, address.biomeKey);
  return biome === undefined
    ? undefined
    : candidateBiomeRooms(biome).find(
        (room) => semanticAddressKey(room.origin) === semanticAddressKey(address),
      );
}

/** Every entered room the walk reaches, with its live placements. */
export function reachedRooms(project: ProjectDocument, assembly: ProjectEvaluationAssembly) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) => {
      const address = createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      );
      const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, address, 'placements');
      return live === undefined ? [] : [{ address, live }];
    }),
  );
}

/** How a verb puts its row at its gap: standing there, moved there or newly placed there. */
export function verbStep(verb: LiveVerb): 'placed' | 'move' | 'place' {
  if (verb.standing === true) return 'placed';
  return verb.commands?.[0]?.kind === 'MoveRoomAction' ? 'move' : 'place';
}

/** The room an address lies in: the first occurrence it names, nearest first. */
export function occurrenceOf(address: object): string | undefined {
  const queue: unknown[] = [address];
  while (queue.length > 0) {
    const next = queue.shift();
    if (typeof next !== 'object' || next === null) continue;
    if ('occurrenceId' in next && typeof next.occurrenceId === 'string') return next.occurrenceId;
    queue.push(...Object.values(next));
  }
  return undefined;
}

/** The room's placement findings; another room's are its own walk's. */
export function placementFindings(
  assembly: ProjectEvaluationAssembly,
  address: OccurrenceAddress,
): ReadonlySet<string> {
  return new Set(
    assembly.evaluation.findings.flatMap((finding) =>
      PLACEMENT_FINDINGS.has(finding.code) && occurrenceOf(finding.origin) === address.occurrenceId
        ? [`${finding.code} ${semanticAddressKey(finding.origin)}`]
        : [],
    ),
  );
}

/**
 * Whether the walk takes an edit placing a row: the command applies, the walk
 * reaches the row it placed and no new placement finding arises.
 */
export function walkAccepts(
  project: ProjectDocument,
  before: ReadonlySet<string>,
  address: OccurrenceAddress,
  commands: readonly ProjectCommand[],
  key: string,
): boolean {
  let after = project;
  try {
    for (const command of commands) after = applyProjectCommand(after, catalog, command);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) return false;
    throw error;
  }
  const index = roomOrder(after, address).findIndex(
    (reference) => roomActionKey(reference) === key,
  );
  if (index < 0) return false;
  const assembly = simulateProjectAssembly(catalog, after);
  const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, address, 'placements');
  return (
    live !== undefined &&
    live.frontier >= index &&
    [...placementFindings(assembly, address)].every((finding) => before.has(finding))
  );
}

export function withRoomOrder(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  order: readonly RoomActionReference[],
): ProjectDocument {
  return {
    ...project,
    route: {
      ...project.route,
      biomes: project.route.biomes.map((biome) =>
        biome.biomeKey !== occurrence.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((candidate) =>
                  candidate.occurrenceId === occurrence.occurrenceId
                    ? { ...candidate, roomActions: { ...candidate.roomActions, order } }
                    : candidate,
                ),
              },
            },
      ),
    },
  };
}

/** The plan through one biome: a later biome's walk takes no part in a room's own. */
export function throughBiome(project: ProjectDocument, biomeKey: string): ProjectDocument {
  const last = project.route.biomes.findIndex((biome) => biome.biomeKey === biomeKey);
  return {
    ...project,
    route: { ...project.route, biomes: project.route.biomes.slice(0, last + 1) },
  };
}
