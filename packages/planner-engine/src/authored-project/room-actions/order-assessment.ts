import type { RoomActionReference, RoomOccurrence } from '../model';
import { CHALLENGE_SWITCH_ACTION } from '../acquisition/challenge-switch';
import type { RoomActionContribution, RoomActionDependency, RoomActionDomain } from './domain';
import {
  roomActionOpeningPoint,
  roomEventPlaces,
  roomEventPointResolves,
  type RoomEventGraph,
  type RoomEventPoint,
} from './event-graph';
import { roomActionKey } from './state';

function frozen<T>(value: T): T {
  return Object.freeze(value);
}

/**
 * Why a row cannot stand where it is placed, in its bounds: it stands before
 * its spawn or enabler can happen (a required action ordered after it must
 * come first, or the point never happens in this room), or past its deadline
 * (an action ordered before it stands only after that point).
 */
export type RoomActionBoundBlocker =
  | {
      readonly kind: 'beforeSpawn' | 'beforeEnabler';
      readonly reference: RoomActionReference;
      readonly detail: string;
      /** The row's spawn or enabler it stands before. */
      readonly point: RoomEventPoint;
      /** A required action ordered after the row whose deadline passes before the point. */
      readonly requiredAction?: RoomActionReference;
      /** The point never happens in this room. */
      readonly unavailable?: true;
    }
  | {
      readonly kind: 'pastDeadline';
      readonly reference: RoomActionReference;
      readonly detail: string;
      /** The point the walk passes before it reaches the row. */
      readonly deadline: RoomEventPoint;
      /** The action ordered before the row that stands only after that point. */
      readonly precedingAction: RoomActionReference;
    };

/** A placement's blockers: the prefix's dependency and bound issues. */
export type RoomActionPlacementBlocker =
  | {
      readonly kind: 'dependency';
      readonly reference: RoomActionReference;
      readonly detail: string;
      readonly dependency: RoomActionDependency;
    }
  | RoomActionBoundBlocker;

export type RoomActionOrderIssue =
  | { readonly kind: 'stale'; readonly reference: RoomActionReference }
  | { readonly kind: 'unrankedRequired'; readonly reference: RoomActionReference }
  | RoomActionPlacementBlocker;

/** Whether an order issue blocks a placement: every issue but a stale or unranked row. */
export function isPlacementBlocker(
  issue: RoomActionOrderIssue,
): issue is RoomActionPlacementBlocker {
  return issue.kind !== 'stale' && issue.kind !== 'unrankedRequired';
}

/** The structural facts one occurrence's action order is judged against. */
export interface RoomActionOrderContext {
  readonly active: ReadonlyMap<string, RoomActionContribution>;
  readonly eventGraph: RoomEventGraph;
  /** An action nothing may follow (a left switch press: leaving ends the room). */
  readonly terminalActionKey?: string;
  /** The place each active action opens at, its enabler's or its spawn's, which no order changes. */
  readonly openings: ReadonlyMap<string, number>;
  /** Active required action keys. */
  readonly requiredKeys: readonly string[];
}

