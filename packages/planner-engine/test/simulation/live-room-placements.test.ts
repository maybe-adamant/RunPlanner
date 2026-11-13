import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
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
import {
  loadSurfaceNOProject,
  oBiome,
  oOccurrenceIds,
  placeDueHermesShrineDeliveries,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
} from '@run-planner/test-fixtures/surface';
import {
  liveRoomForProjectEvaluationAssembly,
  type LiveRoom,
  type LiveVerb,
} from '../../src/simulation/evaluation/live-room';
import {
  canonicalRoom,
  goldenCheckpoints,
  placementFindings,
  reachedRooms,
  roomOrder,
  throughBiome,
  verbStep,
  walkAccepts,
  withRoomOrder,
} from '../support/live-room';

const oPostboss = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));
const oShrine = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-combat07'));
const pCombat = createOccurrenceAddress(
  createBiomeAddress('Surface', 'P'),
  createOccurrenceId('surface-p-1-1-p_combat03'),
);
const fBiome = createBiomeAddress('Underworld', 'F');
const worldShop = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop'));
const fWell = createOccurrenceAddress(fBiome, createOccurrenceId('golden-f-preboss-shop:postboss'));

/** Purchases, the Pedestal and the rack enter the order only through their feature's command. */
const FEATURE_OWNED: ReadonlySet<string> = new Set([
  'interactShopOffer',
  'interactInfernalContractPedestal',
  'purchaseHermesShrineOffer',
  'purchaseStygianWellOffer',
  'interactKeepsakeRack',
]);

function verbsAt(live: LiveRoom, gap: number): readonly LiveVerb[] {
  return live.gaps[gap]?.items.flatMap((item) => item.verbs) ?? [];
}

