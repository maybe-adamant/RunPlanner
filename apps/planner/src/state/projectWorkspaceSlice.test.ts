import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createDefaultRouteLoadout,
  createEmptyProjectDocument,
  createEncounterPhaseAddress,
  createExitSelectionAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTraitOfferAddress,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
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
import { createGoldenFGHProject, goldenHBiome } from '@run-planner/test-fixtures';

function createStore() {
  const assembleProjectEvaluation = vi.fn((project: ProjectDocument) =>
    simulateProjectAssembly(catalog, project),
  );
  const store = createPlannerStore({
    assembleProjectEvaluation,
    catalog,
    initialProject: createInitialProject(catalog),
  });
  return { assembleProjectEvaluation, store };
}

describe('project workspace application state', () => {
  it('atomically boots one empty authored history and its exact evaluation', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const state = store.getState();
    const project = selectPresentProject(state);

    expect(project.projectId).toBe('run-plan');
    expect(project.routes).toEqual([
      {
        routeKey: 'Underworld',
        loadout: createDefaultRouteLoadout(catalog),
        biomes: [],
      },
      {
        routeKey: 'Surface',
        loadout: createDefaultRouteLoadout(catalog),
        biomes: [],
      },
    ]);
    expect(selectProjectEvaluation(state)).toBe(
      assembleProjectEvaluation.mock.results[0]?.value.evaluation,
    );
    expect(state.projectWorkspace.assembly.project).toBe(project);
    expect(selectProjectEvaluation(state)).toBe(state.projectWorkspace.assembly.evaluation);
    expect(assembleProjectEvaluation.mock.calls[0]?.[0]).toBe(project);
    expect(selectProjectEvaluation(state).status).toBe('empty');
    expect(selectCanUndoProject(state)).toBe(false);
    expect(selectCanRedoProject(state)).toBe(false);
  });

  it('rejects an otherwise valid assembly for a different authored identity', () => {
    const initialProject = createInitialProject(catalog);
    const foreignProject = createEmptyProjectDocument(catalog, {
      projectId: 'foreign-assembly',
      name: 'Foreign assembly',
    });

    expect(() =>
      createPlannerStore({
        assembleProjectEvaluation: () => simulateProjectAssembly(catalog, foreignProject),
        catalog,
        initialProject,
      }),
    ).toThrow(/does not match authored workspace identity/);
  });

  it('publishes one replacement evaluation after edit, undo, and redo', () => {
    const { assembleProjectEvaluation, store } = createStore();
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
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(3);
    expect(assembleProjectEvaluation.mock.calls[2]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(editedState)).toBe(
      assembleProjectEvaluation.mock.results[2]?.value.evaluation,
    );

    store.dispatch(authoredProjectUndoRequested());
    const undoneState = store.getState();
    expect(selectPresentProject(undoneState)).toBe(configured);
    expect(selectProjectHistory(undoneState).future).toEqual([editedHistory.present]);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(4);
    expect(assembleProjectEvaluation.mock.calls[3]?.[0]).toBe(configured);
    expect(selectProjectEvaluation(undoneState)).toBe(
      assembleProjectEvaluation.mock.results[3]?.value.evaluation,
    );

    store.dispatch(authoredProjectRedoRequested());
    const redoneState = store.getState();
    expect(selectPresentProject(redoneState)).toBe(editedHistory.present);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(5);
    expect(assembleProjectEvaluation.mock.calls[4]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(redoneState)).toBe(
      assembleProjectEvaluation.mock.results[4]?.value.evaluation,
    );
  });

  it('undoes and redoes one atomic Echo Pom child edit with its outer selection', () => {
    const { store } = createStore();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    store.dispatch(authoredProjectReplaced(project));
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const before = selectPresentProject(store.getState());
    const bridge = before.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const editedOffer = Object.freeze({
      ...offer,
      selectedOptionKey: 'option3' as const,
      options: Object.freeze([
        offer.options[0],
        offer.options[1],
        Object.freeze({ ...offer.options[2], echoPomTarget: null }),
      ]) as typeof offer.options,
    });
    store.dispatch(
      authoredProjectCommandDispatched({ kind: 'ReplaceTraitOffer', trait, value: editedOffer }),
    );
    const edited = selectPresentProject(store.getState());
    expect(edited).not.toBe(before);

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('undoes and redoes one atomic Echo Boon child edit with its outer selection', () => {
    const { store } = createStore();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    store.dispatch(authoredProjectReplaced(project));
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const before = selectPresentProject(store.getState());
    const bridge = before.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const editedOffer = Object.freeze({
      ...offer,
      selectedOptionKey: 'option1' as const,
      options: Object.freeze([
        Object.freeze({
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: Object.freeze({
            options: Object.freeze([
              Object.freeze({
                giverKey: 'Hera',
                traitKey: 'BoonDecayBoon',
                rarity: 'Heroic' as const,
                targetTraitKey: 'HephaestusWeaponBoon',
              }),
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
        offer.options[1],
        offer.options[2],
      ]) as typeof offer.options,
    });
    store.dispatch(
      authoredProjectCommandDispatched({ kind: 'ReplaceTraitOffer', trait, value: editedOffer }),
    );
    const edited = selectPresentProject(store.getState());
    expect(edited).not.toBe(before);

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('retains the coherent workspace without resimulation for semantic and history no-ops', () => {
    const { assembleProjectEvaluation, store } = createStore();
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
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(1);
  });

  it('replaces project history and evaluates the replacement as one publication', () => {
    const { assembleProjectEvaluation, store } = createStore();
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
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(3);
    expect(assembleProjectEvaluation.mock.calls[2]?.[0]).toBe(replacement);
    expect(selectProjectEvaluation(state)).toBe(
      assembleProjectEvaluation.mock.results[2]?.value.evaluation,
    );
  });

  it('keeps projected semantic focus outside authored history and evaluation work', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const before = store.getState().projectWorkspace;
    const owner = createBiomeAddress('Underworld', 'F');

    store.dispatch(semanticOwnerFocused(owner));

    expect(store.getState().projectWorkspace).toBe(before);
    expect(store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(1);
  });

  it('allows the complete authorable Underworld prefix', () => {
    const { assembleProjectEvaluation, store } = createStore();
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
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(2);
  });

  it('publishes an activated I replacement atomically', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const replacement = createProjectDocument(catalog, {
      projectId: 'i-replacement',
      name: 'I Replacement',
      configuredBiomeCounts: { Underworld: 4 },
    });

    store.dispatch(authoredProjectReplaced(replacement));
    expect(selectPresentProject(store.getState())).toBe(replacement);
    expect(selectProjectEvaluation(store.getState())).toBe(
      assembleProjectEvaluation.mock.results[1]?.value.evaluation,
    );
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(2);
  });
});
