import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';
import type { FindingMarkProps } from '@planner/ui/feedback/useFindingTarget';
import { TimelineActionDeleteButton } from './TimelineActionDeleteButton';

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
