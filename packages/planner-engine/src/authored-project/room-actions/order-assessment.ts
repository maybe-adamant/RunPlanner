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
}

export function roomActionOrderContext(options: {
  readonly contributions: readonly RoomActionDomainContribution[];
  readonly lifecycleStructure: RoomLifecycleStructure;
  readonly terminalActionKey?: string;
}): RoomActionOrderContext {
  return frozen({
    active: new Map(
      options.contributions.flatMap((entry) =>
        entry.kind === 'action' ? [[roomActionKey(entry.reference), entry] as const] : [],
      ),
    ),
    checkpoints: new Map(
      options.contributions.flatMap((entry) =>
        entry.kind === 'checkpoint' ? [[entry.checkpointKey, entry] as const] : [],
      ),
    ),
    lifecycleStructure: options.lifecycleStructure,
    ...(options.terminalActionKey === undefined
      ? {}
      : { terminalActionKey: options.terminalActionKey }),
  });
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
  const { active, checkpoints, lifecycleStructure } = context;
  const issues: RoomActionOrderIssue[] = [];
  const indexes = new Map(order.map((reference, index) => [roomActionKey(reference), index]));
  const checkpointAfterIndex = (checkpointKey: string): number => {
    // The exit is usable once every required action is done.
    if (checkpointKey === 'exitUsable')
      return [...active.values()]
        .filter((entry) => entry.participation === 'required')
        .reduce(
          (rank, entry) => Math.max(rank, indexes.get(roomActionKey(entry.reference)) ?? -1),
          -1,
        );
    if (!checkpointKey.startsWith('nextPhaseUsable:')) return -1;
    const checkpoint = checkpoints.get(checkpointKey);
    if (checkpoint === undefined) return -1;
    const required = [...active.values()].filter((entry) => entry.participation === 'required');
    const wheelKey = checkpointKey.slice('nextPhaseUsable:'.length);
    const matching = required.filter(
      (entry) => entry.window.kind === 'shipPostCombat' && entry.window.wheelKey === wheelKey,
    );
    return matching.reduce(
      (rank, entry) => Math.max(rank, indexes.get(roomActionKey(entry.reference)) ?? -1),
      -1,
    );
  };
  for (const reference of order) {
    const entry = active.get(roomActionKey(reference));
    if (entry === undefined) {
      issues.push(frozen({ kind: 'stale', reference }));
      continue;
    }
    for (const dependency of entry.dependencies) {
      const ownIndex = indexes.get(roomActionKey(reference));
      if (dependency.kind === 'afterAction') {
        const dependencyIndex = indexes.get(roomActionKey(dependency.action));
        if (dependencyIndex !== undefined && ownIndex !== undefined && ownIndex > dependencyIndex)
          continue;
        issues.push(
          frozen({
            kind: 'dependency',
            reference,
            detail: `must follow ${roomActionKey(dependency.action)}`,
            dependency,
          }),
        );
        continue;
      }
      const checkpoint = checkpoints.get(dependency.checkpointKey);
      if (checkpoint === undefined || ownIndex === undefined) {
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
      const ownRank = roomLifecycleWindowOrdinal(lifecycleStructure, entry.window);
      const checkpointWindowRank = roomLifecycleWindowOrdinal(
        lifecycleStructure,
        checkpoint.window,
      );
      const valid =
        dependency.kind === 'afterCheckpoint'
          ? ownRank >= checkpointWindowRank &&
            indexes.get(roomActionKey(reference))! >= checkpointAfterIndex(dependency.checkpointKey)
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
  }
  for (const entry of active.values()) {
    if (entry.participation === 'required' && !indexes.has(roomActionKey(entry.reference))) {
      issues.push(frozen({ kind: 'unrankedRequired', reference: entry.reference }));
    }
  }
  const ranked = order.flatMap((reference) => {
    const entry = active.get(roomActionKey(reference));
    return entry === undefined || entry.windowFollowsOrder === true ? [] : [entry];
  });
  for (let index = 1; index < ranked.length; index += 1) {
    const left = ranked[index - 1]!;
    const right = ranked[index]!;
    if (
      roomLifecycleWindowOrdinal(lifecycleStructure, left.window) >
      roomLifecycleWindowOrdinal(lifecycleStructure, right.window)
    ) {
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
  }
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
