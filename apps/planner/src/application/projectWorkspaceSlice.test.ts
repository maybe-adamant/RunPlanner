import { catalog } from '@run-planner/catalog';
import {
  createBiomeAddress,
  createEmptyProjectDocument,
  createOccurrenceId,
  createProjectDocument,
  simulateProject,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/core';
import { describe, expect, it, vi } from 'vitest';

import { createApplicationCapabilities } from './capabilityConfiguration';
import { PlannerCapabilityContractError } from './capabilities';
import { createFEditorSmokeProject } from './projectBootstrap';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from './projectWorkspaceSlice';
import {
  createPlannerStore,
  selectCanRedoProject,
  selectCanUndoProject,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
} from './store';

function createStore() {
  const capabilities = createApplicationCapabilities(catalog);
  const evaluateProject = vi.fn((project: ProjectDocument) => simulateProject(catalog, project));
  const store = createPlannerStore({
    catalog,
    capabilities,
    evaluateProject,
    initialProject: createFEditorSmokeProject(catalog, capabilities),
  });
  return { evaluateProject, store };
}

describe('project workspace application state', () => {
  it('atomically boots one authored history and its exact evaluation', () => {
    const { evaluateProject, store } = createStore();
    const state = store.getState();
    const project = selectPresentProject(state);

    expect(project.projectId).toBe('f-editor-smoke');
    expect(project.routes).toEqual([
      {
        routeKey: 'Underworld',
        biomes: [{ kind: 'LinearBiome', biomeKey: 'F', topology: null }],
      },
      { routeKey: 'Surface', biomes: [] },
    ]);
    expect(selectProjectEvaluation(state)).toBe(evaluateProject.mock.results[0]?.value);
    expect(evaluateProject.mock.calls[0]?.[0]).toBe(project);
    expect(selectProjectEvaluation(state).status).toBe('incomplete');
    expect(selectCanUndoProject(state)).toBe(false);
    expect(selectCanRedoProject(state)).toBe(false);
  });

  it('publishes one replacement evaluation after edit, undo, and redo', () => {
    const { evaluateProject, store } = createStore();
    const original = selectPresentProject(store.getState());
    const command = {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'F'),
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    } as const satisfies ProjectCommand;

    store.dispatch(authoredProjectCommandDispatched(command));
    const editedState = store.getState();
    const editedHistory = selectProjectHistory(editedState);
    expect(editedHistory.past).toEqual([original]);
    expect(editedHistory.present.routes[0]?.biomes[0]?.topology?.startOccurrenceId).toBe('f-start');
    expect(editedHistory.future).toEqual([]);
    expect(evaluateProject).toHaveBeenCalledTimes(2);
    expect(evaluateProject.mock.calls[1]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(editedState)).toBe(evaluateProject.mock.results[1]?.value);

    store.dispatch(authoredProjectUndoRequested());
    const undoneState = store.getState();
    expect(selectPresentProject(undoneState)).toBe(original);
    expect(selectProjectHistory(undoneState).future).toEqual([editedHistory.present]);
    expect(evaluateProject).toHaveBeenCalledTimes(3);
    expect(evaluateProject.mock.calls[2]?.[0]).toBe(original);
    expect(selectProjectEvaluation(undoneState)).toBe(evaluateProject.mock.results[2]?.value);

    store.dispatch(authoredProjectRedoRequested());
    const redoneState = store.getState();
    expect(selectPresentProject(redoneState)).toBe(editedHistory.present);
    expect(evaluateProject).toHaveBeenCalledTimes(4);
    expect(evaluateProject.mock.calls[3]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(redoneState)).toBe(evaluateProject.mock.results[3]?.value);
  });

  it('retains the coherent workspace without resimulation for semantic and history no-ops', () => {
    const { evaluateProject, store } = createStore();
    const original = store.getState().projectWorkspace;

    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ClearTopology',
        biome: createBiomeAddress('Underworld', 'F'),
      }),
    );
    store.dispatch(authoredProjectUndoRequested());
    store.dispatch(authoredProjectRedoRequested());

    expect(store.getState().projectWorkspace).toBe(original);
    expect(evaluateProject).toHaveBeenCalledTimes(1);
  });

  it('replaces project history and evaluates the replacement as one publication', () => {
    const { evaluateProject, store } = createStore();
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome: createBiomeAddress('Underworld', 'F'),
        occurrenceId: createOccurrenceId('discarded-start'),
        gameName: 'F_Opening01',
      }),
    );
    const replacement = createEmptyProjectDocument(catalog, {
      projectId: 'replacement',
      name: 'Replacement',
    });

    store.dispatch(authoredProjectReplaced(replacement));
    const state = store.getState();
    expect(selectProjectHistory(state)).toEqual({ past: [], present: replacement, future: [] });
    expect(selectProjectEvaluation(state).status).toBe('empty');
    expect(evaluateProject).toHaveBeenCalledTimes(3);
    expect(evaluateProject.mock.calls[2]?.[0]).toBe(replacement);
    expect(selectProjectEvaluation(state)).toBe(evaluateProject.mock.results[2]?.value);
  });

  it('rejects a non-authorable replacement before publishing or evaluating it', () => {
    const { evaluateProject, store } = createStore();
    const original = store.getState().projectWorkspace;
    const dormantReplacement = createProjectDocument(catalog, {
      projectId: 'dormant-replacement',
      name: 'Dormant Replacement',
      configuredBiomeCounts: { Underworld: 3 },
    });

    expect(() => store.dispatch(authoredProjectReplaced(dormantReplacement))).toThrowError(
      new PlannerCapabilityContractError('project.routes[0].biomes[2]', 'H is not authorable'),
    );
    expect(store.getState().projectWorkspace).toBe(original);
    expect(evaluateProject).toHaveBeenCalledTimes(1);
  });
});
