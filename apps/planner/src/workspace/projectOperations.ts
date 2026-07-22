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
const reservedWindowsNames = new Set([
  'aux',
  'com1',
  'com2',
  'com3',
  'com4',
  'com5',
  'com6',
  'com7',
  'com8',
  'com9',
  'con',
  'lpt1',
  'lpt2',
  'lpt3',
  'lpt4',
  'lpt5',
  'lpt6',
  'lpt7',
  'lpt8',
  'lpt9',
  'nul',
  'prn',
]);

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

export function suggestedProfileFileName(projectName: string): string {
  const normalized = projectName
    .normalize('NFKD')
    .replace(/[\u0300-\u036f]/g, '')
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, '-')
    .replace(/^-+|-+$/g, '')
    .slice(0, 64)
    .replace(/-+$/g, '');
  const base = normalized.length === 0 ? 'run-plan' : normalized;
  const safeBase = reservedWindowsNames.has(base) ? `run-plan-${base}` : base;
  return `${safeBase}.runplanner.json`;
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
        const baselineJson = encodeProjectDocument(snapshot);
        const saveResult = await options.profileFile.save(
          suggestedProfileFileName(snapshot.name),
          baselineJson,
        );
        if (saveResult === 'cancelled') {
          return result('saveProfile', 'cancelled', 'Save Profile cancelled.');
        }
        options.store.dispatch(profileSaveSucceeded({ baselineJson }));
        return result('saveProfile', 'success', 'Saved the profile.');
      } catch (error) {
        return failure('saveProfile', error);
      }
    },
    async loadProfile(): Promise<ProjectOperationResult> {
      try {
        const json = await options.profileFile.load();
        if (json === null) {
          return result('loadProfile', 'cancelled', 'Load Profile cancelled.');
        }
        const project = parseProjectDocument(json, options.catalog);
        const baselineJson = encodeProjectDocument(project);
        if (selectProfileSession(options.store.getState()).recoveryStatus === 'blocked') {
          if (options.autosaveRecovery === undefined) {
            throw new Error('Autosave recovery is unavailable in this environment');
          }
          options.autosaveRecovery.clear();
        }
        options.store.dispatch(profileLoadSucceeded({ project, baselineJson }));
        return result('loadProfile', 'success', 'Loaded the profile.');
      } catch (error) {
        return failure('loadProfile', error);
      }
    },
  });
}
