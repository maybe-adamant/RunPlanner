import { describe, expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  createRewardWheelAddress,
  createRewardWheelOfferAddress,
  publishProjectHistoryEdit,
  redoProjectHistory,
  roomActionKey,
  semanticAddressKey,
  undoProjectHistory,
  type OccurrenceAddress,
  type ProjectCommand,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import {
  liveActionsForProjectEvaluationAssembly,
  simulateProjectAssembly,
  type ProjectEvaluationAssembly,
  type RoomLiveActions,
} from '@run-planner/engine/simulation';
import { checkpointRegistry } from '@run-planner/test-fixtures/checkpoints/registry';
import { loadUnderworldGeneratedCompositionCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import {
  authorLegalTraitOffers,
  purchaseTestHermesShrineOffer,
} from '@run-planner/test-fixtures/shared';
import {
  oBiome,
  oOccurrenceIds,
  placeDueHermesShrineDeliveries,
  surfaceShrineDeliveriesProject,
  surfaceShrineDeliverySources,
} from '@run-planner/test-fixtures/surface';
import { collectRequiredItems, nextRequiredPlacement } from '../../src/simulation/collect-required';
import { collectTestRequiredItems } from '../support/collect-required';

/**
 * The golden witness's tally. A room is set-restored when its rows come back
 * as a set, in whatever order collection places them.
 */
const PINNED_COUNTS = { rooms: 107, setRestored: 107 };

/**
 * Rows edit settlement still writes on its own as a collected row activates
 * them, by room, each named by its key's last part; they go with C2's removal
 * of automatic placement.
 */
const PINNED_SETTLEMENT_EXTRAS = {
  'underworld-fg golden-g-b3-e1': ['pom'],
  'underworld-f-trait-order-checks 38689388-fd7d-4262-bc0c-c0951542cc3e': [
    'smallGold',
    'tinyGold1',
    'tinyGold2',
    'minorHeal1',
    'minorHeal2',
    'bones',
  ],
};

const PLACEMENT_FINDINGS: ReadonlySet<string> = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);

function roomOrder(project: ProjectDocument, room: OccurrenceAddress) {
  return (
    project.route.biomes
      .find((biome) => biome.biomeKey === room.biomeKey)
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === room.occurrenceId)
      ?.roomActions.order ?? []
  );
}

/** The project with a biome's room orders replaced, as a hand-edited save could leave them. */
function withOrders(
  project: ProjectDocument,
  biomeKey: string,
  order: (occurrenceId: string, current: readonly RoomActionReference[]) => RoomActionReference[],
): ProjectDocument {
  return {
    ...project,
    route: {
      ...project.route,
      biomes: project.route.biomes.map((biome) =>
        biome.biomeKey !== biomeKey || biome.topology === null
          ? biome
          : {
              ...biome,
              topology: {
                ...biome.topology,
                occurrences: biome.topology.occurrences.map((occurrence) => ({
                  ...occurrence,
                  roomActions: {
                    order: order(occurrence.occurrenceId, occurrence.roomActions.order),
                  },
                })),
              },
            },
      ),
    },
  };
}

function withoutRows(
  project: ProjectDocument,
  room: OccurrenceAddress,
  drop: (reference: RoomActionReference) => boolean,
): ProjectDocument {
  return withOrders(project, room.biomeKey, (occurrenceId, current) =>
    occurrenceId === room.occurrenceId
      ? current.filter((reference) => !drop(reference))
      : [...current],
  );
}

/** The keys of the rows the walk reached in the room, read from the live product. */
function rowsOf(
  assembly: ProjectEvaluationAssembly,
  room: OccurrenceAddress,
  requiredOnly = false,
): ReadonlySet<string> {
  const live = liveActionsForProjectEvaluationAssembly(catalog, assembly, room);
  const keys = new Set<string>();
  for (const gap of live?.gaps ?? [])
    for (const item of gap.items)
      for (const action of item.actions)
        if (
          action.kind === 'placed' &&
          (!requiredOnly ||
            (item.kind === 'pickup'
              ? item.participation === 'required'
              : 'participation' in action && action.participation === 'required'))
        )
          keys.add(roomActionKey(action.reference));
  return keys;
}

