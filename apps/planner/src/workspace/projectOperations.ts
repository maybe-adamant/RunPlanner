import {
  applyProjectCommand,
  assessPublicDreamItinerary,
  createProjectAddress,
  createProjectHistory,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  PROJECT_NAME_MAX,
  reidentifyProjectHistory,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';

import { createInitialProject } from '../composition/projectBootstrap';
import type { GamePlanPublisher, GamePlanSlotNumber } from '../persistence/gameModuleHost';
import type { OutsideProjectFile } from '../persistence/projectLibrary';
import { describePublicationBlocker } from '../projections/gamePanel';
import { projectGameSlotSummary } from '../projections/gameSlotSummary';
import { encodeSlotSource } from '../persistence/slotSource';
import { libraryOpenFailed, previousFileOffered } from '../state/librarySessionSlice';
import {
  authoredProjectReplaced,
  authoredProjectReverted,
  type PreparedProjectWorkspace,
} from '../state/projectWorkspaceSlice';
import {
  gamePlanSent,
  gameSendFailed,
  gameSendStarted,
  gameSentSlotNotActivated,
} from '../state/gameSendSessionSlice';
import { selectPresentProject, type PlannerStore } from '../state/store';
import type { LibrarySaver } from './librarySave';
import {
  mintRandomProjectId,
  type FiledPlan,
  type ProjectLibraryOperations,
} from './projectLibrary';

export type ProjectOperation =
  | 'duplicate'
  | 'importPlan'
  | 'importPrevious'
  | 'new'
  | 'openCopy'
  | 'openPlan'
  | 'publishGame'
  | 'revert';

export type CurrentGamePlan =
  | { readonly kind: 'noProject' }
  | {
      readonly kind: 'notPublishable';
      /** The compiler's reason, or null when compiling failed for another reason. */
      readonly code: ExecutionCompilerError['code'] | null;
      readonly startPointReason?: ExecutionCompilerError['startPointReason'];
    }
  | {
      readonly kind: 'publishable';
      readonly projectId: string;
      readonly planFingerprint: string;
    };

const NO_PROJECT_PLAN: CurrentGamePlan = Object.freeze({ kind: 'noProject' });

export type ProjectOperationResult = {
  readonly operation: ProjectOperation;
  readonly status: 'cancelled' | 'failure' | 'success';
  readonly message: string;
};

export interface ProjectOperations {
  /** Creates a library plan for the route and opens it. */
  createNew(
    routeKey: string,
    itineraryBiomeKeys?: readonly string[],
  ): Promise<ProjectOperationResult>;
  /** Imports a file the user picks into the library and opens the copy. */
  importPlan(): Promise<ProjectOperationResult>;
  openPlan(key: string): Promise<ProjectOperationResult>;
  /** Files the open plan as a new plan named as its copy, with its own identity, and opens it. */
  duplicate(): Promise<ProjectOperationResult>;
  /** Returns the open plan to the document it was opened as, as one undoable step. */
  revertToOpened(): ProjectOperationResult;
  /** Files a project document as a new plan with its own identity and opens it. */
  openProjectCopy(json: string): Promise<ProjectOperationResult>;
  /** Imports the file open before the library, once offered, and opens it. */
  acceptPreviousFile(): Promise<ProjectOperationResult>;
  declinePreviousFile(): Promise<void>;
  /** Reopens the plan open at the last close and offers the pre-library file. */
  restoreStartup(): Promise<void>;
  /** The next start opens no plan; every plan stays in the library. */
  forgetLastOpened(): Promise<void>;
  /** Whether the current project compiles to an execution plan, and its fingerprint. */
  inspectCurrentGamePlan(): CurrentGamePlan;
  publishGame(slotNumber: GamePlanSlotNumber): Promise<ProjectOperationResult>;
  /** Writes the open plan's pending edits, before the planner closes or updates. */
  flush(): Promise<{ readonly status: 'failure' | 'success'; readonly message: string }>;
}

interface CreateProjectOperationsOptions {
  readonly catalog: Catalog;
  /** Internal-stage run modifiers take part in publication only in a development build. */
  readonly devBuild?: boolean;
  /** The library and the writer of its open plan; absent where nothing is stored. */
  readonly library?: {
    readonly operations: ProjectLibraryOperations;
    readonly saver: LibrarySaver;
  };
  readonly prepareProjectWorkspace: (project: ProjectDocument) => PreparedProjectWorkspace;
  readonly gamePlanPublisher?: GamePlanPublisher;
  /** Mints the identity a copy takes; injectable for deterministic tests. */
  readonly mintProjectId?: () => string;
  readonly store: PlannerStore;
}

const operationLabels: Readonly<Record<ProjectOperation, string>> = Object.freeze({
  duplicate: 'Duplicate',
  importPlan: 'Open file',
  importPrevious: 'Import',
  new: 'New plan',
  openCopy: 'Open project',
  openPlan: 'Open plan',
  publishGame: 'Send to game',
  revert: 'Revert to opened',
});
const COPY_SUFFIX = ' (copy)';

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

/** "X (copy)", shortened so it stays a valid plan name. */
function copyName(name: string): string {
  const room = PROJECT_NAME_MAX - Array.from(COPY_SUFFIX).length;
  return `${Array.from(name).slice(0, room).join('').trimEnd()}${COPY_SUFFIX}`;
}

export function createProjectOperations(
  options: CreateProjectOperationsOptions,
): ProjectOperations {
  const currentPlans = new WeakMap<object, CurrentGamePlan>();
  const internalRunModifiers = options.devBuild ?? false;
  const mintProjectId = options.mintProjectId ?? mintRandomProjectId;
  let previousFile: OutsideProjectFile | null = null;
  const library = () => {
    if (options.library === undefined) {
      throw new Error('The plan library is unavailable in this environment');
    }
    return options.library.operations;
  };
  const saver = () => {
    if (options.library === undefined) {
      throw new Error('The plan library is unavailable in this environment');
    }
    return options.library.saver;
  };
  /** Opens a filed plan, after writing the open one's pending edits. */
  const openFiled = async (
    operation: ProjectOperation,
    plan: FiledPlan,
    message: string,
  ): Promise<ProjectOperationResult> => {
    const prepared = options.prepareProjectWorkspace(plan.project);
    await saver().open(
      plan.key,
      () => options.store.dispatch(authoredProjectReplaced(prepared.project)),
      { preserveOriginal: plan.olderOnDisk },
    );
    await library().rememberOpened({ key: plan.key, projectId: plan.project.projectId });
    return result(
      operation,
      'success',
      plan.migrationProvenance.length === 0
        ? message
        : migratedPlanMessage(plan.project, plan.migrationProvenance),
    );
  };
  const sendToGame = async (slotNumber: GamePlanSlotNumber): Promise<ProjectOperationResult> => {
    try {
      if (options.gamePlanPublisher === undefined) {
        throw new Error('Publish to Game is unavailable in this environment');
      }
      const workspace = options.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') throw new Error('No project is open');
      const project = workspace.history.present;
      const plan = compileExecutionPlan({
        product: assembleExecutionProduct({
          assembly: workspace.assembly,
          catalog: options.catalog,
          internalRunModifiers,
        }),
        displayName: project.name,
      });
      // The document and the options it compiled with, so the slot can be rebuilt.
      const source = encodeSlotSource({
        internalRunModifiers,
        projectJson: encodeProjectDocument(project),
      });
      const publication = await options.gamePlanPublisher.publish(
        slotNumber,
        encodeExecutionPlan(plan),
        source,
        projectGameSlotSummary(plan, options.catalog, new Date()),
      );
      if (publication.status !== 'published') {
        return result(
          'publishGame',
          'failure',
          publication.blockers.length > 0
            ? publication.blockers.map(describePublicationBlocker).join(' ')
            : publication.message,
        );
      }
      options.store.dispatch(gamePlanSent({ slot: slotNumber }));
      if (publication.activationProblem !== null) {
        options.store.dispatch(
          gameSentSlotNotActivated({
            slot: slotNumber,
            message: publication.activationProblem,
            atMs: Date.now(),
          }),
        );
      }
      return result('publishGame', 'success', `Published to game, Slot ${slotNumber}.`);
    } catch (error) {
      return failure('publishGame', error);
    }
  };

  return Object.freeze({
    async createNew(
      routeKey: string,
      itineraryBiomeKeys?: readonly string[],
    ): Promise<ProjectOperationResult> {
      try {
        const route = options.catalog.routes.byKey[routeKey];
        if (
          route === undefined ||
          (route.key !== 'Underworld' &&
            route.key !== 'Surface' &&
            route.key !== 'Dream' &&
            route.key !== 'FreshFile')
        )
          throw new Error(`Route ${routeKey} is not available for new projects`);
        if (route.key === 'Dream') {
          const assessment = assessPublicDreamItinerary(options.catalog, itineraryBiomeKeys ?? []);
          if (!assessment.legal) {
            throw new Error('Dream Dive requires four biomes in a valid route order');
          }
        } else if (itineraryBiomeKeys !== undefined) {
          throw new Error(`${route.label} uses a fixed route order`);
        }
        const project = createInitialProject(options.catalog, {
          projectId: mintProjectId(),
          routeKey,
          ...(itineraryBiomeKeys === undefined ? {} : { itineraryBiomeKeys }),
        });
        options.prepareProjectWorkspace(project);
        return await openFiled('new', await library().create(project), 'Created a new plan.');
      } catch (error) {
        return failure('new', error);
      }
    },
    async importPlan(): Promise<ProjectOperationResult> {
      try {
        const plan = await library().importChosenFile();
        if (plan === null) return result('importPlan', 'cancelled', 'Open file cancelled.');
        return await openFiled('importPlan', plan, 'Added the file to the library and opened it.');
      } catch (error) {
        return failure('importPlan', error);
      }
    },
    async openPlan(key: string): Promise<ProjectOperationResult> {
      try {
        return await openFiled('openPlan', await library().read(key), 'Opened the plan.');
      } catch (error) {
        return failure('openPlan', error);
      }
    },
    async duplicate(): Promise<ProjectOperationResult> {
      try {
        const project = selectPresentProject(options.store.getState());
        if (project === undefined) throw new Error('No plan is open');
        await saver().flush();
        const renamed = applyProjectCommand(project, options.catalog, {
          kind: 'RenameProject',
          project: createProjectAddress(),
          name: copyName(project.name),
        });
        const copy = reidentifyProjectHistory(
          createProjectHistory(renamed),
          mintProjectId(),
        ).present;
        return await openFiled('duplicate', await library().create(copy), `Opened ${copy.name}.`);
      } catch (error) {
        return failure('duplicate', error);
      }
    },
    revertToOpened(): ProjectOperationResult {
      try {
        const opened = options.store.getState().librarySession.opened;
        if (opened === null) throw new Error('No plan is open');
        options.store.dispatch(authoredProjectReverted(opened));
        return result('revert', 'success', 'Reverted to the plan as it was opened.');
      } catch (error) {
        return failure('revert', error);
      }
    },
    async openProjectCopy(json: string): Promise<ProjectOperationResult> {
      try {
        // A copy never shares the original's identity, so its sends are its own.
        const plan = await library().importFile(
          { fileName: 'project.runplanner.json', json },
          { newIdentity: true },
        );
        return await openFiled('openCopy', plan, 'Added the project to the library and opened it.');
      } catch (error) {
        return failure('openCopy', error);
      }
    },
    async acceptPreviousFile(): Promise<ProjectOperationResult> {
      try {
        if (previousFile === null) throw new Error('No earlier file is waiting to be imported');
        const plan = await library().importFile(previousFile);
        previousFile = null;
        options.store.dispatch(previousFileOffered(null));
        await library().settlePreviousFileOffer();
        return await openFiled('importPrevious', plan, `Imported ${plan.project.name}.`);
      } catch (error) {
        return failure('importPrevious', error);
      }
    },
    async declinePreviousFile(): Promise<void> {
      previousFile = null;
      options.store.dispatch(previousFileOffered(null));
      await library().settlePreviousFileOffer();
    },
    async forgetLastOpened(): Promise<void> {
      if (options.library === undefined) return;
      await library().rememberOpened(null);
    },
    async restoreStartup(): Promise<void> {
      if (options.library === undefined) return;
      try {
        const last = await library().readLastOpened();
        if (last !== null) await openFiled('openPlan', last, 'Opened the plan.');
      } catch (error) {
        options.store.dispatch(
          libraryOpenFailed({
            message: `Could not reopen the last plan: ${errorDetail(error)}`,
          }),
        );
      }
      try {
        previousFile = await library().previousFileOffer();
        if (previousFile !== null) {
          options.store.dispatch(previousFileOffered({ fileName: previousFile.fileName }));
        }
      } catch {
        // Without a readable earlier file there is nothing to offer.
        previousFile = null;
      }
    },
    inspectCurrentGamePlan(): CurrentGamePlan {
      const workspace = options.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') return NO_PROJECT_PLAN;
      const cached = currentPlans.get(workspace.assembly);
      if (cached !== undefined) return cached;
      let current: CurrentGamePlan;
      try {
        const plan = compileExecutionPlan({
          product: assembleExecutionProduct({
            assembly: workspace.assembly,
            catalog: options.catalog,
            internalRunModifiers,
          }),
        });
        current = Object.freeze({
          kind: 'publishable',
          projectId: plan.projectId,
          planFingerprint: plan.planFingerprint,
        });
      } catch (error) {
        current = Object.freeze({
          kind: 'notPublishable',
          code: error instanceof ExecutionCompilerError ? error.code : null,
          ...(error instanceof ExecutionCompilerError && error.startPointReason !== undefined
            ? { startPointReason: error.startPointReason }
            : {}),
        });
      }
      currentPlans.set(workspace.assembly, current);
      return current;
    },
    async publishGame(slotNumber: GamePlanSlotNumber): Promise<ProjectOperationResult> {
      options.store.dispatch(gameSendStarted());
      const outcome = await sendToGame(slotNumber);
      if (outcome.status === 'failure') {
        options.store.dispatch(gameSendFailed({ message: outcome.message, atMs: Date.now() }));
      }
      return outcome;
    },
    async flush() {
      if (options.library === undefined) {
        return Object.freeze({ status: 'success' as const, message: 'Nothing to save.' });
      }
      try {
        await options.library.saver.flush();
        return Object.freeze({ status: 'success' as const, message: 'Saved the plan.' });
      } catch (error) {
        return Object.freeze({
          status: 'failure' as const,
          message: `Could not save the plan: ${errorDetail(error)}`,
        });
      }
    },
  });
}

/** Names the repairs a migrated plan may need, by the migrations it went through. */
function migratedPlanMessage(
  project: ProjectDocument,
  provenance: readonly { readonly sourceSchemaVersion: number }[],
): string {
  // Only the 87 -> 88 step gave Hubs the legacy fountain-first placement.
  const crossedHubPlacement = provenance.some((migration) => migration.sourceSchemaVersion <= 87);
  const repairs = [
    ...(crossedHubPlacement &&
    project.route.biomes.some((biome) =>
      biome.topology?.decisions.some((decision) => decision.kind === 'hub'),
    )
      ? [
          'the Hub fountain use is placed before the first visit, so an Aromatic Phial target may need repair',
        ]
      : []),
    ...(provenance.some((migration) => migration.sourceSchemaVersion === 86)
      ? ['retained encounter choices may need missing fields repaired']
      : []),
  ];
  const migrated = `Migrated the plan to schema ${PROJECT_DOCUMENT_SCHEMA_VERSION}`;
  return repairs.length === 0 ? `${migrated}.` : `${migrated}; ${repairs.join(', and ')}.`;
}
