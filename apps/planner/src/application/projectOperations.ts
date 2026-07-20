import { encodeProjectDocument, type Catalog } from '@run-planner/core';

import type { PlannerCapabilities } from './capabilities';
import { createInitialProject } from './projectBootstrap';
import { parseAuthorableProjectDocument } from './projectDocuments';
import type { ProjectPersistenceAdapters } from './projectPersistence';
import { authoredProjectReplaced } from './projectWorkspaceSlice';
import { selectPresentProject, type PlannerStore } from './store';

export type ProjectOperation = 'export' | 'import' | 'load' | 'new' | 'save';

export type ProjectOperationResult =
  | {
      readonly operation: ProjectOperation;
      readonly status: 'cancelled' | 'success';
      readonly message: string;
    }
  | {
      readonly operation: ProjectOperation;
      readonly status: 'failure';
      readonly message: string;
    };

export interface ProjectOperations {
  createNew(): ProjectOperationResult;
  save(): ProjectOperationResult;
  load(): ProjectOperationResult;
  exportJson(): ProjectOperationResult;
  importJson(): Promise<ProjectOperationResult>;
}

interface CreateProjectOperationsOptions {
  readonly adapters: ProjectPersistenceAdapters;
  readonly capabilities: PlannerCapabilities;
  readonly catalog: Catalog;
  readonly store: PlannerStore;
}

const exportFileName = 'run-planner-project.json';
const operationLabels: Readonly<Record<ProjectOperation, string>> = Object.freeze({
  export: 'Export',
  import: 'Import',
  load: 'Load',
  new: 'New project',
  save: 'Save',
});

function errorDetail(error: unknown): string {
  return error instanceof Error ? error.message : 'Unknown project operation failure';
}

function failure(operation: ProjectOperation, error: unknown): ProjectOperationResult {
  return Object.freeze({
    operation,
    status: 'failure',
    message: `${operationLabels[operation]} failed: ${errorDetail(error)}`,
  });
}

function success(operation: ProjectOperation, message: string): ProjectOperationResult {
  return Object.freeze({ operation, status: 'success', message });
}

export function createProjectOperations(
  options: CreateProjectOperationsOptions,
): ProjectOperations {
  const currentProject = () => selectPresentProject(options.store.getState());
  return Object.freeze({
    createNew(): ProjectOperationResult {
      try {
        options.store.dispatch(
          authoredProjectReplaced(createInitialProject(options.catalog, options.capabilities)),
        );
        return success('new', 'Created a new project.');
      } catch (error) {
        return failure('new', error);
      }
    },
    save(): ProjectOperationResult {
      try {
        options.adapters.storage.write(encodeProjectDocument(currentProject()));
        return success('save', 'Saved this project in the browser.');
      } catch (error) {
        return failure('save', error);
      }
    },
    load(): ProjectOperationResult {
      try {
        const json = options.adapters.storage.read();
        if (json === null) {
          throw new Error('No project has been saved in this browser');
        }
        const project = parseAuthorableProjectDocument(json, options.catalog, options.capabilities);
        options.store.dispatch(authoredProjectReplaced(project));
        return success('load', 'Loaded the saved browser project.');
      } catch (error) {
        return failure('load', error);
      }
    },
    exportJson(): ProjectOperationResult {
      try {
        options.adapters.transfer.download(exportFileName, encodeProjectDocument(currentProject()));
        return success('export', 'Downloaded the project JSON.');
      } catch (error) {
        return failure('export', error);
      }
    },
    async importJson(): Promise<ProjectOperationResult> {
      try {
        const json = await options.adapters.transfer.upload();
        if (json === null) {
          return Object.freeze({
            operation: 'import',
            status: 'cancelled',
            message: 'Import cancelled.',
          });
        }
        const project = parseAuthorableProjectDocument(json, options.catalog, options.capabilities);
        options.store.dispatch(authoredProjectReplaced(project));
        return success('import', 'Imported the project JSON.');
      } catch (error) {
        return failure('import', error);
      }
    },
  });
}
