import type { WorkspaceRoomActionRow } from '@planner/projections/structured-workspace';

/** Names an authored-order destination without deciding whether it is allowed. */
export function roomActionDestinationLabel(
  rows: readonly WorkspaceRoomActionRow[],
  toIndex: number,
  movingRow?: WorkspaceRoomActionRow,
): string {
  const remaining = rows
    .filter((row) => row.rank !== null && row.key !== movingRow?.key)
    .map((row) => ({
      row,
      index: row.rank! - 1 - (movingRow?.rank != null && movingRow.rank < row.rank! ? 1 : 0),
    }))
    .sort((left, right) => left.index - right.index);
  const next = remaining.find((entry) => entry.index >= toIndex);
  if (next !== undefined) return `Before ${next.row.label}`;
  const previous = remaining.at(-1);
  return previous === undefined ? 'First action' : `After ${previous.row.label}`;
}
