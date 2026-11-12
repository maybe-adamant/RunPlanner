import {
  createBiomeAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  roomActionKey,
  type OccurrenceId,
  type RoomActionReference,
  type SemanticAddress,
  roomActionDomainForOccurrence,
  scheduleRequiredRoomActions,
} from '@run-planner/engine/authored-project';
import {
  liveRoomForProjectEvaluationAssembly,
  type SemanticFinding,
} from '@run-planner/engine/simulation';
import type { RunImportContext } from './import';

/** The address of one room action of an occurrence. */
export function roomActionAddress(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
) {
  return createRoomActionAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
    roomActionKey(reference),
  );
}

/**
 * Where an optional room action enters the occurrence's order at its native
 * default position: its current index when already ordered, undefined when
 * the occurrence holds no room actions or the schedule places none.
 */
export function nativeRoomActionIndex(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): { readonly index: number; readonly present: boolean } | undefined {
  const project = context.assembly().project;
  const host = roomActionDomainForOccurrence(
    project,
    context.catalog,
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  if (host === undefined) return undefined;
  const key = roomActionKey(reference);
  const current = host.occurrence.roomActions.order.findIndex(
    (entry) => roomActionKey(entry) === key,
  );
  if (current >= 0) return { index: current, present: true };
  const scheduled = scheduleRequiredRoomActions({
    catalog: context.catalog,
    domain: host.domain,
    order: host.occurrence.roomActions.order,
    requiredKeys: new Set([key]),
    participation: 'any',
  });
  const index = scheduled.findIndex((entry) => roomActionKey(entry) === key);
  return index >= 0 ? { index, present: false } : undefined;
}

/** Inserts an optional room action at its native default position, unless that adds a finding. */
export function insertRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  const native = nativeRoomActionIndex(context, biomeKey, occurrenceId, reference);
  if (native === undefined) return false;
  return (
    native.present ||
    context.applyValid({
      kind: 'InsertRoomAction',
      action: roomActionAddress(context, biomeKey, occurrenceId, reference),
      reference,
      index: native.index,
    })
  );
}

/**
 * Places a live item's row by the command the engine's live room offers for
 * it: its canonical position, else at the walk's frontier in the room, else
 * the latest gap offered. True when the row already stands.
 */
export function placeLiveRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  const project = context.assembly().project;
  const room = createOccurrenceAddress(
    createBiomeAddress(project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  const live = liveRoomForProjectEvaluationAssembly(
    context.catalog,
    context.assembly(),
    room,
    'placements',
  );
  if (live === undefined) return false;
  const key = roomActionKey(reference);
  const verbs = live.gaps.flatMap((gap) =>
    gap.items.flatMap((item) =>
      item.verbs.flatMap((verb) =>
        verb.reference !== undefined && roomActionKey(verb.reference) === key
          ? [{ gap: gap.index, verb }]
          : [],
      ),
    ),
  );
  if (verbs.some(({ verb }) => verb.standing === true)) return true;
  const placements = verbs.filter(
    ({ verb }) => verb.commands?.[0] !== undefined && verb.commands[0].kind !== 'MoveRoomAction',
  );
  const chosen =
    placements.find(({ verb }) => verb.canonical === true) ??
    placements.find(({ gap }) => gap === live.frontier) ??
    placements.at(-1);
  return chosen !== undefined && context.applyValid(chosen.verb.commands![0]!);
}

/**
 * Whether the room's walk has passed a standing row and collected the
 * required items live after it: the record's later actions follow them.
 */
export function collectedPast(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  const room = createOccurrenceAddress(
    createBiomeAddress(context.assembly().project.route.routeKey, biomeKey),
    occurrenceId as OccurrenceId,
  );
  context.collectRequired(room);
  const live = liveRoomForProjectEvaluationAssembly(
    context.catalog,
    context.assembly(),
    room,
    'placements',
  );
  const key = roomActionKey(reference);
  const gap = live?.gaps.find((candidate) =>
    candidate.items.some((item) =>
      item.verbs.some(
        (verb) =>
          verb.standing === true &&
          verb.reference !== undefined &&
          roomActionKey(verb.reference) === key,
      ),
    ),
  );
  return live !== undefined && gap !== undefined && live.frontier > gap.index;
}

/** Removes a room action, unless that adds a finding. */
export function removeRoomAction(
  context: RunImportContext,
  biomeKey: string,
  occurrenceId: string,
  reference: RoomActionReference,
): boolean {
  return context.applyValid({
    kind: 'RemoveRoomAction',
    action: roomActionAddress(context, biomeKey, occurrenceId, reference),
  });
}

const PLACEMENT_REQUIRED = new Set([
  'roomActionPlacementRequired',
  'hermesShrineDeliveryPlacementRequired',
  'echoGoldPickupPlacementRequired',
]);

/** The room an owner lies in; an acquisition entry's is its site owner's. */
function ownerRoom(origin: SemanticAddress) {
  if (origin.kind === 'acquisitionEntry') return ownerRoom(origin.site.owner);
  if (!('occurrenceId' in origin)) return undefined;
  return createOccurrenceAddress(
    createBiomeAddress(origin.routeKey, origin.biomeKey),
    origin.occurrenceId,
  );
}

/**
 * A required item nobody placed is collected where the player would take it:
 * the engine collects every required item live in its room. The record's own
 * order is applied once the plan is complete.
 */
export function answerRequiredPlacement(
  context: RunImportContext,
  reason: SemanticFinding,
): boolean {
  if (!PLACEMENT_REQUIRED.has(reason.code)) return false;
  const room = ownerRoom(reason.origin);
  return room !== undefined && context.collectRequired(room);
}
