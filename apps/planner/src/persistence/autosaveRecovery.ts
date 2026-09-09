import {
  encodeProjectDocument,
  parseProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import type { ProfileFileReference, ProfileFileRestoreResult } from './profileFile';

import {
  autosaveWriteFailed,
  autosaveWriteSucceeded,
  createInitialProfileSessionState,
  type ProfileSessionState,
} from '../state/profileSessionSlice';
import { selectPresentProject, selectProfileSession, type PlannerStore } from '../state/store';

export interface AutosaveRecoveryAdapter {
  read(): string | null;
  write(json: string): void;
  clear(): void;
}

export interface AutosaveScheduler {
  schedule(delayMs: number, task: () => void): () => void;
}

export interface StartupProjectState<TPrepared> {
  readonly activeProfileFile?: ProfileFileReference;
  readonly clearActiveProfileFile: boolean;
  readonly preparedProject?: TPrepared;
  readonly profileSession: ProfileSessionState;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown autosave recovery failure';
}

export function restoreStartupProject<TPrepared>(
  catalog: Catalog,
  recovery: AutosaveRecoveryAdapter | undefined,
  prepareProject: (project: ProjectDocument) => TPrepared,
  profileRestore: ProfileFileRestoreResult = Object.freeze({ status: 'none' }),
): StartupProjectState<TPrepared> {
  const prepareJson = (json: string) => {
    const project = parseProjectDocument(json, catalog);
    return Object.freeze({
      canonicalJson: encodeProjectDocument(project),
      preparedProject: prepareProject(project),
    });
  };
  const recoveryJson = (() => {
    if (recovery === undefined) return Object.freeze({ status: 'none' as const });
    try {
      const json = recovery.read();
      return json === null
        ? Object.freeze({ status: 'none' as const })
        : Object.freeze({ status: 'available' as const, json });
    } catch (error) {
      return Object.freeze({ status: 'failure' as const, error });
    }
  })();
  const profileFileError = profileRestore.status === 'failure' ? profileRestore.message : null;
  const restored = profileRestore.status === 'loaded' ? profileRestore.loaded : undefined;
  const preparedDisk = (() => {
    if (restored === undefined) return Object.freeze({ status: 'none' as const });
    try {
      return Object.freeze({
        status: 'prepared' as const,
        file: restored.file,
        ...prepareJson(restored.json),
      });
    } catch (error) {
      return Object.freeze({ status: 'failure' as const, error });
    }
  })();

  if (preparedDisk.status === 'prepared') {
    const fileName = preparedDisk.file.fileName;
    const baseline = preparedDisk.canonicalJson;
    if (recoveryJson.status === 'none') {
      return Object.freeze({
        activeProfileFile: preparedDisk.file,
        clearActiveProfileFile: false,
        preparedProject: preparedDisk.preparedProject,
        profileSession: createInitialProfileSessionState({
          explicitBaselineJson: baseline,
          fileName,
        }),
      });
    }
    if (recoveryJson.status === 'failure') {
      return Object.freeze({
        activeProfileFile: preparedDisk.file,
        clearActiveProfileFile: false,
        profileSession: createInitialProfileSessionState({
          explicitBaselineJson: baseline,
          fileName,
          recoveryStatus: 'blocked',
          recoveryError: `Autosave recovery failed: ${errorDetail(recoveryJson.error)}`,
        }),
      });
    }
    try {
      const recovered = prepareJson(recoveryJson.json);
      const equivalent = recovered.canonicalJson === baseline;
      return Object.freeze({
        activeProfileFile: preparedDisk.file,
        clearActiveProfileFile: false,
        preparedProject: equivalent ? preparedDisk.preparedProject : recovered.preparedProject,
        profileSession: createInitialProfileSessionState({
          explicitBaselineJson: baseline,
          fileName,
          recoveryStatus: equivalent ? 'none' : 'recovered',
        }),
      });
    } catch (error) {
      return Object.freeze({
        activeProfileFile: preparedDisk.file,
        clearActiveProfileFile: false,
        profileSession: createInitialProfileSessionState({
          explicitBaselineJson: baseline,
          fileName,
          recoveryStatus: 'blocked',
          recoveryError: `Autosave recovery failed: ${errorDetail(error)}`,
        }),
      });
    }
  }

  const invalidRestoredProfileError =
    preparedDisk.status === 'failure'
      ? `Active profile recovery failed: ${errorDetail(preparedDisk.error)}`
      : profileFileError;
  const clearActiveProfileFile = preparedDisk.status === 'failure';
  if (recoveryJson.status === 'none') {
    return Object.freeze({
      clearActiveProfileFile,
      profileSession: createInitialProfileSessionState({
        profileFileError: invalidRestoredProfileError,
      }),
    });
  }
  if (recoveryJson.status === 'failure') {
    return Object.freeze({
      clearActiveProfileFile,
      profileSession: createInitialProfileSessionState({
        profileFileError: invalidRestoredProfileError,
        recoveryStatus: 'blocked',
        recoveryError: `Autosave recovery failed: ${errorDetail(recoveryJson.error)}`,
      }),
    });
  }
  try {
    const recovered = prepareJson(recoveryJson.json);
    return Object.freeze({
      clearActiveProfileFile,
      preparedProject: recovered.preparedProject,
      profileSession: createInitialProfileSessionState({
        profileFileError: invalidRestoredProfileError,
        recoveryStatus: 'recovered',
      }),
    });
  } catch (error) {
    return Object.freeze({
      clearActiveProfileFile,
      profileSession: createInitialProfileSessionState({
        profileFileError: invalidRestoredProfileError,
        recoveryStatus: 'blocked',
        recoveryError: `Autosave recovery failed: ${errorDetail(error)}`,
      }),
    });
  }
}

export interface AutosaveCoordinator {
  dispose(): void;
}

export function createAutosaveCoordinator(options: {
  readonly adapter: AutosaveRecoveryAdapter;
  readonly delayMs: number;
  readonly scheduler: AutosaveScheduler;
  readonly store: PlannerStore;
}): AutosaveCoordinator {
  let observedProject = selectPresentProject(options.store.getState());
  let observedRecoveryStatus = selectProfileSession(options.store.getState()).recoveryStatus;
  let cancelPending: (() => void) | null = null;

  const unsubscribe = options.store.subscribe(() => {
    const state = options.store.getState();
    const project = selectPresentProject(state);
    const recoveryStatus = selectProfileSession(state).recoveryStatus;
    const projectChanged = project !== observedProject;
    const recoveryUnblocked = observedRecoveryStatus === 'blocked' && recoveryStatus !== 'blocked';
    observedProject = project;
    observedRecoveryStatus = recoveryStatus;

    if (!projectChanged && !recoveryUnblocked) {
      return;
    }
    cancelPending?.();
    cancelPending = null;
    if (recoveryStatus === 'blocked') {
      return;
    }
    if (project === undefined) {
      return;
    }
    const snapshot = project;
    cancelPending = options.scheduler.schedule(options.delayMs, () => {
      cancelPending = null;
      try {
        options.adapter.write(encodeProjectDocument(snapshot));
        options.store.dispatch(autosaveWriteSucceeded());
      } catch (error) {
        options.store.dispatch(
          autosaveWriteFailed({ message: `Autosave failed: ${errorDetail(error)}` }),
        );
      }
    });
  });

  return Object.freeze({
    dispose(): void {
      unsubscribe();
      cancelPending?.();
      cancelPending = null;
    },
  });
}
