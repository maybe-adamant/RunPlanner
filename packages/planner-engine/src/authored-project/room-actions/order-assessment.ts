import type { RoomActionReference, RoomOccurrence } from '../model';
import { CHALLENGE_SWITCH_ACTION } from '../acquisition/challenge-switch';
import type {
  RoomActionCheckpointContribution,
  RoomActionContribution,
  RoomActionDependency,
  RoomActionDomain,
  RoomActionDomainContribution,
} from './domain';
import {
  roomLifecycleWindowOrdinal,
  roomLifecycleWindowResolves,
  type RoomActionWindow,
  type RoomLifecycleStructure,
} from './lifecycle-structure';
import { roomActionKey } from './state';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

export type RoomActionOrderIssue =
  | { readonly kind: 'stale'; readonly reference: RoomActionReference }
  | { readonly kind: 'unrankedRequired'; readonly reference: RoomActionReference }
  | {
      readonly kind: 'dependency';
      readonly reference: RoomActionReference;
      readonly detail: string;
      readonly dependency: RoomActionDependency;
      readonly checkpointUnavailable?: true;
    }
  | {
      readonly kind: 'window';
      readonly reference: RoomActionReference;
      readonly detail: string;
      readonly window: RoomActionWindow;
      readonly precedingAction: RoomActionReference;
      readonly precedingWindow: RoomActionWindow;
    }
  /**
   * A row ordered before a ranked required action of an earlier window: that
   * action's deadline passes before the row's window opens, so the walk stops here.
   */
  | {
      readonly kind: 'requiredFirst';
      readonly reference: RoomActionReference;
      readonly detail: string;
      readonly window: RoomActionWindow;
      readonly requiredAction: RoomActionReference;
      readonly requiredWindow: RoomActionWindow;
    };

/** A placement's blockers: the prefix's dependency, window and required-first issues. */
export type RoomActionPlacementBlocker = Extract<
  RoomActionOrderIssue,
  { kind: 'dependency' | 'window' | 'requiredFirst' }
>;

/** The structural facts one occurrence's action order is judged against. */
export interface RoomActionOrderContext {
  readonly active: ReadonlyMap<string, RoomActionContribution>;
  readonly checkpoints: ReadonlyMap<string, RoomActionCheckpointContribution>;
  readonly lifecycleStructure: RoomLifecycleStructure;
  /** An action nothing may follow (a left switch press: leaving ends the room). */
  readonly terminalActionKey?: string;
  /** Each active action's window ordinal, which no order changes. */
  readonly windowOrdinals: ReadonlyMap<string, number>;
  /** Active required action keys, and those of each Ship wheel's post-combat window. */
  readonly requiredKeys: readonly string[];
  readonly requiredKeysByWheel: ReadonlyMap<string, readonly string[]>;
}

export function roomActionOrderContext(options: {
  readonly contributions: readonly RoomActionDomainContribution[];
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly terminalActionKey?: string;
}): RoomActionOrderContext {
  const active = new Map(
    options.contributions.flatMap((entry) =>
      entry.kind === 'action' ? [[roomActionKey(entry.reference), entry] as const] : [],
    ),
  );
  const required = [...active].filter(([, entry]) => entry.participation === 'required');
  const requiredKeysByWheel = new Map<string, string[]>();
  for (const [key, entry] of required) {
    if (entry.window.kind !== 'shipPostCombat') continue;
    requiredKeysByWheel.set(entry.window.wheelKey, [
      ...(requiredKeysByWheel.get(entry.window.wheelKey) ?? []),
      key,
    ]);
  }
  return frozen({
    active,
    checkpoints: new Map(
      options.contributions.flatMap((entry) =>
        entry.kind === 'checkpoint' ? [[entry.checkpointKey, entry] as const] : [],
      ),
    ),
    lifecycleStructure: options.lifecycleStructure,
    ...(options.terminalActionKey === undefined
      ? {}
      : { terminalActionKey: options.terminalActionKey }),
    windowOrdinals: new Map(
      [...active].map(([key, entry]) => [
        key,
        roomLifecycleWindowOrdinal(options.lifecycleStructure, entry.window),
      ]),
    ),
    requiredKeys: frozen(required.map(([key]) => key)),
    requiredKeysByWheel,
  });
}

