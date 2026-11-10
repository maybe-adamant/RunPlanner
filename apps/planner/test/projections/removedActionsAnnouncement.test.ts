import { catalog } from '@run-planner/hades2-catalog';
import { settleProjectEdit, simulateProjectAssembly } from '@run-planner/engine/simulation';
import { createEchoGoldIAnvilDuplicateProject } from '@run-planner/test-fixtures/underworld';
import { describe, expect, it } from 'vitest';

import { removedActionsAnnouncement } from '@planner/projections/removedActionsAnnouncement';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { echoShop, swapEchoAway } from '@planner-test/support/removed-actions';

describe('removed actions announcement', () => {
  it('names each room by its location and reaches it as the stop notice does', () => {
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
      place: 'Location 40',
      selection: {
        origin: echoShop,
        presentationPanel: { kind: 'biome', biomeKey: echoShop.biomeKey },
      },
    });
  });
});
