import { describe, expect, it } from 'vitest';

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
  semanticAddressKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  roomLayoutAuthoringForProjectEvaluationAssembly,
  settleProjectEdit,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { settleProjectFills } from '@run-planner/engine/project-migration';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { createGoldenFGHProject, goldenGBiome } from '@run-planner/test-fixtures/underworld';

import { positionFillOn, positionFills } from '../../../src/simulation/position-fill';

const evaluate = (project: ProjectDocument) => simulateProjectAssembly(catalog, project);
const rename: ProjectCommand = {
  kind: 'RenameProject',
  project: createProjectAddress(),
  name: 'Renamed',
};

/** Every room of the plan, addressed. */
function rooms(project: ProjectDocument) {
  return project.route.biomes.flatMap((plan) =>
    (plan.topology?.occurrences ?? []).map((occurrence) => ({
      occurrence,
      address: createOccurrenceAddress(
        createBiomeAddress(project.route.routeKey, plan.biomeKey),
        occurrence.occurrenceId,
      ),
    })),
  );
}

/** The plan with every stored room layout cleared, as a plan saved before positions were stored. */
function withoutLayouts(project: ProjectDocument): ProjectDocument {
  return rooms(project).reduce(
    (plan, { occurrence, address }) =>
      occurrence.layout === undefined
        ? plan
        : applyProjectCommand(plan, catalog, {
            kind: 'ReplaceRoomLayout',
            occurrence: address,
            layout: {},
          }),
    project,
  );
}

/** Each reached room's settled flip and entry, by room. */
function settledLayouts(project: ProjectDocument) {
  const assembly = evaluate(project);
  return Object.fromEntries(
    rooms(project).flatMap(({ address }) => {
      const settlement = roomLayoutAuthoringForProjectEvaluationAssembly(
        assembly,
        address,
      )?.settlement;
      return settlement === undefined
        ? []
        : [
            [
              semanticAddressKey(address),
              {
                flipped: settlement.flip.value,
                entry: settlement.entry.kind === 'unknown' ? null : settlement.entry.point,
              },
            ],
          ];
    }),
  );
}

const storedLayouts = (project: ProjectDocument) =>
  rooms(project).map(({ occurrence }) => occurrence.layout);

describe('positions filled on first reach', () => {
  const blank = withoutLayouts(loadUnderworldFGCheckpoint());

  it('stores the flip and entry the walk drew for each reached room, leaving the walk unchanged', () => {
    const before = evaluate(blank);
    const settled = settleProjectEdit({ catalog, before, command: rename, evaluate });
    expect(settled.fault).toBeUndefined();
    const project = settled.assembly.project;
    const stored = rooms(project).filter(({ occurrence }) => occurrence.layout !== undefined);
    expect(stored.length).toBeGreaterThan(0);
    // Each stored part is one the game rolls or picks among ties.
    for (const { address, occurrence } of stored) {
      const settlement = roomLayoutAuthoringForProjectEvaluationAssembly(
        settled.assembly,
        address,
      )!.settlement;
      if (occurrence.layout!.flipped !== undefined) expect(settlement.flip.kind).toBe('roll');
      if (occurrence.layout!.entryStartPointId !== undefined)
        expect(settlement.entry.kind).toBe('choice');
    }
    expect(settledLayouts(project)).toEqual(settledLayouts(blank));
    // Undo restores the snapshot before the edit, its fills with it.
    expect(storedLayouts(before.project).every((layout) => layout === undefined)).toBe(true);
  });

  it('fills a loaded plan once, the way an edit would', () => {
    const loaded = settleProjectFills({ catalog, project: blank, evaluate });
    expect(loaded.fault).toBeUndefined();
    const edited = settleProjectEdit({
      catalog,
      before: evaluate(blank),
      command: rename,
      evaluate,
    });
    expect(storedLayouts(loaded.assembly.project)).toEqual(storedLayouts(edited.assembly.project));
    // A filled plan has nothing left to fill.
    const again = settleProjectFills({ catalog, project: loaded.assembly.project, evaluate });
    expect(again.assembly.project).toBe(loaded.assembly.project);
  });

  it("never moves another room's stored layout when one room's changes", () => {
    const filled = settleProjectFills({ catalog, project: blank, evaluate }).assembly.project;
    // Flip each rolled room the other way: every later stored layout stays as stored.
    for (const { address, occurrence } of rooms(filled)) {
      const flipped = occurrence.layout?.flipped;
      if (flipped === undefined) continue;
      const authoring = roomLayoutAuthoringForProjectEvaluationAssembly(evaluate(filled), address);
      const command = authoring?.flips.find((flip) => flip.flipped !== flipped)?.command;
      if (command === undefined) continue;
      const after = settleProjectEdit({
        catalog,
        before: evaluate(filled),
        command,
        evaluate,
      }).assembly.project;
      const others = (project: ProjectDocument) =>
        rooms(project)
          .filter(({ address: other }) => semanticAddressKey(other) !== semanticAddressKey(address))
          .map(({ occurrence: other }) => other.layout);
      expect(others(after)).toEqual(others(filled));
      return;
    }
    throw new Error('the FG checkpoint has no rolled flip');
  });

  it('lands a layout fill on the plan before an edit with only the blanks it stores', () => {
    // G_Combat01 rolls its flip; the edit authors its only entry.
    const room = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b1-e1'));
    const layout = (entry?: number) =>
      applyProjectCommand(createGoldenFGHProject(), catalog, {
        kind: 'ReplaceRoomLayout',
        occurrence: room,
        layout: entry === undefined ? {} : { entryStartPointId: entry },
      });
    const fill = positionFills(catalog, evaluate(layout(50065))).find(
      ({ key }) => key === `layout:${semanticAddressKey(room)}`,
    )!;
    expect(fill.command).toMatchObject({
      layout: { flipped: expect.any(Boolean), entryStartPointId: 50065 },
    });
    // Before the edit the room had no entry: filling its flip does not author one.
    expect(positionFillOn(layout(), fill)).toEqual({
      ...fill.command,
      layout: { flipped: fill.filledLayout!.flipped },
    });
  });
});
