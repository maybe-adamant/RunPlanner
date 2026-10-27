import { catalog } from '@run-planner/hades2-catalog';
import {
  simulateProjectAssembly,
  type CandidateEvaluationEvent,
} from '@run-planner/engine/simulation';
import { summarizeCatalog } from '@run-planner/engine/catalog-schema';
import { type ProjectDocument } from '@run-planner/engine/authored-project';
import { runRecordSavedValuePaths } from '@run-planner/engine/run-record';

import { createCandidateSessionFactory } from '../projections/candidates/candidateProjection';
import { createContextualOptionResolver } from '../projections/contextual/contextualOptions';
import { createContextualPickerProjection } from '../projections/contextual/contextualPicker';
import { createRewardPickerProjection } from '../projections/rewards/rewardPicker';
import { createTraitDomainProjection } from '../projections/rewards/traitDomainProjection';
import { createStructuredWorkspaceProjection } from '../projections/structured-workspace';
import { assertPublicProjectAdmission } from '../workspace/project-admission';
import { createEditorNavigation } from '../projections/editorNavigation';
import { createEditorSessionReconciliationCoordinator } from '../workspace/editorSessionReconciliation';
import { createProjectOperations } from '../workspace/projectOperations';
import { createProjectLibraryOperations } from '../workspace/projectLibrary';
import { createCatalogFeedController } from '../workspace/catalogFeed';
import type { CatalogFeedHost } from '../persistence/catalogFeedHost';
import type { RecordHost, RecordingPreference } from '../persistence/recordHost';
import { createRecordingController } from '../workspace/run-recording/recordingController';
import { createInProcessRunImporter, type RunImporter } from '../workspace/run-recording/runImport';
import { prebossRoomsByBiome } from '../workspace/run-recording/runRecorder';
import { createLibrarySaver, type SaveScheduler } from '../workspace/librarySave';
import { createCloseRequestController } from '../workspace/closeRequest';
import type { ProjectLibraryAdapter } from '../persistence/projectLibrary';
import type { LegacyAutosave } from '../persistence/legacyAutosave';
import { createBugReportOperations } from '../workspace/bugReport';
import {
  createCommunityEventController,
  type EventDismissalPreference,
} from '../workspace/communityEvents';
import { allocateOccurrenceId, type OccurrenceIdFactory } from '../workspace/occurrenceIds';
import { createGameStatusController, type GameModuleHost } from '../persistence/gameModuleHost';
import type {
  CommunityEventDevelopmentHost,
  CommunityEventHost,
} from '../persistence/communityEventHost';
import { createPlannerStore } from '../state/store';
import type { PreparedProjectWorkspace } from '../state/projectWorkspaceSlice';
import { createSlotRebuildController } from '../workspace/slotRebuild';
import {
  createDraftRunController,
  createInProcessDraftRunner,
  type DraftRunner,
} from '../workspace/draftRun';
import { createDevelopmentBuildIdentity, type BuildIdentity } from './buildIdentity';

export interface CreateApplicationOptions {
  readonly allocateOccurrenceId?: OccurrenceIdFactory;
  readonly buildIdentity?: BuildIdentity;
  /**
   * Authors `internal` run modifiers and keeps recorded runs' raw saves; defaults to the Vite
   * development build flag.
   */
  readonly devBuild?: boolean;
  /** Where plans are stored; every edit of the open plan is written there. */
  readonly projectLibrary?: ProjectLibraryAdapter;
  /** The autosave kept before the library, offered once for import. */
  readonly legacyAutosave?: LegacyAutosave;
  /** Debounces those writes; defaults to timers. */
  readonly saveScheduler?: SaveScheduler;
  readonly saveDelayMs?: number;
  readonly gameModuleHost?: GameModuleHost;
  /** The signed community event feed; given with the game module host. */
  readonly communityEventHost?: CommunityEventHost;
  /** The signed plan catalog; desktop only. */
  readonly catalogFeedHost?: CatalogFeedHost;
  /** The Hades II save watch and recent-runs store; desktop only. */
  readonly recordHost?: RecordHost;
  /** Recording on or off and the chosen save folder; given with the record host. */
  readonly recordingPreference?: RecordingPreference;
  /** Builds and imports recorded runs; defaults to the calling thread. */
  readonly runImporter?: RunImporter;
  /** Local event files and export; used only in development builds. */
  readonly communityEventDevelopmentHost?: CommunityEventDevelopmentHost;
  readonly eventDismissals?: EventDismissalPreference;
  readonly mintProjectId?: () => string;
  readonly observeEvaluationWork?: (event: ApplicationEvaluationEvent) => void;
  /** Runs draft searches; defaults to the calling thread. */
  readonly draftRunner?: DraftRunner;
  readonly rerollSeed?: () => number;
}

