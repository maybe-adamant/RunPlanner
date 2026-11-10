import { findingSelected } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import {
  goToStopLabel,
  stopNoticeSentence,
  type StopNoticeAt,
} from '@planner/projections/walkStopCopy';
import { useWalkStop } from '@planner/ui/feedback/useFindingTarget';

/**
 * Where the plan stops, in one sentence, and the blocking finding's own repair link there:
 * what a Timeline, Ship phase, room or Hub the walk has not reached shows.
 */
export function StopNotice({ at }: { readonly at: StopNoticeAt }) {
  const dispatch = useAppDispatch();
  const walkStop = useWalkStop();
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  return (
    <p className="stop-notice" data-stop-notice={at.kind}>
      {stopNoticeSentence(at)}
      {walkStop === undefined ? null : (
        <>
          {' '}
          <button
            className="stop-notice-link"
            disabled={drafting}
            onClick={() => dispatch(findingSelected(walkStop.selection))}
            type="button"
          >
            {goToStopLabel}
          </button>
        </>
      )}
    </p>
  );
}
