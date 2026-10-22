import type { ContextualPickerModel } from '@planner/projections/contextual/contextualPicker';
import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { ExecutionCompilerError } from '@run-planner/engine/execution-plan';
import type { StartPointPublicationBlock } from '@run-planner/engine/execution-plan';
import type { CurrentGamePlan } from '@planner/workspace/projectOperations';
import type { SlotRebuildReport } from '@planner/workspace/slotRebuild';
import { describeStartPointBlocked } from '@planner/projections/startPointCopy';
import { ownEntry, slotLoadoutLabel } from '@planner/projections/gameSlotSummary';
import type { GameActivationFailure, GameSendFailure } from '@planner/state/gameSendSessionSlice';
import type {
  GameActiveSlotNumber,
  GameActiveSlotSetting,
  GameEventSlot,
  GameModuleInstallResult,
  GameModuleRemoveResult,
  GameModuleStatus,
  GamePublicationBlocker,
  GameTargetDiscovery,
  GamePlanSlot,
  GamePlanSlotNumber,
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
  // The planner's own step follows Rust's install action, shown while the module blocks
  // publishing, is older than this planner's module, or was modified since install.
  const action = inspection.install.action;
  const moduleStep =
    action !== 'current' &&
    (hasModuleBlocker(status) || inspection.install.updateAvailable || inspection.module.modified);
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

function isReady(status: GameModuleStatus): boolean {
  return (
    status.publicationBlockers.length === 0 && projectGamePanel(status).module?.state === 'ready'
  );
}

export interface GameActiveSlotIntent {
  readonly kind: 'setActiveSlot';
  readonly slot: GameActiveSlotNumber;
}

export interface GamePlanSentTime {
  /** Compact relative time, such as "4h ago". */
  readonly ago: string;
  /** The exact local date and time. */
  readonly exact: string;
  readonly iso: string;
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

function ownLabel(
  records: Readonly<Record<string, { readonly label: string } | undefined>>,
  key: string | null,
): string | undefined {
  return ownEntry(records, key)?.label;
}

function slotMarker(
  slot: GamePlanSlot,
  current: CurrentGamePlan,
): 'current' | 'olderVersion' | null {
  if (current.kind !== 'publishable' || slot.state !== 'present') return null;
  if (slot.projectId !== current.projectId) return null;
  return slot.planFingerprint === current.planFingerprint ? 'current' : 'olderVersion';
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
    case 'executionCoverageMissing':
    case null:
      return 'The game module can’t run this plan yet.';
  }
}

function rebuildSummary(report: SlotRebuildReport | null): string | null {
  if (report === null) return null;
  if (report.problem !== null) return `Slots not rebuilt: ${report.problem}`;
  const rebuilt = report.outcomes.filter((outcome) => outcome.kind === 'rebuilt').length;
  const failed = report.outcomes.filter(
    (outcome) => outcome.kind === 'failed' || outcome.kind === 'defect',
  ).length;
  if (rebuilt === 0 && failed === 0) return null;
  const slots = (count: number) => `${count} ${count === 1 ? 'slot' : 'slots'}`;
  if (rebuilt === 0) return `Couldn’t rebuild ${slots(failed)}`;
  return failed === 0
    ? `Rebuilt ${slots(rebuilt)}`
    : `Rebuilt ${slots(rebuilt)} · couldn’t rebuild ${slots(failed)}`;
}

/**
 * The slot the game module plays next: the one `active-slot.json` names, or slot 1 when the
 * file is missing or invalid. Null while the target's slots cannot be read.
 */
export function projectNextRunSlot(status: GameModuleStatus | null): GameActiveSlotNumber | null {
  const file = status?.inspection?.activeSlot;
  if (file === undefined) return null;
  return file.state === 'present' ? file.slot : 1;
}

/** Whether the next run plays the event slot, which holds a plan the module can play. */
export function projectEventPlaysNext(status: GameModuleStatus | null): boolean {
  return projectNextRunSlot(status) === 0 && status?.inspection?.eventSlot.state === 'present';
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
  | `Send to slot ${GamePlanSlotNumber}`
  | `Slot ${GamePlanSlotNumber} · up to date`
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
    | 'upToDate'
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
  /** The plan's fingerprint as it is now; compiled only while the plan is in a slot. */
  readonly planFingerprint?: string | null;
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
 * The header's split send button; a send also makes its slot active. It sends to the plan's own
 * slot (the one that plays next when it has several), else the slot last sent this session while
 * it is still empty, else the first empty slot; with none of those it opens the slot picker. A
 * slot already holding the plan as it is now has nothing to send.
 */
export function projectGameSendButton(
  status: GameModuleStatus | null,
  project: GameSendProject | null,
  lastSentSlot: GamePlanSlotNumber | null,
  activity: GameSendActivity,
  activationFailure: GameActivationFailure | null = null,
): GameSendButton {
  switch (activity.kind) {
    case 'sending':
      return inactive('sending', 'Sending…', null);
    case 'sent':
      return inactive(
        'sent',
        `✓ Sent · Slot ${activity.slot}`,
        `Sent to slot ${activity.slot} at ${localTime(activity.atMs)}; ${stillInactive(activationFailure, status) ? 'not made active' : 'now active'}.`,
      );
    case 'failed':
      return inactive('failed', '! Not sent', 'Details are in the slot picker.');
    case 'idle':
      break;
  }
  if (project === null) return inactive('noProject', 'Send to game', 'Open a plan first.');
  if (status === null || !isReady(status)) {
    return inactive('notReady', 'Send to game', 'Set up the game on the Game tab.');
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
  const slots = status.inspection?.planSlots ?? [];
  const own = slots.filter(
    (slot) =>
      (slot.state === 'present' || slot.state === 'stale') && slot.projectId === project.projectId,
  );
  const next = projectNextRunSlot(status);
  const ownSlot = own.find((slot) => slot.slot === next) ?? own[0];
  if (ownSlot !== undefined) {
    const upToDate =
      ownSlot.state === 'present' &&
      project.planFingerprint != null &&
      ownSlot.planFingerprint === project.planFingerprint;
    return upToDate
      ? inactive('upToDate', `Slot ${ownSlot.slot} · up to date`, null)
      : {
          state: 'ready',
          label: `Send to slot ${ownSlot.slot}`,
          action: { kind: 'send', slot: ownSlot.slot },
          description: null,
        };
  }
  const lastSent = slots.find((slot) => slot.slot === lastSentSlot && slot.state === 'empty');
  const target = lastSent ?? slots.find((slot) => slot.state === 'empty');
  if (target === undefined) {
    return {
      state: 'chooseSlot',
      label: 'Send to game…',
      action: { kind: 'openPlans' },
      description: 'Choose a slot.',
    };
  }
  return {
    state: 'ready',
    label: `Send to slot ${target.slot}`,
    action: { kind: 'send', slot: target.slot },
    description: null,
  };
}

/** The Game panel's notice of the latest failed send. */
export function describeLastSendFailure(failure: GameSendFailure): string {
  return `Last send failed at ${localTime(failure.atMs)}: ${failure.message}`;
}

/** What a Home slot row says it holds. */
export type HomeSlotPlan =
  | {
      readonly kind: 'library';
      readonly key: string;
      readonly name: string;
      readonly marker: 'current' | 'older' | null;
      readonly reason: string | null;
    }
  | { readonly kind: 'notInLibrary'; readonly name: string | null; readonly note: string | null }
  | { readonly kind: 'event'; readonly title: string | null };

/** The slot's place in the next run: it plays next, can be made to, or cannot be played. */
export type HomeSlotNextRun =
  | { readonly kind: 'playsNext' }
  | { readonly kind: 'available'; readonly intent: GameActiveSlotIntent }
  | { readonly kind: 'unplayable' };

export interface HomeSlotRow {
  readonly slot: GameActiveSlotNumber;
  readonly label: string;
  readonly state: GamePlanSlot['state'];
  /** Null for a slot without a readable plan, which shows its summary. */
  readonly plan: HomeSlotPlan | null;
  readonly summary: 'Empty' | 'Unreadable' | null;
  readonly route: string | null;
  readonly aspect: string | null;
  readonly sent: GamePlanSentTime | null;
  /** Null for a slot holding no plan. */
  readonly nextRun: HomeSlotNextRun | null;
}

export interface HomeSlotsProduct {
  readonly rows: readonly HomeSlotRow[];
  readonly rebuild: {
    readonly available: boolean;
    /** How many outdated slots a rebuild would write, or the last rebuild's result. */
    readonly summary: string | null;
  };
}

function slotsText(count: number): string {
  return `${count} ${count === 1 ? 'slot' : 'slots'}`;
}

/**
 * Home's slot table: every slot, the event slot first, with the library plan it holds, whether
 * it plays next, and the outdated slots a rebuild would write. Home never sends or clears slots.
 */
export function projectHomeSlots(
  status: GameModuleStatus,
  catalog: Catalog,
  now: number,
  links: {
    readonly bySlot: ReadonlyMap<
      GamePlanSlotNumber,
      {
        readonly key: string;
        readonly name: string;
        readonly link: {
          readonly marker: 'current' | 'older' | null;
          readonly reason: string | null;
        };
      }
    >;
  },
  rebuild: SlotRebuildReport | null = null,
): HomeSlotsProduct | null {
  const inspection = status.inspection;
  if (inspection === null) return null;
  const next = projectNextRunSlot(status);
  const nextRun = (slot: GamePlanSlot | GameEventSlot): HomeSlotNextRun | null => {
    if (slot.state === 'empty' || slot.state === 'unreadable') return null;
    if (slot.slot === next && slot.state === 'present') return { kind: 'playsNext' };
    return slot.state === 'present'
      ? { kind: 'available', intent: { kind: 'setActiveSlot', slot: slot.slot } }
      : { kind: 'unplayable' };
  };
  const columns = (slot: GamePlanSlot | GameEventSlot) => {
    const readable = slot.state === 'present' || slot.state === 'stale';
    return {
      route: !readable
        ? null
        : slot.routeKey === null
          ? '—'
          : (ownLabel(catalog.routes.byKey, slot.routeKey) ?? slot.routeKey),
      aspect: readable ? slotLoadoutLabel(catalog, slot.weaponKey, slot.aspectKey) : null,
      sent: readable && slot.modifiedAtMs !== null ? sentTime(slot.modifiedAtMs, now) : null,
    };
  };
  const event = inspection.eventSlot;
  const rows: HomeSlotRow[] = [];
  if (event.state === 'present' || event.state === 'stale') {
    rows.push({
      slot: event.slot,
      label: 'Event',
      state: event.state,
      plan: { kind: 'event', title: event.event?.title ?? event.displayName },
      summary: null,
      ...columns(event),
      nextRun: nextRun(event),
    });
  }
  for (const slot of inspection.planSlots) {
    const readable = slot.state === 'present' || slot.state === 'stale';
    const linked = links.bySlot.get(slot.slot);
    // A failed rebuild says why in place of what the slot needs.
    const rebuildFailure = rebuild?.outcomes.find(
      (outcome) =>
        outcome.slot === slot.slot && (outcome.kind === 'failed' || outcome.kind === 'defect'),
    );
    const failure =
      rebuildFailure === undefined || !('reason' in rebuildFailure) ? null : rebuildFailure.reason;
    const outdated =
      slot.state !== 'stale'
        ? null
        : (failure ??
          (slot.hasSource
            ? 'Outdated for this module · rebuild to play'
            : 'Outdated for this module · send again to play'));
    rows.push({
      slot: slot.slot,
      label: `Slot ${slot.slot}`,
      state: slot.state,
      plan: !readable
        ? null
        : linked === undefined
          ? { kind: 'notInLibrary', name: slot.displayName, note: outdated }
          : {
              kind: 'library',
              key: linked.key,
              name: linked.name,
              marker: linked.link.marker,
              reason: slot.state === 'stale' ? outdated : linked.link.reason,
            },
      summary: slot.state === 'empty' ? 'Empty' : slot.state === 'unreadable' ? 'Unreadable' : null,
      ...columns(slot),
      nextRun: nextRun(slot),
    });
  }
  const rebuildable = inspection.planSlots.filter(
    (slot) => slot.state === 'stale' && slot.hasSource,
  ).length;
  return Object.freeze({
    rows,
    rebuild: {
      available: rebuildable > 0,
      summary:
        rebuildSummary(rebuild) ??
        (rebuildable === 0
          ? null
          : `${slotsText(rebuildable)} ${rebuildable === 1 ? 'needs' : 'need'} a rebuild for module ${status.bundledVersion}.`),
    },
  });
}

const GAME_NOT_READY = 'Set up or update the game module on the Game tab to send plans.';

/** Who holds a slot, as the editor's slot picker names it. */
export type SendSlotOccupant =
  | { readonly kind: 'thisPlan'; readonly marker: 'current' | 'older' }
  | { readonly kind: 'plan'; readonly name: string }
  | { readonly kind: 'notInLibrary' }
  | { readonly kind: 'empty' }
  | { readonly kind: 'unreadable' };

export interface SendSlotPick {
  readonly slot: GamePlanSlotNumber;
  readonly occupant: SendSlotOccupant;
  /** Null while the plan cannot be sent. */
  readonly action: {
    readonly label: 'Send here' | 'Replace' | 'Update' | 'Current';
    /** Replacing another plan asks first. */
    readonly confirm: boolean;
    readonly enabled: boolean;
  } | null;
}

export interface SendOwnSlot {
  readonly slot: GamePlanSlotNumber;
  readonly marker: 'current' | 'older';
  readonly playsNext: boolean;
  readonly sent: GamePlanSentTime | null;
}

/** The editor's Slots popover: the open plan's slots, and every slot to send it to. */
export interface SendSlotsProduct {
  readonly own: readonly SendOwnSlot[];
  readonly olderCount: number;
  readonly picks: readonly SendSlotPick[];
  /** Why the plan cannot be sent; slot actions are absent while set. */
  readonly unavailableReason: string | null;
}

export function projectSendSlots(
  status: GameModuleStatus,
  current: CurrentGamePlan,
  projectId: string | null,
  libraryNames: ReadonlyMap<GamePlanSlotNumber, string>,
  now: number,
): SendSlotsProduct | null {
  if (status.inspection === null) return null;
  const reason = isReady(status) ? unavailableReason(current) : GAME_NOT_READY;
  const next = projectNextRunSlot(status);
  const own: SendOwnSlot[] = [];
  const picks = status.inspection.planSlots.map((slot): SendSlotPick => {
    const readable = slot.state === 'present' || slot.state === 'stale';
    const mine = readable && projectId !== null && slot.projectId === projectId;
    const marker: 'current' | 'older' =
      mine && slot.state === 'present' && slotMarker(slot, current) === 'current'
        ? 'current'
        : 'older';
    if (mine) {
      own.push({
        slot: slot.slot,
        marker,
        playsNext: slot.slot === next,
        sent: slot.modifiedAtMs === null ? null : sentTime(slot.modifiedAtMs, now),
      });
    }
    const occupant: SendSlotOccupant = mine
      ? { kind: 'thisPlan', marker }
      : slot.state === 'empty'
        ? { kind: 'empty' }
        : slot.state === 'unreadable'
          ? { kind: 'unreadable' }
          : libraryNames.has(slot.slot)
            ? { kind: 'plan', name: libraryNames.get(slot.slot)! }
            : { kind: 'notInLibrary' };
    const label = mine
      ? marker === 'current'
        ? 'Current'
        : 'Update'
      : slot.state === 'empty'
        ? 'Send here'
        : 'Replace';
    return {
      slot: slot.slot,
      occupant,
      action:
        reason === null
          ? { label, confirm: !mine && slot.state !== 'empty', enabled: label !== 'Current' }
          : null,
    };
  });
  return Object.freeze({
    own,
    olderCount: own.filter((slot) => slot.marker === 'older').length,
    picks,
    unavailableReason: reason,
  });
}
