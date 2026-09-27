import type {
  GameModuleInstallResult,
  GameModuleRemoveResult,
  GameModuleStatus,
  GamePublicationBlocker,
  GameTargetInspection,
  GameTargetKind,
} from '@planner/persistence/gameModuleHost';

export type GameModuleTone = 'ok' | 'warning' | 'error' | 'info';

export interface GameModuleStatusRow {
  readonly key: 'module' | 'modpackLib' | 'r2modman' | 'dependencies';
  readonly label: string;
  readonly value: string;
  readonly tone: GameModuleTone;
}

export interface GameModuleNotice {
  readonly key: 'modpackLib' | 'r2modmanManaged' | 'coordinator' | 'modified' | 'strandedInstall';
  readonly tone: GameModuleTone;
  readonly text: string;
}

export interface GameModuleSettingsProduct {
  readonly target: { readonly location: string; readonly kindLabel: string } | null;
  readonly targetProblem: string | null;
  readonly rows: readonly GameModuleStatusRow[];
  readonly notices: readonly GameModuleNotice[];
  readonly install: {
    readonly available: boolean;
    readonly consentRequired: boolean;
    readonly consentFacts: readonly string[];
  };
  readonly remove: { readonly available: boolean; readonly unavailableReason: string | null };
  readonly developmentInstallAvailable: boolean;
}

export interface GamePublicationReadiness {
  readonly ready: boolean;
  readonly targetLocation: string | null;
  readonly reasons: readonly string[];
}

const TARGET_KIND_LABELS: Record<GameTargetKind, string> = {
  discovered: 'r2modman profile',
  manual: 'Chosen folder',
};

const R2MODMAN_MANAGED_WARNING =
  'r2modman manages this Run Planner folder. Disabling or uninstalling Run Planner in r2modman renames or deletes the planner’s files. Remove the Run Planner package in r2modman.';

function majorOf(version: string | null): string {
  return version?.split('.')[0] ?? '?';
}

function requirementText(required: string): string {
  return `${required} or newer ${majorOf(required)}.x`;
}

export function describePublicationBlocker(blocker: GamePublicationBlocker): string {
  const required = blocker.required ?? 'unknown';
  switch (blocker.code) {
    case 'noTarget':
      return 'No game target is set. Locate the game module in Settings.';
    case 'targetUnavailable':
      return 'The game target is unavailable. Locate it again in Settings.';
    case 'moduleMissing':
      return `The Run Planner game module is not installed (this planner needs ${required}). Install it in Settings.`;
    case 'moduleMismatch':
      return `The installed game module (${blocker.found ?? 'unrecognized'}) does not match this planner (${required}). Update it in Settings.`;
    case 'modpackLibMissing':
      return `ModpackLib is not installed (requires ${requirementText(required)}). Install ModpackLib in r2modman.`;
    case 'modpackLibUnreadable':
      return `ModpackLib${blocker.found === null ? '' : ` ${blocker.found}`} could not be read (requires ${requirementText(required)}). Reinstall or enable ModpackLib in r2modman.`;
    case 'modpackLibOlder':
      return `ModpackLib ${blocker.found ?? 'unknown'} is older than required (${requirementText(required)}). Update ModpackLib in r2modman.`;
    case 'modpackLibIncompatibleMajor':
      return `ModpackLib ${blocker.found ?? 'unknown'} is not compatible (requires ${requirementText(required)}). Install a compatible ModpackLib in r2modman.`;
  }
}

function moduleRow(
  inspection: GameTargetInspection,
  status: GameModuleStatus,
): GameModuleStatusRow {
  const { module } = inspection;
  const bundled = `this planner ${status.bundledVersion}`;
  if (module.state === 'absent') {
    return {
      key: 'module',
      label: 'Game module',
      value: `Not installed · ${bundled}`,
      tone: 'warning',
    };
  }
  const found = module.version ?? 'unknown version';
  const installed =
    module.state === 'unrecognized'
      ? `Found ${found}, not installed by the planner`
      : module.source === 'checkout'
        ? `Installed ${found} from this checkout`
        : `Installed ${found}`;
  return {
    key: 'module',
    label: 'Game module',
    value: `${installed}${module.modified ? ' (modified)' : ''} · ${bundled}`,
    // The host decides publishability, which accepts an intact development checkout install.
    tone: status.publicationBlockers.some(
      (blocker) => blocker.code === 'moduleMismatch' || blocker.code === 'moduleMissing',
    )
      ? 'warning'
      : 'ok',
  };
}

function modpackLibRow(inspection: GameTargetInspection): GameModuleStatusRow {
  const { modpackLib } = inspection;
  const required = `requires ${requirementText(modpackLib.required)}`;
  const found =
    modpackLib.state === 'missing'
      ? 'Not found'
      : modpackLib.found === null
        ? 'Found, unreadable'
        : `Found ${modpackLib.found}`;
  return {
    key: 'modpackLib',
    label: 'ModpackLib',
    value: `${found} · ${required}`,
    tone: modpackLib.state === 'compatible' ? 'ok' : 'error',
  };
}

function r2modmanRow(inspection: GameTargetInspection): GameModuleStatusRow {
  const { r2modman } = inspection;
  switch (r2modman.state) {
    case 'notApplicable':
      return {
        key: 'r2modman',
        label: 'r2modman',
        value: 'Not applicable (no mods.yml)',
        tone: 'info',
      };
    case 'unmanaged':
      return {
        key: 'r2modman',
        label: 'r2modman',
        value: 'Does not manage the game module',
        tone: 'ok',
      };
    case 'managed':
      return {
        key: 'r2modman',
        label: 'r2modman',
        value: `Manages the game module${r2modman.moduleEnabled === false ? ' (disabled)' : ''}`,
        tone: 'warning',
      };
    case 'unreadable':
      return {
        key: 'r2modman',
        label: 'r2modman',
        value: 'r2modman’s mod list couldn’t be read',
        tone: 'warning',
      };
  }
}

