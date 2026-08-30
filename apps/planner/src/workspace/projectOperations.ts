import {
  encodeProjectDocument,
  parseProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { compileExecutionPlan, encodeExecutionPlan } from '@run-planner/engine/execution-plan';

import type { AutosaveRecoveryAdapter } from '../persistence/autosaveRecovery';
import { createInitialProject } from '../composition/projectBootstrap';
import type { ProfileFileAdapter, ProfileFileReference } from '../persistence/profileFile';
import type { GamePlanDiscovery, GamePlanPublisher } from '../persistence/gamePlanPublisher';
import {
  newProjectCreated,
  profileLoadSucceeded,
  profileSaveSucceeded,
  recoveryDiscarded,
} from '../state/profileSessionSlice';
import type { PreparedProjectWorkspace } from '../state/projectWorkspaceSlice';
import { selectPresentProject, selectProfileSession, type PlannerStore } from '../state/store';

export type ProjectOperation =
  'discardRecovery' | 'exportRecovery' | 'loadProfile' | 'new' | 'publishGame' | 'saveProfile';

export type ProjectOperationResult = {
  readonly operation: ProjectOperation;
  readonly status: 'cancelled' | 'failure' | 'success';
  readonly message: string;
};

export interface ProjectOperations {
  createNew(routeKey: string): ProjectOperationResult;
  discardAutosaveRecovery(): ProjectOperationResult;
  exportAutosaveRecovery(): Promise<ProjectOperationResult>;
  readonly gamePlanAvailable: boolean;
  discoverGameProfiles(): Promise<GamePlanDiscovery>;
  publishGame(targetId: string): Promise<ProjectOperationResult>;
  saveProfile(): Promise<ProjectOperationResult>;
  loadProfile(): Promise<ProjectOperationResult>;
}

interface CreateProjectOperationsOptions {
  readonly autosaveRecovery?: AutosaveRecoveryAdapter;
  readonly catalog: Catalog;
  readonly profileFile: ProfileFileAdapter;
  readonly prepareProjectWorkspace: (project: ProjectDocument) => PreparedProjectWorkspace;
  readonly gamePlanPublisher?: GamePlanPublisher;
  readonly store: PlannerStore;
}

const operationLabels: Readonly<Record<ProjectOperation, string>> = Object.freeze({
  discardRecovery: 'Discard Autosave',
  exportRecovery: 'Export Autosave',
  loadProfile: 'Load Profile',
  new: 'New project',
  publishGame: 'Publish to Game',
  saveProfile: 'Save Profile',
});
export const DEFAULT_PROFILE_FILE_NAME = 'run-plan.runplanner.json';
export const DEFAULT_AUTOSAVE_EXPORT_FILE_NAME = 'run-planner-autosave.runplanner.json';

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
  let activeProfileFile: ProfileFileReference | null = null;
  const currentProject = () => selectPresentProject(options.store.getState());
  return Object.freeze({
    gamePlanAvailable: options.gamePlanPublisher !== undefined,
    createNew(routeKey: string): ProjectOperationResult {
      try {
        const project = createInitialProject(options.catalog, routeKey);
        activeProfileFile = null;
        options.store.dispatch(newProjectCreated(project));
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
    async exportAutosaveRecovery(): Promise<ProjectOperationResult> {
      try {
        if (options.autosaveRecovery === undefined) {
          throw new Error('Autosave recovery is unavailable in this environment');
        }
        const json = options.autosaveRecovery.read();
        if (json === null) {
          throw new Error('No autosave recovery copy is available');
        }
        const exported = await options.profileFile.saveAs(DEFAULT_AUTOSAVE_EXPORT_FILE_NAME, json);
        if (exported === null) {
          return result('exportRecovery', 'cancelled', 'Export Autosave cancelled.');
        }
        return result('exportRecovery', 'success', 'Exported the autosave copy.');
      } catch (error) {
        return failure('exportRecovery', error);
      }
    },
    async discoverGameProfiles(): Promise<GamePlanDiscovery> {
      if (options.gamePlanPublisher === undefined) {
        return Object.freeze({
          status: 'unavailable',
          targets: Object.freeze([]),
          message: 'Publish to Game is available only in the desktop application.',
        });
      }
      try {
        return await options.gamePlanPublisher.discoverProfiles();
      } catch (error) {
        return Object.freeze({
          status: 'unavailable',
          targets: Object.freeze([]),
          message: `Could not inspect game profiles: ${errorDetail(error)}`,
        });
      }
    },
    async publishGame(targetId: string): Promise<ProjectOperationResult> {
      try {
        if (options.gamePlanPublisher === undefined) {
          throw new Error('Publish to Game is unavailable in this environment');
        }
        const workspace = options.store.getState().projectWorkspace;
        if (workspace.kind !== 'openProject') throw new Error('No project is open');
        const plan = compileExecutionPlan({ assembly: workspace.assembly });
        const publication = await options.gamePlanPublisher.publish(
          targetId,
          encodeExecutionPlan(plan),
        );
        return result(
          'publishGame',
          publication.status === 'published' ? 'success' : 'failure',
          publication.message,
        );
      } catch (error) {
        return failure('publishGame', error);
      }
    },
    async saveProfile(): Promise<ProjectOperationResult> {
      try {
        const snapshot = currentProject();
        if (snapshot === undefined) {
          throw new Error('No project is open');
        }
        const suggestedFileName =
          selectProfileSession(options.store.getState()).fileName ?? DEFAULT_PROFILE_FILE_NAME;
        const baselineJson = encodeProjectDocument(snapshot);
        let savedFile = activeProfileFile;
        if (savedFile === null) {
          savedFile = await options.profileFile.saveAs(suggestedFileName, baselineJson);
          if (savedFile === null) {
            return result('saveProfile', 'cancelled', 'Save Profile cancelled.');
          }
        } else {
          await savedFile.write(baselineJson);
        }
        activeProfileFile = savedFile;
        options.store.dispatch(
          profileSaveSucceeded({ baselineJson, fileName: savedFile.fileName }),
        );
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
        const fileName = loadedProfileFileName(loaded.file.fileName);
        const prepared = options.prepareProjectWorkspace(project);
        if (selectProfileSession(options.store.getState()).recoveryStatus === 'blocked') {
          if (options.autosaveRecovery === undefined) {
            throw new Error('Autosave recovery is unavailable in this environment');
          }
          options.autosaveRecovery.clear();
        }
        options.store.dispatch(
          profileLoadSucceeded({
            assembly: prepared.assembly,
            project,
            baselineJson,
            fileName,
          }),
        );
        activeProfileFile = loaded.file;
        return result('loadProfile', 'success', 'Loaded the profile.');
      } catch (error) {
        return failure('loadProfile', error);
      }
    },
  });
}
