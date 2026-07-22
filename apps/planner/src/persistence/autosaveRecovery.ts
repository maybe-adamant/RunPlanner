import {
  encodeProjectDocument,
  parseProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';

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

export interface StartupProjectState {
  readonly project: ProjectDocument;
  readonly profileSession: ProfileSessionState;
}

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown autosave recovery failure';
}

export function restoreStartupProject(
  fallbackProject: ProjectDocument,
  catalog: Catalog,
  recovery: AutosaveRecoveryAdapter | undefined,
): StartupProjectState {
  if (recovery === undefined) {
    return Object.freeze({
      project: fallbackProject,
      profileSession: createInitialProfileSessionState(),
    });
  }
  try {
    const json = recovery.read();
    if (json === null) {
      return Object.freeze({
        project: fallbackProject,
        profileSession: createInitialProfileSessionState(),
      });
    }
    return Object.freeze({
      project: parseProjectDocument(json, catalog),
      profileSession: createInitialProfileSessionState({ recoveryStatus: 'recovered' }),
    });
  } catch (error) {
    return Object.freeze({
      project: fallbackProject,
      profileSession: createInitialProfileSessionState({
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
