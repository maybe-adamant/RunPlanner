import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type {
  GameModuleInstallResult,
  GameModuleRemoveResult,
  GameModuleStatus,
  GamePublicationBlocker,
  GameTargetDiscovery,
  GameTargetInspection,
  ModpackLibState,
} from '@planner/persistence/gameModuleHost';

export type GameModuleTone = 'ok' | 'warning' | 'error';
export type GameModuleOverallState = 'ready' | 'needsSetup' | 'updateAvailable' | 'stranded';

export interface GameLocationProduct {
  readonly state: 'unset' | 'set';
  readonly name: string | null;
  readonly kindLabel: 'r2modman profile' | 'folder' | null;
  readonly path: string | null;
  readonly problem: string | null;
  /** Switching away first asks what to do with the planner's install here. */
  readonly confirmSwitchAway: boolean;
  /** Whether that question may offer removal, with Rust's reason when it may not. */
  readonly switchAwayRemoval: { readonly available: boolean; readonly reason: string | null };
}

export interface GameModuleStepAction {
  readonly label: 'Install' | 'Update';
}

export interface GameModuleLink {
  readonly url: string;
  readonly label: string;
  readonly accessibleName: string;
}

export interface GameModuleStep {
  readonly key: 'modpackLib' | 'dependencies' | 'r2modman' | 'stranded' | 'module';
  readonly text: string;
  readonly found: string | null;
  readonly tone: GameModuleTone;
  readonly action: GameModuleStepAction | null;
  readonly link: GameModuleLink | null;
}

export interface GameModuleDetail {
  readonly key: 'path' | 'module' | 'modpackLib' | 'dependencies' | 'r2modman' | 'coordinator';
  readonly label: string;
  readonly value: string;
}

export interface GameModuleSectionProduct {
  readonly state: GameModuleOverallState;
  readonly tone: GameModuleTone;
  readonly summary: string;
  readonly steps: readonly GameModuleStep[];
  /** Whether installing asks before replacing the existing folder, and what it states. */
  readonly consent: { readonly required: boolean; readonly facts: readonly string[] };
  readonly removeAvailable: boolean;
  readonly details: readonly GameModuleDetail[];
  readonly developmentInstallAvailable: boolean;
}

export interface GameModuleSettingsProduct {
  readonly location: GameLocationProduct;
  /** Present only when a target is set and could be inspected. */
  readonly module: GameModuleSectionProduct | null;
}

export interface GamePublicationReadiness {
  readonly ready: boolean;
  readonly targetLocation: string | null;
  readonly reasons: readonly { readonly text: string; readonly link: GameModuleLink | null }[];
}

const DEVELOPMENT_VERSION = 'development build';

function modpackLibLink(url: string): GameModuleLink {
  return {
    url,
    label: 'Thunderstore page',
    accessibleName: 'Open ModpackLib’s Thunderstore page in your browser',
  };
}
const R2MODMAN_MANAGED_WARNING =
  'r2modman manages this Run Planner folder. Disabling or uninstalling Run Planner in r2modman renames or deletes the planner’s files. Remove the Run Planner package in r2modman.';
const UNREADABLE_MOD_LIST = 'r2modman’s mod list couldn’t be read';

function majorOf(version: string): string {
  return version.split('.')[0] ?? '?';
}

function sentence(text: string, found: string | null): string {
  return `${text}${found === null ? '' : ` (found ${found})`}.`;
}

function modpackLibStep(
  state: Exclude<ModpackLibState, 'compatible'>,
  found: string | null,
  required: string,
): { readonly text: string; readonly found: string | null } {
  switch (state) {
    case 'missing':
      return { text: `Install ModpackLib ${required}+ in r2modman`, found: null };
    case 'unreadable':
      return {
        text: `Reinstall or enable ModpackLib ${required}+ in r2modman`,
        found: found ?? 'unreadable',
      };
    case 'older':
      return { text: `Update ModpackLib to ${required}+ in r2modman`, found };
    case 'incompatibleMajor':
      return {
        text: `Install a ModpackLib ${majorOf(required)}.x release (${required}+) in r2modman`,
        found,
      };
  }
}