export type ApplicationEvaluationEvent =
  | CandidateEvaluationEvent
  | {
      readonly kind: 'projectEvaluation';
      readonly project: ProjectDocument;
    };

export function createApplication(options: CreateApplicationOptions = {}) {
  const editorNavigation = createEditorNavigation(catalog);
  const rerollSeed = options.rerollSeed ?? (() => Math.floor(Math.random() * 1_000_000));
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
  // Internal run modifiers and the event file actions: dev builds, or a release build made with
  // VITE_INTERNAL_FEATURES=1.
  const devBuild =
    options.devBuild ?? (import.meta.env.DEV || import.meta.env.VITE_INTERNAL_FEATURES === '1');
  const structuredWorkspace = createStructuredWorkspaceProjection(
    catalog,
    {
      candidateSessions,
      contextualPicker,
      rewardPicker,
      traitDomain,
    },
    options.allocateOccurrenceId ?? allocateOccurrenceId,
    { devBuild },
  );
  const prepareProjectWorkspace = (project: ProjectDocument): PreparedProjectWorkspace => {
    assertPublicProjectAdmission(catalog, project);
    const assembly = assembleProjectEvaluation(project);
    const workspace = structuredWorkspace.project(assembly);
    if (editorNavigation.routes.byKey[workspace.route.routeKey] === undefined) {
      throw new Error(`Editor navigation references unavailable route ${workspace.route.routeKey}`);
    }
    return Object.freeze({ assembly, project });
  };
  const store = createPlannerStore({ catalog, assembleProjectEvaluation });
  const draftRun = createDraftRunController({
    catalog,
    store,
    runner: options.draftRunner ?? createInProcessDraftRunner(catalog),
    randomSeed: rerollSeed,
  });
  const editorSessionReconciliation = createEditorSessionReconciliationCoordinator({
    store,
    structuredWorkspace,
  });
  const libraryOperations =
    options.projectLibrary === undefined
      ? undefined
      : createProjectLibraryOperations({
          adapter: options.projectLibrary,
          catalog,
          ...(options.legacyAutosave === undefined
            ? {}
            : { legacyAutosave: options.legacyAutosave }),
          ...(options.mintProjectId === undefined ? {} : { mintProjectId: options.mintProjectId }),
        });
  const librarySaver =
    options.projectLibrary === undefined || libraryOperations === undefined
      ? undefined
      : createLibrarySaver({
          adapter: options.projectLibrary,
          delayMs: options.saveDelayMs ?? 400,
          scheduler: options.saveScheduler ?? {
            schedule: (delayMs, task) => {
              const handle = globalThis.setTimeout(task, delayMs);
              return () => globalThis.clearTimeout(handle);
            },
          },
          store,
        });
  const projectOperations = createProjectOperations({
    catalog,
    devBuild,
    ...(libraryOperations === undefined || librarySaver === undefined
      ? {}
      : { library: { operations: libraryOperations, saver: librarySaver } }),
    prepareProjectWorkspace,
    ...(options.gameModuleHost === undefined ? {} : { gamePlanPublisher: options.gameModuleHost }),
    ...(options.mintProjectId === undefined ? {} : { mintProjectId: options.mintProjectId }),
    store,
  });
  const startupReady = projectOperations.restoreStartup();
  const closeRequest = createCloseRequestController(() => projectOperations.flush());
  const selectStructuredWorkspace = (state: ReturnType<typeof store.getState>) =>
    state.projectWorkspace.kind === 'openProject'
      ? structuredWorkspace.project(state.projectWorkspace.assembly)
      : undefined;

  const gameStatus =
    options.gameModuleHost === undefined
      ? undefined
      : createGameStatusController(options.gameModuleHost);
  const gameModuleHost = options.gameModuleHost;
  const dismissed = new Set<string>();
  const communityEvents =
    options.communityEventHost === undefined || gameModuleHost === undefined
      ? undefined
      : createCommunityEventController({
          catalog,
          host: options.communityEventHost,
          // Filling the event slot from a local event folder is a development action.
          ...(devBuild && options.communityEventDevelopmentHost !== undefined
            ? { development: options.communityEventDevelopmentHost }
            : {}),
          dismissals: options.eventDismissals ?? {
            isDismissed: (eventId) => dismissed.has(eventId),
            dismiss: (eventId) => void dismissed.add(eventId),
          },
          openProjectCopy: (json, title) => projectOperations.openProjectCopy(json, title),
          setActiveSlot: (slot) => gameModuleHost.setActiveSlot(slot),
          onSlotsChanged: () =>
            gameStatus?.refresh().catch(() => {
              // The header indicator reports a failed status read.
            }),
        });
  const planCatalog =
    options.catalogFeedHost === undefined || libraryOperations === undefined
      ? undefined
      : createCatalogFeedController({
          host: options.catalogFeedHost,
          addCatalogPlan: (entry, json) =>
            projectOperations.addLibraryCopy({ key: entry.id, title: entry.title }, json),
        });
  const slotRebuild =
    gameModuleHost === undefined
      ? undefined
      : createSlotRebuildController({
          catalog,
          devBuild,
          host: gameModuleHost,
          onSlotsChanged: () =>
            gameStatus?.refresh().catch(() => {
              // The header indicator reports a failed status read.
            }),
        });
  const recording =
    options.recordHost === undefined
      ? undefined
      : createRecordingController({
          host: options.recordHost,
          preference: options.recordingPreference ?? memoryRecordingPreference(),
          store,
          importer: options.runImporter ?? createInProcessRunImporter(catalog),
          prebossRooms: prebossRoomsByBiome(catalog),
          savedValuePaths: runRecordSavedValuePaths(catalog),
          // Raw saves are kept for importer work in development builds only.
          ...(devBuild ? { rawSaves: options.recordHost.rawSaves } : {}),
        });
  const buildIdentity = options.buildIdentity ?? createDevelopmentBuildIdentity();
  const catalogSummary = summarizeCatalog(catalog);

  return {
    buildIdentity,
    bugReport:
      options.gameModuleHost === undefined
        ? undefined
        : createBugReportOperations({
            buildIdentity,
            catalogVersion: catalogSummary.version,
            host: options.gameModuleHost,
            inspectCurrentGamePlan: () => projectOperations.inspectCurrentGamePlan(),
            ...(slotRebuild === undefined
              ? {}
              : { slotRebuildReport: () => slotRebuild.getSnapshot() }),
            store,
          }),
    catalog,
    catalogSummary,
    closeRequest,
    editorNavigation,
    communityEvents,
    draftRun,
    gameStatus,
    planCatalog,
    projectLibrary: libraryOperations,
    projectOperations,
    recording,
    slotRebuild,
    store,
    selectStructuredWorkspace,
    structuredWorkspace,
    startupReady,
    dispose(): void {
      editorSessionReconciliation.dispose();
      draftRun.dispose();
      librarySaver?.dispose();
      communityEvents?.dispose();
      recording?.dispose();
    },
  };
}

function memoryRecordingPreference(): RecordingPreference {
  let value = { enabled: false, folder: null as string | null };
  return {
    read: () => value,
    write: (next) => void (value = { enabled: next.enabled, folder: next.folder }),
  };
}

export type PlannerApplication = ReturnType<typeof createApplication>;
