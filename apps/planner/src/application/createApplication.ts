import { catalog } from '@run-planner/catalog';
import { simulateProject, summarizeCatalog, type ProjectDocument } from '@run-planner/core';

import { createApplicationCapabilities } from './capabilityConfiguration';
import { createCandidateProjectionService } from './candidateProjection';
import { createEditorNavigation } from './editorNavigation';
import { createInitialProject } from './projectBootstrap';
import { createProjectOperations } from './projectOperations';
import {
  createDefaultProjectPersistenceAdapters,
  type ProjectPersistenceAdapters,
} from './projectPersistence';
import { createPlannerStore } from './store';

export interface CreateApplicationOptions {
  readonly projectPersistence?: ProjectPersistenceAdapters;
}

export function createApplication(options: CreateApplicationOptions = {}) {
  const capabilities = createApplicationCapabilities(catalog);
  const candidateProjection = createCandidateProjectionService(catalog);
  const editorNavigation = createEditorNavigation(catalog, capabilities);
  const initialProject = createInitialProject(catalog, capabilities);
  const evaluateProject = (project: ProjectDocument) => simulateProject(catalog, project);
  const store = createPlannerStore({ catalog, capabilities, evaluateProject, initialProject });
  const projectOperations = createProjectOperations({
    adapters: options.projectPersistence ?? createDefaultProjectPersistenceAdapters(),
    capabilities,
    catalog,
    store,
  });

  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    capabilities,
    candidateProjection,
    editorNavigation,
    projectOperations,
    store,
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
