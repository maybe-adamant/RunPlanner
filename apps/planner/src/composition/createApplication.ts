import { catalog } from '@run-planner/hades2-catalog';
import { simulateProject } from '@run-planner/engine/simulation';
import { summarizeCatalog } from '@run-planner/engine/catalog-schema';
import { type ProjectDocument } from '@run-planner/engine/authored-project';

import { createCandidateProjectionService } from '../projections/candidateProjection';
import {
  createAutosaveCoordinator,
  restoreStartupProject,
  type AutosaveRecoveryAdapter,
  type AutosaveScheduler,
} from '../persistence/autosaveRecovery';
import { createEditorNavigation } from '../projections/editorNavigation';
import { createInitialProject } from './projectBootstrap';
import { createProjectOperations } from '../workspace/projectOperations';
import {
  createUnavailableProfileFileAdapter,
  type ProfileFileAdapter,
} from '../persistence/profileFile';
import { createPlannerStore } from '../state/store';

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
  const editorNavigation = createEditorNavigation(catalog);
  const fallbackProject = createInitialProject(catalog);
  const startup = restoreStartupProject(fallbackProject, catalog, options.autosaveRecovery);
  const evaluationCache = new WeakMap<ProjectDocument, ReturnType<typeof simulateProject>>();
  const evaluateProject = (project: ProjectDocument) => {
    const existing = evaluationCache.get(project);
    if (existing !== undefined) {
      return existing;
    }
    const evaluation = simulateProject(catalog, project);
    evaluationCache.set(project, evaluation);
    return evaluation;
  };
  const candidateProjection = createCandidateProjectionService(catalog, evaluateProject);
  const store = createPlannerStore({
    catalog,
    evaluateProject,
    initialProfileSession: startup.profileSession,
    initialProject: startup.project,
  });
  const projectOperations = createProjectOperations({
    ...(options.autosaveRecovery === undefined
      ? {}
      : { autosaveRecovery: options.autosaveRecovery }),
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