/** Action keys by reference identity; a key is a pure function of its frozen reference. */
const actionKeys = new WeakMap<RoomActionReference, string>();

function keyOf(reference: RoomActionReference): string {
  let key = actionKeys.get(reference);
  if (key === undefined) {
    key = roomActionKey(reference);
    actionKeys.set(reference, key);
  }
  return key;
}

/** The left switch press ends its room's actions; no other action is terminal. */
export function terminalRoomActionKey(
  occurrence: Pick<RoomOccurrence, 'challengeSwitch'>,
): string | undefined {
  return occurrence.challengeSwitch?.outcome === 'left'
    ? roomActionKey(CHALLENGE_SWITCH_ACTION)
    : undefined;
}

/**
 * The stale, dependency and window issues of the rows at or before `through`,
 * row issues first: a row is judged by the rows before it and by where the
 * order places the actions its checkpoints wait on.
 */
function rowAndWindowIssues(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
  through: number,
): { readonly rows: RoomActionOrderIssue[]; readonly windows: RoomActionOrderIssue[] } {
  const { active, checkpoints, lifecycleStructure, windowOrdinals } = context;
  const rows: RoomActionOrderIssue[] = [];
  const windows: RoomActionOrderIssue[] = [];
  const keys = order.map(keyOf);
  const indexes = new Map(keys.map((key, index) => [key, index]));
  const latestIndex = (requiredKeys: readonly string[]) =>
    requiredKeys.reduce((rank, key) => Math.max(rank, indexes.get(key) ?? -1), -1);
  const afterIndexes = new Map<string, number>();
  const checkpointAfterIndex = (checkpointKey: string): number => {
    let index = afterIndexes.get(checkpointKey);
    if (index !== undefined) return index;
    // The exit is usable once every required action is done.
    index =
      checkpointKey === 'exitUsable'
        ? latestIndex(context.requiredKeys)
        : !checkpointKey.startsWith('nextPhaseUsable:') || !checkpoints.has(checkpointKey)
          ? -1
          : latestIndex(
              context.requiredKeysByWheel.get(checkpointKey.slice('nextPhaseUsable:'.length)) ?? [],
            );
    afterIndexes.set(checkpointKey, index);
    return index;
  };
  let left: RoomActionContribution | undefined;
  let leftOrdinal = 0;
  for (let ownIndex = 0; ownIndex <= through && ownIndex < order.length; ownIndex += 1) {
    const reference = order[ownIndex]!;
    const entry = active.get(keys[ownIndex]!);
    if (entry === undefined) {
      rows.push(frozen({ kind: 'stale', reference }));
      continue;
    }
    for (const dependency of entry.dependencies) {
      if (dependency.kind === 'afterAction') {
        const dependencyKey = keyOf(dependency.action);
        const dependencyIndex = indexes.get(dependencyKey);
        if (dependencyIndex !== undefined && ownIndex > dependencyIndex) continue;
        rows.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `must follow ${dependencyKey}`,
            dependency,
          }),
        );
        continue;
      }
      const checkpoint = checkpoints.get(dependency.checkpointKey);
      if (checkpoint === undefined) {
        rows.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `has unknown checkpoint ${dependency.checkpointKey}`,
            dependency,
            checkpointUnavailable: true,
          }),
        );
        continue;
      }
      const ownRank = windowOrdinals.get(keys[ownIndex]!)!;
      const checkpointWindowRank = roomLifecycleWindowOrdinal(
        lifecycleStructure,
        checkpoint.window,
      );
      const valid =
        dependency.kind === 'afterCheckpoint'
          ? ownRank >= checkpointWindowRank &&
            ownIndex >= checkpointAfterIndex(dependency.checkpointKey)
          : ownRank <= checkpointWindowRank;
      if (!valid) {
        rows.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `${dependency.kind} ${dependency.checkpointKey}`,
            dependency,
          }),
        );
      }
    }
    if (entry.windowFollowsOrder === true) continue;
    const ordinal = windowOrdinals.get(keys[ownIndex]!)!;
    if (left !== undefined && leftOrdinal > ordinal) {
      windows.push(
        frozen({
          kind: 'window',
          reference: entry.reference,
          detail: 'crosses a fixed lifecycle window',
          window: entry.window,
          precedingAction: left.reference,
          precedingWindow: left.window,
        }),
      );
    }
    left = entry;
    leftOrdinal = ordinal;
  }
  return { rows, windows };
}

