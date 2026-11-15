import { isDeepStrictEqual } from 'node:util';
import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createShopOfferAddress,
  createDefaultRouteLoadout,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveRoomForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { authorLegalTraitOffers, stockTestProject } from '@run-planner/test-fixtures/shared';
import { createEchoGoldHPrebossProject } from '@run-planner/test-fixtures/underworld';
import { oBiome } from '@run-planner/test-fixtures/surface';
import type { DraftSpec } from '../src';
import { startDraftWalk } from './support/draft-walk';

/**
 * The golden witness's tally. Rooms whose walk stops inside the room or chooses a new encounter
 * resolve their placement finding but are not checked row by row.
 */
const PINNED_COUNTS = {
  rooms: 107,
  restored: 97,
  stoppedInRoom: 0,
  encounterChosen: 10,
  livePlacements: 134,
};

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

/** The project with the room's stored Fields cage points replaced. */
function withCagePoints(
  project: ProjectDocument,
  room: OccurrenceAddress,
  cagePointIdBySlot: Readonly<Record<string, number>>,
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
                  occurrence.occurrenceId === room.occurrenceId &&
                  occurrence.state.kind === 'fieldsCombat'
                    ? {
                        ...occurrence,
                        state: {
                          ...occurrence.state,
                          spatial: { ...occurrence.state.spatial, cagePointIdBySlot },
                        },
                      }
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
  const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, room, 'placements');
  const keys = new Set<string>();
  for (const gap of live?.gaps ?? [])
    for (const item of gap.items)
      for (const verb of item.verbs)
        if (verb.standing === true && verb.participation === 'required')
          keys.add(roomActionKey(verb.reference!));
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

/** The commands a walk places room actions with. */
const PLACEMENT_COMMANDS: ReadonlySet<string> = new Set([
  'InsertRoomAction',
  'PlaceHermesShrineDelivery',
  'PlaceEchoGoldPickup',
  'PlaceClockedTraitPickup',
]);

/** A placement the walk settled, and whether the room's live product offered that command. */
interface SettledPlacement {
  readonly command: ProjectCommand;
  readonly offered: boolean;
}

/** Whether the room's live product, read where the command applies, offers exactly it. */
function offeredByLiveProduct(
  assembly: ProjectEvaluationAssembly,
  room: OccurrenceAddress,
  command: ProjectCommand,
): boolean {
  const live = liveRoomForProjectEvaluationAssembly(catalog, assembly, room, 'placements');
  return (
    live?.gaps.some((gap) =>
      gap.items.some((item) =>
        item.verbs.some(
          (verb) => verb.standing !== true && isDeepStrictEqual(verb.commands?.[0], command),
        ),
      ),
    ) ?? false
  );
}

/**
 * Walks from the room's stripped plan while its first issue is the room's placement finding,
 * recording each placement it settles. Edit settlement places only the required actions an
 * edit newly activates, so the stripped rows come back only through the walk's own placement.
 */
function restore(
  project: ProjectDocument,
  biomeIndex: number,
  room: OccurrenceAddress,
  stripped: ProjectEvaluationAssembly,
) {
  const placements: SettledPlacement[] = [];
  const walk = startDraftWalk(project, spec, 1, {
    from: stripped,
    observe: (session) => ({
      ...session,
      apply: (command, admission) => {
        // The walk also picks up optional trait drops in other rooms it passes.
        const placement =
          PLACEMENT_COMMANDS.has(command.kind) && occurrenceOf(command) === room.occurrenceId;
        const offered = placement && offeredByLiveProduct(session.current(), room, command);
        const outcome = session.apply(command, admission);
        if (outcome.kind === 'applied' && placement) placements.push({ command, offered });
        return outcome;
      },
    }),
  });
  while (isRoomPlacement(walk.assembly, room)) {
    const steps = walk.steps;
    walk.runBiome(biomeIndex, steps + 1);
    if (walk.steps === steps) break;
  }
  return { walk, placements };
}

