// @vitest-environment jsdom

import { cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import {
  createEncounterCommandAuthorization,
  simulateProjectAssembly,
} from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '@planner/persistence/autosaveRecovery';
import type { ProfileFileAdapter } from '@planner/persistence/profileFile';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  createCompleteFGProject,
  goldenFBiome,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures';

afterEach(cleanup);

function configuredBiomeCount(
  application: ReturnType<typeof renderPlannerForInteraction>['application'],
) {
  return application.store.getState().projectWorkspace.history.present.routes[0]?.biomes.length;
}

function projectWithArtemisInErebus() {
  const initial = createCompleteFGProject();
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );
  return {
    phase,
    project: applyProjectCommand(
      initial,
      catalog,
      { kind: 'SelectEncounter', phase, encounterKey: 'ArtemisCombatF' },
      {
        encounterAuthorization: createEncounterCommandAuthorization(
          catalog,
          simulateProjectAssembly(catalog, initial),
        ),
      },
    ),
  };
}

describe('planner history interaction', () => {
  it('binds visible history controls to semantic project history', async () => {
    const { application, user } = renderPlannerForInteraction();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    expect(undo.classList.contains('quiet-action')).toBe(true);
    expect(redo.classList.contains('quiet-action')).toBe(true);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', true);

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(undo);

    expect(configuredBiomeCount(application)).toBe(0);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', false);

    await user.click(redo);

    expect(configuredBiomeCount(application)).toBe(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);
  });

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z', shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { metaKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'y' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);
  });

  it('leaves native text and content-editable undo behavior untouched', async () => {
    const { application, user } = renderPlannerForInteraction({
      companion: (
        <>
          <input aria-label="Project name draft" defaultValue="Draft" />
          <div
            aria-label="Project notes draft"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
          >
            Notes
          </div>
        </>
      ),
    });
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    const input = screen.getByRole('textbox', { name: 'Project name draft' });
    expect(fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);

    const editable = screen.getByRole('textbox', { name: 'Project notes draft' });
    expect(fireEvent.keyDown(editable, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
  });

  it('keeps navigation outside authored history', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(screen.getByRole('button', { name: 'Surface' }));

    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });

  it('activates route and configured-biome navigation from the keyboard', async () => {
    const { application, user } = renderPlannerForInteraction();

    const surface = screen.getByRole('button', { name: 'Surface' });
    surface.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(surface.getAttribute('aria-current')).toBe('page');

    const underworld = screen.getByRole('button', { name: 'Underworld' });
    underworld.focus();
    await user.keyboard(' ');
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');

    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    oceanus.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'G',
    });
    expect(oceanus.getAttribute('aria-current')).toBe('page');

    const tartarus = screen.getByRole('button', { name: 'Tartarus' });
    tartarus.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'I',
    });
    expect(tartarus.getAttribute('aria-current')).toBe('page');

    const route = screen.getByRole('button', { name: 'Route' });
    route.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'overview',
    });
    expect(route.getAttribute('aria-current')).toBe('page');
  });

  it('opens an NPC index row at its exact room phase without authoring history', async () => {
    const { phase, project } = projectWithArtemisInErebus();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'NPCs' }));
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    const npcEntry = screen.getByRole('button', {
      name: 'Inspect Artemis combat in Erebus · Encounter',
    });
    npcEntry.focus();
    await view.user.keyboard('{Enter}');

    expect(application.store.getState().editorSession).toMatchObject({
      activeRouteKey: 'Underworld',
      focusedSemanticOwner: phase,
      selectedFinding: null,
    });
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
    const customize = screen.getByLabelText('Customize') as HTMLDetailsElement;
    await waitFor(() => expect(customize.open).toBe(true));
    const encounter = screen.getByLabelText('Encounter') as HTMLSelectElement;
    expect(encounter.value).toBe('ArtemisCombatF');
    await waitFor(() => expect(document.activeElement).toBe(encounter));
  });

  it('keeps blocked and cross-route biome pages visible and editable', async () => {
    const { user } = renderPlannerForInteraction();

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    expect(within(oceanus).getByTitle('Blocked')).toBeTruthy();
    expect(
      document
        .getElementById(oceanus.getAttribute('aria-describedby') ?? '')
        ?.getAttribute('aria-label'),
    ).toBe('Blocked');

    await user.click(oceanus);
    const blockedBanner = screen.getByText(
      'Finish and fix Erebus before Oceanus can be evaluated. You can still edit it.',
    );
    expect(blockedBanner.getAttribute('role')).toBeNull();
    expect(blockedBanner.closest('.editor-panel')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);

    await user.click(screen.getByRole('button', { name: 'Surface' }));
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    // Route composition blocks the complete suffix at the first incomplete
    // biome. O/P/Q therefore retain their own structural frontiers while
    // each names N/Ephyra as the shared upstream semantic blocker.
    for (const [label, predecessor] of [
      ['Thessaly', 'Ephyra'],
      ['Olympus', 'Ephyra'],
      ['Summit', 'Ephyra'],
    ] as const) {
      const blockedSurfaceBiome = screen.getByRole('button', { name: label });
      expect(within(blockedSurfaceBiome).getByTitle('Blocked')).toBeTruthy();
      await user.click(blockedSurfaceBiome);
      expect(
        screen.getByText(
          new RegExp(`Finish and fix ${predecessor} before ${label} can be evaluated`),
        ),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);
    }

    const ephyra = screen.getByRole('button', { name: 'Ephyra' });
    expect(within(ephyra).getByTitle('Incomplete')).toBeTruthy();

    await user.click(ephyra);
    expect(screen.getByText('Ephyra is not evaluated yet. You can still edit it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start biome' })).toHaveProperty('disabled', false);
  });
});