export function describePublicationBlocker(blocker: GamePublicationBlocker): string {
  const required = blocker.required ?? 'unknown';
  switch (blocker.code) {
    case 'noTarget':
      return 'Set the game location in Settings.';
    case 'targetUnavailable':
      return 'The game location is unavailable. Change it in Settings.';
    case 'moduleMissing':
      return sentence('Install the game module in Settings', null);
    case 'moduleMismatch':
      return sentence('Update the game module in Settings', blocker.found ?? 'unrecognized');
    case 'modpackLibMissing': {
      const step = modpackLibStep('missing', blocker.found, required);
      return sentence(step.text, step.found);
    }
    case 'modpackLibUnreadable': {
      const step = modpackLibStep('unreadable', blocker.found, required);
      return sentence(step.text, step.found);
    }
    case 'modpackLibOlder': {
      const step = modpackLibStep('older', blocker.found, required);
      return sentence(step.text, step.found);
    }
    case 'modpackLibIncompatibleMajor': {
      const step = modpackLibStep('incompatibleMajor', blocker.found, required);
      return sentence(step.text, step.found);
    }
  }
}

function versions(status: GameModuleStatus, inspection: GameTargetInspection) {
  const development = status.developmentInstallAvailable;
  const bundled = development ? DEVELOPMENT_VERSION : status.bundledVersion;
  const installed =
    inspection.module.state === 'plannerInstalled' && development
      ? DEVELOPMENT_VERSION
      : (inspection.module.version ?? 'unknown version');
  return { bundled, installed };
}

function consentFacts(inspection: GameTargetInspection): readonly string[] {
  const facts = [
    `An existing Run Planner folder (${inspection.module.version ?? 'unknown version'}) will be replaced.`,
  ];
  if (inspection.r2modman.state === 'managed') facts.push(R2MODMAN_MANAGED_WARNING);
  else if (inspection.r2modman.state === 'unreadable')
    facts.push(`${UNREADABLE_MOD_LIST}, so r2modman may manage this folder.`);
  else if (inspection.r2modman.state === 'unmanaged')
    facts.push('r2modman does not manage this folder.');
  facts.push('The replaced copy is backed up to the planner’s application data.');
  return facts;
}

function hasModuleBlocker(status: GameModuleStatus): boolean {
  return status.publicationBlockers.some(
    (blocker) => blocker.code === 'moduleMissing' || blocker.code === 'moduleMismatch',
  );
}

function instructionSteps(
  inspection: GameTargetInspection,
  installStep: boolean,
): GameModuleStep[] {
  const steps: GameModuleStep[] = [];
  const library = inspection.modpackLib;
  if (library.state !== 'compatible') {
    steps.push({
      key: 'modpackLib',
      ...modpackLibStep(library.state, library.found, library.required),
      tone: 'error',
      action: null,
      link: modpackLibLink(library.pageUrl),
    });
  }
  if (inspection.missingDependencies.length > 0) {
    steps.push({
      key: 'dependencies',
      text: `Install ${inspection.missingDependencies.map((dependency) => dependency.name).join(', ')} through r2modman or ModpackLib`,
      found: null,
      tone: 'warning',
      action: null,
      link: null,
    });
  }
  if (inspection.r2modman.state === 'managed' || inspection.r2modman.state === 'unreadable') {
    steps.push({
      key: 'r2modman',
      text:
        inspection.r2modman.state === 'managed'
          ? 'Remove the Run Planner package in r2modman'
          : `Check r2modman: ${UNREADABLE_MOD_LIST}, so it may manage this Run Planner folder`,
      found: null,
      tone: 'warning',
      action: null,
      link: null,
    });
  }
  if (inspection.strandedInstall !== null) {
    steps.push({
      key: 'stranded',
      text: installStep
        ? `A failed update left the previous module at ReturnOfModding/${inspection.strandedInstall}. Install again to recover; the planner backs it up first`
        : `A failed update left an old module copy at ReturnOfModding/${inspection.strandedInstall}. The game does not load it; delete it once you no longer need it`,
      found: null,
      tone: 'error',
      action: null,
      link: null,
    });
  }
  return steps;
}