/** The live product as Draft and Collect all required read it: each step's one verb. */
function placementsOf(
  assembly: ProjectEvaluationAssembly,
  address: OccurrenceAddress,
): LiveRoom | undefined {
  return liveRoomForProjectEvaluationAssembly(catalog, assembly, address, 'placements');
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

const POSITIONED: ReadonlySet<string> = new Set([
  'ReplaceShopPurchaseParticipation',
  'PurchaseShopTravelDealRefill',
  'SetStygianWellPurchase',
  'PurchaseHermesShrineOffer',
  'SetHermesShrineRush',
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
 * One room's live placements against the walk: every offered placement or move
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
  const live = placementsOf(assembly, address)!;
  const room = canonicalRoom(assembly, address)!;
  const before = placementFindings(assembly, address);
  const biome = createBiomeAddress(address.routeKey, address.biomeKey);
  const actionOf = (key: string) => createRoomActionAddress(biome, address.occurrenceId, key);
  const offeredGaps = new Map<string, Set<number>>();
  const positioned = new Map<string, ProjectCommand>();
  for (const gap of live.gaps)
    for (const verb of gap.items.flatMap((item) => item.verbs)) {
      // A standing row, or a Travel Deal item whose picker supplies the command.
      const offered = verb.standing === true ? undefined : verb.commands?.[0];
      if (offered === undefined) continue;
      if (only !== undefined && offered.kind !== only) continue;
      const key = roomActionKey(verb.reference!);
      offeredGaps.set(key, (offeredGaps.get(key) ?? new Set()).add(gap.index));
      if (POSITIONED.has(offered.kind)) {
        const { index: _index, ...command } = offered as ProjectCommand & { index?: number };
        void _index;
        positioned.set(key, command as ProjectCommand);
        counts.families?.add(offered.kind);
      }
      counts.sound += 1;
      if (!walkAccepts(project, before, address, [offered], key))
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
    // A pickup is live only once spawned; the walk taking it earlier is a leniency to report.
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

describe('live placements at a gap', () => {
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
            !verbsAt(live, index).some(
              (verb) => verb.standing === true && roomActionKey(verb.reference!) === key,
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
      readonly live: LiveRoom;
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
    // Gold Gold Gold's duplicate follows the purchase that spawns it; the walk refuses it earlier.
    expect(beforeSpawn).toEqual([]);
  });

  it('offers a bought Shrine item’s rush at every gap after its purchase', () => {
    // [wheel choice, wheel pickup, buy first, rush first, buy second left, first's pickup]
    const loaded = loadSurfaceNOHermesShrineDeliveryCheckpoint();
    const project = applyProjectCommand(loaded, catalog, {
      kind: 'PurchaseHermesShrineOffer',
      occurrence: oShrine,
      generationKey: 'initial:secondRight',
    });
    const live = placementsOf(simulateProjectAssembly(catalog, project), oShrine)!;
    const rushKey = roomActionKey({
      kind: 'rushHermesShrineOffer',
      generationKey: 'initial:secondLeft',
    });
    const purchaseIndex = roomOrder(project, oShrine).findIndex(
      (reference) =>
        reference.kind === 'purchaseHermesShrineOffer' &&
        reference.generationKey === 'initial:secondLeft',
    );
    const gaps = live.gaps.flatMap((gap) =>
      gap.items.some(
        (item) =>
          item.kind === 'object' &&
          item.verbs.some((verb) => roomActionKey(verb.reference!) === rushKey),
      )
        ? [gap.index]
        : [],
    );
    // Bought before the second right item, its rush may stand at any later gap of the room.
    const length = roomOrder(project, oShrine).length;
    expect(purchaseIndex).toBeLessThan(length - 1);
    expect(gaps).toEqual(
      Array.from({ length: length - purchaseIndex }, (_, offset) => purchaseIndex + 1 + offset),
    );
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
          candidate.verbs.some(
            (verb) => verb.standing === true && roomActionKey(verb.reference!) === key,
          ),
        );
        const deadline =
          item?.kind === 'pickup'
            ? item.deadline
            : item?.verbs.find((verb) => roomActionKey(verb.reference!) === key)?.deadline;
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

  it('offers a required pickup taken back at its own gap: the walk passes what spawns it', () => {
    // Take each placed required pickup of a sampled room back, alone: the walk passes the event
    // or action that spawns it and stops at its deadline on its placement finding, with the
    // pickup offered at its own gap.
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
              other.dependencies.some((dependency) => roomActionKey(dependency.action) === row.key),
          )
        )
          continue;
        tried += 1;
        const index = row.rank - 1;
        const without = withRoomOrder(project, address, order.toSpliced(index, 1));
        const after = simulateProjectAssembly(catalog, without);
        const reached = placementsOf(after, address)!;
        const offered =
          reached.frontier >= index &&
          verbsAt(reached, index).some(
            (verb) =>
              verbStep(verb) === 'place' &&
              roomActionKey(verb.reference!) === row.key &&
              roomActionKey(
                roomOrder(applyProjectCommand(without, catalog, verb.commands![0]!), address)[
                  index
                ]!,
              ) === row.key,
          );
        if (!offered || placementFindings(after, address).size === 0)
          failures.push(`${id} ${address.occurrenceId} #${index} ${row.key}`);
      }
    }
    expect(failures).toEqual([]);
    expect(tried).toBeGreaterThan(15);
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
    const live = placementsOf(simulateProjectAssembly(catalog, project), room)!;
    // The walk passes the encounter end the delivery spawns at and stops before Doors open.
    expect(live.frontier).toBe(2);
    const unplaced = live.gaps[2]!.items.flatMap((item) =>
      item.kind === 'pickup' &&
      item.verbs.some(
        (verb) =>
          verb.commands?.[0]?.kind === 'PlaceHermesShrineDelivery' ||
          verb.commands?.[0]?.kind === 'PlaceClockedTraitPickup',
      )
        ? [item]
        : [],
    );
    expect(
      unplaced.map((item) => [
        item.source.kind === 'generated' ? item.source.family.kind : item.source.kind,
        item.participation,
        item.deadline,
        item.verbs.map((verb) => verb.choice?.picker),
      ]),
    ).toEqual([
      // It may go anywhere after the encounter end, the room's last gap included.
      ['hermesShrineDelivery', 'required', 3, [undefined]],
      ['trait', 'optional', undefined, ['levelResolution']],
    ]);
    const delivery = unplaced[0]!.verbs[0]!;
    expect(delivery.commands).toMatchObject([{ index: 2 }]);
    const placed = roomOrder(applyProjectCommand(project, catalog, delivery.commands![0]!), room);
    expect(roomActionKey(placed[2]!)).toBe(roomActionKey(delivery.reference!));
  });

  it('lets a Ship delivery left unplaced lie from Wheels open until the next wheel choice', () => {
    // A Shrine item bought in O matures at combat02's Intro end; wheel 1 rolls before it is due.
    const { oShrine: shrine } = surfaceShrineDeliverySources;
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat02);
    let placed = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: shrine,
      slotKey: 'secondLeft',
      value: { rewardType: 'ShopHermesUpgrade' },
    });
    placed = placeDueHermesShrineDeliveries(
      purchaseTestHermesShrineOffer(placed, catalog, shrine, 'initial:secondLeft', {
        delay: 4,
        rushed: false,
      }),
    );
    const order = roomOrder(placed, ship);
    const deliveryIndex = order.findIndex(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    );
    const chooseIndex = order.findIndex(
      (reference) => reference.kind === 'chooseRewardWheel' && reference.wheelKey === 'wheel1',
    );
    expect(deliveryIndex).toBeGreaterThanOrEqual(0);
    expect(chooseIndex).toBe(deliveryIndex + 1);
    const deliveryKey = roomActionKey(order[deliveryIndex]!);
    const project = withRoomOrder(placed, ship, order.toSpliced(deliveryIndex, 1));
    const assembly = simulateProjectAssembly(catalog, project);
    const biome = assembly.evaluation.route.biomes.find((candidate) => candidate.biomeKey === 'O')!;
    const events = ('history' in biome ? biome.history.events : []).flatMap((event) =>
      'origin' in event && semanticAddressKey(event.origin) === semanticAddressKey(ship)
        ? [
            event.kind === 'offerPointMaterialized'
              ? `open ${event.offerPoint}`
              : event.kind === 'encounterEndEffectsApplied'
                ? `end ${event.phaseKey}`
                : event.kind === 'encounterStarted'
                  ? `start ${event.phaseKey}`
                  : event.kind === 'acquisitionPointReached'
                    ? `reach ${event.point}`
                    : event.kind,
          ]
        : [],
    );
    // The walk passes the Intro's end, rolls wheel 1 and stops before its choice.
    expect(events.slice(-3)).toEqual(['encounterCompleted', 'end Intro', 'open wheel1']);
    expect([...placementFindings(assembly, ship)]).toEqual([
      expect.stringMatching(/^hermesShrineDeliveryPlacementRequired /),
    ]);
    const room = canonicalRoom(assembly, ship)!;
    const stop = biome.coverage.kind === 'prefix' ? biome.coverage.roomStop : undefined;
    expect(stop).toMatchObject({ kind: 'timeline', at: 'before' });
    const entries = room.roomLifecycleTimeline.entries;
    const stopIndex = biome.roomStopEntryIndex!;
    const stopEntry = entries[stopIndex]!;
    const previous = entries[stopIndex - 1]!;
    // Wheel 1's encounter begins as its wheels open.
    expect(previous.kind === 'boundary' && previous.boundary.key).toBe('encounterBegun:Combat1');
    expect(
      entries[stopIndex - 2]?.kind === 'boundary' &&
        (entries[stopIndex - 2] as { boundary: { key: string } }).boundary.key,
    ).toBe('wheelsOpen:wheel1');
    expect(stopEntry.kind === 'action' && stopEntry.action.reference.kind).toBe(
      'chooseRewardWheel',
    );

    // The pickup spawns at Wheels open and is due at the choice, its only gap.
    const live = placementsOf(assembly, ship)!;
    expect(live.frontier).toBe(0);
    // The walk stands at the unplaced delivery, which the live row answers.
    expect(live.blocked).toEqual({ kind: 'placement' });
    expect(stop).toMatchObject({ placement: true });
    const pickup = live.gaps[0]!.items.find(
      (item) => item.kind === 'pickup' && roomActionKey(item.reference) === deliveryKey,
    );
    expect(pickup).toMatchObject({
      spawn: { gap: 0, moment: 'wheelsOpen:Intro' },
      deadline: 0,
    });
    const [place] = pickup!.verbs[0]!.commands!;
    expect(place).toMatchObject({ kind: 'PlaceHermesShrineDelivery', index: 0 });
    const repaired = applyProjectCommand(project, catalog, place!);
    expect(roomOrder(repaired, ship).map(roomActionKey)).toEqual(order.map(roomActionKey));
  });

  it('offers a later Ship wheel only once the earlier wheel’s choice opens its phase', () => {
    const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const three = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: ship,
      encounterCount: 3,
    });
    const choose = (wheelKey: string): RoomActionReference => ({
      kind: 'chooseRewardWheel',
      wheelKey,
    });
    const chooseKeysAt = (project: ProjectDocument, gap: number) =>
      verbsAt(placementsOf(simulateProjectAssembly(catalog, project), ship)!, gap).flatMap(
        (verb) =>
          verb.reference?.kind === 'chooseRewardWheel' ? [roomActionKey(verb.reference)] : [],
      );

    const empty = withRoomOrder(three, ship, []);
    expect(placementsOf(simulateProjectAssembly(catalog, empty), ship)!.frontier).toBe(0);
    expect(chooseKeysAt(empty, 0)).toEqual([roomActionKey(choose('wheel1'))]);

    // With wheel 1 chosen, wheel 2 is offered after it, never before it.
    const first = withRoomOrder(three, ship, [choose('wheel1')]);
    expect(chooseKeysAt(first, 0)).not.toContain(roomActionKey(choose('wheel2')));
  });
});
