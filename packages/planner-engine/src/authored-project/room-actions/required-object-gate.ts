import type { RoomActionReference } from '../model';
import {
  roomActionOpeningPoint,
  roomEventPlaces,
  type RoomActionBounds,
  type RoomEventGraph,
} from './event-graph';

interface GateRow {
  readonly reference: RoomActionReference;
  readonly bounds: RoomActionBounds;
  readonly stale?: boolean;
}

/**
 * Whether a row waits for every required object on the ground
 * (`HasRoomRequiredObject`): a Ship wheel's choice, and anything the doors
 * opening enables. A wheel's reroll does not wait.
 */
export function waitsForRequiredObjects(graph: RoomEventGraph): (row: GateRow) => boolean {
  const place = roomEventPlaces(graph);
  const doors = place({ kind: 'doorsOpened' });
  return (row) =>
    row.stale !== true &&
    (row.reference.kind === 'chooseRewardWheel' ||
      place(roomActionOpeningPoint(row.bounds)) >= doors);
}

/**
 * Where a required object lying on the ground from `rows[from]` falls due: the
 * index of the first row from there that waits for it, or undefined when only
 * the doors close it.
 */
export function requiredObjectDeadline(
  graph: RoomEventGraph,
  rows: readonly GateRow[],
  from = 0,
): number | undefined {
  const waits = waitsForRequiredObjects(graph);
  const index = rows.findIndex((row, at) => at >= from && waits(row));
  return index < 0 ? undefined : index;
}
