import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  ProjectCommandContractError,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type ProjectEvaluationAssembly,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { purchaseTestHermesShrineOffer } from '@run-planner/test-fixtures/shared';
import { oBiome } from '@run-planner/test-fixtures/surface';
import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../src/simulation/candidates/evaluated-biome';
import {
  liveActionsForProjectEvaluationAssembly,
  type LiveAction,
  type RoomLiveActions,
} from '../../src/simulation/evaluation/live-actions';

const oPostboss = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));

const goldenCheckpoints = checkpointRegistry.filter(
  ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
);

/** Findings an action placed out of its window, order or dependencies raises. */
const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionOrderUnavailable',
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

/** Purchases, the Pedestal and the rack enter the order only through their feature's command. */
const FEATURE_OWNED: ReadonlySet<string> = new Set([
  'interactShopOffer',
  'interactInfernalContractPedestal',
  'purchaseHermesShrineOffer',
  'purchaseStygianWellOffer',
  'interactKeepsakeRack',
]);

function roomOrder(
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

function canonicalRoom(assembly: ProjectEvaluationAssembly, address: OccurrenceAddress) {
  const biome = candidateBiome(assembly.evaluation, address.routeKey, address.biomeKey);
  return biome === undefined
    ? undefined
    : candidateBiomeRooms(biome).find(
        (room) => semanticAddressKey(room.origin) === semanticAddressKey(address),
      );
}

/** Every entered room the walk reaches, with its live actions. */
function reachedRooms(project: ProjectDocument, assembly: ProjectEvaluationAssembly) {
  return project.route.biomes.flatMap((biome) =>
    (biome.topology?.occurrences ?? []).flatMap((occurrence) => {
      const address = createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, biome.biomeKey),
        occurrence.occurrenceId,
      );
      const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, address);
      return live === undefined ? [] : [{ address, live }];
    }),
  );
}

function actionsAt(live: RoomLiveActions, gap: number): readonly LiveAction[] {
  return live.gaps[gap]?.items.flatMap((item) => item.actions) ?? [];
}

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

/** The room's placement findings; another room's are its own walk's. */
function placementFindings(
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
function walkAccepts(
  project: ProjectDocument,
  before: ReadonlySet<string>,
  address: OccurrenceAddress,
  command: ProjectCommand,
  key: string,
): boolean {
  let after: ProjectDocument;
  try {
    after = applyProjectCommand(project, catalog, command);
  } catch (error) {
    if (error instanceof ProjectCommandContractError) return false;
    throw error;
  }
  const index = roomOrder(after, address).findIndex(
    (reference) => roomActionKey(reference) === key,
  );
  if (index < 0) return false;
  const assembly = simulateProjectAssembly(catalog, after);
  const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, address);
  return (
    live !== undefined &&
    live.frontier >= index &&
    [...placementFindings(assembly, address)].every((finding) => before.has(finding))
  );
}

