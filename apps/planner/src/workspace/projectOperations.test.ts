import { createRouteAddress, encodeProjectDocument } from '@run-planner/engine/authored-project';
import { describe, expect, it } from 'vitest';

import { createApplication } from '../composition/createApplication';
import { DEFAULT_PROFILE_FILE_NAME } from './projectOperations';
import type { ProfileFileAdapter, ProfileSaveResult } from '../persistence/profileFile';
import { authoredProjectCommandDispatched } from '../state/projectWorkspaceSlice';
import {
  selectExplicitProfileBaselineJson,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
  selectProfileSession,
} from '../state/store';

interface ProfileFixture {
  readonly adapter: ProfileFileAdapter;
  readonly saves: { fileName: string; json: string }[];
  setLoadJson(json: string | null, fileName?: string): void;
  setSaveResult(result: ProfileSaveResult): void;
}

function createProfileFixture(): ProfileFixture {
  let loadJson: string | null = null;
  let loadFileName = 'loaded-route.runplanner.json';
  let saveResult: ProfileSaveResult = 'saved';
  const saves: { fileName: string; json: string }[] = [];
  return {
    adapter: {
      save: (fileName, json) => {
        saves.push({ fileName, json });
        return Promise.resolve(saveResult);
      },
      load: () =>
        Promise.resolve(loadJson === null ? null : { fileName: loadFileName, json: loadJson }),
    },
    saves,
    setLoadJson: (json, fileName = 'loaded-route.runplanner.json') => {
      loadJson = json;
      loadFileName = fileName;
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

describe('project profile operations', () => {
  it('saves and loads only the normalized project with a fresh evaluation, history, and baseline', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    const savedProject = selectPresentProject(application.store.getState());
    const savedEvaluation = selectProjectEvaluation(application.store.getState());
    const savedJson = encodeProjectDocument(savedProject);

    await expect(application.projectOperations.saveProfile()).resolves.toEqual({
      operation: 'saveProfile',
      status: 'success',
      message: 'Saved the profile.',
    });
    expect(profile.saves).toEqual([{ fileName: DEFAULT_PROFILE_FILE_NAME, json: savedJson }]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(savedJson);
    expect(Object.keys(JSON.parse(savedJson))).toEqual([
      'schemaVersion',
      'projectId',
      'catalogVersion',
      'routes',
    ]);

    expect(application.projectOperations.createNew().status).toBe('success');
    expect(selectPresentProject(application.store.getState())).not.toEqual(savedProject);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBeNull();
    expect(selectProfileSession(application.store.getState()).fileName).toBeNull();
    expect(selectProjectHistory(application.store.getState()).past).toEqual([]);
    expect(selectProjectHistory(application.store.getState()).future).toEqual([]);
    expect(selectProjectEvaluation(application.store.getState()).status).toBe('empty');
    profile.setLoadJson(savedJson, 'erebus-route.runplanner.json');

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
    expect(selectProfileSession(state).fileName).toBe('erebus-route.runplanner.json');

    await application.projectOperations.saveProfile();
    expect(profile.saves.at(-1)).toEqual({
      fileName: 'erebus-route.runplanner.json',
      json: savedJson,
    });
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
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 1,
      }),
    );
    resolveSave?.('saved');
    await expect(saving).resolves.toMatchObject({ status: 'success' });

    expect(saves).toEqual([{ fileName: 'run-plan.runplanner.json', json: pendingJson }]);
    expect(selectExplicitProfileBaselineJson(application.store.getState())).toBe(pendingJson);
    expect(selectPresentProject(application.store.getState())).not.toBe(pendingSnapshot);
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

    profile.setLoadJson(encodeProjectDocument(selectPresentProject(state)), '  ');
    await expect(application.projectOperations.loadProfile()).resolves.toEqual({
      operation: 'loadProfile',
      status: 'failure',
      message: 'Load Profile failed: Loaded profile filename must be non-blank',
    });
    expect(application.store.getState()).toBe(state);
  });

  it('rejects schema-8 and stale-catalog profiles without replacing the current workspace', async () => {
    const profile = createProfileFixture();
    const application = createApplication({ profileFile: profile.adapter });
    configureF(application);
    const state = application.store.getState();
    const current = JSON.parse(encodeProjectDocument(selectPresentProject(state))) as Record<
      string,
      unknown
    >;

    for (const json of [
      JSON.stringify({ ...current, schemaVersion: 8 }),
      JSON.stringify({ ...current, catalogVersion: 'stale-catalog-version' }),
    ]) {
      profile.setLoadJson(json);
      await expect(application.projectOperations.loadProfile()).resolves.toMatchObject({
        operation: 'loadProfile',
        status: 'failure',
      });
      expect(application.store.getState()).toBe(state);
    }
  });
});
