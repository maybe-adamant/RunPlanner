import { recordingIndicator } from '@planner/projections/recentRunsHome';
import { viewChanged } from '@planner/state/librarySessionSlice';
import { recordingProblemReported } from '@planner/state/recordingSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import type { RecordingController } from '@planner/workspace/run-recording/recordingController';

/** The recording toggle and status, beside About on every Home tab; the status opens Recent runs. */
export function RecordingControl({ controller }: { readonly controller: RecordingController }) {
  const dispatch = useAppDispatch();
  const status = useAppSelector((state) => state.recordingSession.status);
  const indicator = recordingIndicator(status);
  const recording = status.kind !== 'off' && status.kind !== 'error';
  return (
    <div className="recording-control">
      <button
        aria-label={`Recording status: ${indicator.text}. Open Recent runs`}
        className="recording-indicator"
        data-tone={indicator.tone ?? undefined}
        onClick={() => dispatch(viewChanged({ kind: 'home', tab: 'runs' }))}
        type="button"
      >
        <span aria-hidden="true" className="recording-dot" />
        <span className="recording-status-text">{indicator.text}</span>
      </button>
      <button
        aria-pressed={recording}
        className="library-chip recording-toggle"
        onClick={() =>
          void controller
            .setEnabled(!recording)
            .catch((error: unknown) =>
              dispatch(
                recordingProblemReported(error instanceof Error ? error.message : String(error)),
              ),
            )
        }
        type="button"
      >
        Record runs
      </button>
    </div>
  );
}