function withRoomOrder(
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

/**
 * Required pickups today's walk cannot reach once unplaced, by room and kind:
 * the walk stops at the event or source that spawns them.
 */
const HELD_TODAY: Readonly<Record<string, number>> = {
  // A Nemesis trade's result: the walk blocks at her contact.
  'nemesis-f-trait-trade golden-f-b5-e1 interactAcquisitionEntry': 1,
  // A cage reward: the walk stops at room entry, where the cages spawn.
  'nemesis-h-fields golden-h-combat05 interactLocalReward': 1,
  // A deferred Ship wheel's reward: its encounter end waits on it.
  'surface-shrine-travel-deal surface-o-combat07 interactWheelReward': 1,
  'surface-no-hermes-shrine-delivery surface-o-combat07 interactWheelReward': 1,
  'surface-scheduled-lifecycle surface-o-combat01 interactWheelReward': 1,
  'surface-shrine-travel-deal surface-o-combat04 interactWheelReward': 1,
  // A delivery due after a wheel reward: the walk blocks at the encounter end.
  'surface-shrine-travel-deal surface-o-combat04 interactAcquisitionEntry': 1,
  // An Artificer replacement: the walk blocks at the pickup it converts.
  'underworld-f-trait-order-checks e9c1775e-a04b-4ed2-b749-7ef344614cbe interactAcquisitionEntry': 1,
  'underworld-f-trait-order-checks f4adb787-5267-4ce6-8712-e53744e505ff interactAcquisitionEntry': 1,
  // A Boss room's reward after its forced drop: the stop rewinds before the drop's row.
  'underworld-zagreus-contract zagreus-contract-showcase interactIncomingReward': 1,
};

describe('live actions at a gap', () => {
  const evaluated = goldenCheckpoints.map(({ entry, load }) => {
    const project = load();
    return { id: entry.id, project, assembly: simulateProjectAssembly(catalog, project) };
  });

  it('stands every reached row live at its own gap', () => {
    const failures: string[] = [];
    let rows = 0;
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const order = roomOrder(project, address);
        const stale = new Set(
          canonicalRoom(assembly, address)?.roomActionRoster.rows.flatMap((row) =>
            row.stale ? [row.key] : [],
          ),
        );
        for (let index = 0; index <= live.frontier && index < order.length; index += 1) {
          const key = roomActionKey(order[index]!);
          if (stale.has(key)) continue;
          rows += 1;
          if (
            !actionsAt(live, index).some(
              (action) => action.kind === 'placed' && roomActionKey(action.reference) === key,
            )
          )
            failures.push(`${id} ${address.occurrenceId} #${index} ${key}`);
        }
      }
    expect(failures).toEqual([]);
    expect(rows).toBeGreaterThan(1000);
  });

  it('lists at the frontier every spawned pickup the walk left unplaced', () => {
    const failures: string[] = [];
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const loot = spawnedLootForProjectEvaluationAssembly(catalog, assembly, address)!;
        const frontier = live.gaps[live.frontier]!;
        const unplaced = [
          ...loot.moments.flatMap((moment) => moment.items),
          ...loot.actionSpawns.flatMap((spawn) => spawn.items),
        ].filter((item) => item.placement.kind === 'unplaced');
        for (const item of unplaced)
          if (
            !frontier.items.some(
              (candidate) =>
                candidate.kind === 'pickup' &&
                semanticAddressKey(candidate.owner) === semanticAddressKey(item.owner),
            )
          )
            failures.push(`${id} ${address.occurrenceId}: ${roomActionKey(item.reference)}`);
      }
    expect(failures).toEqual([]);
  });

  // One room of each set of action kinds across the golden plans, and every room a plan stops in.
  const sampleRooms = (() => {
    const seen = new Set<string>();
    const rooms: {
      readonly id: string;
      readonly project: ProjectDocument;
      readonly assembly: ProjectEvaluationAssembly;
      readonly address: OccurrenceAddress;
      readonly live: RoomLiveActions;
    }[] = [];
    // A room in a plan's last biomes re-evaluates least once edited, so it represents its shape.
    const candidates = evaluated
      .flatMap(({ id, project, assembly }) =>
        reachedRooms(project, assembly).map(({ address, live }) => ({
          id,
          project,
          assembly,
          address,
          live,
          later:
            project.route.biomes.length -
            project.route.biomes.findIndex((biome) => biome.biomeKey === address.biomeKey),
        })),
      )
      .sort((left, right) => left.later - right.later);
    for (const { later: _later, ...room } of candidates) {
      void _later;
      const order = roomOrder(room.project, room.address);
      if (order.length === 0) continue;
      const stopped = room.live.frontier < order.length;
      const shape = [...new Set(order.map((reference) => reference.kind))].sort().join(',');
      if (!stopped && seen.has(shape)) continue;
      seen.add(shape);
      rooms.push(room);
    }
    return rooms;
  })();

  it('offers at each gap through the frontier exactly the placements and moves the walk takes there', () => {
    const failures: string[] = [];
    let tried = 0;
    for (const { id, project, assembly, address, live } of sampleRooms) {
      const before = placementFindings(assembly, address);
      const room = canonicalRoom(assembly, address)!;
      const accepts = (command: ProjectCommand, key: string) => {
        tried += 1;
        return walkAccepts(project, before, address, command, key);
      };
      for (let gap = 0; gap <= live.frontier; gap += 1) {
        const offeredRows = new Set<string>();
        // Every offered action the walk takes; a choice still to make is proved apart.
        for (const action of actionsAt(live, gap)) {
          if (action.kind === 'placed') continue;
          if (action.kind === 'place' && action.needsChoice === 'travelDealItem') continue;
          const key = roomActionKey(action.reference);
          if (
            action.command.kind === 'InsertRoomAction' ||
            action.command.kind === 'MoveRoomAction'
          )
            offeredRows.add(key);
          if (!accepts(action.command, key))
            failures.push(`${id} ${address.occurrenceId} @${gap}: offered ${key} refused`);
        }
        // Every row insertion, or move of a later row, the walk takes here is offered.
        for (const row of room.roomActionRoster.rows) {
          if (row.stale || offeredRows.has(row.key)) continue;
          const action = createRoomActionAddress(
            createBiomeAddress(address.routeKey, address.biomeKey),
            address.occurrenceId,
            row.key,
          );
          const command: ProjectCommand | undefined =
            row.rank === null
              ? FEATURE_OWNED.has(row.reference.kind)
                ? undefined
                : { kind: 'InsertRoomAction', action, reference: row.reference, index: gap }
              : row.rank - 1 > gap
                ? { kind: 'MoveRoomAction', action, toIndex: gap }
                : undefined;
          if (command !== undefined && accepts(command, row.key))
            failures.push(`${id} ${address.occurrenceId} @${gap}: ${row.key} taken, not offered`);
        }
      }
    }
    expect(failures).toEqual([]);
    expect(sampleRooms.length).toBeGreaterThan(20);
    expect(tried).toBeGreaterThan(150);
  });

  it('holds a required pickup at its spawn while it is unplaced, as today’s walk does', () => {
    // Take each placed required pickup of a sampled room back, alone: it stands offered at its
    // own gap unless today's walk stops, on its placement finding, at what spawns it.
    const held = new Map<string, number>();
    const failures: string[] = [];
    let tried = 0;
    for (const { id, project, assembly, address, live } of sampleRooms) {
      const order = roomOrder(project, address);
      if (live.frontier < order.length) continue;
      const room = canonicalRoom(assembly, address)!;
      const loot = spawnedLootForProjectEvaluationAssembly(catalog, assembly, address)!;
      const pickups = new Set(
        [
          ...loot.moments.flatMap((moment) => moment.items),
          ...loot.actionSpawns.flatMap((spawn) => spawn.items),
        ].map((item) => roomActionKey(item.reference)),
      );
      for (const row of room.roomActionRoster.rows) {
        if (row.stale || row.rank === null || row.participation !== 'required') continue;
        if (!pickups.has(row.key)) continue;
        // A row a later ordered row depends on cannot leave the order alone.
        if (
          room.roomActionRoster.rows.some(
            (other) =>
              other.rank !== null &&
              other.dependencies.some(
                (dependency) =>
                  dependency.kind === 'afterAction' && roomActionKey(dependency.action) === row.key,
              ),
          )
        )
          continue;
        tried += 1;
        const index = row.rank - 1;
        const without = withRoomOrder(project, address, order.toSpliced(index, 1));
        const after = simulateProjectAssembly(catalog, without);
        const reached = liveActionsForProjectEvaluationAssembly(catalog, after, address)!;
        const offered =
          reached.frontier >= index &&
          actionsAt(reached, index).some(
            (action) =>
              action.kind === 'place' &&
              roomActionKey(action.reference) === row.key &&
              roomActionKey(
                roomOrder(applyProjectCommand(without, catalog, action.command), address)[index]!,
              ) === row.key,
          );
        if (offered) continue;
        // Held: the walk stops short of the pickup's own gap, or there before it spawns, on a
        // placement finding of this room.
        const short =
          reached.frontier < index ||
          !(reached.gaps[index]?.items ?? []).some(
            (item) => item.kind === 'pickup' && roomActionKey(item.reference) === row.key,
          );
        if (!short || placementFindings(after, address).size === 0) {
          failures.push(`${id} ${address.occurrenceId} #${index} ${row.key}`);
          continue;
        }
        const pin = `${id} ${address.occurrenceId} ${row.reference.kind}`;
        held.set(pin, (held.get(pin) ?? 0) + 1);
      }
    }
    expect(failures).toEqual([]);
    expect(tried).toBeGreaterThan(15);
    expect(Object.fromEntries(held)).toEqual(HELD_TODAY);
  });

  it('places a due delivery and a matured drop the walk left unplaced, at the gaps their commands accept', () => {
    // A second O Postboss Shrine item falls due in P beside the placed one.
    const project = purchaseTestHermesShrineOffer(
      loadSurfaceScheduledLifecycleCheckpoint(),
      catalog,
      oPostboss,
      'initial:secondRight',
      { delay: 2, rushed: false },
    );
    const room = createOccurrenceAddress(
      createBiomeAddress('Surface', 'P'),
      createOccurrenceId('surface-p-1-1-p_combat03'),
    );
    const live = liveActionsForProjectEvaluationAssembly(
      catalog,
      simulateProjectAssembly(catalog, project),
      room,
    )!;
    // The walk holds at the encounter end the delivery is due at.
    expect(live.frontier).toBe(0);
    const unplaced = live.gaps[0]!.items.flatMap((item) =>
      item.kind === 'pickup' &&
      item.actions.some(
        (action) =>
          action.kind === 'place' &&
          (action.command.kind === 'PlaceHermesShrineDelivery' ||
            action.command.kind === 'PlaceClockedTraitPickup'),
      )
        ? [item]
        : [],
    );
    expect(
      unplaced.map((item) => [
        item.source.kind === 'generated' ? item.source.family.kind : item.source.kind,
        item.participation,
        item.deadline,
        item.actions.map((action) => (action.kind === 'place' ? action.needsChoice : '')),
      ]),
    ).toEqual([
      // It may go anywhere after the encounter end, the room's last gap included.
      ['hermesShrineDelivery', 'required', 3, [undefined]],
      ['trait', 'optional', undefined, ['levelResolution']],
    ]);
    const delivery = unplaced[0]!.actions[0]!;
    if (delivery.kind !== 'place') throw new Error('the delivery is not placeable');
    expect(delivery.command).toMatchObject({ index: 0 });
    const placed = roomOrder(applyProjectCommand(project, catalog, delivery.command), room);
    expect(roomActionKey(placed[0]!)).toBe(roomActionKey(delivery.reference));
  });
});