describe('project profile interaction', () => {
  it('renames the project through one undoable semantic command', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Ocean Route');
    await user.click(screen.getByRole('button', { name: 'Rename' }));

    expect(application.store.getState().projectWorkspace.history.present.name).toBe('Ocean Route');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history.present.name).toBe('Run Plan');
    expect(screen.getByRole('textbox', { name: 'Project name' })).toHaveProperty(
      'value',
      'Run Plan',
    );
  });

  it('saves, replaces, and reloads the project through the visible profile controls', async () => {
    let profileJson: string | null = null;
    const profileFile: ProfileFileAdapter = {
      save: (_fileName, json) => {
        profileJson = json;
        return Promise.resolve('saved');
      },
      load: () => Promise.resolve(profileJson),
    };
    const application = createApplication({ profileFile });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('button', { name: 'New' }).classList.contains('danger-action')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Save Profile' }).classList.contains('secondary-action'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Load Profile' }).classList.contains('danger-action'),
    ).toBe(true);
    expect(screen.getByText('Unsaved')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');
    const savedEvaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
    expect(await screen.findByText('Saved the profile.')).toBeTruthy();
    expect(screen.getByText('Clean')).toBeTruthy();

    await user.clear(screen.getByRole('textbox', { name: 'Project name' }));
    await user.type(screen.getByRole('textbox', { name: 'Project name' }), 'Edited after save');
    await user.click(screen.getByRole('button', { name: 'Rename' }));
    expect(screen.getByText('Dirty')).toBeTruthy();
    expect(profileJson).not.toBeNull();

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(configuredBiomeCount(application)).toBe(0);
    expect(screen.getByText('Created a new project.')).toBeTruthy();
    expect(screen.getByText('Unsaved')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));
    expect(await screen.findByText('Loaded the profile.')).toBeTruthy();
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toEqual(
      savedEvaluation,
    );
    expect(screen.getByText('Clean')).toBeTruthy();
  });

  it('presents a restored startup project as recovered', () => {
    const source = createApplication();
    const json = encodeProjectDocument(source.store.getState().projectWorkspace.history.present);
    const application = createApplication({
      autosaveRecovery: {
        read: () => json,
        write: () => {},
        clear: () => {},
      },
      autosaveScheduler: { schedule: () => () => {} },
    });

    renderPlannerForInteraction({ application });

    expect(screen.getByText('Recovered')).toBeTruthy();
  });

  it('presents corrupt recovery and exposes its explicit discard action', async () => {
    let recoveryJson: string | null = '{not json';
    const recovery: AutosaveRecoveryAdapter = {
      read: () => recoveryJson,
      write: (json) => {
        recoveryJson = json;
      },
      clear: () => {
        recoveryJson = null;
      },
    };
    const scheduler: AutosaveScheduler = {
      schedule: () => () => {},
    };
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
    });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('alert').textContent).toBe(
      'Autosave recovery failed: $: must be valid JSON',
    );
    expect(screen.getByText('Unsaved')).toBeTruthy();
    const discard = screen.getByRole('button', { name: 'Discard Autosave' });
    expect(discard.classList.contains('danger-action')).toBe(true);
    await user.click(discard);

    expect(recoveryJson).toBeNull();
    expect(screen.queryByText('Autosave recovery failed: $: must be valid JSON')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard Autosave' })).toBeNull();
    expect(screen.getByText('Discarded the unreadable autosave.')).toBeTruthy();
  });

  it('presents a load failure and retains the current workspace', async () => {
    const application = createApplication({
      profileFile: {
        save: () => Promise.resolve('saved'),
        load: () => Promise.resolve('{not json'),
      },
    });
    const workspace = application.store.getState().projectWorkspace;
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Load Profile failed: $: must be valid JSON',
    );
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });
});
