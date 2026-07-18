import { catalog } from '@run-planner/catalog';
import { createBiomeAddress, createOccurrenceId, type ProjectCommand } from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from './authoredProjectSlice';
import { createFEditorSmokeProject } from './projectBootstrap';
import { createPlannerStore } from './store';

function createStore() {
  return createPlannerStore({
    catalog,
    initialProject: createFEditorSmokeProject(catalog),
  });
}

describe('authored project application state', () => {
  it('boots one configured F biome without starting its topology', () => {
    const project = createStore().getState().authoredProject.present;

    expect(project.projectId).toBe('f-editor-smoke');
    expect(project.routes).toEqual([
      {
        routeKey: 'Underworld',
        biomes: [{ kind: 'LinearBiome', biomeStepKey: 'Underworld_F', topology: null }],
      },
      { routeKey: 'Surface', biomes: [] },
    ]);
  });

  it('routes semantic edits and undo/redo through the core project history', () => {
    const store = createStore();
    const original = store.getState().authoredProject.present;
    const command = {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'Underworld_F'),
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    } as const satisfies ProjectCommand;

    store.dispatch(authoredProjectCommandDispatched(command));
    const edited = store.getState().authoredProject;
    expect(edited.past).toEqual([original]);
    expect(edited.present.routes[0]?.biomes[0]?.topology?.startOccurrenceId).toBe('f-start');
    expect(edited.future).toEqual([]);

    store.dispatch(authoredProjectUndoRequested());
    expect(store.getState().authoredProject.present).toBe(original);
    expect(store.getState().authoredProject.future).toEqual([edited.present]);

    store.dispatch(authoredProjectRedoRequested());
    expect(store.getState().authoredProject.present).toBe(edited.present);
  });

  it('does not create application history for a semantic no-op', () => {
    const store = createStore();
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ClearTopology',
        biome: createBiomeAddress('Underworld', 'Underworld_F'),
      }),
    );

    expect(store.getState().authoredProject.past).toEqual([]);
  });
});