describe('Draft places what a room requires from the live product', () => {
  it('restores the stripped required rows of every golden room, each by an offered command', () => {
    const golden = checkpointRegistry.filter(
      ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
    );
    const seen = new Set<string>();
    const failures: string[] = [];
    const counts = {
      rooms: 0,
      restored: 0,
      stoppedInRoom: 0,
      encounterChosen: 0,
      livePlacements: 0,
    };
    for (const { entry, load } of golden) {
      const project = load();
      const fresh = project.route.biomes.some((biome) =>
        (biome.topology?.occurrences ?? []).some(
          (occurrence) => !seen.has(occurrence.occurrenceId),
        ),
      );
      if (!fresh) continue;
      const assembly = simulateProjectAssembly(catalog, project);
      for (const [biomeIndex, biome] of project.route.biomes.entries())
        for (const occurrence of biome.topology?.occurrences ?? []) {
          if (seen.has(occurrence.occurrenceId)) continue;
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
          seen.add(occurrence.occurrenceId);
          counts.rooms += 1;
          const name = `${entry.id} ${occurrence.occurrenceId}`;
          const { walk, placements } = restore(project, biomeIndex, room, stripped);
          for (const placement of placements) {
            if (placement.offered) counts.livePlacements += 1;
            else failures.push(`${name}: unoffered ${JSON.stringify(placement.command)}`);
          }
          const issue = walk.assembly.evaluation.issue?.reasons[0];
          if (isRoomPlacement(walk.assembly, room)) {
            failures.push(`${name}: still ${issue?.code}`);
            continue;
          }
          // A later row of a room the walk stops in waits for that stop's own repair.
          const live = liveRoomForProjectEvaluationAssembly(
            catalog,
            walk.assembly,
            room,
            'placements',
          );
          if (issue !== undefined && live?.frontier !== roomOrder(walk.project, room).length) {
            counts.stoppedInRoom += 1;
            continue;
          }
          // An encounter the walk chose may no longer require the stripped contact.
          if (walk.appliedCommands.some((command) => command.kind === 'SelectEncounter')) {
            counts.encounterChosen += 1;
            continue;
          }
          const restored = new Set(roomActionKeys(walk.project, room));
          const missing = [...required].filter((key) => !restored.has(key));
          if (missing.length > 0) failures.push(`${name}: missing ${missing}`);
          else counts.restored += 1;
        }
    }
    expect(failures).toEqual([]);
    expect(counts).toEqual(PINNED_COUNTS);
  });

  it('places a deferred Ship wheel reward by the command the live product offers', () => {
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
    // The reward spawns as the fight completes; its encounter's end effects wait on it.
    const live = liveRoomForProjectEvaluationAssembly(catalog, stripped, room, 'placements')!;
    const offered = live.gaps[live.frontier]!.items.flatMap((item) =>
      item.verbs.map((verb) => roomActionKey(verb.reference!)),
    );
    expect(offered).toContain(roomActionKey(reward));
    const { walk, placements } = restore(
      project,
      project.route.itineraryBiomeKeys.indexOf('O'),
      room,
      stripped,
    );
    expect(placements).toEqual([
      {
        command: expect.objectContaining({ kind: 'InsertRoomAction', reference: reward }),
        offered: true,
      },
    ]);
    expect(isRoomPlacement(walk.assembly, room)).toBe(false);
    expect(roomActionKeys(walk.project, room)).toEqual(
      kept(order, roomActionKeys(walk.project, room)),
    );
  });

  // H_Combat05 entered at HeroStart 755863 (9368, 10536). Its stored points: cage1 573087
  // (14758, 7466), cage2 621494 (14329, 10395), cage3 621539 (9453, 7763).
  it.each([
    {
      points: undefined,
      // cage3 is nearest the entry, then cage1 is nearer cage3 than cage2 is.
      cages: [3, 1, 2],
    },
    {
      points: { cage1: 573087, cage2: 621539, cage3: 621494 },
      cages: [2, 1, 3],
    },
  ])(
    'unlocks the Fields cage nearest where the walk stands and collects its reward before the next (points $points)',
    ({ points, cages }) => {
      const checkpoint = loadUnderworldGeneratedCompositionCheckpoint();
      const room = createOccurrenceAddress(
        createBiomeAddress('Underworld', 'H'),
        createOccurrenceId('golden-h-combat05'),
      );
      const project = points === undefined ? checkpoint : withCagePoints(checkpoint, room, points);
      const order = roomOrder(project, room);
      const required = requiredRows(simulateProjectAssembly(catalog, project), room);
      const stripped = simulateProjectAssembly(
        catalog,
        withOrder(
          project,
          room,
          order.filter((reference) => !required.has(roomActionKey(reference))),
        ),
      );
      expect(isRoomPlacement(stripped, room)).toBe(true);
      const { walk } = restore(
        project,
        project.route.itineraryBiomeKeys.indexOf('H'),
        room,
        stripped,
      );
      expect(isRoomPlacement(walk.assembly, room)).toBe(false);
      expect(roomActionKeys(walk.project, room)).toEqual(
        cages.flatMap((cage) => [
          `["completeFieldsCage","Cage0${cage}"]`,
          `["interactLocalReward","cages","cage${cage}"]`,
        ]),
      );
    },
  );

  it('collects a Gold Gold Gold duplicate right after the purchase that spawns it, not after the later ones', () => {
    const hBiome = createBiomeAddress('Underworld', 'H');
    const shop = createOccurrenceAddress(hBiome, createOccurrenceId('golden-h-preboss-shop'));
    let project = createEchoGoldHPrebossProject();
    for (const offerKey of ['Boon', 'Minor'])
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(hBiome, shop.occurrenceId, offerKey),
        purchased: true,
      });
    const bought = simulateProjectAssembly(
      catalog,
      stockTestProject(authorLegalTraitOffers(project)),
    );
    expect(bought.evaluation.issue?.reasons[0]?.code).toBe('echoGoldPickupPlacementRequired');
    const { placements, walk } = restore(
      project,
      project.route.itineraryBiomeKeys.indexOf('H'),
      shop,
      bought,
    );
    expect(placements).toEqual([
      {
        command: expect.objectContaining({ kind: 'PlaceEchoGoldPickup', index: 1 }),
        offered: true,
      },
    ]);
    expect(roomActionKeys(walk.project, shop)).toEqual([
      '["interactShopOffer","Boon"]',
      '["interactAcquisitionEntry","roomExit","echoDoubleShopReward"]',
      '["interactShopOffer","Minor"]',
    ]);
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
    const { walk, placements } = restore(
      project,
      project.route.itineraryBiomeKeys.indexOf('P'),
      pCombat,
      stripped,
    );
    expect(walk.appliedCommands).toHaveLength(1);
    expect(placements).toEqual([
      { command: expect.objectContaining({ kind: 'PlaceHermesShrineDelivery' }), offered: true },
    ]);
    expect(isRoomPlacement(walk.assembly, pCombat)).toBe(false);
    // Where it arrives with the room reward, before the matured Pom collected after it.
    expect(roomActionKeys(walk.project, pCombat)).toEqual(order.map(roomActionKey));
    expect(order.indexOf(delivery!)).toBe(1);
    expect(order).toHaveLength(3);
  });
});
