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
  };
  readonly missingDependencies: readonly { readonly name: string; readonly version: string }[];
  readonly coordinator: { readonly present: boolean; readonly managed: boolean };
  readonly install: { readonly action: GameModuleInstallAction; readonly consentRequired: boolean };
  readonly removable: boolean;
  /** A previous install left beside `plugins/` after a failed restore. */
  readonly strandedInstall: string | null;
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

export const GAME_PLAN_SLOT_NUMBERS = [1, 2, 3, 4, 5, 6] as const;
export type GamePlanSlotNumber = (typeof GAME_PLAN_SLOT_NUMBERS)[number];

export interface GamePlanPublisher {
  readonly status: () => Promise<GameModuleStatus>;
  readonly publish: (
    slotNumber: GamePlanSlotNumber,
    planJson: string,
  ) => Promise<GamePlanPublication>;
}

export interface GameModuleHost extends GamePlanPublisher {
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
  });
}
