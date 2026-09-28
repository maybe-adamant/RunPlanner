import { invoke as tauriInvoke } from '@tauri-apps/api/core';
import { open } from '@tauri-apps/plugin-dialog';

export type GameTargetKind = 'discovered' | 'manual';

export interface GameTarget {
  readonly path: string;
  readonly location: string;
  readonly label: string;
  readonly kind: GameTargetKind;
}

export interface DiscoveredGameProfile {
  readonly path: string;
  readonly location: string;
  readonly label: string;
  /** The Run Planner copy the profile already holds, from cheap folder checks. */
  readonly module: 'none' | 'plannerInstalled' | 'modListUnreadable' | 'thunderstore';
}

export interface GameTargetDiscovery {
  readonly supported: boolean;
  readonly profiles: readonly DiscoveredGameProfile[];
}

export type GameModuleState = 'absent' | 'plannerInstalled' | 'unrecognized';
export type GameModuleSource = 'bundled' | 'checkout';
export type R2modmanState = 'notApplicable' | 'unmanaged' | 'managed' | 'unreadable';
export type ModpackLibState =
  'missing' | 'unreadable' | 'older' | 'compatible' | 'incompatibleMajor';
export type GameModuleInstallAction = 'install' | 'update' | 'current';

export type GamePublicationBlockerCode =
  | 'noTarget'
  | 'targetUnavailable'
  | 'moduleMissing'
  | 'moduleMismatch'
  | 'modpackLibMissing'
  | 'modpackLibUnreadable'
  | 'modpackLibOlder'
  | 'modpackLibIncompatibleMajor';

export interface GamePublicationBlocker {
  readonly code: GamePublicationBlockerCode;
  readonly found: string | null;
  readonly required: string | null;
}

export interface GameTargetInspection {
  readonly module: {
    readonly state: GameModuleState;
    readonly version: string | null;
    readonly source: GameModuleSource | null;
    readonly matchesBundled: boolean;
    readonly modified: boolean;
  };
  readonly r2modman: {
    readonly state: R2modmanState;
    readonly moduleEnabled: boolean | null;
  };
  readonly modpackLib: {
    readonly state: ModpackLibState;
    readonly found: string | null;
    readonly required: string;
    /** ModpackLib's store page, the only page the host opens for it. */
    readonly pageUrl: string;
  };
  readonly missingDependencies: readonly { readonly name: string; readonly version: string }[];
  readonly coordinator: { readonly present: boolean; readonly managed: boolean };
  readonly install: { readonly action: GameModuleInstallAction; readonly consentRequired: boolean };
  readonly removable: boolean;
  /** A previous install left beside `plugins/` after a failed restore. */
  readonly strandedInstall: string | null;
  readonly planSlots: readonly GamePlanSlot[];
}

/** One plan slot, identified only by fields the execution-plan wire already carries. */
export interface GamePlanSlot {
  readonly slot: GamePlanSlotNumber;
  readonly state: 'empty' | 'present' | 'unreadable';
  readonly modifiedAtMs: number | null;
  readonly routeKey: string | null;
  readonly biomeKeys: readonly string[];
  readonly planFingerprint: string | null;
  readonly projectId: string | null;
  /** The saved file's name at send time; absent in older plans. */
  readonly displayName: string | null;
  readonly weaponKey: string | null;
  readonly aspectKey: string | null;
}

/** Host-reported facts about the established game target. */
export interface GameModuleStatus {
  readonly bundledVersion: string;
  readonly developmentInstallAvailable: boolean;
  readonly target: GameTarget | null;
  readonly targetProblem: string | null;
  readonly inspection: GameTargetInspection | null;
  readonly publicationBlockers: readonly GamePublicationBlocker[];
}

export interface GameModuleInstallResult {
  readonly outcome: 'installed' | 'unchanged' | 'consentRequired';
  readonly status: GameModuleStatus;
}

export interface GameModuleRemoveResult {
  readonly outcome:
    'removed' | 'absent' | 'notPlannerInstalled' | 'managedByR2modman' | 'r2modmanUnreadable';
  readonly status: GameModuleStatus;
}

export interface GamePlanPublication {
  readonly status: 'published' | 'blocked' | 'nativeWrite';
  readonly message: string;
  readonly blockers: readonly GamePublicationBlocker[];
}

/** What a bug report includes; the host adds its own facts and files. */
export interface BugReportRequest {
  readonly appFacts: Readonly<Record<string, unknown>>;
  /** The open plan document's JSON, when included. */
  readonly openPlan: string | null;
  readonly includePlanSlots: boolean;
  readonly includeLogs: boolean;
}

export type BugReportCreation =
  | { readonly kind: 'cancelled' }
  | {
      readonly kind: 'saved';
      readonly fileName: string;
      readonly entries: readonly string[];
      /** The host-allowlisted page where the report can be attached. */
      readonly issuePageUrl: string;
    };

export const GAME_PLAN_SLOT_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export type GamePlanSlotNumber = (typeof GAME_PLAN_SLOT_NUMBERS)[number];

export interface GamePlanPublisher {
  readonly publish: (
    slotNumber: GamePlanSlotNumber,
    planJson: string,
  ) => Promise<GamePlanPublication>;
}

