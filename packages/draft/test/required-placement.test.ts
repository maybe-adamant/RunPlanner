import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createDefaultRouteLoadout,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveActionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { oBiome } from '@run-planner/test-fixtures/surface';
import type { DraftSpec } from '../src';
import { startDraftWalk } from './support/draft-walk';

const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

const { startingReward: _startingReward, ...loadout } = createDefaultRouteLoadout(catalog);
void _startingReward;
const spec: DraftSpec = {
  loadout,
  world: { godKeys: ['Zeus'], storyNpcByBiome: {}, fieldNpcsByBiome: {} },
  basketByGiver: {},
  rackKeepsakeKeys: [null, null, null],
  // No essence placement: the walk's only edits are its repairs.
  resourceRoomChance: 0,
};

/** The room an address lies in: the first occurrence it names, nearest first. */
function occurrenceOf(address: object): string | undefined {
  const queue: unknown[] = [address];
  while (queue.length > 0) {
    const next = queue.shift();
    if (typeof next !== 'object' || next === null) continue;
    if ('occurrenceId' in next && typeof next.occurrenceId === 'string') return next.occurrenceId;
    queue.push(...Object.values(next));
  }
  return undefined;
}

function roomOrder(project: ProjectDocument, room: OccurrenceAddress) {
  return (
    project.route.biomes
      .find((biome) => biome.biomeKey === room.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === room.occurrenceId)
      ?.roomActions.order ?? []
  );
}

/** The project with the room's order replaced, as a hand-edited save could leave it. */
function withOrder(
  project: ProjectDocument,
  room: OccurrenceAddress,
  order: readonly RoomActionReference[],
): ProjectDocument {
  return {
    ...project,
    route: {
      ...project.route,
      biomes: project.route.biomes.map((biome) =>
        biome.biomeKey !== room.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((occurrence) =>
                  occurrence.occurrenceId === room.occurrenceId
                    ? { ...occurrence, roomActions: { order } }
                    : occurrence,
                ),
              },
            },
      ),
    },
  };
}

/** The keys of the required rows the walk reached in the room, read from the live product. */
function requiredRows(assembly: ProjectEvaluationAssembly, room: OccurrenceAddress) {
  const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, room);
  const keys = new Set<string>();
  for (const gap of live?.gaps ?? [])
    for (const item of gap.items)
      for (const action of item.actions)
        if (
          action.kind === 'placed' &&
          (item.kind === 'pickup'
            ? item.participation === 'required'
            : 'participation' in action && action.participation === 'required')
        )
          keys.add(roomActionKey(action.reference));
  return keys;
}

function roomActionKeys(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  return roomOrder(project, room).map(roomActionKey);
}

/** The original order's keys still present: edit settlement drops a stale row on any edit. */
function kept(
  order: readonly RoomActionReference[],
  present: readonly string[],
): readonly string[] {
  return order.map(roomActionKey).filter((key) => present.includes(key));
}

function isRoomPlacement(assembly: ProjectEvaluationAssembly, room: OccurrenceAddress): boolean {
  const reason = assembly.evaluation.issue?.reasons[0];
  return (
    reason !== undefined &&
    PLACEMENT_FINDINGS.has(reason.code) &&
    occurrenceOf(reason.origin) === room.occurrenceId
  );
}

/**
 * Walks from the room's stripped plan while its first issue is the room's placement finding.
 * Edit settlement places only the required actions an edit newly activates, so the stripped
 * rows come back only through the walk's own placement.
 */
function restore(
  project: ProjectDocument,
  biomeIndex: number,
  room: OccurrenceAddress,
  stripped: ProjectEvaluationAssembly,
) {
  const walk = startDraftWalk(project, spec, 1, { from: stripped });
  while (isRoomPlacement(walk.assembly, room)) {
    const steps = walk.steps;
    walk.runBiome(biomeIndex, steps + 1);
    if (walk.steps === steps) break;
  }
  return walk;
}

const golden = checkpointRegistry.filter(
  ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
);
/** Rooms an earlier checkpoint already witnessed. */
const witnessed = new Set<string>();

