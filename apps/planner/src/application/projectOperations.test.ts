import { createRouteAddress, encodeProjectDocument } from '@run-planner/engine';
import { describe, expect, it } from 'vitest';

import { createApplication } from './createApplication';
import { suggestedProfileFileName } from './projectOperations';
import type { ProfileFileAdapter, ProfileSaveResult } from './profileFile';
import { authoredProjectCommandDispatched } from './projectWorkspaceSlice';
import {
  selectExplicitProfileBaselineJson,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
} from './store';

interface ProfileFixture {
  readonly adapter: ProfileFileAdapter;
  readonly saves: { fileName: string; json: string }[];
  setLoadJson(json: string | null): void;
  setSaveResult(result: ProfileSaveResult): void;
}

function createProfileFixture(): ProfileFixture {
  let loadJson: string | null = null;
  let saveResult: ProfileSaveResult = 'saved';
  const saves: { fileName: string; json: string }[] = [];
  return {
    adapter: {
      save: (fileName, json) => {
        saves.push({ fileName, json });
        return Promise.resolve(saveResult);
      },
      load: () => Promise.resolve(loadJson),
    },
    saves,
    setLoadJson: (json) => {
      loadJson = json;
    },
    setSaveResult: (result) => {
      saveResult = result;
    },
  };
}

function configureF(application: ReturnType<typeof createApplication>): void {
  application.store.dispatch(
    authoredProjectCommandDispatched({
      kind: 'ConfigureRoutePrefix',
      route: createRouteAddress('Underworld'),
      configuredBiomeCount: 1,
    }),
  );
}

function rename(application: ReturnType<typeof createApplication>, name: string): void {
  application.store.dispatch(authoredProjectCommandDispatched({ kind: 'RenameProject', name }));
}

describe('project profile operations', () => {
  it('saves and loads only the normalized project with a fresh evaluation, history, and baseline', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    rename(application, 'Erebus Route');
    const savedProject = selectPresentProject(application.store.getState());
    const savedEvaluation = selectProjectEvaluation(application.store.getState());
    const savedJson = encodeProjectDocument(savedProject);

    await expect(application.projectOperations.saveProfile()).resolves.toEqual({
      operation: 'saveProfile',
      status: 'success',
      message: 'Saved the profile.',
    });
    expect(profile.saves).toEqual([{ fileName: 'erebus-route.runplanner.json', json: savedJson }]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(savedJson);
    expect(Object.keys(JSON.parse(savedJson))).toEqual([
      'schemaVersion',
      'projectId',
      'name',
      'catalogVersion',
      'routes',
    ]);

    expect(application.projectOperations.createNew().status).toBe('success');
    expect(selectPresentProject(application.store.getState())).not.toEqual(savedProject);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBeNull();
    expect(selectProjectHistory(application.store.getState()).past).toEqual([]);
    expect(selectProjectHistory(application.store.getState()).future).toEqual([]);
    expect(selectProjectEvaluation(application.store.getState()).status).toBe('empty');
    profile.setLoadJson(savedJson);

    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'success',
      message: 'Loaded the profile.',
    });

    const state = application.store.getState();
    expect(selectPresentProject(state)).toEqual(savedProject);
    expect(selectProjectHistory(state)).toEqual({ past: [], present: savedProject, future: [] });
    expect(selectProjectEvaluation(state)).toEqual(savedEvaluation);
    expect(selectExplicitProfileBaselineJson(state)).toBe(savedJson);
  });

  it('establishes the exact pending-save snapshot as baseline after a later edit', async () => {
    let resolveSave: ((result: ProfileSaveResult) => void) | undefined;
    const saves: { fileName: string; json: string }[] = [];
    const profileFile: ProfileFileAdapter = {
      save: (fileName, json) => {
        saves.push({ fileName, json });
        return new Promise((resolve) => {
          resolveSave = resolve;
        });
      },
      load: () => Promise.resolve(null),
    };
    const application = createApplication({ profileFile });
    configureF(application);
    const pendingSnapshot = selectPresentProject(application.store.getState());
    const pendingJson = encodeProjectDocument(pendingSnapshot);

    const saving = application.projectOperations.saveProfile();
    rename(application, 'Edited While Saving');
    resolveSave?.('saved');
    await expect(saving).resolves.toMatchObject({ status: 'success' });

    expect(saves).toEqual([{ fileName: 'run-plan.runplanner.json', json: pendingJson }]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(pendingJson);
    expect(selectPresentProject(application.store.getState()).name).toBe('Edited While Saving');
  });

  it('normalizes safe portable profile filenames', () => {
    expect(suggestedProfileFileName('  Erebus / Route: Ω?  ')).toBe('erebus-route.runplanner.json');
    expect(suggestedProfileFileName('CON')).toBe('run-plan-con.runplanner.json');
    expect(suggestedProfileFileName('---')).toBe('run-plan.runplanner.json');
    expect(suggestedProfileFileName('A'.repeat(100))).toBe(`${'a'.repeat(64)}.runplanner.json`);
  });

  it('preserves the current workspace and baseline across cancellation and adapter failure', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    await application.projectOperations.saveProfile();
    const workspace = application.store.getState().projectWorkspace;
    const baseline = selectExplicitProfileBaselineJson(application.store.getState());

    profile.setSaveResult('cancelled');
    await expect(application.projectOperations.saveProfile()).resolves.toMatchObject({
      operation: 'saveProfile',
      status: 'cancelled',
    });
    profile.setLoadJson(null);
    await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
      operation: 'loadProfile',
      status: 'cancelled',
    });
    expect(application.store.getState().projectWorkspace).toBe(workspace);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(baseline);

    const failing = createApplication({
      profileFile: {
        save: () => Promise.reject(new Error('save denied')),
        load: () => Promise.reject(new Error('load denied')),
      },
    });
    const failingState = failing.store.getState();
    await expect(failing.projectOperations.saveProfile()).resolves.toEqual({
      operation: 'saveProfile',
      status: 'failure',
      message: 'Save Profile failed: save denied',
    });
    await expect(failing.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: load denied',
    });
    expect(failing.store.getState()).toBe(failingState);
  });

  it('rejects malformed profiles atomically', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    await application.projectOperations.saveProfile();
    const state = application.store.getState();

    profile.setLoadJson('{not json');
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: $: must be valid JSON',
    });
    expect(application.store.getState()).toBe(state);
  });
});
