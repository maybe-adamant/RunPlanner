import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  roomActionKey,
  semanticAddressKey,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveActionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  spawnedLootForProjectEvaluationAssembly,
  type LiveAction,
  type LiveItem,
  type ProjectEvaluationAssembly,
  type RoomLiveActions,
} from '@run-planner/engine/simulation';
import {
  candidateBiome,
  candidateBiomeRooms,
} from '../../src/simulation/candidates/evaluated-biome';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadSurfaceScheduledLifecycleCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { purchaseTestHermesShrineOffer } from '@run-planner/test-fixtures/shared';
import { oBiome } from '@run-planner/test-fixtures/surface';

const oPostboss = createOccurrenceAddress(oBiome, createOccurrenceId('surface-o-preboss:postboss'));

const goldenCheckpoints = checkpointRegistry.filter(
  ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
);

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

function itemActions(item: LiveItem): readonly LiveAction[] {
  return item.actions;
}

function placedAt(live: RoomLiveActions, index: number, key: string) {
  return live.gaps[index]?.items.find((item) =>
    itemActions(item).some(
      (action) => action.kind === 'placed' && roomActionKey(action.reference) === key,
    ),
  );
}

describe('live actions at a gap', () => {
  const evaluated = goldenCheckpoints.map(({ entry, load }) => {
    const project = load();
    return { id: entry.id, project, assembly: simulateProjectAssembly(catalog, project) };
  });

  it('stands every reached row live at its own gap, spawned there and inside its deadline', () => {
    const failures: string[] = [];
    let rows = 0;
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const order = roomOrder(project, address);
        const stale = staleKeys(assembly, address);
        for (let index = 0; index <= live.frontier && index < order.length; index += 1) {
          const key = roomActionKey(order[index]!);
          const item = placedAt(live, index, key);
          // A stale row is never executed.
          if (stale.has(key)) continue;
          rows += 1;
          if (item === undefined) {
            failures.push(`${id} ${address.occurrenceId} #${index} ${key}: not live`);
            continue;
          }
          if (item.kind === 'pickup' && item.spawn.gap > index)
            failures.push(`${id} ${address.occurrenceId} #${index} ${key}: before its spawn`);
          const deadline =
            item.kind === 'pickup'
              ? item.deadline
              : item.actions.find((action) => roomActionKey(action.reference) === key)?.deadline;
          const participation =
            item.kind === 'pickup'
              ? item.participation
              : item.actions.find((action) => roomActionKey(action.reference) === key)
                  ?.participation;
          if (participation === 'required' && (deadline === undefined || deadline < index))
            failures.push(`${id} ${address.occurrenceId} #${index} ${key}: past its deadline`);
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

  it('never lists a pickup before it spawns or after it is collected', () => {
    for (const { project, assembly } of evaluated)
      for (const { live } of reachedRooms(project, assembly))
        for (const gap of live.gaps)
          for (const item of gap.items) {
            if (item.kind !== 'pickup') {
              expect(item.actions.length).toBeGreaterThan(0);
              continue;
            }
            expect(item.spawn.gap).toBeLessThanOrEqual(gap.index);
          }
  });

  // One room of each action shape across the golden plans.
  const sampleRooms = (() => {
    const seen = new Set<string>();
    const rooms: {
      id: string;
      project: ProjectDocument;
      address: OccurrenceAddress;
      stale: ReadonlySet<string>;
    }[] = [];
    for (const { id, project, assembly } of evaluated)
      for (const { address, live } of reachedRooms(project, assembly)) {
        const order = roomOrder(project, address);
        if (live.frontier !== order.length || order.length === 0) continue;
        const shape = order.map((reference) => reference.kind).join(',');
        if (seen.has(shape)) continue;
        seen.add(shape);
        rooms.push({ id, project, address, stale: staleKeys(assembly, address) });
      }
    return rooms;
  })();

  it('offers each sampled row at its gap once the room is reset to just before it', () => {
    const failures: string[] = [];
    let rows = 0;
    const held: string[] = [];
    for (const { id, project, address, stale } of sampleRooms) {
      const original = roomOrder(project, address);
      for (let index = 0; index < original.length; index += 1) {
        const key = roomActionKey(original[index]!);
        if (stale.has(key)) continue;
        const kept = applyProjectCommand(project, catalog, {
          kind: 'ResetRoomActionsAfter',
          occurrence: address,
          afterActionKey: index === 0 ? null : roomActionKey(original[index - 1]!),
        });
        // The reset keeps active required rows and the Postboss rack; take a required row back too.
        const keptOrder = roomOrder(kept, address);
        const required =
          keptOrder[index] !== undefined &&
          roomActionKey(keptOrder[index]!) === key &&
          original[index]!.kind !== 'interactKeepsakeRack';
        const reset = required ? withRoomOrder(kept, address, keptOrder.toSpliced(index, 1)) : kept;
        if (roomOrder(reset, address).some((reference) => roomActionKey(reference) === key))
          continue;
        rows += 1;
        const assembly = simulateProjectAssembly(catalog, reset);
        const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, address);
        // A missing required action stops today's walk at its spawn, which may lie before its gap.
        const gapIndex = required ? Math.min(index, live?.frontier ?? -1) : index;
        const gap = live?.gaps[gapIndex];
        const places =
          gap !== undefined &&
          gap.items.flatMap(itemActions).some((action) => {
            if (action.kind !== 'place' || roomActionKey(action.reference) !== key) return false;
            if (action.needsChoice === 'travelDealItem') return false;
            const placed = roomOrder(applyProjectCommand(reset, catalog, action.command), address);
            return placed[gapIndex] !== undefined && roomActionKey(placed[gapIndex]!) === key;
          });
        if (places) continue;
        // Until a missing required pickup no longer holds the event that spawns it, the walk
        // stops there on its placement finding, before the gap the pickup could take.
        if (
          required &&
          assembly.evaluation.findings.some((finding) => PLACEMENT_REQUIRED.has(finding.code))
        ) {
          held.push(`${id} ${address.occurrenceId} ${original[index]!.kind}`);
          continue;
        }
        failures.push(`${id} ${address.occurrenceId} #${index} ${key}: not offered at ${gapIndex}`);
      }
    }
    expect(failures).toEqual([]);
    expect(sampleRooms.length).toBeGreaterThan(20);
    expect(rows).toBeGreaterThan(90);
    // Today a missing required pickup holds the event or source that spawns it: an Artificer
    // replacement its converted pickup, a deferred Ship wheel's reward its encounter end, and
    // a Nemesis trade result, a delivery or a cage reward their spawn.
    expect(held).toEqual([
      'underworld-f-trait-order-checks e9c1775e-a04b-4ed2-b749-7ef344614cbe interactAcquisitionEntry',
      'underworld-f-trait-order-checks f4adb787-5267-4ce6-8712-e53744e505ff interactAcquisitionEntry',
      'surface-encounter-showcase surface-o-combat04 interactWheelReward',
      'surface-shrine-travel-deal surface-o-combat04 interactWheelReward',
      'surface-shrine-travel-deal surface-o-combat04 interactAcquisitionEntry',
      'surface-scheduled-lifecycle surface-o-combat01 interactWheelReward',
      'surface-no-hermes-shrine-delivery surface-o-combat07 interactWheelReward',
      'surface-p-steady-growth-shrine-frontier f5cd94da-1e74-40a0-8161-fc0c58c3f384 interactWheelReward',
      'surface-p-steady-growth-shrine-frontier f5cd94da-1e74-40a0-8161-fc0c58c3f384 chooseRewardWheel',
      'surface-p-steady-growth-shrine-frontier f5cd94da-1e74-40a0-8161-fc0c58c3f384 interactWheelReward',
      'nemesis-f-trait-trade golden-f-b5-e1 interactAcquisitionEntry',
      'nemesis-h-fields golden-h-combat05 interactLocalReward',
    ]);
  });

  it('offers at the frontier only actions the walk then reaches', () => {
    const failures: string[] = [];
    let tried = 0;
    // The sampled complete rooms, and every room a golden plan stops in.
    const stoppedRooms = evaluated.flatMap(({ id, project, assembly }) =>
      reachedRooms(project, assembly).flatMap(({ address, live }) =>
        live.frontier < roomOrder(project, address).length ? [{ id, project, address }] : [],
      ),
    );
    expect(stoppedRooms.length).toBeGreaterThan(3);
    for (const { id, project, address } of [...sampleRooms, ...stoppedRooms]) {
      const live = liveActionsForProjectEvaluationAssembly(
        catalog,
        simulateProjectAssembly(catalog, project),
        address,
      )!;
      const frontier = live.gaps[live.frontier]!;
      for (const action of frontier.items.flatMap(itemActions)) {
        if (action.kind === 'placed' || ('needsChoice' in action && action.needsChoice)) continue;
        tried += 1;
        const after = applyProjectCommand(project, catalog, action.command);
        const reached = liveActionsForProjectEvaluationAssembly(
          catalog,
          simulateProjectAssembly(catalog, after),
          address,
        );
        const key = roomActionKey(action.reference);
        const index = roomOrder(after, address).findIndex(
          (reference) => roomActionKey(reference) === key,
        );
        if (reached === undefined || reached.frontier < index)
          failures.push(`${id} ${address.occurrenceId}: ${key} not reached`);
      }
    }
    expect(failures).toEqual([]);
    expect(tried).toBeGreaterThan(40);
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
    expect(live.frontier).toBe(0);
    const frontier = live.gaps[live.frontier]!;
    const unplaced = frontier.items.filter(
      (item) =>
        item.kind === 'pickup' &&
        item.actions.some(
          (action) =>
            action.kind === 'place' &&
            (action.command.kind === 'PlaceHermesShrineDelivery' ||
              action.command.kind === 'PlaceClockedTraitPickup'),
        ),
    );
    expect(
      unplaced.map((item) =>
        item.kind === 'pickup'
          ? [
              item.source.kind === 'generated' ? item.source.family.kind : item.source.kind,
              item.participation,
              item.deadline,
              item.actions.map((action) => (action.kind === 'place' ? action.needsChoice : '')),
            ]
          : [],
      ),
    ).toEqual([
      // The walk holds at the encounter end the delivery is due at; it may go anywhere after.
      ['hermesShrineDelivery', 'required', 3, [undefined]],
      ['trait', 'optional', undefined, ['levelResolution']],
    ]);
    const delivery = unplaced[0]!.actions[0]!;
    if (delivery.kind !== 'place') throw new Error('the delivery is not placeable');
    expect(delivery.command).toMatchObject({ index: live.frontier });
    const placed = roomOrder(applyProjectCommand(project, catalog, delivery.command), room);
    expect(roomActionKey(placed[live.frontier]!)).toBe(roomActionKey(delivery.reference));
  });
});

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

const PLACEMENT_REQUIRED: ReadonlySet<string> = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

/** Rows the roster keeps but never executes: their action is no longer active. */
function staleKeys(
  assembly: ProjectEvaluationAssembly,
  address: OccurrenceAddress,
): ReadonlySet<string> {
  const biome = candidateBiome(assembly.evaluation, address.routeKey, address.biomeKey);
  const room =
    biome === undefined
      ? undefined
      : candidateBiomeRooms(biome).find(
          (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(address),
        );
  return new Set(room?.roomActionRoster.rows.flatMap((row) => (row.stale ? [row.key] : [])));
}