describe('Draft places what a room requires from the live product', () => {
  it.each(golden.map((checkpoint) => [checkpoint.entry.id, checkpoint] as const))(
    '%s: restores the stripped required rows of each room not yet witnessed',
    (id, { load }) => {
      const project = load();
      const assembly = simulateProjectAssembly(catalog, project);
      const failures: string[] = [];
      for (const [biomeIndex, biome] of project.route.biomes.entries())
        for (const occurrence of biome.topology?.occurrences ?? []) {
          if (witnessed.has(occurrence.occurrenceId)) continue;
          const room = createOccurrenceAddress(
            createBiomeAddress(project.route.routeKey, biome.biomeKey),
            occurrence.occurrenceId,
          );
          const required = requiredRows(assembly, room);
          if (required.size === 0) continue;
          const stripped = simulateProjectAssembly(
            catalog,
            withOrder(
              project,
              room,
              roomOrder(project, room).filter(
                (reference) => !required.has(roomActionKey(reference)),
              ),
            ),
          );
          // An earlier finding of the checkpoint stands before the room's placement.
          if (!isRoomPlacement(stripped, room)) continue;
          witnessed.add(occurrence.occurrenceId);
          const walk = restore(project, biomeIndex, room, stripped);
          const issue = walk.assembly.evaluation.issue?.reasons[0];
          if (isRoomPlacement(walk.assembly, room)) {
            failures.push(`${occurrence.occurrenceId}: still ${issue?.code}`);
            continue;
          }
          // A later row of a room the walk stops in waits for that stop's own repair, and an
          // encounter the walk chose may no longer require the stripped contact.
          const live = liveActionsForProjectEvaluationAssembly(catalog, walk.assembly, room);
          if (
            (issue !== undefined && live?.frontier !== roomOrder(walk.project, room).length) ||
            walk.appliedCommands.some((command) => command.kind === 'SelectEncounter')
          )
            continue;
          const restored = new Set(roomOrder(walk.project, room).map(roomActionKey));
          const missing = [...required].filter((key) => !restored.has(key));
          if (missing.length > 0) failures.push(`${occurrence.occurrenceId}: missing ${missing}`);
        }
      expect(failures, id).toEqual([]);
    },
  );

  it('witnessed the golden rooms', () => {
    expect(witnessed.size).toBeGreaterThan(90);
  });

  it('places a deferred Ship wheel reward the live product does not offer yet', () => {
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const room = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-combat01'));
    const order = roomOrder(project, room);
    const reward = order.find((reference) => reference.kind === 'interactWheelReward')!;
    expect(reward).toBeDefined();
    const stripped = simulateProjectAssembly(
      catalog,
      withOrder(
        project,
        room,
        order.filter((reference) => reference !== reward),
      ),
    );
    // The walk stops at the encounter end the unplaced reward holds, before the reward spawns.
    const live = liveActionsForProjectEvaluationAssembly(catalog, stripped, room)!;
    const offered = live.gaps.flatMap((gap) =>
      gap.items.flatMap((item) => item.actions.map((action) => roomActionKey(action.reference))),
    );
    expect(offered).not.toContain(roomActionKey(reward));
    const walk = restore(project, project.route.itineraryBiomeKeys.indexOf('O'), room, stripped);
    expect(walk.appliedCommands).toContainEqual(
      expect.objectContaining({ kind: 'InsertRoomAction', reference: reward }),
    );
    expect(isRoomPlacement(walk.assembly, room)).toBe(false);
    expect(roomActionKeys(walk.project, room)).toEqual(
      kept(order, roomActionKeys(walk.project, room)),
    );
  });

  it('places a removed Hermes delivery by the command the live product offers', () => {
    const pCombat = createOccurrenceAddress(
      createBiomeAddress('Surface', 'P'),
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const project = loadSurfaceScheduledLifecycleCheckpoint();
    const order = roomOrder(project, pCombat);
    const delivery = order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    expect(delivery).toBeDefined();
    const stripped = simulateProjectAssembly(
      catalog,
      withOrder(
        project,
        pCombat,
        order.filter((reference) => reference !== delivery),
      ),
    );
    expect(stripped.evaluation.issue?.reasons[0]?.code).toBe(
      'hermesShrineDeliveryPlacementRequired',
    );
    const walk = restore(project, project.route.itineraryBiomeKeys.indexOf('P'), pCombat, stripped);
    expect(walk.appliedCommands).toEqual([
      expect.objectContaining({ kind: 'PlaceHermesShrineDelivery' }),
    ]);
    expect(isRoomPlacement(walk.assembly, pCombat)).toBe(false);
    // The frontier's placement, where the walk stands, rather than settlement's due contact.
    expect(new Set(roomActionKeys(walk.project, pCombat))).toEqual(
      new Set(order.map(roomActionKey)),
    );
  });
});
