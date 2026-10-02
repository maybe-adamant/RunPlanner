import {
  encodeProjectDocument,
  PROJECT_DOCUMENT_SCHEMA_VERSION,
} from '@run-planner/engine/authored-project';

import type { BuildIdentity } from '../composition/buildIdentity';
import type { GameModuleHost } from '../persistence/gameModuleHost';
import {
  selectPresentProject,
  selectProfileStatus,
  type PlannerStore,
  type RootState,
} from '../state/store';
import type { CurrentGamePlan } from './projectOperations';

export interface BugReportContents {
  readonly openPlan: boolean;
  readonly plansInGame: boolean;
  readonly gameLogs: boolean;
}

export type BugReportOutcome =
  | { readonly kind: 'cancelled' }
  | { readonly kind: 'saved'; readonly fileName: string; readonly issuePageUrl: string };

export interface BugReportOperations {
  /** Has the host ask where to save, then write the report; rejects with the host's reason. */
  create(contents: BugReportContents): Promise<BugReportOutcome>;
  reveal(): Promise<void>;
  openIssuePage(url: string): Promise<void>;
}

interface CreateBugReportOperationsOptions {
  readonly buildIdentity: BuildIdentity;
  readonly catalogVersion: string;
  readonly host: GameModuleHost;
  readonly inspectCurrentGamePlan: () => CurrentGamePlan;
  readonly now?: () => Date;
  readonly store: PlannerStore;
}

function twoDigits(value: number): string {
  return String(value).padStart(2, '0');
}

/** `run-planner-report-YYYYMMDD-HHMM.zip` in local time. */
export function bugReportFileName(date: Date): string {
  const day = `${date.getFullYear()}${twoDigits(date.getMonth() + 1)}${twoDigits(date.getDate())}`;
  return `run-planner-report-${day}-${twoDigits(date.getHours())}${twoDigits(date.getMinutes())}.zip`;
}

/** Planner facts a report carries beside the host's own. */
export function projectBugReportFacts(
  state: RootState,
  options: {
    readonly buildIdentity: BuildIdentity;
    readonly catalogVersion: string;
    readonly currentGamePlan: CurrentGamePlan;
  },
): Readonly<Record<string, unknown>> {
  const failure = state.gameSendSession.lastFailure;
  const activationFailure = state.gameSendSession.lastActivationFailure;
  return {
    plannerVersion: options.buildIdentity.version,
    build: options.buildIdentity.build,
    commit: options.buildIdentity.commit ?? null,
    schemaVersion: PROJECT_DOCUMENT_SCHEMA_VERSION,
    catalogVersion: options.catalogVersion,
    openPlan:
      selectPresentProject(state) === undefined
        ? null
        : {
            fileName: state.profileSession.fileName,
            saveStatus: selectProfileStatus(state),
            gamePlan: options.currentGamePlan,
          },
    lastSendSlot: state.gameSendSession.lastSentSlot,
    lastSendFailure:
      failure === null
        ? null
        : { message: failure.message, at: new Date(failure.atMs).toISOString() },
    lastSendNotActivated:
      activationFailure === null
        ? null
        : {
            slot: activationFailure.slot,
            message: activationFailure.message,
            at: new Date(activationFailure.atMs).toISOString(),
          },
  };
}

export function createBugReportOperations(
  options: CreateBugReportOperationsOptions,
): BugReportOperations {
  const now = options.now ?? (() => new Date());
  return Object.freeze({
    async create(contents: BugReportContents): Promise<BugReportOutcome> {
      const state = options.store.getState();
      const project = selectPresentProject(state);
      const creation = await options.host.createBugReport(bugReportFileName(now()), {
        appFacts: projectBugReportFacts(state, {
          buildIdentity: options.buildIdentity,
          catalogVersion: options.catalogVersion,
          currentGamePlan: options.inspectCurrentGamePlan(),
        }),
        openPlan:
          contents.openPlan && project !== undefined ? encodeProjectDocument(project) : null,
        includePlanSlots: contents.plansInGame,
        includeLogs: contents.gameLogs,
      });
      return creation.kind === 'cancelled'
        ? creation
        : { kind: 'saved', fileName: creation.fileName, issuePageUrl: creation.issuePageUrl };
    },
    reveal: () => options.host.revealBugReport(),
    openIssuePage: (url: string) => options.host.openExternalPage(url),
  });
}