/**
 * Every structural issue of one authored order: stale, missing required,
 * dependency, window and required-first.
 */
export function assessRoomActionOrder(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): readonly RoomActionOrderIssue[] {
  const { rows, windows } = rowAndWindowIssues(order, context, order.length - 1);
  const ranked = new Set(order.map(keyOf));
  const unranked = context.requiredKeys
    .filter((key) => !ranked.has(key))
    .map((key) =>
      frozen({ kind: 'unrankedRequired' as const, reference: context.active.get(key)!.reference }),
    );
  const deadlines = requiredDeadlinesAfter(order, context);
  const requiredFirst = order.flatMap((reference, index) => {
    const issue = requiredFirstIssue(reference, deadlines[index], context);
    return issue === undefined ? [] : [issue];
  });
  return frozen([...rows, ...unranked, ...windows, ...requiredFirst]);
}

interface RequiredDeadline {
  readonly entry: RoomActionContribution;
  readonly ordinal: number;
}

/**
 * For each row, the ranked required action ordered after it whose window
 * closes first (the earliest such row on a tie). An action whose window names
 * a phase the room does not play has no deadline here; its placement is its
 * own finding.
 */
function requiredDeadlinesAfter(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): readonly (RequiredDeadline | undefined)[] {
  const deadlines: (RequiredDeadline | undefined)[] = new Array(order.length);
  let earliest: RequiredDeadline | undefined;
  for (let index = order.length - 1; index >= 0; index -= 1) {
    deadlines[index] = earliest;
    const key = keyOf(order[index]!);
    const entry = context.active.get(key);
    if (
      entry?.participation !== 'required' ||
      entry.windowFollowsOrder === true ||
      !roomLifecycleWindowResolves(context.lifecycleStructure, entry.window)
    )
      continue;
    const ordinal = context.windowOrdinals.get(key)!;
    if (earliest === undefined || ordinal <= earliest.ordinal) earliest = { entry, ordinal };
  }
  return deadlines;
}

/**
 * A ranked required action's window closes at its deadline, so a row whose
 * window is later than that of a required action ordered after it is not
 * reached: the required action must come first.
 */
function requiredFirstIssue(
  reference: RoomActionReference,
  deadline: RequiredDeadline | undefined,
  context: RoomActionOrderContext,
): Extract<RoomActionOrderIssue, { kind: 'requiredFirst' }> | undefined {
  const key = keyOf(reference);
  const entry = context.active.get(key);
  if (entry === undefined || deadline === undefined || entry.windowFollowsOrder === true)
    return undefined;
  if (context.windowOrdinals.get(key)! <= deadline.ordinal) return undefined;
  const required = deadline.entry;
  return frozen({
    kind: 'requiredFirst',
    reference: entry.reference,
    detail: `must follow ${keyOf(required.reference)}, a required action of an earlier window`,
    window: entry.window,
    requiredAction: required.reference,
    requiredWindow: required.window,
  });
}

