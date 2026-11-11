import { catalog } from '@run-planner/hades2-catalog';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createBiomeAddress,
  createProjectAddress,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  createEchoGoldIAnvilDuplicateProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOHermesShrineDeliveryCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import { describe, expect, it } from 'vitest';

import { removedActionsAnnouncement } from '@planner/projections/removedActionsAnnouncement';
import { removedActionsLead } from '@planner/projections/walkStopCopy';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { echoShop, swapEchoAway } from '@planner-test/support/removed-actions';

const surfaceO = createBiomeAddress('Surface', 'O');

describe('removed actions announcement', () => {
  it('names each room by its location and opens it on its Timeline', () => {
    const before = simulateProjectAssembly(catalog, createEchoGoldIAnvilDuplicateProject());
    const settled = settleProjectEdit({
      catalog,
      before,
      command: swapEchoAway,
      evaluate: (project) => simulateProjectAssembly(catalog, project),
    });
    expect(settled.removedStaleActions).toHaveLength(1);
    const workspace = createStructuredWorkspaceTestServices().structuredWorkspace.project(
      settled.assembly,
    );
    const [room, ...others] = removedActionsAnnouncement(
      catalog,
      settled.removedStaleActions!,
      workspace,
    );
    expect(others).toEqual([]);
    expect(room).toMatchObject({
      count: 1,
      doors: 0,
      place: { text: 'Location 40', hint: 'Preboss' },
      selection: {
        origin: echoShop,
        presentation: { kind: 'roomTimeline' },
        presentationPanel: { kind: 'biome', biomeKey: echoShop.biomeKey },
      },
    });
  });

  it('counts the doors a room lost beside its actions', () => {
    const source = createOccurrenceAddress(goldenGBiome, createOccurrenceId('golden-g-b7-e1'));
    // An older file whose room before the Preboss lost its third door unsettled.
    const drifted = applyProjectCommand(
      createCompleteFGProject({ prebossSource: 'G_Combat14' }),
      catalog,
      { kind: 'ReplaceOccurrenceRoom', occurrence: source, gameName: 'G_Combat12' },
    );
    const settled = settleProjectEdit({
      catalog,
      before: simulateProjectAssembly(catalog, drifted),
      command: { kind: 'RenameProject', project: createProjectAddress(), name: 'Renamed' },
      evaluate: (project) => simulateProjectAssembly(catalog, project),
    });
    const workspace = createStructuredWorkspaceTestServices().structuredWorkspace.project(
      settled.assembly,
    );
    const [room] = removedActionsAnnouncement(catalog, settled.removedStaleActions!, workspace);
    expect(room).toMatchObject({ count: 0, doors: 1, selection: { origin: source } });
    expect(removedActionsLead(room!.count, room!.doors)).toBe('1 door removed at');
    expect(removedActionsLead(2, 1)).toBe('2 actions and 1 door removed at');
    expect(removedActionsLead(1)).toBe('1 action removed at');
  });

  it('counts the replaced items whose rolls and choices a room lost', () => {
    const shrine = createOccurrenceAddress(surfaceO, createOccurrenceId('surface-o-combat07'));
    const host = createOccurrenceAddress(surfaceO, createOccurrenceId('surface-o-devotion'));
    // Restocking the Shrine slot replaces the countdown delivery due at the Devotion room.
    const before = simulateProjectAssembly(catalog, loadSurfaceNOHermesShrineDeliveryCheckpoint());
    const settled = settleProjectEdit({
      catalog,
      before,
      command: {
        kind: 'ReplaceHermesShrineOffer',
        occurrence: shrine,
        slotKey: 'secondLeft',
        value: { rewardType: 'HealBigDrop' },
      },
      evaluate: (project) => simulateProjectAssembly(catalog, project),
    });
    const workspace = createStructuredWorkspaceTestServices().structuredWorkspace.project(
      settled.assembly,
    );
    const [room, ...others] = removedActionsAnnouncement(
      catalog,
      settled.removedStaleActions!,
      workspace,
    );
    expect(others).toEqual([]);
    expect(room).toMatchObject({ count: 1, doors: 0, items: 1, selection: { origin: host } });
    expect(removedActionsLead(room!.count, room!.doors, room!.items)).toBe(
      '1 action and 1 replaced item removed at',
    );
    expect(removedActionsLead(0, 0, 2)).toBe('2 replaced items removed at');
    expect(removedActionsLead(1, 1, 1)).toBe('1 action, 1 door and 1 replaced item removed at');
  });
});
