import { catalog } from '@run-planner/catalog';
import {
  createProjectDocument,
  createRouteAddress,
  encodeProjectDocument,
} from '@run-planner/core';
import { describe, expect, it } from 'vitest';

import { createApplication } from './createApplication';
import type {
  ProjectJsonTransferAdapter,
  ProjectPersistenceAdapters,
  ProjectStorageAdapter,
} from './projectPersistence';
import { authoredProjectCommandDispatched } from './projectWorkspaceSlice';
import { selectPresentProject, selectProjectEvaluation, selectProjectHistory } from './store';

interface PersistenceFixture {
  readonly adapters: ProjectPersistenceAdapters;
  readonly downloads: { fileName: string; json: string }[];
  setStoredJson(json: string | null): void;
  setUploadJson(json: string | null): void;
  storedJson(): string | null;
}

function createPersistenceFixture(): PersistenceFixture {
  let storedJson: string | null = null;
  let uploadJson: string | null = null;
  const downloads: { fileName: string; json: string }[] = [];
  const storage: ProjectStorageAdapter = {
    read: () => storedJson,
    write: (json) => {
      storedJson = json;
    },
  };
  const transfer: ProjectJsonTransferAdapter = {
    download: (fileName, json) => downloads.push({ fileName, json }),
    upload: () => Promise.resolve(uploadJson),
  };
  return {
    adapters: { storage, transfer },
    downloads,
    setStoredJson: (json) => {
      storedJson = json;
    },
    setUploadJson: (json) => {
      uploadJson = json;
    },
    storedJson: () => storedJson,
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

describe('project operations', () => {
  it('saves and loads only the normalized authored project with a fresh evaluation and history', () => {
    const persistence = createPersistenceFixture();
    const application = createApplication({ projectPersistence: persistence.adapters });
    configureF(application);
    const savedProject = selectPresentProject(application.store.getState());
    const savedEvaluation = selectProjectEvaluation(application.store.getState());

    expect(application.projectOperations.save()).toEqual({
      operation: 'save',
      status: 'success',
      message: 'Saved this project in the browser.',
    });
    expect(persistence.storedJson()).toBe(encodeProjectDocument(savedProject));
    expect(Object.keys(JSON.parse(persistence.storedJson() ?? '{}'))).toEqual([
      'schemaVersion',
      'projectId',
      'name',
      'catalogVersion',
      'routes',
    ]);

    expect(application.projectOperations.createNew().status).toBe('success');
    expect(selectPresentProject(application.store.getState())).not.toEqual(savedProject);
    expect(selectProjectHistory(application.store.getState()).past).toEqual([]);
    expect(selectProjectHistory(application.store.getState()).future).toEqual([]);
    expect(application.projectOperations.load()).toEqual({
      operation: 'load',
      status: 'success',
      message: 'Loaded the saved browser project.',
    });

    const state = application.store.getState();
    expect(selectPresentProject(state)).toEqual(savedProject);
    expect(selectProjectHistory(state)).toEqual({
      past: [],
      present: savedProject,
      future: [],
    });
    expect(selectProjectEvaluation(state)).toEqual(savedEvaluation);
  });

  it('exports and imports capability-aware project JSON without exporting derived state', async () => {
    const persistence = createPersistenceFixture();
    const application = createApplication({ projectPersistence: persistence.adapters });
    configureF(application);
    const exportedProject = selectPresentProject(application.store.getState());
    const exportedEvaluation = selectProjectEvaluation(application.store.getState());

    expect(application.projectOperations.exportJson().status).toBe('success');
    expect(persistence.downloads).toEqual([
      {
        fileName: 'run-planner-project.json',
        json: encodeProjectDocument(exportedProject),
      },
    ]);

    expect(application.projectOperations.createNew().status).toBe('success');
    persistence.setUploadJson(persistence.downloads[0]?.json ?? null);
    expect(await application.projectOperations.importJson()).toEqual({
      operation: 'import',
      status: 'success',
      message: 'Imported the project JSON.',
    });

    const state = application.store.getState();
    expect(selectPresentProject(state)).toEqual(exportedProject);
    expect(selectProjectHistory(state).past).toEqual([]);
    expect(selectProjectHistory(state).future).toEqual([]);
    expect(selectProjectEvaluation(state)).toEqual(exportedEvaluation);
  });

  it('leaves the current workspace untouched when load or import cannot decode authorable data', async () => {
    const persistence = createPersistenceFixture();
    const application = createApplication({ projectPersistence: persistence.adapters });
    configureF(application);
    const workspace = application.store.getState().projectWorkspace;

    persistence.setStoredJson('{not json');
    expect(application.projectOperations.load()).toEqual({
      operation: 'load',
      status: 'failure',
      message: 'Load failed: $: must be valid JSON',
    });
    expect(application.store.getState().projectWorkspace).toBe(workspace);

    const dormantProject = createProjectDocument(catalog, {
      projectId: 'dormant',
      name: 'Dormant',
      configuredBiomeCounts: { Underworld: 3 },
    });
    persistence.setUploadJson(encodeProjectDocument(dormantProject));
    const importResult = await application.projectOperations.importJson();
    expect(importResult.status).toBe('failure');
    expect(importResult.message).toContain('H is not authorable');
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });

  it('reports missing, cancelled, storage, and transfer failures without guessing a project', async () => {
    const application = createApplication({
      projectPersistence: {
        storage: {
          read: () => null,
          write: () => {
            throw new Error('storage denied');
          },
        },
        transfer: {
          download: () => {
            throw new Error('download denied');
          },
          upload: () => Promise.resolve(null),
        },
      },
    });
    const workspace = application.store.getState().projectWorkspace;

    expect(application.projectOperations.load()).toEqual({
      operation: 'load',
      status: 'failure',
      message: 'Load failed: No project has been saved in this browser',
    });
    expect(application.projectOperations.save()).toEqual({
      operation: 'save',
      status: 'failure',
      message: 'Save failed: storage denied',
    });
    expect(application.projectOperations.exportJson()).toEqual({
      operation: 'export',
      status: 'failure',
      message: 'Export failed: download denied',
    });
    expect(await application.projectOperations.importJson()).toEqual({
      operation: 'import',
      status: 'cancelled',
      message: 'Import cancelled.',
    });
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });
});
