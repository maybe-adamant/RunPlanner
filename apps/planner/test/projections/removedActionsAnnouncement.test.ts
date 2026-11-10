import { catalog } from '@run-planner/hades2-catalog';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectAddress,
} from '@run-planner/engine/authored-project';
import {
  createCompleteFGProject,
  createEchoGoldIAnvilDuplicateProject,
  goldenGBiome,
} from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { removedActionsAnnouncement } from '@planner/projections/removedActionsAnnouncement';
import { removedActionsLead } from '@planner/projections/walkStopCopy';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { echoShop, swapEchoAway } from '@planner-test/support/removed-actions';

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
      place: 'Location 40',
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
});
