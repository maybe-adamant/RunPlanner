import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  applyProjectHistoryCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectHistory,
  decodeProjectDocument,
  roomActionKey,
  undoProjectHistory,
  type OccurrenceAddress,
  type ProjectDocument,
  type RoomActionReference,
} from '@run-planner/engine/authored-project';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  createGoldenFGHProject,
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOProject,
  oBiome,
  oOccurrenceIds,
  surfaceShrineDeliveriesProject,
} from '@run-planner/test-fixtures/surface';

const fPostboss = createOccurrenceAddress(
  goldenFBiome,
  createOccurrenceId('golden-f-preboss-shop:postboss'),
);
const fields = createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02'));
const invented: RoomActionReference = { kind: 'interactEncounter', phaseKey: 'invented' };

function order(project: ProjectDocument, room: OccurrenceAddress): readonly string[] {
  const occurrence = project.route.biomes
    .find((plan) => plan.biomeKey === room.biomeKey)
    ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === room.occurrenceId);
  if (occurrence === undefined) throw new Error(`${room.occurrenceId} is missing`);
  return occurrence.roomActions.order.map(roomActionKey);
}

const reset = (occurrence: OccurrenceAddress, after: RoomActionReference | null) =>
  ({
    kind: 'ResetRoomActionsAfter',
    occurrence,
    afterActionKey: after === null ? null : roomActionKey(after),
  }) as const;

/** The room's order with `extra` appended, as a loaded document retains it. */
function withAppended(
  project: ProjectDocument,
  room: OccurrenceAddress,
  extra: readonly RoomActionReference[],
): ProjectDocument {
  return decodeProjectDocument(
    {
      ...project,
      route: {
        ...project.route,
        biomes: project.route.biomes.map((plan) =>
          plan.biomeKey !== room.biomeKey || plan.topology === null
            ? plan
            : {
                ...plan,
                topology: {
                  ...plan.topology,
                  occurrences: plan.topology.occurrences.map((candidate) =>
                    candidate.occurrenceId !== room.occurrenceId
                      ? candidate
                      : {
                          ...candidate,
                          roomActions: { order: [...candidate.roomActions.order, ...extra] },
                        },
                  ),
                },
              },
        ),
      },
    },
    catalog,
  );
}

describe('ResetRoomActionsAfter', () => {
  const fountain: RoomActionReference = { kind: 'useFountain' };
  const rack: RoomActionReference = { kind: 'interactKeepsakeRack' };

  it('removes every later row through its own removal; the rack and required rows stay', () => {
    const project = createUnderworldFWellCheckpoint();
    expect(order(project, fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondLeft' }),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'initial:secondRight' }),
      roomActionKey({ kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' }),
    ]);
    const after = applyProjectCommand(project, catalog, reset(fPostboss, fountain));
    // The Well purchases leave as un-purchases; the permanent rack keeps its place.
    expect(order(after, fPostboss)).toEqual([roomActionKey(fountain), roomActionKey(rack)]);
    // From the room's entry the required fountain stays too.
    expect(order(applyProjectCommand(project, catalog, reset(fPostboss, null)), fPostboss)).toEqual(
      [roomActionKey(fountain), roomActionKey(rack)],
    );
  });

  it('is one Undo step', () => {
    const initial = createProjectHistory(createUnderworldFWellCheckpoint());
    const edited = applyProjectHistoryCommand(initial, catalog, reset(fPostboss, fountain));
    expect(edited.past).toHaveLength(initial.past.length + 1);
    expect(undoProjectHistory(edited).present).toBe(initial.present);
  });

  it('leaves the document unchanged when nothing it can remove follows', () => {
    const project = createUnderworldFWellCheckpoint();
    const last = { kind: 'purchaseStygianWellOffer', generationKey: 'travelDealRefill' } as const;
    expect(applyProjectCommand(project, catalog, reset(fPostboss, last))).toBe(project);
    // Every row of a Fields room is a required cage contact: nothing leaves.
    const authored = createGoldenFGHProject();
    expect(applyProjectCommand(authored, catalog, reset(fields, null))).toBe(authored);
  });

  it('refuses an anchor that is not an ordered action of the room', () => {
    const project = createUnderworldFWellCheckpoint();
    expect(() => applyProjectCommand(project, catalog, reset(fPostboss, invented))).toThrow(
      'afterActionKey is not an ordered room action',
    );
  });

  it('removes optional and stale rows after the point', () => {
    const optional: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'optionalRewards',
      slotKey: 'optional1',
    };
    const authored = createGoldenFGHProject();
    const original = order(authored, fields);
    const retained = withAppended(authored, fields, [optional, invented]);
    const cage1: RoomActionReference = {
      kind: 'interactLocalReward',
      groupKey: 'cages',
      slotKey: 'cage1',
    };
    expect(order(applyProjectCommand(retained, catalog, reset(fields, cage1)), fields)).toEqual(
      original,
    );
  });

  it('removes rows in later Ship phases after a point inside an earlier one', () => {
    const combat07 = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const authored = applyProjectCommand(loadSurfaceNOProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence: combat07,
      encounterCount: 3,
    });
    const original = order(authored, combat07);
    const wheel1: RoomActionReference = { kind: 'interactWheelReward', wheelKey: 'wheel1' };
    // Phase 2's wheel rows are required and stay; the stale row after them goes.
    expect(original.indexOf(roomActionKey(wheel1))).toBeLessThan(original.length - 1);
    const retained = withAppended(authored, combat07, [invented]);
    expect(
      order(applyProjectCommand(retained, catalog, reset(combat07, wheel1)), combat07),
    ).toEqual(original);
  });

  it('keeps required automatic placements through settlement: a due delivery stays', () => {
    const combat04 = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = surfaceShrineDeliveriesProject();
    // Wheel choice, its pickup and the due delivery are all automatic required placements.
    expect(applyProjectCommand(project, catalog, reset(combat04, null))).toBe(project);
    const evaluate = (document: ProjectDocument) => simulateProjectAssembly(catalog, document);
    const settled = settleProjectEdit({
      catalog,
      before: evaluate(createUnderworldFWellCheckpoint()),
      command: reset(fPostboss, null),
      evaluate,
    });
    expect(settled.fault).toBeUndefined();
    expect(order(settled.assembly.project, fPostboss)).toEqual([
      roomActionKey(fountain),
      roomActionKey(rack),
    ]);
  });
});
