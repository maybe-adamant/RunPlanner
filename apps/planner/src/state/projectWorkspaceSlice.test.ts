import { catalog } from '@run-planner/hades2-catalog';
import {
  createBiomeAddress,
  createEmptyProjectDocument,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { createInitialProject } from '../composition/projectBootstrap';
import { semanticOwnerFocused } from './editorSessionSlice';
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
  const evaluateProject = vi.fn((project: ProjectDocument) => simulateProject(catalog, project));
  const store = createPlannerStore({
    catalog,
    evaluateProject,
    initialProject: createInitialProject(catalog),
  });
  return { evaluateProject, store };
}

describe('project workspace application state', () => {
  it('atomically boots one empty authored history and its exact evaluation', () => {
    const { evaluateProject, store } = createStore();
    const state = store.getState();
    const project = selectPresentProject(state);

    expect(project.projectId).toBe('run-plan');
    expect(project.routes).toEqual([
      { routeKey: 'Underworld', biomes: [] },
      { routeKey: 'Surface', biomes: [] },
    ]);
    expect(selectProjectEvaluation(state)).toBe(evaluateProject.mock.results[0]?.value);
    expect(evaluateProject.mock.calls[0]?.[0]).toBe(project);
    expect(selectProjectEvaluation(state).status).toBe('empty');
    expect(selectCanUndoProject(state)).toBe(false);
    expect(selectCanRedoProject(state)).toBe(false);
  });

  it('publishes one replacement evaluation after edit, undo, and redo', () => {
    const { evaluateProject, store } = createStore();
    const original = selectPresentProject(store.getState());
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
      }),
    );
    const configured = selectPresentProject(store.getState());
    const command = {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'F'),
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    } as const satisfies ProjectCommand;

    store.dispatch(authoredProjectCommandDispatched(command));
    const editedState = store.getState();
    const editedHistory = selectProjectHistory(editedState);
    const editedPlan = editedHistory.present.routes[0]?.biomes[0];
    if (editedPlan === undefined) throw new Error('expected edited F plan');
    expect(editedHistory.past).toEqual([original, configured]);
    expect(editedPlan.topology?.startOccurrenceId).toBe('f-start');
    expect(editedHistory.future).toEqual([]);
    expect(evaluateProject).toHaveBeenCalledTimes(3);
    expect(evaluateProject.mock.calls[2]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(editedState)).toBe(evaluateProject.mock.results[2]?.value);

    store.dispatch(authoredProjectUndoRequested());
    const undoneState = store.getState();
    expect(selectPresentProject(undoneState)).toBe(configured);
    expect(selectProjectHistory(undoneState).future).toEqual([editedHistory.present]);
    expect(evaluateProject).toHaveBeenCalledTimes(4);
    expect(evaluateProject.mock.calls[3]?.[0]).toBe(configured);
    expect(selectProjectEvaluation(undoneState)).toBe(evaluateProject.mock.results[3]?.value);

    store.dispatch(authoredProjectRedoRequested());
    const redoneState = store.getState();
    expect(selectPresentProject(redoneState)).toBe(editedHistory.present);
    expect(evaluateProject).toHaveBeenCalledTimes(5);
    expect(evaluateProject.mock.calls[4]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(redoneState)).toBe(evaluateProject.mock.results[4]?.value);
  });

  it('retains the coherent workspace without resimulation for semantic and history no-ops', () => {
    const { evaluateProject, store } = createStore();
    const original = store.getState().projectWorkspace;

    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 0,
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
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
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

  it('keeps projected semantic focus outside authored history and evaluation work', () => {
    const { evaluateProject, store } = createStore();
    const before = store.getState().projectWorkspace;
    const owner = createBiomeAddress('Underworld', 'F');

    store.dispatch(semanticOwnerFocused(owner));

    expect(store.getState().projectWorkspace).toBe(before);
    expect(store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    expect(evaluateProject).toHaveBeenCalledTimes(1);
  });

  it('allows the complete authorable Underworld prefix', () => {
    const { evaluateProject, store } = createStore();
    const route = createRouteAddress('Underworld');
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route,
        configuredBiomeCount: 4,
      }),
    );
    const fghiState = store.getState();
    expect(
      selectPresentProject(fghiState).routes[0]?.biomes.map((biome) => biome.biomeKey),
    ).toEqual(['F', 'G', 'H', 'I']);
    expect(selectProjectEvaluation(fghiState).status).toBe('incomplete');
    expect(evaluateProject).toHaveBeenCalledTimes(2);
  });

  it('publishes an activated I replacement atomically', () => {
    const { evaluateProject, store } = createStore();
    const replacement = createProjectDocument(catalog, {
      projectId: 'i-replacement',
      name: 'I Replacement',
      configuredBiomeCounts: { Underworld: 4 },
    });

    store.dispatch(authoredProjectReplaced(replacement));
    expect(selectPresentProject(store.getState())).toBe(replacement);
    expect(selectProjectEvaluation(store.getState())).toBe(evaluateProject.mock.results[1]?.value);
    expect(evaluateProject).toHaveBeenCalledTimes(2);
  });
});
