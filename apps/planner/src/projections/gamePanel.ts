import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ProfileStatus } from '@planner/state/store';
import type { CurrentGamePlan } from '@planner/workspace/projectOperations';
import type {
  GameModuleInstallResult,
  GameModuleRemoveResult,
  GameModuleStatus,
  GamePublicationBlocker,
  GameTargetDiscovery,
  GamePlanSlot,
  GamePlanSlotNumber,
  GameStatusSnapshot,
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

export interface GamePanelProduct {
  readonly location: GameLocationProduct;
  /** Present only when a target is set and could be inspected. */
  readonly module: GameModuleSectionProduct | null;
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
      return 'Set the game location in the Game panel.';
    case 'targetUnavailable':
      return 'The game location is unavailable. Change it in the Game panel.';
    case 'moduleMissing':
      return sentence('Install the game module in the Game panel', null);
    case 'moduleMismatch':
      return sentence('Update the game module in the Game panel', blocker.found ?? 'unrecognized');
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

export function projectGamePanel(status: GameModuleStatus): GamePanelProduct {
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

export interface GameIndicator {
  readonly state: 'ready' | 'needsSetup' | 'noLocation' | 'checking' | 'unavailable';
  readonly symbol: '✓' | '!' | '○' | '…';
  readonly accessibleName: string;
}

function isReady(status: GameModuleStatus): boolean {
  return (
    status.publicationBlockers.length === 0 && projectGamePanel(status).module?.state === 'ready'
  );
}

/** The header indicator: one overall state from the same host facts as the Game panel. */
export function projectGameIndicator(snapshot: GameStatusSnapshot): GameIndicator {
  const { status, error } = snapshot;
  if (status === null) {
    return error === null
      ? { state: 'checking', symbol: '…', accessibleName: 'Game — checking' }
      : {
          state: 'unavailable',
          symbol: '!',
          accessibleName: `Game — status unavailable: ${error}`,
        };
  }
  if (status.target === null) {
    return { state: 'noLocation', symbol: '○', accessibleName: 'Game — no location' };
  }
  return isReady(status)
    ? { state: 'ready', symbol: '✓', accessibleName: 'Game — ready' }
    : { state: 'needsSetup', symbol: '!', accessibleName: 'Game — needs setup' };
}

/** Whether sending first needs a save: never saved, unsaved changes, or clean. */
export type GameSaveState = 'unsaved' | 'dirty' | 'clean';

export function gameSaveState(
  profileStatus: ProfileStatus,
  fileName: string | null,
): GameSaveState {
  switch (profileStatus) {
    case 'Clean':
      return 'clean';
    case 'Dirty':
      return 'dirty';
    case 'Recovered':
      return fileName === null ? 'unsaved' : 'dirty';
    case 'Unsaved':
      return 'unsaved';
  }
}

export type GamePlanSlotActionLabel = 'Send here' | 'Replace' | 'Save and send' | 'Save and send…';

export interface GamePlanSlotRow {
  readonly slot: GamePlanSlotNumber;
  readonly state: GamePlanSlot['state'];
  /** Present only for a readable plan. */
  readonly columns: {
    readonly plan: string;
    readonly route: string;
    readonly endsAt: string;
    readonly aspect: string;
    readonly sent: string | null;
  } | null;
  readonly summary: 'Empty' | 'Unreadable' | null;
  readonly marker: 'current' | 'olderVersion' | null;
  readonly action: { readonly label: GamePlanSlotActionLabel; readonly confirm: boolean } | null;
}

export interface GamePlansProduct {
  readonly rows: readonly GamePlanSlotRow[];
  /** Why the current project cannot be sent; send actions are absent while set. */
  readonly unavailableReason: string | null;
}

const UNNAMED_PLAN = '(unnamed plan)';

function sentAgo(modifiedAtMs: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - modifiedAtMs) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes} min ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours} h ago`;
  const days = Math.round(hours / 24);
  return `${days} day${days === 1 ? '' : 's'} ago`;
}

// Wire keys are untrusted, so only the catalog's own entries give a label.
function ownLabel(
  records: Readonly<Record<string, { readonly label: string } | undefined>>,
  key: string | null,
): string | undefined {
  return key !== null && Object.hasOwn(records, key) ? records[key]?.label : undefined;
}

function slotColumns(
  slot: GamePlanSlot,
  catalog: Catalog,
  now: number,
): GamePlanSlotRow['columns'] {
  if (slot.state !== 'present') return null;
  const endKey = slot.biomeKeys.at(-1);
  const weapon = ownLabel(catalog.weapons.byKey, slot.weaponKey);
  const aspectLabel =
    ownLabel(catalog.aspects.byKey, slot.aspectKey) ?? slot.aspectKey ?? 'Unknown';
  return {
    plan: slot.displayName ?? UNNAMED_PLAN,
    route:
      slot.routeKey === null
        ? '—'
        : (ownLabel(catalog.routes.byKey, slot.routeKey) ?? slot.routeKey),
    endsAt: endKey === undefined ? '—' : (ownLabel(catalog.biomes.byKey, endKey) ?? endKey),
    aspect: weapon === undefined ? aspectLabel : `${aspectLabel} (${weapon})`,
    sent: slot.modifiedAtMs === null ? null : sentAgo(slot.modifiedAtMs, now),
  };
}

function slotMarker(slot: GamePlanSlot, current: CurrentGamePlan): GamePlanSlotRow['marker'] {
  if (current.kind !== 'publishable' || slot.state !== 'present') return null;
  if (slot.projectId !== current.projectId) return null;
  return slot.planFingerprint === current.planFingerprint ? 'current' : 'olderVersion';
}

function slotAction(
  slot: GamePlanSlot,
  saveState: GameSaveState,
): NonNullable<GamePlanSlotRow['action']> {
  const confirm = slot.state !== 'empty';
  switch (saveState) {
    case 'clean':
      return { label: confirm ? 'Replace' : 'Send here', confirm };
    case 'dirty':
      return { label: 'Save and send', confirm };
    case 'unsaved':
      return { label: 'Save and send…', confirm };
  }
}

function unavailableReason(current: CurrentGamePlan): string | null {
  switch (current.kind) {
    case 'publishable':
      return null;
    case 'noProject':
      return 'Open a project to send it to the game.';
    case 'notPublishable':
      return `This plan can’t be sent yet: ${current.reason}`;
  }
}

/** The six plan slots, shown only while the game module is ready. */
export function projectGamePlans(
  status: GameModuleStatus,
  current: CurrentGamePlan,
  saveState: GameSaveState,
  catalog: Catalog,
  now: number,
): GamePlansProduct | null {
  if (!isReady(status) || status.inspection === null) return null;
  const reason = unavailableReason(current);
  return Object.freeze({
    unavailableReason: reason,
    rows: status.inspection.planSlots.map((slot): GamePlanSlotRow => ({
      slot: slot.slot,
      state: slot.state,
      columns: slotColumns(slot, catalog, now),
      summary: slot.state === 'empty' ? 'Empty' : slot.state === 'unreadable' ? 'Unreadable' : null,
      marker: slotMarker(slot, current),
      action: reason === null ? slotAction(slot, saveState) : null,
    })),
  });
}

export interface GameQuickSend {
  readonly slot: GamePlanSlotNumber;
  readonly label: string;
}

/**
 * The header re-send to the slot last sent in this session for the loaded project: a ready
 * target, an engine-eligible project, and a slot that is empty or already holds this project.
 * Unsaved changes are saved in place first.
 */
export function projectGameQuickSend(
  status: GameModuleStatus | null,
  sendableProjectId: string | null,
  lastSentSlot: GamePlanSlotNumber | null,
  saveState: GameSaveState,
): GameQuickSend | null {
  if (status === null || lastSentSlot === null || sendableProjectId === null) return null;
  if (!isReady(status) || saveState === 'unsaved') return null;
  const slot = status.inspection?.planSlots.find((entry) => entry.slot === lastSentSlot);
  const ownSlot =
    slot?.state === 'empty' || (slot?.state === 'present' && slot.projectId === sendableProjectId);
  if (!ownSlot) return null;
  return {
    slot: lastSentSlot,
    label: `${saveState === 'clean' ? 'Send' : 'Save and send'} to game (slot ${lastSentSlot})`,
  };
}