function dependencyRow(inspection: GameTargetInspection): GameModuleStatusRow {
  const missing = inspection.missingDependencies;
  return {
    key: 'dependencies',
    label: 'Dependencies',
    value:
      missing.length === 0
        ? 'All found'
        : `Missing: ${missing.map((dependency) => `${dependency.name} ${dependency.version}`).join(', ')}`,
    tone: missing.length === 0 ? 'ok' : 'warning',
  };
}

function notices(inspection: GameTargetInspection): readonly GameModuleNotice[] {
  const result: GameModuleNotice[] = [];
  if (inspection.modpackLib.state !== 'compatible') {
    result.push({
      key: 'modpackLib',
      tone: 'error',
      text: 'Install or update ModpackLib in r2modman, which also installs its dependencies. The planner never installs ModpackLib.',
    });
  }
  if (inspection.r2modman.state === 'managed') {
    result.push({ key: 'r2modmanManaged', tone: 'warning', text: R2MODMAN_MANAGED_WARNING });
  }
  if (inspection.module.state === 'plannerInstalled' && inspection.module.modified) {
    result.push({
      key: 'modified',
      tone: 'warning',
      text: 'The installed module’s files differ from its install record.',
    });
  }
  if (inspection.strandedInstall !== null) {
    result.push({
      key: 'strandedInstall',
      tone: 'error',
      text: `A failed update left the previous game module at ReturnOfModding/${inspection.strandedInstall}. Install / Update Game Module again; the planner backs it up before cleaning it away.`,
    });
  }
  if (inspection.coordinator.present) {
    result.push({
      key: 'coordinator',
      tone: 'info',
      text: inspection.coordinator.managed
        ? 'The RunPlanner_Modpack coordinator is no longer needed. Remove it in r2modman.'
        : 'The RunPlanner_Modpack coordinator is no longer needed. Remove its plugin folder.',
    });
  }
  return result;
}

function consentFacts(inspection: GameTargetInspection): readonly string[] {
  const facts = [
    `An existing Run Planner folder (${inspection.module.version ?? 'unknown version'}) will be replaced.`,
  ];
  if (inspection.r2modman.state === 'managed') facts.push(R2MODMAN_MANAGED_WARNING);
  else if (inspection.r2modman.state === 'unreadable')
    facts.push('r2modman’s mod list couldn’t be read, so r2modman may manage this folder.');
  else if (inspection.r2modman.state === 'unmanaged')
    facts.push('r2modman does not manage this folder.');
  facts.push('The replaced copy is backed up to the planner’s application data.');
  return facts;
}

function removeUnavailableReason(inspection: GameTargetInspection): string | null {
  if (inspection.removable) return null;
  if (inspection.module.state === 'absent') return 'The game module is not installed.';
  if (inspection.module.state === 'unrecognized')
    return 'This module was not installed by the planner. Remove it with your mod manager.';
  if (inspection.r2modman.state === 'unreadable')
    return 'r2modman’s mod list couldn’t be read, so the planner cannot confirm r2modman does not manage this module.';
  return 'r2modman manages this module. Remove it in r2modman.';
}

export function projectGameModuleSettings(status: GameModuleStatus): GameModuleSettingsProduct {
  const inspection = status.inspection;
  return Object.freeze({
    target:
      status.target === null
        ? null
        : {
            location: status.target.location,
            kindLabel: TARGET_KIND_LABELS[status.target.kind],
          },
    targetProblem: status.targetProblem,
    rows:
      inspection === null
        ? []
        : [
            moduleRow(inspection, status),
            modpackLibRow(inspection),
            r2modmanRow(inspection),
            dependencyRow(inspection),
          ],
    notices: inspection === null ? [] : notices(inspection),
    install: {
      available: inspection !== null,
      consentRequired: inspection?.install.consentRequired ?? false,
      consentFacts: inspection === null ? [] : consentFacts(inspection),
    },
    remove: {
      available: inspection?.removable ?? false,
      unavailableReason: inspection === null ? null : removeUnavailableReason(inspection),
    },
    developmentInstallAvailable: status.developmentInstallAvailable && inspection !== null,
  });
}

export function projectGamePublicationReadiness(
  status: GameModuleStatus,
): GamePublicationReadiness {
  return Object.freeze({
    ready: status.publicationBlockers.length === 0,
    targetLocation: status.target?.location ?? null,
    reasons: status.publicationBlockers.map(describePublicationBlocker),
  });
}

export function describeInstallOutcome(outcome: GameModuleInstallResult['outcome']): string {
  switch (outcome) {
    case 'installed':
      return 'Installed the game module.';
    case 'unchanged':
      return 'The installed game module already matches this planner.';
    case 'consentRequired':
      return 'Confirm replacing the existing Run Planner folder to continue.';
  }
}

export function describeRemoveOutcome(outcome: GameModuleRemoveResult['outcome']): string {
  switch (outcome) {
    case 'removed':
      return 'Removed the game module. Plan slots and ModpackLib were kept.';
    case 'absent':
      return 'The game module is not installed.';
    case 'notPlannerInstalled':
      return 'The planner did not install this module, so it was not removed.';
    case 'managedByR2modman':
      return 'r2modman manages this module. Remove it in r2modman.';
    case 'r2modmanUnreadable':
      return 'r2modman’s mod list couldn’t be read, so the module was not removed.';
  }
}
