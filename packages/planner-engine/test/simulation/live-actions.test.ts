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
import {
  loadSurfaceNOHermesShrineDeliveryCheckpoint,
  loadSurfaceScheduledLifecycleCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/surface';
import {
  loadUnderworldFStygianWellCheckpoint,
  loadUnderworldWorldShopTravelDealCheckpoint,
} from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  createEchoGoldIAnvilDuplicateProject,
  echoGoldIPrebossShopId,
} from '@run-planner/test-fixtures/underworld';
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
const oShrine = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-combat07'));
const pCombat = createOccurrenceAddress(
  createBiomeAddress('Surface', 'P'),
  createOccurrenceId('surface-p-1-1-p_combat03'),
);
const fBiome = createBiomeAddress('Underworld', 'F');
const worldShop = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop'));
const fWell = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:postboss'));

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

/** The room with Gold Gold Gold's duplicate unplaced: its row and its entry gone. */
function withoutEchoGold(
  project: ProjectDocument,
  occurrence: OccurrenceAddress,
  order: readonly RoomActionReference[],
): ProjectDocument {
  const ordered = withRoomOrder(project, occurrence, order);
  return {
    ...ordered,
    route: {
      ...ordered.route,
      biomes: ordered.route.biomes.map((biome) =>
        biome.biomeKey !== occurrence.biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((candidate) => {
                  if (candidate.occurrenceId !== occurrence.occurrenceId) return candidate;
                  const { echoDoubleShopReward: _gold, ...pickupEntries } =
                    candidate.acquisitionSites?.roomExit?.pickupEntries ?? {};
                  void _gold;
                  return {
                    ...candidate,
                    acquisitionSites: {
                      ...candidate.acquisitionSites,
                      roomExit: { ...candidate.acquisitionSites?.roomExit, pickupEntries },
                    },
                  };
                }),
              },
            },
      ),
    },
  };
}

/**
 * Required pickups today's walk cannot reach once unplaced, by room, row and
 * kind: the walk stops at the event or source that spawns them.
 */
const HELD_TODAY: readonly string[] = [
  // A Nemesis trade's result: the walk blocks at her contact.
  'nemesis-f-trait-trade golden-f-b5-e1 #1 interactAcquisitionEntry',
  // A cage reward: the walk stops at room entry, where the cages spawn.
  'nemesis-h-fields golden-h-combat05 #7 interactLocalReward',
  // A deferred Ship wheel's reward: its encounter end waits on it.
  'surface-no-hermes-shrine-delivery surface-o-combat07 #1 interactWheelReward',
  'surface-scheduled-lifecycle surface-o-combat01 #1 interactWheelReward',
  'surface-shrine-travel-deal surface-o-combat04 #1 interactWheelReward',
  'surface-shrine-travel-deal surface-o-combat07 #1 interactWheelReward',
  // A delivery due after a wheel reward: the walk blocks at the encounter end.
  'surface-shrine-travel-deal surface-o-combat04 #2 interactAcquisitionEntry',
  // An Artificer replacement: the walk blocks at the pickup it converts.
  'underworld-f-trait-order-checks e9c1775e-a04b-4ed2-b749-7ef344614cbe #1 interactAcquisitionEntry',
  'underworld-f-trait-order-checks f4adb787-5267-4ce6-8712-e53744e505ff #2 interactAcquisitionEntry',
  // A Boss room's reward after its forced drop: the stop rewinds before the drop's row.
  'underworld-zagreus-contract zagreus-contract-showcase #1 interactIncomingReward',
];

/** The plan through one biome: a later biome's walk takes no part in a room's own. */
function throughBiome(project: ProjectDocument, biomeKey: string): ProjectDocument {
  const last = project.route.biomes.findIndex((biome) => biome.biomeKey === biomeKey);
  return {
    ...project,
    route: { ...project.route, biomes: project.route.biomes.slice(0, last + 1) },
  };
}

const POSITIONED: ReadonlySet<string> = new Set([
  'ReplaceShopPurchaseParticipation',
  'PurchaseShopTravelDealRefill',
  'SetStygianWellPurchase',
  'PurchaseHermesShrineOffer',
  'PlaceHermesShrineDelivery',
  'PlaceClockedTraitPickup',
  'PlaceEchoGoldPickup',
]);

/** The gaps just outside each run of offered gaps, with the room's first gap and the frontier. */
function boundaryGaps(offered: ReadonlySet<number>, frontier: number): readonly number[] {
  const gaps = new Set([0, frontier]);
  for (const gap of offered) {
    if (!offered.has(gap - 1)) gaps.add(gap - 1);
    if (!offered.has(gap + 1)) gaps.add(gap + 1);
  }
  return [...gaps].filter((gap) => gap >= 0 && gap <= frontier && !offered.has(gap));
}

/**
 * One room's live actions against the walk: every offered placement or move
 * is taken, and no row, purchase or derived placement is taken at the gaps
 * bounding where it is offered. A purchase or placement reaches a gap by its
 * default placement and a move.
 */