export function roomActionOrderContext(options: {
  readonly contributions: readonly RoomActionContribution[];
  readonly eventGraph: RoomEventGraph;
  readonly terminalActionKey?: string;
}): RoomActionOrderContext {
  const active = new Map(
    options.contributions.map((entry) => [roomActionKey(entry.reference), entry] as const),
  );
  const required = [...active].filter(([, entry]) => entry.participation === 'required');
  const place = roomEventPlaces(options.eventGraph);
  return frozen({
    active,
    eventGraph: options.eventGraph,
    ...(options.terminalActionKey === undefined
      ? {}
      : { terminalActionKey: options.terminalActionKey }),
    openings: new Map(
      [...active].map(([key, entry]) => [key, place(roomActionOpeningPoint(entry.bounds))]),
    ),
    requiredKeys: frozen(required.map(([key]) => key)),
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
 * The Keepsake Rack is not a required room object: it stands wherever it is
 * placed, so no bound of its own or of another row is judged against it.
 */
function standsAnywhere(entry: RoomActionContribution): boolean {
  return entry.reference.kind === 'interactKeepsakeRack';
}

/**
 * The bound a row's opening place belongs to: an enabler when it has one.
 */
function openingKind(entry: RoomActionContribution): 'beforeSpawn' | 'beforeEnabler' {
  return entry.bounds.enabler === undefined ? 'beforeSpawn' : 'beforeEnabler';
}

/**
 * The stale, dependency and bound issues of the rows at or before `through`,
 * row issues first: a row is judged by the rows before it, by whether its
 * spawn happens in the room, and a locked door's press by the required rows
 * its exits wait on.
 */
function rowAndBoundIssues(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
  through: number,
): { readonly rows: RoomActionOrderIssue[]; readonly crossings: RoomActionOrderIssue[] } {
  const { active, eventGraph, openings } = context;
  const rows: RoomActionOrderIssue[] = [];
  const crossings: RoomActionOrderIssue[] = [];
  const keys = order.map(keyOf);
  const indexes = new Map(keys.map((key, index) => [key, index]));
  let exitsReadyIndex: number | undefined;
  let left: RoomActionContribution | undefined;
  let leftOpening = 0;
  for (let ownIndex = 0; ownIndex <= through && ownIndex < order.length; ownIndex += 1) {
    const reference = order[ownIndex]!;
    const entry = active.get(keys[ownIndex]!);
    if (entry === undefined) {
      rows.push(frozen({ kind: 'stale', reference }));
      continue;
    }
    for (const dependency of entry.dependencies) {
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
    }
    const { spawn, enabler } = entry.bounds;
    if (spawn.kind === 'encounterEnd' && !roomEventPointResolves(eventGraph, spawn))
      rows.push(
        frozen({
          kind: 'beforeSpawn',
          reference,
          detail: `has unknown checkpoint combat:${spawn.phaseKey}`,
          point: spawn,
          unavailable: true as const,
        }),
      );
    if (enabler?.kind === 'exitsReady') {
      // The exits are ready once every required action is done.
      exitsReadyIndex ??= context.requiredKeys.reduce(
        (index, key) => Math.max(index, indexes.get(key) ?? -1),
        -1,
      );
      if (ownIndex < exitsReadyIndex)
        rows.push(
          frozen({
            kind: 'beforeEnabler',
            reference,
            detail: 'afterCheckpoint exitUsable',
            point: enabler,
          }),
        );
    }
    if (standsAnywhere(entry)) continue;
    const opening = openings.get(keys[ownIndex]!)!;
    if (left !== undefined && leftOpening > opening) {
      crossings.push(
        frozen({
          kind: 'pastDeadline',
          reference: entry.reference,
          detail: 'crosses a fixed lifecycle window',
          deadline: roomActionOpeningPoint(left.bounds),
          precedingAction: left.reference,
        }),
      );
    }
    left = entry;
    leftOpening = opening;
  }
  return { rows, crossings };
}

/**
 * Every structural issue of one authored order: stale, missing required,
 * dependency, past its deadline and before its opening.
 */
export function assessRoomActionOrder(
  order: readonly RoomActionReference[],
  context: RoomActionOrderContext,
): readonly RoomActionOrderIssue[] {
  const { rows, crossings } = rowAndBoundIssues(order, context, order.length - 1);
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
  return frozen([...rows, ...unranked, ...crossings, ...requiredFirst]);
}

interface RequiredDeadline {
  readonly entry: RoomActionContribution;
  readonly opening: number;
}

/**
 * For each row, the ranked required action ordered after it that opens first
 * (the earliest such row on a tie). An action whose bounds name a phase or
 * wheel the room does not play has no deadline here; its placement is its
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
      standsAnywhere(entry) ||
      !roomEventPointResolves(context.eventGraph, roomActionOpeningPoint(entry.bounds)) ||
      !roomEventPointResolves(context.eventGraph, entry.bounds.spawn)
    )
      continue;
    const opening = context.openings.get(key)!;
    if (earliest === undefined || opening <= earliest.opening) earliest = { entry, opening };
  }
  return deadlines;
}

/**
 * A ranked required action is taken by its deadline, which passes before a
 * row that opens later than it can be reached: a row ordered before such a
 * required action stands before its own opening, and the required action
 * must come first.
 */
function requiredFirstIssue(
  reference: RoomActionReference,
  deadline: RequiredDeadline | undefined,
  context: RoomActionOrderContext,
): RoomActionBoundBlocker | undefined {
  const key = keyOf(reference);
  const entry = context.active.get(key);
  if (entry === undefined || deadline === undefined || standsAnywhere(entry)) return undefined;
  if (context.openings.get(key)! <= deadline.opening) return undefined;
  const required = deadline.entry;
  return frozen({
    kind: openingKind(entry),
    reference: entry.reference,
    detail: `must follow ${keyOf(required.reference)}, a required action of an earlier window`,
    point: roomActionOpeningPoint(entry.bounds),
    requiredAction: required.reference,
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
  /** Dependency and bound issues of the placed actions and every row before them. */
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
 * bounds and dependencies, follow every ranked required action that opens
 * earlier, and none may follow a left switch press. Other rows after
 * the placed actions take no part; an issue the placement gives them is theirs
 * when the walk reaches them.
 */
export function assessRoomActionPlacement(
  order: readonly RoomActionReference[],
  lastIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementAssessment {
  const { rows, crossings } = rowAndBoundIssues(order, context, lastIndex);
  const blockers: readonly RoomActionPlacementBlocker[] = frozen([
    ...[...rows, ...crossings].filter(isPlacementBlocker),
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

/** The order a move yields: the row lands at `toIndex`. */
export function movedRoomActionOrder(
  order: readonly RoomActionReference[],
  fromIndex: number,
  toIndex: number,
): readonly RoomActionReference[] {
  const next = [...order];
  const [reference] = next.splice(fromIndex, 1);
  next.splice(toIndex, 0, reference!);
  return frozen(next);
}

/** One move and the order it yields, judged like an insertion at its landing. */
export function assessRoomActionMove(
  order: readonly RoomActionReference[],
  fromIndex: number,
  toIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementAssessment {
  return assessRoomActionPlacement(
    movedRoomActionOrder(order, fromIndex, toIndex),
    toIndex,
    context,
  );
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
  domain: Pick<RoomActionDomain, 'contributions' | 'eventGraph'>,
  occurrence: Pick<RoomOccurrence, 'challengeSwitch'>,
): RoomActionOrderContext {
  const terminalActionKey = terminalRoomActionKey(occurrence);
  return roomActionOrderContext({
    contributions: domain.contributions,
    eventGraph: domain.eventGraph,
    ...(terminalActionKey === undefined ? {} : { terminalActionKey }),
  });
}
