import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ExecutionCompilerError } from '@run-planner/engine/execution-plan';
import type { StartPointPublicationBlock } from '@run-planner/engine/execution-plan';
import type { ProfileStatus } from '@planner/state/store';
import type { CurrentGamePlan } from '@planner/workspace/projectOperations';
import { describeStartPointBlocked } from '@planner/projections/startPointCopy';
import type { GameActivationFailure, GameSendFailure } from '@planner/state/gameSendSessionSlice';
import type {
  GameActiveSlotSetting,
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
  readonly state:
    'ready' | 'needsSetup' | 'noLocation' | 'checking' | 'unavailable' | 'lastSendFailed';
  readonly symbol: '✓' | '!' | '○' | '…';
  readonly accessibleName: string;
}

function isReady(status: GameModuleStatus): boolean {
  return (
    status.publicationBlockers.length === 0 && projectGamePanel(status).module?.state === 'ready'
  );
}

/**
 * The header indicator: one overall state from the same host facts as the Game panel. A failed
 * last send outranks every state once status is known.
 */
export function projectGameIndicator(
  snapshot: GameStatusSnapshot,
  lastSendFailed = false,
): GameIndicator {
  const { status, error } = snapshot;
  if (lastSendFailed && (status !== null || error !== null)) {
    return {
      state: 'lastSendFailed',
      symbol: '!',
      accessibleName: 'Game — last send failed',
    };
  }
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

export type GamePlanSlotSummary = 'Empty' | 'Sent by another build — send again' | 'Unreadable';

const SLOT_SUMMARIES: Readonly<Record<GamePlanSlot['state'], GamePlanSlotSummary | null>> = {
  empty: 'Empty',
  present: null,
  stale: 'Sent by another build — send again',
  unreadable: 'Unreadable',
};

export type GamePlanSlotActionLabel = 'Send here' | 'Replace' | 'Save and send' | 'Save and send…';

export interface GamePlanSlotRow {
  readonly slot: GamePlanSlotNumber;
  readonly state: GamePlanSlot['state'];
  /** Present only for a readable plan. */
  readonly columns: {
    /** The plan's saved name, or null for an unnamed plan. */
    readonly plan: string | null;
    readonly route: string;
    readonly endsAt: string;
    readonly aspect: string;
    readonly sent: GamePlanSentTime | null;
  } | null;
  readonly summary: GamePlanSlotSummary | null;
  readonly marker: 'current' | 'olderVersion' | null;
  readonly action: { readonly label: GamePlanSlotActionLabel; readonly confirm: boolean } | null;
  /** This row's Active slot radio; the intent is null while the radio is disabled. */
  readonly active: { readonly checked: boolean; readonly intent: GameActiveSlotIntent | null };
}

export interface GameActiveSlotIntent {
  readonly kind: 'setActiveSlot';
  readonly slot: GamePlanSlotNumber;
}

/** A pending or failed Active slot write in the panel. */
export type GameActivationActivity =
  | { readonly kind: 'idle' }
  | { readonly kind: 'pending' }
  | { readonly kind: 'failed'; readonly message: string };

export interface GameActiveSlotGroup {
  readonly label: 'Active slot';
  /** The slot `active-slot.json` names, or null when it is missing or invalid. */
  readonly selected: GamePlanSlotNumber | null;
  readonly pending: boolean;
  readonly notice: string | null;
}

export interface GamePlanSentTime {
  /** Compact relative time, such as "4h ago". */
  readonly ago: string;
  /** The exact local date and time. */
  readonly exact: string;
  readonly iso: string;
}

export interface GamePlansProduct {
  readonly rows: readonly GamePlanSlotRow[];
  /** Why the current project cannot be sent; send actions are absent while set. */
  readonly unavailableReason: string | null;
  readonly activeSlot: GameActiveSlotGroup;
}

function sentAgo(modifiedAtMs: number, now: number): string {
  const seconds = Math.max(0, Math.round((now - modifiedAtMs) / 1000));
  if (seconds < 60) return 'just now';
  const minutes = Math.round(seconds / 60);
  if (minutes < 60) return `${minutes}m ago`;
  const hours = Math.round(minutes / 60);
  if (hours < 24) return `${hours}h ago`;
  return `${Math.round(hours / 24)}d ago`;
}

function sentTime(modifiedAtMs: number, now: number): GamePlanSentTime {
  const date = new Date(modifiedAtMs);
  return {
    ago: sentAgo(modifiedAtMs, now),
    exact: date.toLocaleString(undefined, { dateStyle: 'medium', timeStyle: 'short' }),
    iso: date.toISOString(),
  };
}

// Wire keys are untrusted, so only the catalog's own entries are read.
function ownEntry<Entry>(
  records: Readonly<Record<string, Entry | undefined>>,
  key: string | null,
): Entry | undefined {
  return key !== null && Object.hasOwn(records, key) ? records[key] : undefined;
}

function ownLabel(
  records: Readonly<Record<string, { readonly label: string } | undefined>>,
  key: string | null,
): string | undefined {
  return ownEntry(records, key)?.label;
}

function slotColumns(
  slot: GamePlanSlot,
  catalog: Catalog,
  now: number,
): GamePlanSlotRow['columns'] {
  if (slot.state !== 'present' && slot.state !== 'stale') return null;
  const endKey = slot.biomeKeys.at(-1);
  const weapon =
    slot.weaponKey === null
      ? undefined
      : (ownEntry(catalog.weapons.byKey, slot.weaponKey)?.shortLabel ?? slot.weaponKey);
  // A plan with a loadout but no aspect starts without one.
  const aspectLabel =
    ownLabel(catalog.aspects.byKey, slot.aspectKey) ??
    slot.aspectKey ??
    (slot.weaponKey === null ? 'Unknown' : 'None');
  return {
    plan: slot.displayName,
    route:
      slot.routeKey === null
        ? '—'
        : (ownLabel(catalog.routes.byKey, slot.routeKey) ?? slot.routeKey),
    endsAt: endKey === undefined ? '—' : (ownLabel(catalog.biomes.byKey, endKey) ?? endKey),
    aspect: weapon === undefined ? aspectLabel : `${aspectLabel} (${weapon})`,
    sent: slot.modifiedAtMs === null ? null : sentTime(slot.modifiedAtMs, now),
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
      return current.code === 'startPointIneligible' && current.startPointReason !== undefined
        ? describeStartPointBlocked({ code: current.code, reason: current.startPointReason })
        : describeNotPublishable(current.code);
  }
}

const RESOLVE_FINDINGS = 'Resolve this plan’s findings before sending it.';

export function describeNotPublishable(code: ExecutionCompilerError['code'] | null): string {
  switch (code) {
    case 'unsupportedRoute':
      return 'The game module can’t run this route yet.';
    case 'unsupportedExtent':
      return 'The game module can’t run this route’s selection of biomes yet.';
    case 'openingMissing':
      return 'Plan the opening room before sending this plan.';
    case 'openingSelectionMissing':
      return 'Choose an exit for every planned room before sending this plan.';
    case 'notEligible':
      return RESOLVE_FINDINGS;
    case 'startPointIneligible':
      return 'The start point can’t start this run.';
    case 'startPointUnpublished':
      return describeStartPointBlocked({ code: 'startPointUnpublished' });
    case 'executionCoverageMissing':
    case null:
      return 'The game module can’t run this plan yet.';
  }
}

const IDLE_ACTIVATION: GameActivationActivity = Object.freeze({ kind: 'idle' });

/**
 * The six plan slots, shown only while the game module is ready. The Active slot radios show
 * the file as last read and enable only slots that hold a plan.
 */
export function projectGamePlans(
  status: GameModuleStatus,
  current: CurrentGamePlan,
  saveState: GameSaveState,
  catalog: Catalog,
  now: number,
  activation: GameActivationActivity = IDLE_ACTIVATION,
): GamePlansProduct | null {
  if (!isReady(status) || status.inspection === null) return null;
  const reason = unavailableReason(current);
  const file = status.inspection.activeSlot;
  const selected = file.state === 'present' ? file.slot : null;
  const pending = activation.kind === 'pending';
  return Object.freeze({
    unavailableReason: reason,
    activeSlot: {
      label: 'Active slot' as const,
      selected,
      pending,
      notice: activation.kind === 'failed' ? `Not made active: ${activation.message}` : null,
    },
    rows: status.inspection.planSlots.map((slot): GamePlanSlotRow => ({
      slot: slot.slot,
      state: slot.state,
      columns: slotColumns(slot, catalog, now),
      summary: SLOT_SUMMARIES[slot.state],
      marker: slotMarker(slot, current),
      action: reason === null ? slotAction(slot, saveState) : null,
      active: {
        checked: slot.slot === selected,
        intent:
          pending || slot.state !== 'present' ? null : { kind: 'setActiveSlot', slot: slot.slot },
      },
    })),
  });
}

/** Why an Active slot write did not take effect, or null when it did. */
export function describeActiveSlotSetting(setting: GameActiveSlotSetting): string | null {
  switch (setting.status) {
    case 'activated':
      return null;
    case 'blocked':
      return setting.blockers.length > 0
        ? setting.blockers.map(describePublicationBlocker).join(' ')
        : setting.message;
    case 'invalidSlot':
    case 'notPresent':
    case 'nativeWrite':
      return setting.message;
  }
}

// A send's activation failure stands until the file, as last read, names that slot.
function stillInactive(
  failure: GameActivationFailure | null,
  status: GameModuleStatus | null,
): failure is GameActivationFailure {
  const file = status?.inspection?.activeSlot;
  return failure !== null && !(file?.state === 'present' && file.slot === failure.slot);
}

/** The Game panel's notice of a send whose slot is still not active, or null. */
export function describeSentNotActivated(
  failure: GameActivationFailure | null,
  status: GameModuleStatus | null,
): string | null {
  return stillInactive(failure, status)
    ? `Sent to slot ${failure.slot} at ${localTime(failure.atMs)}, but it isn’t active: ${failure.message}`
    : null;
}

/** The header's announcement of a successful send. */
export function describeSent(
  slot: GamePlanSlotNumber,
  failure: GameActivationFailure | null,
  status: GameModuleStatus | null,
): string {
  return stillInactive(failure, status)
    ? `Sent to slot ${slot}; not made active.`
    : `Sent to slot ${slot}.`;
}

export type GameSendActivity =
  | { readonly kind: 'idle' }
  | { readonly kind: 'sending' }
  | { readonly kind: 'sent'; readonly slot: GamePlanSlotNumber; readonly atMs: number }
  | { readonly kind: 'failed' };

export type GameSendButtonLabel =
  | 'Send to game'
  | 'Send to game…'
  | `Send · Slot ${GamePlanSlotNumber}`
  | 'Saving…'
  | 'Sending…'
  | `✓ Sent · Slot ${GamePlanSlotNumber}`
  | '! Not sent';

export interface GameSendButton {
  readonly state:
    | 'noProject'
    | 'notReady'
    | 'notSendable'
    | 'chooseSlot'
    | 'ready'
    | 'saving'
    | 'sending'
    | 'sent'
    | 'failed';
  readonly label: GameSendButtonLabel;
  /** Present only while clicking does something. */
  readonly action:
    | { readonly kind: 'send'; readonly slot: GamePlanSlotNumber }
    | { readonly kind: 'openPlans' }
    | null;
  readonly description: string | null;
}

/** The header's open project, with the engine's execution-plan eligibility. */
export interface GameSendProject {
  readonly projectId: string;
  readonly eligible: boolean;
  /** The engine's reason the authored start point blocks publication. */
  readonly startPointBlock?: StartPointPublicationBlock;
}

function localTime(ms: number): string {
  return new Date(ms).toLocaleTimeString([], { hour: '2-digit', minute: '2-digit' });
}

function inactive(
  state: GameSendButton['state'],
  label: GameSendButtonLabel,
  description: string | null,
): GameSendButton {
  return { state, label, action: null, description };
}

/**
 * The always-present header send; a send also makes its slot active. It re-sends only to the slot last sent in this session for the
 * loaded project, while that slot is empty or still holds this project; otherwise it opens the
 * Game panel's plans. It uses the engine's eligibility without compiling.
 */
export function projectGameSendButton(
  status: GameModuleStatus | null,
  project: GameSendProject | null,
  lastSentSlot: GamePlanSlotNumber | null,
  saveState: GameSaveState,
  activity: GameSendActivity,
  activationFailure: GameActivationFailure | null = null,
): GameSendButton {
  switch (activity.kind) {
    case 'sending':
      return saveState === 'clean'
        ? inactive('sending', 'Sending…', null)
        : inactive('saving', 'Saving…', null);
    case 'sent':
      return inactive(
        'sent',
        `✓ Sent · Slot ${activity.slot}`,
        `Sent to slot ${activity.slot} at ${localTime(activity.atMs)}; ${stillInactive(activationFailure, status) ? 'not made active' : 'now active'}.`,
      );
    case 'failed':
      return inactive('failed', '! Not sent', 'Details are in the Game panel.');
    case 'idle':
      break;
  }
  if (project === null) return inactive('noProject', 'Send to game', 'Open a plan first.');
  if (status === null || !isReady(status)) {
    return inactive('notReady', 'Send to game', 'Set up the game in the Game panel.');
  }
  if (!project.eligible) {
    return inactive('notSendable', 'Send to game', describeNotPublishable('notEligible'));
  }
  if (project.startPointBlock !== undefined) {
    return inactive(
      'notSendable',
      'Send to game',
      describeStartPointBlocked(project.startPointBlock),
    );
  }
  const slot = status.inspection?.planSlots.find((entry) => entry.slot === lastSentSlot);
  const ownSlot =
    slot?.state === 'empty' ||
    ((slot?.state === 'present' || slot?.state === 'stale') &&
      slot.projectId === project.projectId);
  if (lastSentSlot === null || !ownSlot || saveState === 'unsaved') {
    return {
      state: 'chooseSlot',
      label: 'Send to game…',
      action: { kind: 'openPlans' },
      description: 'Choose a slot in the Game panel.',
    };
  }
  return {
    state: 'ready',
    label: `Send · Slot ${lastSentSlot}`,
    action: { kind: 'send', slot: lastSentSlot },
    description:
      saveState === 'clean' ? null : `Saves your changes, then sends to slot ${lastSentSlot}.`,
  };
}

/** The Game panel's notice of the latest failed send. */
export function describeLastSendFailure(failure: GameSendFailure): string {
  return `Last send failed at ${localTime(failure.atMs)}: ${failure.message}`;
}
