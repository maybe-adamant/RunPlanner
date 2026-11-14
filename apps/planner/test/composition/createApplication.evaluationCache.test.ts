import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createProjectAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { loadUnderworldFGCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { describe, expect, it } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

function storedLayoutCount(project: ProjectDocument): number {
  return project.route.biomes
    .flatMap((plan) => plan.topology?.occurrences ?? [])
    .filter((occurrence) => occurrence.layout !== undefined).length;
}

/** The plan with every stored room layout cleared, so the next edit stores the drawn ones. */
function withoutLayouts(project: ProjectDocument): ProjectDocument {
  let plan = project;
  for (const biome of project.route.biomes)
    for (const occurrence of biome.topology?.occurrences ?? [])
      if (occurrence.layout !== undefined)
        plan = applyProjectCommand(plan, catalog, {
          kind: 'ReplaceRoomLayout',
          occurrence: createOccurrenceAddress(
            createBiomeAddress(project.route.routeKey, biome.biomeKey),
            occurrence.occurrenceId,
          ),
          layout: {},
        });
  return plan;
}

describe('application project evaluation cache', () => {
  it('redoes an edit that stored drawn positions without evaluating its plan again', () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({ observeEvaluationWork: (event) => events.push(event) });
    const workspace = () => {
      const state = application.store.getState().projectWorkspace;
      if (state.kind !== 'openProject') throw new Error('expected an open project');
      return state;
    };
    const blank = withoutLayouts(loadUnderworldFGCheckpoint());
    expect(storedLayoutCount(blank)).toBe(0);
    application.store.dispatch(authoredProjectReplaced(blank));
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'RenameProject',
        project: createProjectAddress(),
        name: 'Renamed',
      }),
    );
    const edited = workspace().assembly;
    expect(storedLayoutCount(edited.project)).toBeGreaterThan(0);

    application.store.dispatch(authoredProjectUndoRequested());
    events.length = 0;
    application.store.dispatch(authoredProjectRedoRequested());

    expect(workspace().assembly).toBe(edited);
    expect(events.filter((event) => event.kind === 'projectEvaluation')).toHaveLength(0);
    application.dispose();
  });
});
