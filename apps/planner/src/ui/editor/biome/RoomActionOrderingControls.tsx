import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { roomActionDestinationLabel } from './room-action-placement';

/** Timeline-only ordering and removal controls for one already-projected action. */
export function RoomActionOrderingControls({
  row,
  rows,
  proposals,
  onApply,
  onRemove,
  onBeginAdd,
  showRemoval = true,
}: {
  readonly row: WorkspaceRoomActionRow;
  readonly rows: readonly WorkspaceRoomActionRow[];
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly onApply: (proposalKey: string) => void;
  readonly onRemove: () => void;
  readonly onBeginAdd: (button: HTMLButtonElement) => void;
  readonly showRemoval?: boolean;
}) {
  const removable = proposals.find(
    (proposal) => proposal.kind === 'remove' || proposal.kind === 'unplace',
  );
  const moves = proposals.filter((proposal) => proposal.kind === 'move');
  const insertions = proposals.filter((proposal) => proposal.kind === 'insert');
  const removalEnabled =
    removable?.structurallyAuthorable === true || row.shopParticipation !== undefined;
  const explanation = removalEnabled
    ? removable?.kind === 'unplace'
      ? 'Remove this delivery and its reward details while keeping the source purchase.'
      : `Remove ${row.label} from the timeline`
    : row.rank === null
      ? 'This action is not currently in the timeline.'
      : row.shopParticipation !== undefined
        ? 'Purchased membership is edited in Room Overview.'
        : row.participation === 'required'
          ? 'Required actions cannot be removed.'
          : 'This action cannot be removed from its current state.';
  return (
    <>
      {row.rank === null && row.participation === 'required' ? (
        <button
          className="secondary-action action-compact"
          disabled={insertions.length !== 1 || insertions[0]?.structurallyAuthorable !== true}
          onClick={() => insertions[0] === undefined || onApply(insertions[0].key)}
          type="button"
        >
          Restore required action
        </button>
      ) : row.rank === null ? (
        <button
          aria-label={`Add ${row.label}`}
          className="secondary-action action-compact"
          disabled={insertions.length === 0}
          onClick={(event) => onBeginAdd(event.currentTarget)}
          type="button"
        >
          Add…
        </button>
      ) : (row.stale || removable?.kind === 'unplace') &&
        !moves.some((proposal) => proposal.structurallyAuthorable) ? null : (
        <RoomActionPlacementPicker
          label={`Move ${row.label}`}
          trigger="Move…"
          choices={moves.map((proposal) => ({
            ...proposal,
            label: roomActionDestinationLabel(rows, proposal.toIndex ?? 0, row),
          }))}
          onApply={onApply}
        />
      )}
      {showRemoval || removable?.kind === 'unplace' ? (
        <TimelineActionDeleteButton
          enabled={removalEnabled}
          explanation={explanation}
          label={row.label}
          onRemove={onRemove}
        />
      ) : null}
    </>
  );
}
