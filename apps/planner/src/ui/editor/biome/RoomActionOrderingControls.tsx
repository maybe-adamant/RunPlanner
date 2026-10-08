import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';
import { RoomActionPlacementPicker } from './RoomActionPlacementPicker';
import { roomActionDestinationLabel } from './room-action-placement';

/** Placement slot for one already-projected action; it stays mounted and disabled without a proposal. */
export function RoomActionPlacementControl({
  findingMark,
  row,
  rows,
  proposals,
  onApply,
  onBeginAdd,
}: {
  /** Findings repaired by restoring, adding or moving this action. */
  readonly findingMark?: FindingMarkProps;
  readonly row: WorkspaceRoomActionRow;
  readonly rows: readonly WorkspaceRoomActionRow[];
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly onApply: (proposalKey: string) => void;
  readonly onBeginAdd: (button: HTMLButtonElement) => void;
}) {
  const moves = proposals.filter((proposal) => proposal.kind === 'move');
  const insertions = proposals.filter((proposal) => proposal.kind === 'insert');
  const restoreDisabled = insertions.length !== 1 || insertions[0]?.structurallyAuthorable !== true;
  if (row.rank === null && row.participation === 'required')
    return (
      <button
        {...findingMark}
        aria-label="Restore required action"
        className="secondary-action action-compact"
        disabled={restoreDisabled}
        onClick={() => insertions[0] === undefined || onApply(insertions[0].key)}
        {...(restoreDisabled ? { title: 'No position to restore this action.' } : {})}
        type="button"
      >
        Restore
      </button>
    );
  if (row.rank === null)
    return (
      <button
        {...findingMark}
        aria-label={`Add ${row.label}`}
        className="secondary-action action-compact"
        disabled={insertions.length === 0}
        onClick={(event) => onBeginAdd(event.currentTarget)}
        {...(insertions.length === 0 ? { title: 'No position to add this action.' } : {})}
        type="button"
      >
        Add…
      </button>
    );
  return (
    <RoomActionPlacementPicker
      {...(findingMark === undefined ? {} : { findingMark })}
      label={`Move ${row.label}`}
      trigger="Move…"
      choices={moves.map((proposal) => ({
        ...proposal,
        label: roomActionDestinationLabel(rows, proposal.toIndex ?? 0, row),
      }))}
      disabledHint="No other position is available."
      onApply={onApply}
    />
  );
}

/** Delete slot for one action; a row whose removal is owned elsewhere keeps it disabled. */
export function RoomActionRemovalControl({
  findingMark,
  row,
  proposals,
  onRemove,
  showRemoval = true,
}: {
  /** Findings repaired by removing this action. */
  readonly findingMark?: FindingMarkProps;
  readonly row: WorkspaceRoomActionRow;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly onRemove: () => void;
  readonly showRemoval?: boolean;
}) {
  const removable = proposals.find(
    (proposal) => proposal.kind === 'remove' || proposal.kind === 'unplace',
  );
  const owned = showRemoval || removable?.kind === 'unplace';
  const removalEnabled =
    owned &&
    (removable?.structurallyAuthorable === true ||
      row.refillPurchaseRemoval !== undefined ||
      row.shopParticipation !== undefined);
  const explanation = removalEnabled
    ? removable?.kind === 'unplace'
      ? 'Remove this delivery and its reward details while keeping the source purchase.'
      : `Remove ${row.label} from the timeline`
    : row.rank === null
      ? 'This action is not currently in the timeline.'
      : row.shopParticipation !== undefined
        ? 'Purchased membership is edited in Room Overview.'
        : !owned && row.participationOwnedByOverview
          ? 'This action is edited in Room Overview.'
          : row.participation === 'required'
            ? 'Required actions cannot be removed.'
            : 'This action cannot be removed from its current state.';
  return (
    <TimelineActionDeleteButton
      {...(findingMark === undefined ? {} : { findingMark })}
      enabled={removalEnabled}
      explanation={explanation}
      label={row.label}
      onRemove={onRemove}
    />
  );
}