function moduleDetail(status: GameModuleStatus, inspection: GameTargetInspection): string {
  const { module } = inspection;
  const { bundled, installed } = versions(status, inspection);
  const found =
    module.state === 'absent'
      ? 'Not installed'
      : module.state === 'unrecognized'
        ? `Found ${installed}, not installed by the planner`
        : `Installed ${installed}${module.source === 'checkout' ? ' from this checkout' : ''}`;
  return `${found}${module.modified ? ' (modified)' : ''} · this planner ${bundled}`;
}

function r2modmanDetail(inspection: GameTargetInspection): string {
  switch (inspection.r2modman.state) {
    case 'notApplicable':
      return 'Not applicable (no mods.yml)';
    case 'unmanaged':
      return 'Does not manage the game module';
    case 'managed':
      return `Manages the game module${inspection.r2modman.moduleEnabled === false ? ' (disabled)' : ''}`;
    case 'unreadable':
      return UNREADABLE_MOD_LIST;
  }
}

function details(
  status: GameModuleStatus,
  inspection: GameTargetInspection,
): readonly GameModuleDetail[] {
  const library = inspection.modpackLib;
  const missing = inspection.missingDependencies;
  const result: GameModuleDetail[] = [
    { key: 'path', label: 'Path', value: status.target?.location ?? '' },
    { key: 'module', label: 'Game module', value: moduleDetail(status, inspection) },
    {
      key: 'modpackLib',
      label: 'ModpackLib',
      value: `${library.state === 'missing' ? 'Not found' : `Found ${library.found ?? 'unreadable'}`} · requires ${library.required}+ (${majorOf(library.required)}.x)`,
    },
    {
      key: 'dependencies',
      label: 'Dependencies',
      value:
        missing.length === 0
          ? 'All found'
          : `Missing: ${missing.map((dependency) => `${dependency.name} ${dependency.version}`).join(', ')}`,
    },
    { key: 'r2modman', label: 'r2modman', value: r2modmanDetail(inspection) },
  ];
  if (inspection.coordinator.present) {
    result.push({
      key: 'coordinator',
      label: 'Coordinator',
      value: inspection.coordinator.managed
        ? 'The RunPlanner_Modpack coordinator is no longer needed. Remove it in r2modman.'
        : 'The RunPlanner_Modpack coordinator is no longer needed. Remove its plugin folder.',
    });
  }
  return result;
}

function moduleSection(
  status: GameModuleStatus,
  inspection: GameTargetInspection,
): GameModuleSectionProduct {
  // The planner's own step follows Rust's install action, shown only while the module blocks publishing.
  const action = inspection.install.action;
  const moduleStep = action !== 'current' && hasModuleBlocker(status);
  const steps = instructionSteps(inspection, moduleStep);
  const instructed = steps.length > 0;
  if (moduleStep) {
    const label = action === 'install' ? 'Install' : 'Update';
    steps.push({
      key: 'module',
      text: `${label} the game module`,
      found:
        status.publicationBlockers.find((blocker) => blocker.code === 'moduleMismatch')?.found ??
        null,
      tone: 'warning',
      action: { label },
      link: null,
    });
  }
  const { bundled, installed } = versions(status, inspection);
  const state: GameModuleOverallState =
    inspection.strandedInstall !== null
      ? 'stranded'
      : instructed || (moduleStep && action === 'install')
        ? 'needsSetup'
        : moduleStep
          ? 'updateAvailable'
          : 'ready';
  const summary =
    state === 'ready'
      ? `Ready · module ${installed} · ModpackLib ${inspection.modpackLib.found ?? ''} · dependencies found`
      : state === 'needsSetup'
        ? 'Needs setup'
        : state === 'stranded'
          ? 'Stranded install'
          : `Update available · this planner ${bundled}`;
  const tone: GameModuleTone =
    state === 'ready'
      ? 'ok'
      : state === 'stranded' || steps.some((step) => step.tone === 'error')
        ? 'error'
        : 'warning';
  return Object.freeze({
    state,
    tone,
    summary,
    steps,
    consent: { required: inspection.install.consentRequired, facts: consentFacts(inspection) },
    removeAvailable: inspection.removable,
    details: details(status, inspection),
    developmentInstallAvailable: status.developmentInstallAvailable,
  });
}