/** Each row at or before `lastIndex` that a required action ordered after it must precede. */
function requiredFirstBlockers(
  order: readonly RoomActionReference[],
  lastIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementBlocker[] {
  const deadline = requiredDeadlinesAfter(order, context)[lastIndex];
  if (deadline === undefined) return [];
  return order.slice(0, lastIndex + 1).flatMap((reference) => {
    const issue = requiredFirstIssue(reference, deadline, context);
    return issue === undefined ? [] : [issue];
  });
}

/** A proposed order, judged as the walk reaches its last placed action. */
export interface RoomActionPlacementAssessment {
  readonly order: readonly RoomActionReference[];
  /** Dependency and window issues of the placed actions and every row before them. */
  readonly blockers: readonly RoomActionPlacementBlocker[];
  /** A left switch press at or before a placed action ends the room before an action after it. */
  readonly followsTerminal: boolean;
  readonly structurallyAuthorable: boolean;
}

/** One insertion position and the order it yields. */
export interface RoomActionInsertionAssessment extends RoomActionPlacementAssessment {
  readonly toIndex: number;
}

/**
 * Judges actions placed through `order[lastIndex]` by their prefix, as the
 * walk reaches them: each placed action and every row before it must keep its
 * window, dependencies and checkpoints, follow every ranked required action of
 * an earlier window, and none may follow a left switch press. Other rows after
 * the placed actions take no part; an issue the placement gives them is theirs
 * when the walk reaches them.
 */
export function assessRoomActionPlacement(
  order: readonly RoomActionReference[],
  lastIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementAssessment {
  const { rows, windows } = rowAndWindowIssues(order, context, lastIndex);
  const blockers: readonly RoomActionPlacementBlocker[] = frozen([
    ...[...rows, ...windows].filter(
      (issue): issue is Extract<RoomActionOrderIssue, { kind: 'dependency' | 'window' }> =>
        issue.kind === 'dependency' || issue.kind === 'window',
    ),
    ...requiredFirstBlockers(order, lastIndex, context),
  ]);
  const terminalIndex =
    context.terminalActionKey === undefined
      ? -1
      : order.findIndex((reference) => keyOf(reference) === context.terminalActionKey);
  const followsTerminal =
    terminalIndex >= 0 && terminalIndex <= lastIndex && terminalIndex < order.length - 1;
  return frozen({
    order: frozen([...order]),
    blockers,
    followsTerminal,
    structurallyAuthorable: blockers.length === 0 && !followsTerminal,
  });
}

export function assessRoomActionInsertion(
  order: readonly RoomActionReference[],
  reference: RoomActionReference,
  toIndex: number,
  context: RoomActionOrderContext,
): RoomActionInsertionAssessment {
  const next = [...order];
  next.splice(toIndex, 0, reference);
  return frozen({ toIndex, ...assessRoomActionPlacement(next, toIndex, context) });
}

/** One move and the order it yields, judged like an insertion at `toIndex`. */
export function assessRoomActionMove(
  order: readonly RoomActionReference[],
  fromIndex: number,
  toIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementAssessment {
  const next = [...order];
  const [reference] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, reference!);
  return assessRoomActionPlacement(next, toIndex, context);
}

/** The contract error for an index whose placement is not structurally authorable. */
export function roomActionPlacementRefusal(
  index: number,
  reference: RoomActionReference,
  assessment: RoomActionPlacementAssessment,
): string | undefined {
  if (assessment.structurallyAuthorable) return undefined;
  if (assessment.followsTerminal)
    return `index ${index} follows leaving the switch fight, which ends the room`;
  const detail = assessment.blockers
    .map((blocker) => `${roomActionKey(blocker.reference)} ${blocker.detail}`)
    .join('; ');
  return `index ${index} is not a legal position for ${roomActionKey(reference)}: ${detail}`;
}

/**
 * Why inserting the action at this index is refused, or undefined when it is
 * structurally authorable. A command accepts its own default index without it.
 */
export function roomActionInsertionRefusal(
  order: readonly RoomActionReference[],
  reference: RoomActionReference,
  index: number,
  context: RoomActionOrderContext,
): string | undefined {
  if (!Number.isInteger(index) || index < 0 || index > order.length)
    return `index must be an integer from 0 through ${order.length}`;
  return roomActionPlacementRefusal(
    index,
    reference,
    assessRoomActionInsertion(order, reference, index, context),
  );
}

/** The order context a command judges an occurrence's insertion against. */
export function roomActionOrderContextForOccurrence(
  domain: Pick<RoomActionDomain, 'contributions' | 'lifecycleStructure'>,
  occurrence: Pick<RoomOccurrence, 'challengeSwitch'>,
): RoomActionOrderContext {
  const terminalActionKey = terminalRoomActionKey(occurrence);
  return roomActionOrderContext({
    contributions: domain.contributions,
    lifecycleStructure: domain.lifecycleStructure,
    ...(terminalActionKey === undefined ? {} : { terminalActionKey }),
  });
}
