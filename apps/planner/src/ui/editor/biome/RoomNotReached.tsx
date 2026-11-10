import type { ReactNode } from 'react';
import { nextRepairSelection } from '@planner/projections/evaluationProjection';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import { findingSelected } from '@planner/state/editorSessionSlice';
import { selectProjectEvaluation, useAppDispatch, useAppSelector } from '@planner/state/store';
import { goToStopLabel, roomNotReachedLabel } from './notReachedCopy';

/**
 * A room or Hub past the walk's stop: only its title, that it is not reached, and the
 * blocking finding's own repair link to where the walk stopped. Its content returns as
 * soon as the walk reaches it.
 */
export function RoomNotReached({
  focusByOwner,
  title,
}: {
  readonly focusByOwner: StructuredWorkspaceProjection['focusByOwner'];
  readonly title: ReactNode;
}) {
  const dispatch = useAppDispatch();
  const issue = useAppSelector((state) => selectProjectEvaluation(state)?.route.issue);
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  return (
    <article className="room-card biome-occurrence-workbench room-not-reached" data-not-reached>
      <header className="room-head-card">
        <div className="room-head-identity">
          <h3 className="room-title-name">{title}</h3>
        </div>
      </header>
      <div className="room-not-reached-body">
        <p>{roomNotReachedLabel}</p>
        {issue === undefined ? null : (
          <button
            className="room-not-reached-link"
            disabled={drafting}
            onClick={() => dispatch(findingSelected(nextRepairSelection(issue, focusByOwner)))}
            type="button"
          >
            {goToStopLabel}
          </button>
        )}
      </div>
    </article>
  );
}