function removalRefusal(inspection: GameTargetInspection): string | null {
  if (inspection.removable) return null;
  switch (inspection.r2modman.state) {
    case 'managed':
      return describeRemoveOutcome('managedByR2modman');
    case 'unreadable':
      return describeRemoveOutcome('r2modmanUnreadable');
    case 'notApplicable':
    case 'unmanaged':
      return inspection.module.state === 'absent'
        ? describeRemoveOutcome('absent')
        : describeRemoveOutcome('notPlannerInstalled');
  }
}

export function projectGameModuleSettings(status: GameModuleStatus): GameModuleSettingsProduct {
  const { target, inspection } = status;
  return Object.freeze({
    location: Object.freeze({
      state: target === null ? 'unset' : 'set',
      name: target?.label ?? null,
      kindLabel:
        target === null ? null : target.kind === 'discovered' ? 'r2modman profile' : 'folder',
      path: target?.location ?? null,
      problem: status.targetProblem,
      confirmSwitchAway: inspection?.module.state === 'plannerInstalled',
      switchAwayRemoval: {
        available: inspection?.removable ?? false,
        reason: inspection === null ? null : removalRefusal(inspection),
      },
    }),
    module: target === null || inspection === null ? null : moduleSection(status, inspection),
  });
}

const PROFILE_HINTS = {
  none: undefined,
  plannerInstalled: 'Run Planner installed',
  modListUnreadable: 'Run Planner (mod list unreadable)',
  thunderstore: 'Run Planner (Thunderstore)',
} as const;

/** Discovered profiles as picker choices whose value is the profile path. */
export function projectGameProfileChoices(
  discovery: GameTargetDiscovery,
  currentPath: string | null,
): ContextualPickerModel<string> {
  return Object.freeze({
    sections: [
      {
        key: 'profiles',
        kind: 'category' as const,
        label: 'r2modman profiles',
        collapsible: false,
        items: discovery.profiles.map((profile) => {
          const hint = PROFILE_HINTS[profile.module];
          return {
            key: profile.path,
            value: profile.path,
            label: profile.label,
            ariaLabel: hint === undefined ? profile.label : `${profile.label}, ${hint}`,
            state: 'possible' as const,
            selected: profile.path === currentPath,
            disabled: false,
            ...(hint === undefined ? {} : { status: hint }),
            explanation: profile.location,
          };
        }),
      },
    ],
  });
}

export function projectGamePublicationReadiness(
  status: GameModuleStatus,
): GamePublicationReadiness {
  return Object.freeze({
    ready: status.publicationBlockers.length === 0,
    targetLocation: status.target?.location ?? null,
    reasons: status.publicationBlockers.map((blocker) => ({
      text: describePublicationBlocker(blocker),
      link:
        blocker.code.startsWith('modpackLib') && status.inspection !== null
          ? modpackLibLink(status.inspection.modpackLib.pageUrl)
          : null,
    })),
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
      return `${UNREADABLE_MOD_LIST}, so the module was not removed.`;
  }
}
