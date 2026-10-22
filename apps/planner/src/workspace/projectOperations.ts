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
import { previousFileOffered, viewChanged } from '../state/librarySessionSlice';
import {
  authoredProjectClosed,
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
import type { PlannerStore } from '../state/store';
import type { LibrarySaver } from './librarySave';
import { compileProjectFile } from './projectFileCompilation';
import {
  childFolder,
  mintRandomProjectId,
  normalizeFolderName,
  parentFolder,
  type DeletedFolder,
  type DeletedPlan,
  type FiledPlan,
  type LibraryItem,
  type LibraryListing,
  type ProjectLibraryOperations,
} from './projectLibrary';

export type ProjectOperation =
  | 'addCatalog'
  | 'delete'
  | 'deleteFolder'
  | 'folder'
  | 'move'
  | 'undoDeleteFolder'
  | 'duplicate'
  | 'importPlan'
  | 'importPrevious'
  | 'new'
  | 'openCopy'
  | 'openPlan'
  | 'publishGame'
  | 'reveal'
  | 'revert'
  | 'undoDelete';

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

/** A deletion and what undoing it needs; `deleted` is null when nothing was deleted. */
export type DeletePlanResult = ProjectOperationResult & { readonly deleted: DeletedPlan | null };
export type DeleteFolderResult = ProjectOperationResult & {
  readonly deleted: DeletedFolder | null;
};

/** The names of the plans an import filed, and the files it could not, with their reasons. */
export type ImportPlansResult = ProjectOperationResult & {
  readonly imported: readonly string[];
  readonly failed: readonly { readonly fileName: string; readonly message: string }[];
};

export interface ProjectOperations {
  /** Whether the library is a folder that Open folder can show. */
  readonly libraryRevealable: boolean;
  /** Every library plan, oldest first, and every folder. */
  listLibrary(): Promise<LibraryListing>;
  /**
   * The execution-plan fingerprint of each ready plan holding one of `projectIds`, by key; null
   * for a plan that does not compile. The open plan is read as it is now.
   */
  inspectLibraryGamePlans(
    items: readonly LibraryItem[],
    projectIds: ReadonlySet<string>,
  ): Promise<ReadonlyMap<string, string | null>>;
  /** The open plan's library key, or null. */
  openKey(): string | null;
  revealLibrary(): Promise<ProjectOperationResult>;
  /** Creates a library plan for the route and opens it. */
  createNew(
    routeKey: string,
    itineraryBiomeKeys?: readonly string[],
    folder?: string,
  ): Promise<ProjectOperationResult>;
  /**
   * Imports the files the user picks into a library folder and opens the first copy; used where
   * no library is shown.
   */
  importPlan(folder?: string): Promise<ProjectOperationResult>;
  /** Imports the files the user picks into a library folder without opening any. */
  importPlans(folder: string): Promise<ImportPlansResult>;
  /** Opens a library plan; the plan already open is shown as it is. */
  openPlan(key: string): Promise<ProjectOperationResult>;
  /** Files a library plan as a new plan named as its copy, with its own identity. */
  duplicate(key: string): Promise<ProjectOperationResult>;
  /** Moves a plan to the recycle bin, closing it when open; its content is kept for undo. */
  deletePlan(key: string): Promise<DeletePlanResult>;
  undoDelete(deleted: DeletedPlan): Promise<ProjectOperationResult>;
  /** Moves a plan to another folder, the open plan included. */
  movePlan(key: string, folder: string): Promise<ProjectOperationResult>;
  createFolder(parent: string, name: string): Promise<ProjectOperationResult>;
  renameFolder(folder: string, name: string): Promise<ProjectOperationResult>;
  /** Moves a folder and everything in it to the recycle bin, closing the open plan inside it. */
  deleteFolder(folder: string): Promise<DeleteFolderResult>;
  undoDeleteFolder(deleted: DeletedFolder): Promise<ProjectOperationResult>;
  /** Returns the open plan to the document it was opened as, as one undoable step. */
  revertToOpened(): ProjectOperationResult;
  /** Files a project document as a new plan with its own identity and opens it. */
  openProjectCopy(json: string): Promise<ProjectOperationResult>;
  /**
   * Files a catalog entry's plan at the top of the library as a copy with its own identity,
   * named after the entry's title, and remembers which entry it came from.
   */
  addCatalogPlan(
    entry: { readonly id: string; readonly title: string },
    json: string,
  ): Promise<ProjectOperationResult>;
  /** The `projectId` of the copy each catalog entry was added as, by entry id. */
  catalogCopies(): Promise<Readonly<Record<string, string>>>;
  /** Imports the file open before the library, once offered, and opens it. */
  acceptPreviousFile(): Promise<ProjectOperationResult>;
  declinePreviousFile(): Promise<void>;
  /** Offers the pre-library file once; the app starts on Home with no plan open. */
  restoreStartup(): Promise<void>;
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
  addCatalog: 'Add to library',
  delete: 'Delete',
  deleteFolder: 'Delete folder',
  folder: 'Folder',
  move: 'Move',
  undoDeleteFolder: 'Undo delete',
  duplicate: 'Duplicate',
  importPlan: 'Open file',
  importPrevious: 'Import',
  new: 'New plan',
  openCopy: 'Open project',
  openPlan: 'Open plan',
  publishGame: 'Send to game',
  reveal: 'Open folder',
  revert: 'Revert to opened',
  undoDelete: 'Undo delete',
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
  /** Fingerprints of stored plans, by key and the modified time they were read at. */
  const storedFingerprints = new Map<
    string,
    { readonly modifiedMs: number; readonly fingerprint: string | null }
  >();
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

  const inspectCurrentGamePlan = (): CurrentGamePlan => {
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
  };

  return Object.freeze({
    libraryRevealable: options.library?.operations.revealable ?? false,
    async listLibrary(): Promise<LibraryListing> {
      if (options.library === undefined) return { folders: [], items: [] };
      const openKey = saver().openKey();
      return library().list(openKey === null ? {} : { openKey });
    },
    async inspectLibraryGamePlans(
      items: readonly LibraryItem[],
      projectIds: ReadonlySet<string>,
    ): Promise<ReadonlyMap<string, string | null>> {
      const fingerprints = new Map<string, string | null>();
      const openKey = options.library === undefined ? null : saver().openKey();
      for (const item of items) {
        if (item.kind !== 'ready' || !projectIds.has(item.projectId)) continue;
        if (item.key === openKey) {
          const current = inspectCurrentGamePlan();
          fingerprints.set(
            item.key,
            current.kind === 'publishable' ? current.planFingerprint : null,
          );
          continue;
        }
        const cached = storedFingerprints.get(item.key);
        if (cached !== undefined && cached.modifiedMs === item.modifiedMs) {
          fingerprints.set(item.key, cached.fingerprint);
          continue;
        }
        // Each compile simulates the plan, so the page keeps responding between them.
        await new Promise((resolve) => globalThis.setTimeout(resolve, 0));
        let fingerprint: string | null;
        try {
          const json = await options.library!.operations.readJson(item.key);
          fingerprint = compileProjectFile(options.catalog, json, {
            internalRunModifiers,
          }).plan.planFingerprint;
        } catch {
          fingerprint = null;
        }
        storedFingerprints.set(item.key, { modifiedMs: item.modifiedMs, fingerprint });
        fingerprints.set(item.key, fingerprint);
      }
      return fingerprints;
    },
    openKey: () => (options.library === undefined ? null : saver().openKey()),
    async revealLibrary(): Promise<ProjectOperationResult> {
      try {
        await library().reveal();
        return result('reveal', 'success', 'Opened the library folder.');
      } catch (error) {
        return failure('reveal', error);
      }
    },
    async createNew(
      routeKey: string,
      itineraryBiomeKeys?: readonly string[],
      folder = '',
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
        return await openFiled(
          'new',
          await library().create(project, folder),
          'Created a new plan.',
        );
      } catch (error) {
        return failure('new', error);
      }
    },
    async importPlan(folder = ''): Promise<ProjectOperationResult> {
      try {
        const { filed, failed } = await library().importChosenFiles(folder);
        const [plan] = filed;
        if (plan !== undefined) {
          return await openFiled(
            'importPlan',
            plan,
            'Added the file to the library and opened it.',
          );
        }
        const [problem] = failed;
        if (problem !== undefined) return failure('importPlan', new Error(problem.message));
        return result('importPlan', 'cancelled', 'Open file cancelled.');
      } catch (error) {
        return failure('importPlan', error);
      }
    },
    async importPlans(folder: string): Promise<ImportPlansResult> {
      try {
        const { filed, failed } = await library().importChosenFiles(folder);
        const imported = filed.map((plan) => plan.project.name);
        const status = imported.length === 0 && failed.length === 0 ? 'cancelled' : 'success';
        return Object.freeze({
          ...result(
            'importPlan',
            status,
            status === 'cancelled' ? 'Import cancelled.' : 'Imported the files into the library.',
          ),
          imported: Object.freeze(imported),
          failed,
        });
      } catch (error) {
        return Object.freeze({ ...failure('importPlan', error), imported: [], failed: [] });
      }
    },
    async openPlan(key: string): Promise<ProjectOperationResult> {
      try {
        if (options.library !== undefined && saver().openKey() === key) {
          options.store.dispatch(viewChanged({ kind: 'editor' }));
          return result('openPlan', 'success', 'Opened the plan.');
        }
        return await openFiled('openPlan', await library().read(key), 'Opened the plan.');
      } catch (error) {
        return failure('openPlan', error);
      }
    },
    async duplicate(key: string): Promise<ProjectOperationResult> {
      try {
        if (saver().openKey() === key) await saver().flush();
        const { project } = await library().read(key);
        const folder =
          (await library().list()).items.find((item) => item.key === key)?.folder ?? '';
        const renamed = applyProjectCommand(project, options.catalog, {
          kind: 'RenameProject',
          project: createProjectAddress(),
          name: copyName(project.name),
        });
        const copy = reidentifyProjectHistory(
          createProjectHistory(renamed),
          mintProjectId(),
        ).present;
        await library().create(copy, folder);
        return result('duplicate', 'success', `Added ${copy.name}.`);
      } catch (error) {
        return failure('duplicate', error);
      }
    },
    async deletePlan(key: string): Promise<DeletePlanResult> {
      try {
        if (saver().openKey() === key) {
          await saver().flush();
          saver().close();
          options.store.dispatch(authoredProjectClosed());
        }
        const deleted = await library().deletePlan(key);
        return Object.freeze({ ...result('delete', 'success', 'Deleted the plan.'), deleted });
      } catch (error) {
        return Object.freeze({ ...failure('delete', error), deleted: null });
      }
    },
    async movePlan(key: string, folder: string): Promise<ProjectOperationResult> {
      try {
        const open = saver().openKey() === key;
        if (open) await saver().flush();
        const moved = await library().movePlan(key, folder);
        if (open) saver().moved(key, moved);
        return result('move', 'success', 'Moved the plan.');
      } catch (error) {
        return failure('move', error);
      }
    },
    async createFolder(parent: string, name: string): Promise<ProjectOperationResult> {
      try {
        const normalized = normalizeFolderName(name);
        if (normalized === null) throw new Error(`“${name}” can’t name a folder.`);
        const path = childFolder(parent, normalized);
        if ((await library().list()).folders.includes(path)) {
          throw new Error(`A folder named “${normalized}” is already here.`);
        }
        await library().createFolder(path);
        return result('folder', 'success', `Added the folder ${normalized}.`);
      } catch (error) {
        return failure('folder', error);
      }
    },
    async renameFolder(folder: string, name: string): Promise<ProjectOperationResult> {
      try {
        const normalized = normalizeFolderName(name);
        if (normalized === null) throw new Error(`“${name}” can’t name a folder.`);
        const target = childFolder(parentFolder(folder), normalized);
        if (target === folder) return result('folder', 'cancelled', 'The name is unchanged.');
        const openKey = saver().openKey();
        const project = options.store.getState().projectWorkspace.history?.present;
        if (openKey !== null) await saver().flush();
        await library().moveFolder(folder, target);
        // The open plan may now be filed under another key.
        if (openKey !== null && project !== undefined) {
          const moved = (await library().list()).items.find(
            (item) => item.kind === 'ready' && item.projectId === project.projectId,
          );
          if (moved !== undefined) saver().moved(openKey, moved.key);
        }
        return result('folder', 'success', `Renamed the folder to ${normalized}.`);
      } catch (error) {
        return failure('folder', error);
      }
    },
    async deleteFolder(folder: string): Promise<DeleteFolderResult> {
      try {
        const openKey = saver().openKey();
        const inside = (path: string) => path === folder || path.startsWith(`${folder}/`);
        const openFolder =
          openKey === null
            ? null
            : ((await library().list()).items.find((item) => item.key === openKey)?.folder ?? null);
        if (openFolder !== null && inside(openFolder)) {
          await saver().flush();
          saver().close();
          options.store.dispatch(authoredProjectClosed());
        }
        const deleted = await library().deleteFolder(folder);
        return Object.freeze({
          ...result('deleteFolder', 'success', 'Deleted the folder.'),
          deleted,
        });
      } catch (error) {
        return Object.freeze({ ...failure('deleteFolder', error), deleted: null });
      }
    },
    async undoDeleteFolder(deleted: DeletedFolder): Promise<ProjectOperationResult> {
      try {
        await library().undoDeleteFolder(deleted);
        return result('undoDeleteFolder', 'success', 'Restored the folder.');
      } catch (error) {
        return failure('undoDeleteFolder', error);
      }
    },
    async undoDelete(deleted: DeletedPlan): Promise<ProjectOperationResult> {
      try {
        const plan = await library().undoDelete(deleted);
        return result('undoDelete', 'success', `Restored ${plan.project.name}.`);
      } catch (error) {
        return failure('undoDelete', error);
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
    async addCatalogPlan(
      entry: { readonly id: string; readonly title: string },
      json: string,
    ): Promise<ProjectOperationResult> {
      try {
        const plan = await library().importFile(
          { fileName: `${entry.id}.runplanner.json`, json },
          { newIdentity: true, name: entry.title },
        );
        await library().recordCatalogCopy(entry.id, plan.project.projectId);
        return result('addCatalog', 'success', `Added “${plan.project.name}” to the library.`);
      } catch (error) {
        return failure('addCatalog', error);
      }
    },
    catalogCopies: async () => (options.library === undefined ? {} : library().catalogCopies()),
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
    async restoreStartup(): Promise<void> {
      if (options.library === undefined) return;
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
    inspectCurrentGamePlan,
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