export interface GameModuleHost extends GamePlanPublisher {
  readonly status: () => Promise<GameModuleStatus>;
  /** Opens a host-allowlisted page in the default browser. */
  readonly openExternalPage: (url: string) => Promise<void>;
  readonly discoverTargets: () => Promise<GameTargetDiscovery>;
  readonly useDiscoveredTarget: (path: string) => Promise<GameModuleStatus>;
  /** Resolves null when the folder picker is cancelled. */
  readonly pickTargetFolder: () => Promise<string | null>;
  readonly useChosenTarget: (path: string) => Promise<GameModuleStatus>;
  /** Resolves a candidate by the rules of setting it, without saving; rejects with the reason. */
  readonly validateTarget: (path: string, kind: GameTargetKind) => Promise<GameTarget>;
  /** Clears the saved target without touching any files. */
  readonly forgetTarget: () => Promise<GameModuleStatus>;
  readonly install: (overwriteConsent: boolean) => Promise<GameModuleInstallResult>;
  readonly installFromCheckout: (overwriteConsent: boolean) => Promise<GameModuleInstallResult>;
  readonly remove: () => Promise<GameModuleRemoveResult>;
  /** Asks where to save through the host's own dialog, then writes the report there. */
  readonly createBugReport: (
    defaultFileName: string,
    request: BugReportRequest,
  ) => Promise<BugReportCreation>;
  /** Shows the last report written this session in the system file manager. */
  readonly revealBugReport: () => Promise<void>;
}

export interface TauriGameModuleEnvironment {
  readonly invoke: <T>(command: string, args?: Record<string, unknown>) => Promise<T>;
  readonly chooseDirectory: () => Promise<string | null>;
}

export function createTauriGameModuleHost(
  environment: TauriGameModuleEnvironment = {
    invoke: tauriInvoke,
    chooseDirectory: () =>
      open({
        directory: true,
        multiple: false,
        title: 'Choose a Folder Containing ReturnOfModding',
      }),
  },
): GameModuleHost {
  return Object.freeze({
    status: () => environment.invoke<GameModuleStatus>('game_module_status'),
    openExternalPage: (url: string) => environment.invoke<void>('external_open_url', { url }),
    discoverTargets: () => environment.invoke<GameTargetDiscovery>('game_target_discover'),
    useDiscoveredTarget: (path: string) =>
      environment.invoke<GameModuleStatus>('game_target_use_discovered', { path }),
    pickTargetFolder: () => environment.chooseDirectory(),
    useChosenTarget: (path: string) =>
      environment.invoke<GameModuleStatus>('game_target_choose', { path }),
    validateTarget: (path: string, kind: GameTargetKind) =>
      environment.invoke<GameTarget>('game_target_validate', { path, kind }),
    forgetTarget: () => environment.invoke<GameModuleStatus>('game_target_clear'),
    install: (overwriteConsent: boolean) =>
      environment.invoke<GameModuleInstallResult>('game_module_install', { overwriteConsent }),
    installFromCheckout: (overwriteConsent: boolean) =>
      environment.invoke<GameModuleInstallResult>('game_module_install_from_checkout', {
        overwriteConsent,
      }),
    remove: () => environment.invoke<GameModuleRemoveResult>('game_module_remove'),
    publish: (slotNumber: GamePlanSlotNumber, planJson: string) =>
      environment.invoke<GamePlanPublication>('game_plan_publish', { slotNumber, planJson }),
    createBugReport: (defaultFileName: string, request: BugReportRequest) =>
      environment.invoke<BugReportCreation>('bug_report_create', { defaultFileName, request }),
    revealBugReport: () => environment.invoke<void>('bug_report_reveal'),
  });
}

/** The latest host status, or why the last refresh failed, and when it was read. */
export interface GameStatusSnapshot {
  readonly status: GameModuleStatus | null;
  readonly error: string | null;
  readonly readAt: number;
}

/** Shares the latest host status between the header indicator and the Game panel. */
export interface GameStatusController {
  readonly host: GameModuleHost;
  readonly getSnapshot: () => GameStatusSnapshot;
  readonly subscribe: (listener: () => void) => () => void;
  readonly refresh: () => Promise<GameModuleStatus>;
  readonly publish: (status: GameModuleStatus) => void;
}

export function createGameStatusController(host: GameModuleHost): GameStatusController {
  let snapshot: GameStatusSnapshot = Object.freeze({ status: null, error: null, readAt: 0 });
  // Each refresh or publish takes a generation; only the newest may replace the snapshot.
  let generation = 0;
  const listeners = new Set<() => void>();
  const replace = (next: GameStatusSnapshot) => {
    snapshot = Object.freeze(next);
    for (const listener of listeners) listener();
  };
  const publish = (status: GameModuleStatus) => {
    generation += 1;
    replace({ status, error: null, readAt: Date.now() });
  };
  return Object.freeze({
    host,
    getSnapshot: () => snapshot,
    subscribe: (listener: () => void) => {
      listeners.add(listener);
      return () => listeners.delete(listener);
    },
    refresh: async () => {
      generation += 1;
      const requested = generation;
      try {
        const status = await host.status();
        if (requested === generation) replace({ status, error: null, readAt: Date.now() });
        return status;
      } catch (error) {
        if (requested === generation) {
          replace({
            status: snapshot.status,
            error: error instanceof Error ? error.message : String(error),
            readAt: snapshot.readAt,
          });
        }
        throw error;
      }
    },
    publish,
  });
}
