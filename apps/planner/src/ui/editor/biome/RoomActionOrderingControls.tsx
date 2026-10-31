import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';
import { hintProps } from '@planner/ui/controls/hint';

/** Placement slot for one unplaced action: Restore or Add. */
export function RoomActionPlacementControl({
  findingMark,
  row,
  proposals,
  onApply,
}: {
  /** Findings repaired by restoring or adding this action. */
  readonly findingMark?: FindingMarkProps;
  readonly row: WorkspaceRoomActionRow;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly onApply: (proposalKey: string) => void;
}) {
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
        {...hintProps(
          restoreDisabled ? 'No position to restore this action.' : undefined,
          findingMark?.['aria-description'],
        )}
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
        disabled={!insertions.some((proposal) => proposal.structurallyAuthorable)}
        // It appends at its last legal place; the author then drags it.
        onClick={() => {
          const authorable = insertions.filter((proposal) => proposal.structurallyAuthorable);
          const last = authorable.reduce<(typeof authorable)[number] | undefined>(
            (latest, proposal) =>
              latest === undefined || (proposal.toIndex ?? 0) > (latest.toIndex ?? 0)
                ? proposal
                : latest,
            undefined,
          );
          if (last !== undefined) onApply(last.key);
        }}
        {...hintProps(
          insertions.some((proposal) => proposal.structurallyAuthorable)
            ? undefined
            : 'No position to add this action.',
          findingMark?.['aria-description'],
        )}
        type="button"
      >
        Add…
      </button>
    );
  // A placed row reorders through its drag handle.
  return null;
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
    owned && (removable?.structurallyAuthorable === true || row.purchaseRemoval !== undefined);
  // A mandatory or unplaced row's disabled delete needs no hint.
  const explanation = removalEnabled
    ? removable?.kind === 'unplace'
      ? 'Remove this delivery and its reward details while keeping the source purchase.'
      : `Remove ${row.label} from the timeline.`
    : row.rank === null
      ? undefined
      : row.reference.kind === 'interactKeepsakeRack'
        ? undefined
        : row.participation === 'required'
          ? undefined
          : removable?.explanations.join(' ') || undefined;
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
