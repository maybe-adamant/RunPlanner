import { catalog } from '@run-planner/catalog';
import { simulateProject, summarizeCatalog, type ProjectDocument } from '@run-planner/core';

import {
  createApplicationCapabilities,
  createProjectSimulationScope,
} from './capabilityConfiguration';
import { createCandidateProjectionService } from './candidateProjection';
import { createEditorNavigation } from './editorNavigation';
import { createInitialProject } from './projectBootstrap';
import { createProjectOperations } from './projectOperations';
import { createUnavailableProfileFileAdapter, type ProfileFileAdapter } from './profileFile';
import { createPlannerStore } from './store';

export interface CreateApplicationOptions {
  readonly profileFile?: ProfileFileAdapter;
}

export function createApplication(options: CreateApplicationOptions = {}) {
  const capabilities = createApplicationCapabilities(catalog);
  const simulationScope = createProjectSimulationScope(capabilities);
  const candidateProjection = createCandidateProjectionService(catalog, simulationScope);
  const editorNavigation = createEditorNavigation(catalog, capabilities);
  const initialProject = createInitialProject(catalog, capabilities);
  const evaluateProject = (project: ProjectDocument) =>
    simulateProject(catalog, project, simulationScope);
  const store = createPlannerStore({ catalog, capabilities, evaluateProject, initialProject });
  const projectOperations = createProjectOperations({
    capabilities,
    catalog,
    profileFile: options.profileFile ?? createUnavailableProfileFileAdapter(),
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