function auditRoom(
  id: string,
  project: ProjectDocument,
  address: OccurrenceAddress,
  counts: {
    sound: number;
    complete: number;
    families?: Set<string>;
    beforeSpawn?: string[];
  },
  /** Audit only these commands' placements, leaving the room's rows to the sampled rooms. */
  only?: string,
): string[] {
  const failures: string[] = [];
  project = throughBiome(project, address.biomeKey);
  const assembly = simulateProjectAssembly(catalog, project);
  const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, address)!;
  const room = canonicalRoom(assembly, address)!;
  const before = placementFindings(assembly, address);
  const biome = createBiomeAddress(address.routeKey, address.biomeKey);
  const actionOf = (key: string) => createRoomActionAddress(biome, address.occurrenceId, key);
  const offeredGaps = new Map<string, Set<number>>();
  const positioned = new Map<string, ProjectCommand>();
  for (const gap of live.gaps)
    for (const action of gap.items.flatMap((item) => item.actions)) {
      if (action.kind === 'placed') continue;
      if (action.kind === 'place' && action.needsChoice === 'travelDealItem') continue;
      if (only !== undefined && action.command.kind !== only) continue;
      const key = roomActionKey(action.reference);
      offeredGaps.set(key, (offeredGaps.get(key) ?? new Set()).add(gap.index));
      if (POSITIONED.has(action.command.kind)) {
        // A rushed Shrine item's pickup moves with its purchase; the plain purchase stands for both.
        if (action.command.kind === 'PurchaseHermesShrineOffer' && action.command.rushed) continue;
        const { index: _index, ...command } = action.command as ProjectCommand & { index?: number };
        void _index;
        positioned.set(key, command as ProjectCommand);
        counts.families?.add(action.command.kind);
      }
      counts.sound += 1;
      if (!walkAccepts(project, before, address, [action.command], key))
        failures.push(`${id} ${address.occurrenceId} @${gap.index}: offered ${key} refused`);
    }
  const spawnGaps = new Map(
    live.gaps.flatMap((gap) =>
      gap.items.flatMap((item) =>
        item.kind === 'pickup' ? [[roomActionKey(item.reference), item.spawn.gap] as const] : [],
      ),
    ),
  );
  const probe = (key: string, gap: number, commands: readonly ProjectCommand[]) => {
    counts.complete += 1;
    if (!walkAccepts(project, before, address, commands, key)) return;
    // A pickup is live only once spawned; the walk taking it earlier is the walk's leniency.
    if (gap < (spawnGaps.get(key) ?? 0)) counts.beforeSpawn?.push(`${id} @${gap} ${key}`);
    else failures.push(`${id} ${address.occurrenceId} @${gap}: ${key} taken, not offered`);
  };
  for (const row of only === undefined ? room.roomActionRoster.rows : []) {
    if (row.stale || positioned.has(row.key)) continue;
    if (row.rank === null && FEATURE_OWNED.has(row.reference.kind)) continue;
    for (const gap of boundaryGaps(offeredGaps.get(row.key) ?? new Set(), live.frontier))
      if (row.rank === null)
        probe(row.key, gap, [
          {
            kind: 'InsertRoomAction',
            action: actionOf(row.key),
            reference: row.reference,
            index: gap,
          },
        ]);
      else if (row.rank - 1 > gap)
        probe(row.key, gap, [{ kind: 'MoveRoomAction', action: actionOf(row.key), toIndex: gap }]);
  }
  for (const [key, command] of positioned)
    for (const gap of boundaryGaps(offeredGaps.get(key) ?? new Set(), live.frontier))
      probe(key, gap, [command, { kind: 'MoveRoomAction', action: actionOf(key), toIndex: gap }]);
  return failures;
}

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

  // The shortest room of each set of action kinds across the golden plans.
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
      .sort(
        (left, right) =>
          roomOrder(left.project, left.address).length -
            roomOrder(right.project, right.address).length || left.later - right.later,
      );
    for (const { later: _later, ...room } of candidates) {
      void _later;
      const order = roomOrder(room.project, room.address);
      if (order.length === 0) continue;
      const shape = [...new Set(order.map((reference) => reference.kind))].sort().join(',');
      if (seen.has(shape)) continue;
      seen.add(shape);
      rooms.push(room);
    }
    return rooms;
  })();

  // The shortest room holding each action kind, and the shortest room a plan stops in.
  const kindRooms = (() => {
    const chosen = new Set<(typeof sampleRooms)[number]>();
    const kinds = new Set(
      sampleRooms.flatMap(({ project, address }) =>
        roomOrder(project, address).map((reference) => reference.kind),
      ),
    );
    for (const kind of kinds)
      chosen.add(
        sampleRooms.find(({ project, address }) =>
          roomOrder(project, address).some((reference) => reference.kind === kind),
        )!,
      );
    const stopped = sampleRooms.find(
      ({ project, address, live }) => live.frontier < roomOrder(project, address).length,
    );
    if (stopped !== undefined) chosen.add(stopped);
    return [...chosen];
  })();

  it('offers through the frontier only placements and moves the walk takes, and every one it takes', () => {
    const failures: string[] = [];
    const counts = { sound: 0, complete: 0, beforeSpawn: [] as string[] };
    for (const { id, project, address } of kindRooms)
      failures.push(...auditRoom(id, project, address, counts));
    expect(failures).toEqual([]);
    expect(counts.beforeSpawn).toEqual([]);
    expect(kindRooms.length).toBeGreaterThan(10);
    expect(counts.sound).toBeGreaterThan(40);
    expect(counts.complete).toBeGreaterThan(10);
  });

  it('offers every index the walk takes for each object purchase and derived placement', () => {
    const scheduled = purchaseTestHermesShrineOffer(
      loadSurfaceScheduledLifecycleCheckpoint(),
      catalog,
      oPostboss,
      'initial:secondRight',
      { delay: 2, rushed: false },
    );
    const echoShop = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'I'),
      echoGoldIPrebossShopId,
    );
    const echoGold = createEchoGoldIAnvilDuplicateProject();
    const cases: readonly [string, ProjectDocument, OccurrenceAddress, string][] = [
      [
        'Shop item',
        loadUnderworldWorldShopTravelDealCheckpoint(),
        worldShop,
        'ReplaceShopPurchaseParticipation',
      ],
      [
        'Shrine buy',
        loadSurfaceNOHermesShrineDeliveryCheckpoint(),
        oShrine,
        'PurchaseHermesShrineOffer',
      ],
      ['Well purchase', loadUnderworldFStygianWellCheckpoint(), fWell, 'SetStygianWellPurchase'],
      ['delivery', scheduled, pCombat, 'PlaceHermesShrineDelivery'],
      ['clocked drop', scheduled, pCombat, 'PlaceClockedTraitPickup'],
      [
        'Echo gold',
        withoutEchoGold(
          echoGold,
          echoShop,
          roomOrder(echoGold, echoShop).filter(
            (reference) =>
              !(
                reference.kind === 'interactAcquisitionEntry' &&
                reference.entryKey === 'echoDoubleShopReward'
              ),
          ),
        ),
        echoShop,
        'PlaceEchoGoldPickup',
      ],
    ];
    const beforeSpawn: string[] = [];
    for (const [name, project, address, kind] of cases) {
      const counts = { sound: 0, complete: 0, families: new Set<string>(), beforeSpawn };
      expect(auditRoom(name, project, address, counts, kind), name).toEqual([]);
      expect([...counts.families], name).toContain(kind);
    }
    // Gold Gold Gold's duplicate has no order dependency on the purchase that spawns it.
    expect(beforeSpawn).toEqual([
      'Echo gold @0 ["interactAcquisitionEntry","roomExit","echoDoubleShopReward"]',
    ]);
  });

  it('closes a required row’s window at its deadline, before the room’s last gap', () => {
    // Placed required rows whose window ends before the room's last gap: the walk takes the
    // row at its deadline and refuses it at the next distinct gap.
    const failures: string[] = [];
    let tried = 0;
    for (const { id, project, assembly, address, live } of sampleRooms) {
      const order = roomOrder(project, address);
      if (live.frontier < order.length) continue;
      const before = placementFindings(assembly, address);
      for (let own = 0; own < order.length && tried < 6; own += 1) {
        const key = roomActionKey(order[own]!);
        const item = live.gaps[own]!.items.find((candidate) =>
          candidate.actions.some(
            (action) => action.kind === 'placed' && roomActionKey(action.reference) === key,
          ),
        );
        const deadline =
          item?.kind === 'pickup'
            ? item.deadline
            : item?.actions.find((action) => roomActionKey(action.reference) === key)?.deadline;
        // The row's own gap and the one after it are the same position; the next gap is past it.
        if (deadline === undefined) continue;
        const past = deadline + (deadline === own ? 2 : 1);
        if (past > order.length) continue;
        tried += 1;
        const action = createRoomActionAddress(
          createBiomeAddress(address.routeKey, address.biomeKey),
          address.occurrenceId,
          key,
        );
        const moveTo = (gap: number): ProjectCommand => ({
          kind: 'MoveRoomAction',
          action,
          toIndex: gap > own ? gap - 1 : gap,
        });
        if (deadline !== own && !walkAccepts(project, before, address, [moveTo(deadline)], key))
          failures.push(`${id} ${address.occurrenceId} #${own} ${key}: refused at ${deadline}`);
        if (walkAccepts(project, before, address, [moveTo(past)], key))
          failures.push(`${id} ${address.occurrenceId} #${own} ${key}: taken past ${deadline}`);
      }
    }
    expect(failures).toEqual([]);
    expect(tried).toBe(6);
  });

  it('holds a required pickup at its spawn while it is unplaced, as today’s walk does', () => {
    // Take each placed required pickup of a sampled room back, alone: it stands offered at its
    // own gap unless today's walk stops, on its placement finding, at what spawns it.
    const held = new Set<string>();
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
        held.add(`${id} ${address.occurrenceId} #${index} ${row.reference.kind}`);
      }
    }
    expect(failures).toEqual([]);
    expect(tried).toBeGreaterThan(15);
    expect([...held].sort()).toEqual([...HELD_TODAY].sort());
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