const requiredRows = (assembly: ProjectEvaluationAssembly, room: OccurrenceAddress) =>
  rowsOf(assembly, room, true);

function issueKey(assembly: ProjectEvaluationAssembly) {
  const reason = assembly.evaluation.issue?.reasons[0];
  return reason === undefined ? 'none' : `${reason.code} ${semanticAddressKey(reason.origin)}`;
}

function isRoomPlacement(assembly: ProjectEvaluationAssembly, room: OccurrenceAddress): boolean {
  const reason = assembly.evaluation.issue?.reasons[0];
  return (
    reason !== undefined &&
    PLACEMENT_FINDINGS.has(reason.code) &&
    JSON.stringify(reason.origin).includes(JSON.stringify(room.occurrenceId))
  );
}

function commandKey(command: ProjectCommand): string {
  switch (command.kind) {
    case 'InsertRoomAction':
      return roomActionKey(command.reference);
    case 'PlaceHermesShrineDelivery':
      return roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: command.entry.site.pointKey,
        entryKey: command.entry.entryKey,
        ...(command.encounterPhaseKey === undefined
          ? {}
          : { encounterPhaseKey: command.encounterPhaseKey }),
      });
    case 'PlaceEchoGoldPickup':
      return roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: command.site.pointKey,
        entryKey: command.entryKey,
      });
    default:
      throw new Error(`unexpected placement ${command.kind}`);
  }
}

/** Each placement as its command kind, its row's key and its index, in the order collected. */
function placements(commands: readonly ProjectCommand[]): readonly string[] {
  return commands.map(
    (command) =>
      `${command.kind} ${commandKey(command)}@${'index' in command ? String(command.index) : '-'}`,
  );
}

/** A three-encounter Ship whose second wheel waits on a delivery Combat 1 matured. */
function wheel2DeliveryProject(): ProjectDocument {
  const { oShrine } = surfaceShrineDeliverySources;
  let project = applyProjectCommand(surfaceShrineDeliveriesProject(), catalog, {
    kind: 'ReplaceShipEncounterCount',
    occurrence: createOccurrenceAddress(oBiome, oOccurrenceIds.combat02),
    encounterCount: 3,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceHermesShrineOffer',
    occurrence: oShrine,
    slotKey: 'secondLeft',
    value: { rewardType: 'ShopHermesUpgrade' },
  });
  project = purchaseTestHermesShrineOffer(project, catalog, oShrine, 'initial:secondLeft', {
    delay: 5,
    rushed: false,
  });
  project = placeDueHermesShrineDeliveries(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceRewardWheelStore',
    wheel: createRewardWheelAddress(oBiome, oOccurrenceIds.combat02, 'wheel2'),
    storeKey: 'RunProgress',
  });
}

const ship = createOccurrenceAddress(oBiome, oOccurrenceIds.combat02);
const wheel2Offer = createRewardWheelOfferAddress(
  oBiome,
  oOccurrenceIds.combat02,
  'wheel2',
  'offer1',
);
const isRequiredShipRow = (reference: RoomActionReference) =>
  reference.kind === 'chooseRewardWheel' ||
  reference.kind === 'interactWheelReward' ||
  (reference.kind === 'interactAcquisitionEntry' && reference.siteKey === 'hermesShrineDelivery');

