import { useCallback, useEffect, useState } from 'react';

import type { RecordingController } from '@planner/workspace/run-recording/recordingController';
import { ConfirmationDialog } from '../controls/ConfirmationDialog';
import { HomeToast } from './HomeToast';

const message = (error: unknown) => (error instanceof Error ? error.message : String(error));

function formatBytes(bytes: number): string {
  if (bytes < 1024 * 1024) return `${Math.ceil(bytes / 1024)} KB`;
  const megabytes = bytes / (1024 * 1024);
  return megabytes < 1024
    ? `${megabytes.toFixed(megabytes < 10 ? 1 : 0)} MB`
    : `${(megabytes / 1024).toFixed(1)} GB`;
}

/** Whether recorded runs keep every save, with the kept saves' folder and size. */
export function RecordingSettings({ controller }: { readonly controller: RecordingController }) {
  const [keep, setKeep] = useState(() => controller.keepsRawSaves());
  const [size, setSize] = useState<number | null>(null);
  const [confirming, setConfirming] = useState(false);
  const [pending, setPending] = useState(false);
  const [problem, setProblem] = useState<string | null>(null);
  const measure = useCallback(
    () => controller.rawSavesSize().then(setSize, () => setSize(null)),
    [controller],
  );
  useEffect(() => {
    void measure();
  }, [measure]);

  const clear = async () => {
    setPending(true);
    try {
      await controller.clearRawSaves();
    } catch (error) {
      setProblem(message(error));
    }
    setPending(false);
    setConfirming(false);
    await measure();
  };

  return (
    <section aria-labelledby="settings-recording-title" className="home-panel home-card">
      <h3 className="home-panel-title" id="settings-recording-title">
        Recording
      </h3>
      <label className="home-setting-row">
        <span className="home-setting-label">Keep full recordings</span>
        <input
          checked={keep}
          onChange={(event) => {
            controller.setKeepRawSaves(event.target.checked);
            setKeep(event.target.checked);
          }}
          type="checkbox"
        />
      </label>
      {keep || (size ?? 0) > 0 ? (
        <div className="home-setting-row">
          <span className="home-setting-hint">{size === null ? '' : formatBytes(size)}</span>
          <div className="home-stepper">
            <button
              className="text-action"
              onClick={() =>
                void controller
                  .revealRawSaves()
                  .then(measure)
                  .catch((error: unknown) => setProblem(message(error)))
              }
              type="button"
            >
              Open folder
            </button>
            <button
              className="text-action"
              disabled={size === 0}
              onClick={() => setConfirming(true)}
              type="button"
            >
              Clear
            </button>
          </div>
        </div>
      ) : null}
      {confirming ? (
        <ConfirmationDialog
          confirmLabel="Delete"
          id="settings-recording-clear-title"
          onCancel={() => setConfirming(false)}
          onConfirm={() => void clear()}
          pending={pending}
          title="Delete the full recordings of all kept runs?"
        >
          <p className="game-publication-message">Recorded runs stay.</p>
        </ConfirmationDialog>
      ) : null}
      {problem === null ? null : (
        <HomeToast lasting onDismiss={() => setProblem(null)} text={problem} />
      )}
    </section>
  );
}
