import { findingSelected } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import {
  stopNoticeLead,
  stopNoticeLink,
  type StopNoticeAt,
} from '@planner/projections/walkStopCopy';
import { hintProps } from '@planner/ui/controls/hint';
import { useWalkStop } from '@planner/ui/feedback/useFindingTarget';

/**
 * Where the plan stops, its place being the blocking finding's own repair link there: what a
 * Timeline, Ship phase, room or Hub the walk has not reached shows.
 */
export function StopNotice({ at }: { readonly at: StopNoticeAt }) {
  const dispatch = useAppDispatch();
  const walkStop = useWalkStop();
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  const place = stopNoticeLink(at);
  return (
    <p className="stop-notice" data-stop-notice={at.kind}>
      {stopNoticeLead}{' '}
      {walkStop === undefined ? (
        <span {...hintProps(place.hint)}>{place.text}</span>
      ) : (
        <button
          className="stop-notice-link"
          disabled={drafting}
          onClick={() => dispatch(findingSelected(walkStop.selection))}
          type="button"
          {...hintProps(place.hint)}
        >
          {place.text}
        </button>
      )}
    </p>
  );
}
