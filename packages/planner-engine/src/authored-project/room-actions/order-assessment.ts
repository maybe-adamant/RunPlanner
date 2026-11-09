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
    };

export type RoomActionPlacementBlocker = Extract<
  RoomActionOrderIssue,
  { kind: 'dependency' | 'window' }
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

/** Every structural issue of one authored order: stale, missing required, dependency and window. */
export function assessRoomActionOrder(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): readonly RoomActionOrderIssue[] {
  const { active, checkpoints, lifecycleStructure, windowOrdinals } = context;
  const issues: RoomActionOrderIssue[] = [];
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
  order.forEach((reference, ownIndex) => {
    const entry = active.get(keys[ownIndex]!);
    if (entry === undefined) {
      issues.push(frozen({ kind: 'stale', reference }));
      return;
    }
    for (const dependency of entry.dependencies) {
      if (dependency.kind === 'afterAction') {
        const dependencyKey = keyOf(dependency.action);
        const dependencyIndex = indexes.get(dependencyKey);
        if (dependencyIndex !== undefined && ownIndex > dependencyIndex) continue;
        issues.push(
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
        issues.push(
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
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `${dependency.kind} ${dependency.checkpointKey}`,
            dependency,
          }),
        );
      }
    }
  });
  for (const key of context.requiredKeys) {
    if (!indexes.has(key)) {
      issues.push(frozen({ kind: 'unrankedRequired', reference: active.get(key)!.reference }));
    }
  }
  let left: RoomActionContribution | undefined;
  let leftOrdinal = 0;
  keys.forEach((key) => {
    const right = active.get(key);
    if (right === undefined || right.windowFollowsOrder === true) return;
    const rightOrdinal = windowOrdinals.get(key)!;
    if (left !== undefined && leftOrdinal > rightOrdinal) {
      issues.push(
        frozen({
          kind: 'window',
          reference: right.reference,
          detail: 'crosses a fixed lifecycle window',
          window: right.window,
          precedingAction: left.reference,
          precedingWindow: left.window,
        }),
      );
    }
    left = right;
    leftOrdinal = rightOrdinal;
  });
  return frozen(issues);
}

/** The dependency and window issues of a proposed order, as insert and move proposals carry them. */
export function roomActionPlacementBlockers(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): readonly RoomActionPlacementBlocker[] {
  return frozen(
    assessRoomActionOrder(order, context).filter(
      (issue): issue is RoomActionPlacementBlocker =>
        issue.kind === 'dependency' || issue.kind === 'window',
    ),
  );
}

/** No insertion or move may put more actions after the terminal action than now follow it. */
export function keepsTerminalActionLast(
  before: readonly RoomActionReference[],
  after: readonly RoomActionReference[],
  terminalActionKey: string | undefined,
): boolean {
  if (terminalActionKey === undefined) return true;
  const following = (order: readonly RoomActionReference[]) => {
    const index = order.findIndex((reference) => roomActionKey(reference) === terminalActionKey);
    return index < 0 ? 0 : order.length - index - 1;
  };
  return following(after) <= following(before);
}

/** A proposed order, judged by window, dependencies, checkpoints and the terminal action. */
export interface RoomActionPlacementAssessment {
  readonly order: readonly RoomActionReference[];
  readonly blockers: readonly RoomActionPlacementBlocker[];
  /** The proposed order puts an action after the terminal one. */
  readonly followsTerminal: boolean;
  readonly structurallyAuthorable: boolean;
}

/** One insertion position and the order it yields. */
export interface RoomActionInsertionAssessment extends RoomActionPlacementAssessment {
  readonly toIndex: number;
}

/** Judges the order that results from placing actions into `before`. */
export function assessRoomActionPlacement(
  before: readonly RoomActionReference[],
  after: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): RoomActionPlacementAssessment {
  const blockers = roomActionPlacementBlockers(after, context);
  const followsTerminal = !keepsTerminalActionLast(before, after, context.terminalActionKey);
  return frozen({
    order: frozen([...after]),
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
  return frozen({ toIndex, ...assessRoomActionPlacement(order, next, context) });
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
