import type {
  WorkspaceRoomActionProposal,
  WorkspaceRoomActionRow,
} from '@planner/projections/structured-workspace';

/** Timeline-only ordering and removal controls for one already-projected action. */
export function RoomActionOrderingControls({
  row,
  proposals,
  onApply,
  onRemove,
}: {
  readonly row: WorkspaceRoomActionRow;
  readonly proposals: readonly WorkspaceRoomActionProposal[];
  readonly onApply: (proposalKey: string) => void;
  readonly onRemove: () => void;
}) {
  const removable = proposals.find((proposal) => proposal.kind === 'remove');
  const moveEarlier = proposals.find(
    (proposal) =>
      proposal.kind === 'move' && row.rank !== null && proposal.toIndex === row.rank - 2,
  );
  const moveLater = proposals.find(
    (proposal) => proposal.kind === 'move' && row.rank !== null && proposal.toIndex === row.rank,
  );
  const insertions = proposals.filter((proposal) => proposal.kind === 'insert');
  const removalEnabled =
    removable?.structurallyAuthorable === true || row.shopParticipation !== undefined;
  const explanation = removalEnabled
    ? `Remove ${row.label} from the timeline`
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
        <label className="field-control field-control-inline room-action-position-control">
          <span>Position</span>
          <select
            aria-label={`Insert ${row.label}`}
            onChange={(event) => {
              onApply(event.target.value);
              event.target.value = '';
            }}
            value=""
          >
            <option disabled value="">
              Choose
            </option>
            {insertions.map((proposal) => (
              <option
                disabled={!proposal.structurallyAuthorable}
                key={proposal.key}
                value={proposal.key}
              >
                {proposal.label}
              </option>
            ))}
          </select>
        </label>
      ) : (
        <>
          {[
            { direction: 'earlier' as const, glyph: '↑', proposal: moveEarlier },
            { direction: 'later' as const, glyph: '↓', proposal: moveLater },
          ].map(({ direction, glyph, proposal }) => (
            <button
              aria-label={`Move ${row.label} ${direction}`}
              className="quiet-action hub-rank-action"
              disabled={proposal?.structurallyAuthorable !== true}
              key={direction}
              onClick={() => proposal === undefined || onApply(proposal.key)}
              type="button"
            >
              <span aria-hidden="true">{glyph}</span>
            </button>
          ))}
        </>
      )}
      <button
        aria-label={`Remove ${row.label} from timeline`}
        className={`${removalEnabled ? 'danger-action' : 'quiet-action'} room-action-delete`}
        disabled={!removalEnabled}
        onClick={onRemove}
        title={explanation}
        type="button"
      >
        <svg aria-hidden="true" viewBox="0 0 16 16">
          <path d="M3.5 4.5h9M6 2.5h4l.5 2h-5l.5-2Zm-1 2 .5 9h5l.5-9M7 7v4M9 7v4" />
        </svg>
      </button>
    </>
  );
}
