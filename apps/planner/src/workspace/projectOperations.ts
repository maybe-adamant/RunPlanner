import {
  assessPublicDreamItinerary,
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import {
  assembleExecutionProduct,
  compileExecutionPlan,
  encodeExecutionPlan,
  EXECUTION_DISPLAY_NAME_MAX,
  ExecutionCompilerError,
} from '@run-planner/engine/execution-plan';

import type { AutosaveRecoveryAdapter } from '../persistence/autosaveRecovery';
import { loadProjectDocument } from '../persistence/projectDocumentLoader';
import { createInitialProject } from '../composition/projectBootstrap';
import {
  profileFileStem,
  type ProfileFileAdapter,
  type ProfileFileReference,
} from '../persistence/profileFile';
import type { GamePlanPublisher, GamePlanSlotNumber } from '../persistence/gameModuleHost';
import { describePublicationBlocker } from '../projections/gamePanel';
import {
  newProjectCreated,
  profileLoadSucceeded,
  profileSaveSucceeded,
  recoveryDiscarded,
} from '../state/profileSessionSlice';
import {
  projectIdentityMinted,
  type PreparedProjectWorkspace,
} from '../state/projectWorkspaceSlice';
import {
  gamePlanSent,
  gameSendFailed,
  gameSendStarted,
  gameSentSlotNotActivated,
} from '../state/gameSendSessionSlice';
import { assertPublicProjectAdmission } from './project-admission';
import { gamePublicationRestriction } from './game-publication-availability';
import {
  selectPresentProject,
  selectProfileSession,
  selectProfileStatus,
  type PlannerStore,
} from '../state/store';

export type ProjectOperation =
  | 'discardRecovery'
  | 'exportRecovery'
  | 'loadProfile'
  | 'new'
  | 'publishGame'
  | 'saveBeforeUpdate'
  | 'saveProfile'
  | 'saveProfileAs';

export type CurrentGamePlan =
  | { readonly kind: 'noProject' }
  /** Sending is unavailable for this route while its game-module support is in development. */
  | { readonly kind: 'unavailable'; readonly reason: string }
  | {
      readonly kind: 'notPublishable';
      /** The compiler's reason, or null when compiling failed for another reason. */
      readonly code: ExecutionCompilerError['code'] | null;
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
  createNew(
    routeKey: string,
    itineraryBiomeKeys?: readonly string[],
  ): Promise<ProjectOperationResult>;
  discardAutosaveRecovery(): ProjectOperationResult;
  exportAutosaveRecovery(): Promise<ProjectOperationResult>;
  readonly saveAsAvailable: boolean;
  /** Whether the current project compiles to an execution plan, and its fingerprint. */
  inspectCurrentGamePlan(): CurrentGamePlan;
  /** Why a route's plans can't be sent to the game, or null when they can. */
  gamePublicationRestriction(routeKey: string): string | null;
  publishGame(slotNumber: GamePlanSlotNumber): Promise<ProjectOperationResult>;
  /** Saves an unsaved or never-saved project before the planner closes to update. */
  saveBeforeUpdate(): Promise<ProjectOperationResult>;
  saveProfile(): Promise<ProjectOperationResult>;
  saveProfileAs(): Promise<ProjectOperationResult>;
  loadProfile(): Promise<ProjectOperationResult>;
}

interface CreateProjectOperationsOptions {
  readonly activeProfileFile?: ProfileFileReference;
  readonly autosaveRecovery?: AutosaveRecoveryAdapter;
  readonly catalog: Catalog;
  readonly profileFile: ProfileFileAdapter;
  readonly prepareProjectWorkspace: (project: ProjectDocument) => PreparedProjectWorkspace;
  readonly gamePlanPublisher?: GamePlanPublisher;
  /** Mints the identity a saved copy takes; injectable for deterministic tests. */
  readonly mintProjectId?: () => string;
  readonly store: PlannerStore;
}

/** The saved file's stem, bounded in code points as the plan's display name. */
function planDisplayName(fileName: string): string {
  return Array.from(profileFileStem(fileName)).slice(0, EXECUTION_DISPLAY_NAME_MAX).join('');
}

function mintRandomProjectId(): string {
  return `run-plan-${globalThis.crypto.randomUUID()}`;
}

const operationLabels: Readonly<Record<ProjectOperation, string>> = Object.freeze({
  discardRecovery: 'Discard Autosave',
  exportRecovery: 'Export Autosave',
  loadProfile: 'Load Profile',
  new: 'New project',
  publishGame: 'Send to game',
  saveBeforeUpdate: 'Save before update',
  saveProfile: 'Save Profile',
  saveProfileAs: 'Save As',
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
  let activeProfileFile = options.activeProfileFile ?? null;
  const currentPlans = new WeakMap<object, CurrentGamePlan>();
  const currentProject = () => selectPresentProject(options.store.getState());
  const mintProjectId = options.mintProjectId ?? mintRandomProjectId;
  // Explicit saves run one at a time, so each reads the identity its predecessor wrote.
  // An idle save starts at once, reading the snapshot of its invocation; a later one waits.
  let inFlightSave: Promise<unknown> | null = null;
  const serializedSave = (
    task: () => Promise<ProjectOperationResult>,
  ): Promise<ProjectOperationResult> => {
    const run = inFlightSave === null ? task() : inFlightSave.then(task, task);
    const tracked: Promise<unknown> = run.finally(() => {
      if (inFlightSave === tracked) inFlightSave = null;
    });
    inFlightSave = tracked;
    return run;
  };
  const activateSaved = async (file: ProfileFileReference, operation: ProjectOperation) => {
    try {
      await file.activate();
      return null;
    } catch (error) {
      return result(
        operation,
        'failure',
        `${operationLabels[operation]} wrote ${file.fileName} but could not make it the active file: ${errorDetail(error)}`,
      );
    }
  };
  const saveProfileNow = async (): Promise<ProjectOperationResult> => {
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
        const activationFailure = await activateSaved(savedFile, 'saveProfile');
        if (activationFailure !== null) return activationFailure;
      } else {
        await savedFile.write(baselineJson);
      }
      activeProfileFile = savedFile;
      options.store.dispatch(profileSaveSucceeded({ baselineJson, fileName: savedFile.fileName }));
      return result('saveProfile', 'success', 'Saved the profile.');
    } catch (error) {
      return failure('saveProfile', error);
    }
  };
  const saveProfile = () => serializedSave(saveProfileNow);
  // A project that is not both saved to a file and clean is saved first (Save As if never saved).
  const saveUnlessClean = (): Promise<ProjectOperationResult> | null =>
    activeProfileFile === null || selectProfileStatus(options.store.getState()) !== 'Clean'
      ? saveProfile()
      : null;
  const sendToGame = async (slotNumber: GamePlanSlotNumber): Promise<ProjectOperationResult> => {
    try {
      if (options.gamePlanPublisher === undefined) {
        throw new Error('Publish to Game is unavailable in this environment');
      }
      const workspace = options.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') throw new Error('No project is open');
      const restriction = gamePublicationRestriction(
        options.catalog,
        workspace.history.present.route.routeKey,
      );
      if (restriction !== null) return result('publishGame', 'failure', restriction);
      // Checked before saving, so an unsendable plan is never saved on the way.
      assembleExecutionProduct({ assembly: workspace.assembly, catalog: options.catalog });
      // Sending needs a saved file with no unsaved changes; the file's name names the plan.
      let saved = false;
      const pendingSave = saveUnlessClean();
      if (pendingSave !== null) {
        const saving = await pendingSave;
        if (saving.status === 'cancelled') {
          return result('publishGame', 'cancelled', 'Send to game cancelled; nothing was sent.');
        }
        if (saving.status === 'failure') {
          return result('publishGame', 'failure', `Not saved, so not sent: ${saving.message}`);
        }
        saved = true;
      }
      const notSent = (message: string) =>
        result('publishGame', 'failure', saved ? `Saved, but not sent: ${message}` : message);
      try {
        // Compile the document as saved, since the save may have re-identified its history.
        const savedWorkspace = options.store.getState().projectWorkspace;
        if (savedWorkspace.kind !== 'openProject') throw new Error('No project is open');
        const fileName = selectProfileSession(options.store.getState()).fileName;
        const plan = compileExecutionPlan({
          product: assembleExecutionProduct({
            assembly: savedWorkspace.assembly,
            catalog: options.catalog,
          }),
          ...(fileName === null ? {} : { displayName: planDisplayName(fileName) }),
        });
        const publication = await options.gamePlanPublisher.publish(
          slotNumber,
          encodeExecutionPlan(plan),
        );
        if (publication.status === 'published') {
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
        }
        return notSent(
          publication.blockers.length > 0
            ? publication.blockers.map(describePublicationBlocker).join(' ')
            : publication.message,
        );
      } catch (error) {
        return notSent(errorDetail(error));
      }
    } catch (error) {
      return failure('publishGame', error);
    }
  };
  return Object.freeze({
    saveAsAvailable: options.profileFile.supportsSaveAs === true,
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
        assertPublicProjectAdmission(options.catalog, project);
        await options.profileFile.clearActive();
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
    gamePublicationRestriction(routeKey: string): string | null {
      return gamePublicationRestriction(options.catalog, routeKey);
    },
    inspectCurrentGamePlan(): CurrentGamePlan {
      const workspace = options.store.getState().projectWorkspace;
      if (workspace.kind !== 'openProject') return NO_PROJECT_PLAN;
      const restriction = gamePublicationRestriction(
        options.catalog,
        workspace.history.present.route.routeKey,
      );
      if (restriction !== null) return Object.freeze({ kind: 'unavailable', reason: restriction });
      const cached = currentPlans.get(workspace.assembly);
      if (cached !== undefined) return cached;
      let current: CurrentGamePlan;
      try {
        const plan = compileExecutionPlan({
          product: assembleExecutionProduct({
            assembly: workspace.assembly,
            catalog: options.catalog,
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
    async saveBeforeUpdate(): Promise<ProjectOperationResult> {
      if (options.store.getState().projectWorkspace.kind !== 'openProject') {
        return result('saveBeforeUpdate', 'success', 'No project is open.');
      }
      const pendingSave = saveUnlessClean();
      if (pendingSave === null) {
        return result('saveBeforeUpdate', 'success', 'The project is already saved.');
      }
      const saving = await pendingSave;
      if (saving.status === 'cancelled') {
        return result(
          'saveBeforeUpdate',
          'cancelled',
          'Update cancelled; the project was not saved.',
        );
      }
      if (saving.status === 'failure') {
        return result(
          'saveBeforeUpdate',
          'failure',
          `Not saved, so not updated: ${saving.message}`,
        );
      }
      return result('saveBeforeUpdate', 'success', 'Saved the profile.');
    },
    saveProfile,
    saveProfileAs: () =>
      serializedSave(async (): Promise<ProjectOperationResult> => {
        try {
          const snapshot = currentProject();
          if (snapshot === undefined) {
            throw new Error('No project is open');
          }
          const suggestedFileName =
            selectProfileSession(options.store.getState()).fileName ?? DEFAULT_PROFILE_FILE_NAME;
          // A copy of an already-saved file is a different plan, so it takes a new identity;
          // the first save of a never-saved project keeps its own.
          const projectId = activeProfileFile === null ? snapshot.projectId : mintProjectId();
          const baselineJson = encodeProjectDocument({ ...snapshot, projectId });
          const savedFile = await options.profileFile.saveAs(suggestedFileName, baselineJson);
          if (savedFile === null) {
            return result('saveProfileAs', 'cancelled', 'Save As cancelled.');
          }
          const activationFailure = await activateSaved(savedFile, 'saveProfileAs');
          if (activationFailure !== null) return activationFailure;
          activeProfileFile = savedFile;
          if (projectId !== snapshot.projectId) {
            options.store.dispatch(projectIdentityMinted(projectId));
          }
          options.store.dispatch(
            profileSaveSucceeded({ baselineJson, fileName: savedFile.fileName }),
          );
          return result('saveProfileAs', 'success', 'Saved as a new file.');
        } catch (error) {
          return failure('saveProfileAs', error);
        }
      }),
    async loadProfile(): Promise<ProjectOperationResult> {
      try {
        const loaded = await options.profileFile.load();
        if (loaded === null) {
          return result('loadProfile', 'cancelled', 'Load Profile cancelled.');
        }
        const loadedDocument = loadProjectDocument(loaded.json, options.catalog);
        const { project } = loadedDocument;
        assertPublicProjectAdmission(options.catalog, project);
        const baselineJson = encodeProjectDocument(project);
        const fileName = loadedProfileFileName(loaded.file.fileName);
        const prepared = options.prepareProjectWorkspace(project);
        const autosaveRecovery = options.autosaveRecovery;
        let clearedRecoveryJson: string | null = null;
        if (selectProfileSession(options.store.getState()).recoveryStatus === 'blocked') {
          if (autosaveRecovery === undefined) {
            throw new Error('Autosave recovery is unavailable in this environment');
          }
          const recoveryJson = autosaveRecovery.read();
          if (recoveryJson === null) {
            throw new Error('Blocked autosave recovery is missing');
          }
          autosaveRecovery.clear();
          clearedRecoveryJson = recoveryJson;
        }
        try {
          await loaded.file.activate();
        } catch (error) {
          if (clearedRecoveryJson !== null && autosaveRecovery !== undefined) {
            try {
              autosaveRecovery.write(clearedRecoveryJson);
            } catch (restoreError) {
              throw new Error(
                `${errorDetail(error)}; restoring blocked autosave also failed: ${errorDetail(restoreError)}`,
                { cause: restoreError },
              );
            }
          }
          throw error;
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
        return result(
          'loadProfile',
          'success',
          loadedDocument.migrationProvenance.length === 0
            ? 'Loaded the profile.'
            : migratedProfileMessage(project, loadedDocument.migrationProvenance),
        );
      } catch (error) {
        return failure('loadProfile', error);
      }
    },
  });
}

/** Names the repairs a migrated profile may need, by the migrations it went through. */
function migratedProfileMessage(
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
  const migrated = `Migrated the profile to schema ${PROJECT_DOCUMENT_SCHEMA_VERSION}`;
  return repairs.length === 0 ? `${migrated}.` : `${migrated}; ${repairs.join(', and ')}.`;
}
