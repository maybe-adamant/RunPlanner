import { encodeProjectDocument, parseProjectDocument } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';

import type { AutosaveRecoveryAdapter } from '../persistence/autosaveRecovery';
import { createInitialProject } from '../composition/projectBootstrap';
import type { ProfileFileAdapter } from '../persistence/profileFile';
import {
  newProjectCreated,
  profileLoadSucceeded,
  profileSaveSucceeded,
  recoveryDiscarded,
} from '../state/profileSessionSlice';
import { selectPresentProject, selectProfileSession, type PlannerStore } from '../state/store';

export type ProjectOperation = 'discardRecovery' | 'loadProfile' | 'new' | 'saveProfile';

export type ProjectOperationResult = {
  readonly operation: ProjectOperation;
  readonly status: 'cancelled' | 'failure' | 'success';
  readonly message: string;
};

export interface ProjectOperations {
  createNew(): ProjectOperationResult;
  discardAutosaveRecovery(): ProjectOperationResult;
  saveProfile(): Promise<ProjectOperationResult>;
  loadProfile(): Promise<ProjectOperationResult>;
}

interface CreateProjectOperationsOptions {
  readonly autosaveRecovery?: AutosaveRecoveryAdapter;
  readonly catalog: Catalog;
  readonly profileFile: ProfileFileAdapter;
  readonly store: PlannerStore;
}

const operationLabels: Readonly<Record<ProjectOperation, string>> = Object.freeze({
  discardRecovery: 'Discard Autosave',
  loadProfile: 'Load Profile',
  new: 'New project',
  saveProfile: 'Save Profile',
});
export const DEFAULT_PROFILE_FILE_NAME = 'run-plan.runplanner.json';

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown project operation failure';
}

function result(
  operation: ProjectOperation,
  status: ProjectOperationResult['status'],
  message: string,
): ProjectOperationResult {
  return Object.freeze({ operation, status, message });
}

function failure(operation: ProjectOperation, error: unknown): ProjectOperationResult {
  return result(
    operation,
    'failure',
    `${operationLabels[operation]} failed: ${errorDetail(error)}`,
  );
}

function loadedProfileFileName(fileName: string): string {
  if (fileName.trim().length === 0) {
    throw new Error('Loaded profile filename must be non-blank');
  }
  return fileName;
}

export function createProjectOperations(
  options: CreateProjectOperationsOptions,
): ProjectOperations {
  const currentProject = () => selectPresentProject(options.store.getState());
  return Object.freeze({
    createNew(): ProjectOperationResult {
      try {
        options.store.dispatch(newProjectCreated(createInitialProject(options.catalog)));
        return result('new', 'success', 'Created a new project.');
      } catch (error) {
        return failure('new', error);
      }
    },
    discardAutosaveRecovery(): ProjectOperationResult {
      try {
        if (selectProfileSession(options.store.getState()).recoveryStatus !== 'blocked') {
          throw new Error('No unreadable autosave is awaiting discard');
        }
        if (options.autosaveRecovery === undefined) {
          throw new Error('Autosave recovery is unavailable in this environment');
        }
        options.autosaveRecovery.clear();
        options.store.dispatch(recoveryDiscarded());
        return result('discardRecovery', 'success', 'Discarded the unreadable autosave.');
      } catch (error) {
        return failure('discardRecovery', error);
      }
    },
    async saveProfile(): Promise<ProjectOperationResult> {
      try {
        const snapshot = currentProject();
        const fileName =
          selectProfileSession(options.store.getState()).fileName ?? DEFAULT_PROFILE_FILE_NAME;
        const baselineJson = encodeProjectDocument(snapshot);
        const saveResult = await options.profileFile.save(fileName, baselineJson);
        if (saveResult === 'cancelled') {
          return result('saveProfile', 'cancelled', 'Save Profile cancelled.');
        }
        options.store.dispatch(profileSaveSucceeded({ baselineJson, fileName }));
        return result('saveProfile', 'success', 'Saved the profile.');
      } catch (error) {
        return failure('saveProfile', error);
      }
    },
    async loadProfile(): Promise<ProjectOperationResult> {
      try {
        const loaded = await options.profileFile.load();
        if (loaded === null) {
          return result('loadProfile', 'cancelled', 'Load Profile cancelled.');
        }
        const project = parseProjectDocument(loaded.json, options.catalog);
        const baselineJson = encodeProjectDocument(project);
        const fileName = loadedProfileFileName(loaded.fileName);
        if (selectProfileSession(options.store.getState()).recoveryStatus === 'blocked') {
          if (options.autosaveRecovery === undefined) {
            throw new Error('Autosave recovery is unavailable in this environment');
          }
          options.autosaveRecovery.clear();
        }
        options.store.dispatch(profileLoadSucceeded({ project, baselineJson, fileName }));
        return result('loadProfile', 'success', 'Loaded the profile.');
      } catch (error) {
        return failure('loadProfile', error);
      }
    },
  });
}