describe('Collect all required', () => {
  it('restores the stripped required rows of every golden room', () => {
    const golden = checkpointRegistry.filter(
      ({ entry }) => entry.route === 'Underworld' || entry.route === 'Surface',
    );
    const seen = new Set<string>();
    const failures: string[] = [];
    const counts = { rooms: 0, setRestored: 0 };
    const extras: Record<string, readonly string[]> = {};
    for (const { entry, load } of golden) {
      const project = load();
      const assembly = evaluate(project);
      for (const biome of project.route.biomes)
        for (const occurrence of biome.topology?.occurrences ?? []) {
          if (seen.has(occurrence.occurrenceId)) continue;
          const room = createOccurrenceAddress(
            createBiomeAddress(project.route.routeKey, biome.biomeKey),
            occurrence.occurrenceId,
          );
          const required = requiredRows(assembly, room);
          if (required.size === 0) continue;
          const stripped = evaluate(
            withoutRows(project, room, (reference) => required.has(roomActionKey(reference))),
          );
          // An earlier finding of the checkpoint stands before the room's placement.
          if (!isRoomPlacement(stripped, room)) continue;
          seen.add(occurrence.occurrenceId);
          counts.rooms += 1;
          const name = `${entry.id} ${occurrence.occurrenceId}`;
          const collected = collectRequiredItems({
            catalog,
            before: stripped,
            occurrence: room,
            evaluate,
          });
          if (collected.fault !== undefined) failures.push(`${name}: fault ${collected.fault.key}`);
          const unrequired = collected.commands.map(commandKey).filter((key) => !required.has(key));
          if (unrequired.length > 0) failures.push(`${name}: placed ${unrequired}`);
          // A stale row of the checkpoint goes with any edit of its room.
          const live = rowsOf(assembly, room);
          const before = new Set(
            roomOrder(project, room)
              .map(roomActionKey)
              .filter((key) => live.has(key)),
          );
          const after = new Set(roomOrder(collected.assembly.project, room).map(roomActionKey));
          const missing = [...before].filter((key) => !after.has(key));
          if (missing.length > 0) failures.push(`${name}: missing ${missing}`);
          // Edit settlement still activates rows of its own, never by this collection.
          const added = [...after].filter((key) => !before.has(key));
          if (added.length > 0)
            extras[name] = added.map((key) => String((JSON.parse(key) as unknown[]).at(-1)));
          if (issueKey(collected.assembly) !== issueKey(assembly))
            failures.push(`${name}: ${issueKey(collected.assembly)}`);
          else if (missing.length === 0) counts.setRestored += 1;
        }
    }
    expect(failures).toEqual([]);
    expect(counts).toEqual(PINNED_COUNTS);
    expect(extras).toEqual(PINNED_SETTLEMENT_EXTRAS);
  });

  it('collects a Ship room across Wheels open: wheel reward, then delivery, then choice', () => {
    const project = authorLegalTraitOffers(
      applyProjectCommand(wheel2DeliveryProject(), catalog, {
        kind: 'ReplaceRewardWheelOffer',
        offer: wheel2Offer,
        value: { rewardType: 'HermesUpgrade' },
      }),
    );
    const valid = evaluate(project);
    const order = roomOrder(project, ship).map(roomActionKey);
    const stripped = evaluate(withoutRows(project, ship, isRequiredShipRow));
    expect(isRoomPlacement(stripped, ship)).toBe(true);

    const collected = collectRequiredItems({
      catalog,
      before: stripped,
      occurrence: ship,
      evaluate,
    });

    expect(collected.stop).toBe('complete');
    expect(collected.fault).toBeUndefined();
    // Edit settlement still places the due delivery as the first wheel's reward is taken.
    expect(placements(collected.commands)).toEqual([
      'InsertRoomAction ["chooseRewardWheel","wheel1"]@0',
      'InsertRoomAction ["interactWheelReward","wheel1"]@1',
      'InsertRoomAction ["chooseRewardWheel","wheel2"]@3',
      'InsertRoomAction ["interactWheelReward","wheel2"]@4',
    ]);
    expect(roomOrder(collected.assembly.project, ship).map((reference) => reference.kind)).toEqual([
      'chooseRewardWheel',
      'interactWheelReward',
      'interactAcquisitionEntry',
      'chooseRewardWheel',
      'interactWheelReward',
    ]);
    expect(roomOrder(collected.assembly.project, ship).map(roomActionKey)).toEqual(order);
    expect(issueKey(collected.assembly)).toBe(issueKey(valid));
  });

  it('pins the default order collected in a stripped Fields room: clear then collect, cage by cage', () => {
    const project = loadUnderworldGeneratedCompositionCheckpoint();
    const room = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('golden-h-combat05'),
    );
    const required = requiredRows(evaluate(project), room);
    const stripped = evaluate(
      withoutRows(project, room, (reference) => required.has(roomActionKey(reference))),
    );

    const collected = collectRequiredItems({
      catalog,
      before: stripped,
      occurrence: room,
      evaluate,
    });

    expect(collected.stop).toBe('complete');
    expect(placements(collected.commands)).toEqual([
      'InsertRoomAction ["completeFieldsCage","Cage01"]@0',
      'InsertRoomAction ["interactLocalReward","cages","cage1"]@1',
      'InsertRoomAction ["completeFieldsCage","Cage02"]@2',
      'InsertRoomAction ["interactLocalReward","cages","cage2"]@3',
      'InsertRoomAction ["completeFieldsCage","Cage03"]@4',
      'InsertRoomAction ["interactLocalReward","cages","cage3"]@5',
    ]);
  });

  it('collects a pickup before acting on an object at the same index, whatever the item order', () => {
    const place = (reference: RoomActionReference) => ({
      kind: 'place' as const,
      reference,
      command: { kind: 'InsertRoomAction', reference, index: 2 } as unknown as ProjectCommand,
    });
    const choice = { kind: 'chooseRewardWheel', wheelKey: 'wheel2' } as const;
    const delivery = {
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey: 'delivery',
    } as const;
    const live = {
      owner: ship,
      frontier: 0,
      gaps: [
        {
          index: 0,
          entries: { from: 0, to: 0 },
          items: [
            {
              kind: 'object',
              object: 'rewardWheel',
              owner: ship,
              actions: [{ ...place(choice), participation: 'required' }],
            },
            {
              kind: 'pickup',
              participation: 'required',
              reference: delivery,
              actions: [place(delivery)],
            },
          ],
        },
      ],
    } as unknown as RoomLiveActions;
    expect(nextRequiredPlacement(live, new Set())?.reference).toEqual(delivery);
  });

  it('stops cleanly at a missing choice and returns what it placed', () => {
    // The second wheel's offer has no reward yet: its Wheels open blocks.
    const stripped = evaluate(
      withoutRows(authorLegalTraitOffers(wheel2DeliveryProject()), ship, isRequiredShipRow),
    );

    const collected = collectRequiredItems({
      catalog,
      before: stripped,
      occurrence: ship,
      evaluate,
    });

    expect(collected.stop).toBe('blocked');
    expect(collected.fault).toBeUndefined();
    expect(placements(collected.commands)).toEqual([
      'InsertRoomAction ["chooseRewardWheel","wheel1"]@0',
      'InsertRoomAction ["interactWheelReward","wheel1"]@1',
    ]);
    expect(isRoomPlacement(collected.assembly, ship)).toBe(false);
    expect(collected.assembly.evaluation.issue?.reasons[0]).toMatchObject({
      code: 'rewardMissing',
      origin: wheel2Offer,
    });
  });

  it('is one edit: a single Undo returns the stripped room', () => {
    const project = loadUnderworldGeneratedCompositionCheckpoint();
    const room = createOccurrenceAddress(
      createBiomeAddress('Underworld', 'H'),
      createOccurrenceId('golden-h-combat02'),
    );
    const strippedProject = withoutRows(project, room, () => true);
    const collected = collectRequiredItems({
      catalog,
      before: evaluate(strippedProject),
      occurrence: room,
      evaluate,
    });
    expect(collected.commands.length).toBeGreaterThan(1);

    const history = publishProjectHistoryEdit(
      createProjectHistory(strippedProject),
      collected.assembly.project,
    );
    const undone = undoProjectHistory(history);
    expect(undone.present).toBe(strippedProject);
    expect(redoProjectHistory(undone).present).toBe(collected.assembly.project);
  });

  it('restores a whole biome room by room through the test fixture', () => {
    const project = loadUnderworldGeneratedCompositionCheckpoint();
    const assembly = evaluate(project);
    const restored = collectTestRequiredItems(
      withOrders(project, 'H', (occurrenceId, current) => {
        const required = requiredRows(
          assembly,
          createOccurrenceAddress(
            createBiomeAddress('Underworld', 'H'),
            createOccurrenceId(occurrenceId),
          ),
        );
        return current.filter((reference) => !required.has(roomActionKey(reference)));
      }),
    );
    const plan = (document: ProjectDocument) =>
      document.route.biomes
        .find((biome) => biome.biomeKey === 'H')!
        .topology!.occurrences.map(
          (occurrence) =>
            `${occurrence.occurrenceId} ${occurrence.roomActions.order.map(roomActionKey).sort().join(',')}`,
        );
    expect(issueKey(evaluate(restored))).toBe(issueKey(evaluate(project)));
    expect(plan(restored)).toEqual(plan(project));
  });
});
