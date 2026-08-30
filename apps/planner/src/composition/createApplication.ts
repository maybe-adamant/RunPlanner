import { catalog } from '@run-planner/hades2-catalog';
import {
  simulateProjectAssembly,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import { summarizeCatalog } from '@run-planner/engine/catalog-schema';
import { type ProjectDocument } from '@run-planner/engine/authored-project';

import { createCandidateSessionFactory } from '../projections/candidateProjection';
import { createContextualOptionResolver } from '../projections/contextualOptions';
import { createContextualPickerProjection } from '../projections/contextualPicker';
import { createRewardPickerProjection } from '../projections/rewardPicker';
import { createTraitDomainProjection } from '../projections/traitDomainProjection';
import { createStructuredWorkspaceProjection } from '../projections/structured-workspace';
import {
  createAutosaveCoordinator,
  restoreStartupProject,
  type AutosaveRecoveryAdapter,
  type AutosaveScheduler,
} from '../persistence/autosaveRecovery';
import { createEditorNavigation } from '../projections/editorNavigation';
import { createEditorSessionReconciliationCoordinator } from '../workspace/editorSessionReconciliation';
import { createProjectOperations } from '../workspace/projectOperations';
import { allocateOccurrenceId, type OccurrenceIdFactory } from '../workspace/occurrenceIds';
import {
  createUnavailableProfileFileAdapter,
  type ProfileFileAdapter,
} from '../persistence/profileFile';
import { createPlannerStore } from '../state/store';

export interface CreateApplicationOptions {
  readonly allocateOccurrenceId?: OccurrenceIdFactory;
  readonly autosaveDelayMs?: number;
  readonly autosaveRecovery?: AutosaveRecoveryAdapter;
  readonly autosaveScheduler?: AutosaveScheduler;
  readonly profileFile?: ProfileFileAdapter;
  readonly observeEvaluationWork?: (event: ApplicationEvaluationEvent) => void;
}

export type ApplicationEvaluationEvent =
  | CandidateEvaluationEvent
  | {
      readonly kind: 'projectEvaluation';
      readonly project: ProjectDocument;
    };

export function createApplication(options: CreateApplicationOptions = {}) {
  if ((options.autosaveRecovery === undefined) !== (options.autosaveScheduler === undefined)) {
    throw new Error('Autosave recovery adapter and scheduler must be provided together');
  }
  const editorNavigation = createEditorNavigation(catalog);
  const startup = restoreStartupProject(catalog, options.autosaveRecovery);
  const evaluationCache = new WeakMap<
    ProjectDocument,
    ReturnType<typeof simulateProjectAssembly>
  >();
  const assembleProjectEvaluation = (project: ProjectDocument) => {
    const existing = evaluationCache.get(project);
    if (existing !== undefined) {
      return existing;
    }
    options.observeEvaluationWork?.(Object.freeze({ kind: 'projectEvaluation', project }));
    const assembly = simulateProjectAssembly(catalog, project);
    evaluationCache.set(project, assembly);
    return assembly;
  };
  const candidateSessions = createCandidateSessionFactory(
    catalog,
    options.observeEvaluationWork === undefined
      ? {}
      : { observeCandidateEvaluation: options.observeEvaluationWork },
  );
  const contextualOptions = createContextualOptionResolver(catalog);
  const contextualPicker = createContextualPickerProjection(contextualOptions);
  const rewardPicker = createRewardPickerProjection(catalog, contextualPicker);
  const traitDomain = createTraitDomainProjection(catalog, contextualPicker);
  const structuredWorkspace = createStructuredWorkspaceProjection(
    catalog,
    {
      candidateSessions,
      contextualPicker,
      rewardPicker,
      traitDomain,
    },
    options.allocateOccurrenceId ?? allocateOccurrenceId,
  );
  const store = createPlannerStore({
    catalog,
    assembleProjectEvaluation,
    initialProfileSession: startup.profileSession,
    ...(startup.project === undefined ? {} : { initialProject: startup.project }),
  });
  const editorSessionReconciliation = createEditorSessionReconciliationCoordinator({
    store,
    structuredWorkspace,
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
  const selectStructuredWorkspace = (state: ReturnType<typeof store.getState>) =>
    state.projectWorkspace.kind === 'openProject'
      ? structuredWorkspace.project(state.projectWorkspace.assembly)
      : undefined;

  return {
    catalog,
    catalogSummary: summarizeCatalog(catalog),
    editorNavigation,
    projectOperations,
    store,
    selectStructuredWorkspace,
    structuredWorkspace,
    dispose(): void {
      editorSessionReconciliation.dispose();
      autosaveCoordinator?.dispose();
    },
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
