import type { RoomActionReference, RoomOccurrence } from '../model';
import { CHALLENGE_SWITCH_ACTION } from '../acquisition/challenge-switch';
import type { RoomActionContribution, RoomActionDependency, RoomActionDomain } from './domain';
import {
  roomActionOpeningPoint,
  roomEventPlaces,
  roomEventPointPasses,
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
 * (an action ordered before it opens at or after that point).
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
      /** The row's deadline, which the walk passes before it reaches the row. */
      readonly deadline: RoomEventPoint;
      /** The nearest action ordered before the row whose opening passes it. */
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

/** A point as a refusal names it: its kind and the phase or wheel it belongs to. */
function pointText(point: RoomEventPoint): string {
  return 'phaseKey' in point
    ? `${point.kind} ${point.phaseKey}`
    : 'wheelKey' in point
      ? `${point.kind} ${point.wheelKey}`
      : point.kind;
}

/** The structural facts one occurrence's action order is judged against. */
export interface RoomActionOrderContext {
  readonly active: ReadonlyMap<string, RoomActionContribution>;
  readonly eventGraph: RoomEventGraph;
  /** An action nothing may follow (a left switch press: leaving ends the room). */
  readonly terminalActionKey?: string;
  /** Where a point stands in the room's graph. */
  readonly place: (point: RoomEventPoint) => number;
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
    place,
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
  const { active, eventGraph } = context;
  const rows: RoomActionOrderIssue[] = [];
  const crossings: RoomActionOrderIssue[] = [];
  const keys = order.map(keyOf);
  const indexes = new Map(keys.map((key, index) => [key, index]));
  let exitsReadyIndex: number | undefined;
  const reached: RoomActionContribution[] = [];
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
          detail: `waits on ${pointText(spawn)}, which the room never reaches`,
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
            detail: 'must follow the last required action',
            point: enabler,
          }),
        );
    }
    if (standsAnywhere(entry)) continue;
    const passedAt = judgedDeadline(entry, context)
      ? reached.findLast((before) => passes(before, entry, context))
      : undefined;
    if (passedAt !== undefined)
      crossings.push(
        frozen({
          kind: 'pastDeadline',
          reference: entry.reference,
          detail: `must stand before ${pointText(entry.bounds.deadline)}, which ${keyOf(passedAt.reference)} passes`,
          deadline: entry.bounds.deadline,
          precedingAction: passedAt.reference,
        }),
      );
    reached.push(entry);
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
  const requiredFirst = order.flatMap((reference, index) => {
    const issue = requiredFirstIssue(reference, requiredAfter(order, index, context), context);
    return issue === undefined ? [] : [issue];
  });
  return frozen([...rows, ...unranked, ...crossings, ...requiredFirst]);
}

/** Whether the walk, reaching `before` where it opens, has passed `entry`'s deadline. */
function passes(
  before: RoomActionContribution,
  entry: RoomActionContribution,
  context: RoomActionOrderContext,
): boolean {
  return roomEventPointPasses(
    context.place,
    roomActionOpeningPoint(before.bounds),
    entry.bounds.deadline,
  );
}

/**
 * Whether a row's deadline is judged here: an action whose bounds name a
 * phase or wheel the room does not play has none; its placement is its own
 * finding.
 */
function judgedDeadline(entry: RoomActionContribution, context: RoomActionOrderContext): boolean {
  const { eventGraph } = context;
  return (
    roomEventPointResolves(eventGraph, entry.bounds.deadline) &&
    roomEventPointResolves(eventGraph, roomActionOpeningPoint(entry.bounds)) &&
    roomEventPointResolves(eventGraph, entry.bounds.spawn)
  );
}

/** The ranked required actions ordered after `index` whose deadlines are judged. */
function requiredAfter(
  order: readonly RoomActionReference[],
  index: number,
  context: RoomActionOrderContext,
): readonly RoomActionContribution[] {
  return order.slice(index + 1).flatMap((reference) => {
    const entry = context.active.get(keyOf(reference));
    return entry?.participation === 'required' &&
      !standsAnywhere(entry) &&
      judgedDeadline(entry, context)
      ? [entry]
      : [];
  });
}

/**
 * A ranked required action is taken by its deadline: a row ordered before it
 * whose opening passes that deadline would pass it first, so the required
 * action must come first. The one named is the earliest deadline it passes.
 */
function requiredFirstIssue(
  reference: RoomActionReference,
  required: readonly RoomActionContribution[],
  context: RoomActionOrderContext,
): RoomActionBoundBlocker | undefined {
  const entry = context.active.get(keyOf(reference));
  if (entry === undefined || standsAnywhere(entry)) return undefined;
  const first = required
    .filter((candidate) => passes(entry, candidate, context))
    .reduce<RoomActionContribution | undefined>(
      (earliest, candidate) =>
        earliest === undefined ||
        context.place(candidate.bounds.deadline) < context.place(earliest.bounds.deadline)
          ? candidate
          : earliest,
      undefined,
    );
  if (first === undefined) return undefined;
  return frozen({
    kind: openingKind(entry),
    reference: entry.reference,
    detail: `must follow ${keyOf(first.reference)}, a required action whose deadline passes first`,
    point: roomActionOpeningPoint(entry.bounds),
    requiredAction: first.reference,
  });
}

/** Each row at or before `lastIndex` that a required action ordered after it must precede. */
function requiredFirstBlockers(
  order: readonly RoomActionReference[],
  lastIndex: number,
  context: RoomActionOrderContext,
): RoomActionPlacementBlocker[] {
  const required = requiredAfter(order, lastIndex, context);
  if (required.length === 0) return [];
  return order.slice(0, lastIndex + 1).flatMap((reference) => {
    const issue = requiredFirstIssue(reference, required, context);
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
