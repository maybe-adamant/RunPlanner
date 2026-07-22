import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject, summarizeCatalog, type ProjectDocument } from '@run-planner/engine';

import {
  createApplicationCapabilities,
  createProjectSimulationScope,
} from './capabilityConfiguration';
import { createCandidateProjectionService } from './candidateProjection';
import {
  createAutosaveCoordinator,
  restoreStartupProject,
  type AutosaveRecoveryAdapter,
  type AutosaveScheduler,
} from './autosaveRecovery';
import { createEditorNavigation } from './editorNavigation';
import { createInitialProject } from './projectBootstrap';
import { createProjectOperations } from './projectOperations';
import { createUnavailableProfileFileAdapter, type ProfileFileAdapter } from './profileFile';
import { createPlannerStore } from './store';

export interface CreateApplicationOptions {
  readonly autosaveDelayMs?: number;
  readonly autosaveRecovery?: AutosaveRecoveryAdapter;
  readonly autosaveScheduler?: AutosaveScheduler;
  readonly profileFile?: ProfileFileAdapter;
}

export function createApplication(options: CreateApplicationOptions = {}) {
  if ((options.autosaveRecovery === undefined) !== (options.autosaveScheduler === undefined)) {
    throw new Error('Autosave recovery adapter and scheduler must be provided together');
  }
  const capabilities = createApplicationCapabilities(catalog);
  const simulationScope = createProjectSimulationScope(capabilities);
  const editorNavigation = createEditorNavigation(catalog, capabilities);
  const fallbackProject = createInitialProject(catalog, capabilities);
  const startup = restoreStartupProject(
    fallbackProject,
    catalog,
    capabilities,
    options.autosaveRecovery,
  );
  const evaluationCache = new WeakMap<ProjectDocument, ReturnType<typeof simulateProject>>();
  const evaluateProject = (project: ProjectDocument) => {
    const existing = evaluationCache.get(project);
    if (existing !== undefined) {
      return existing;
    }
    const evaluation = simulateProject(catalog, project, simulationScope);
    evaluationCache.set(project, evaluation);
    return evaluation;
  };
  const candidateProjection = createCandidateProjectionService(catalog, evaluateProject);
  const store = createPlannerStore({
    catalog,
    capabilities,
    evaluateProject,
    initialProfileSession: startup.profileSession,
    initialProject: startup.project,
  });
  const projectOperations = createProjectOperations({
    ...(options.autosaveRecovery === undefined
      ? {}
      : { autosaveRecovery: options.autosaveRecovery }),
    capabilities,
    catalog,
    profileFile: options.profileFile ?? createUnavailableProfileFileAdapter(),
    store,
  });
  const autosaveCoordinator =
    options.autosaveRecovery === undefined || options.autosaveScheduler === undefined
      ? undefined
      : createAutosaveCoordinator({
          adapter: options.autosaveRecovery,
          delayMs: options.autosaveDelayMs ?? 500,
          scheduler: options.autosaveScheduler,
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
    dispose(): void {
      autosaveCoordinator?.dispose();
    },
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
