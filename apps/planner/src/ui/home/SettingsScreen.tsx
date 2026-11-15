import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { RecordingController } from '@planner/workspace/run-recording/recordingController';
import type { AppScale } from '../shell/useAppScale';
import { LoadoutPresetsSettings } from './LoadoutPresetsSettings';
import { RecordingSettings } from './RecordingSettings';

export function SettingsScreen({
  catalog,
  recording,
  scale,
}: {
  readonly catalog: Catalog;
  /** Run recording; absent where there is no host to watch saves, as in the browser. */
  readonly recording: RecordingController | undefined;
  readonly scale: AppScale;
}) {
  return (
    <section aria-label="Settings" className="home-page">
      <div className="home-settings">
        <section aria-labelledby="settings-display-title" className="home-panel home-card">
          <h3 className="home-panel-title" id="settings-display-title">
            Display
          </h3>
          <div className="home-setting-row">
            <div>
              <div className="home-setting-label" id="settings-scale-label">
                App scale
              </div>
              <div className="home-setting-hint">Ctrl/Cmd + / − anywhere</div>
            </div>
            <div aria-labelledby="settings-scale-label" className="home-stepper" role="group">
              <button
                aria-label="Smaller"
                className="quiet-action action-compact"
                disabled={!scale.canShrink}
                onClick={() => scale.step(-1)}
                type="button"
              >
                −
              </button>
              <output aria-live="polite" className="home-stepper-value">
                {scale.percent}%
              </output>
              <button
                aria-label="Larger"
                className="quiet-action action-compact"
                disabled={!scale.canGrow}
                onClick={() => scale.step(1)}
                type="button"
              >
                +
              </button>
              <button
                className="text-action"
                disabled={scale.percent === 100}
                onClick={scale.reset}
                type="button"
              >
                Reset
              </button>
            </div>
          </div>
        </section>
        {recording === undefined ? null : <RecordingSettings controller={recording} />}
        <LoadoutPresetsSettings catalog={catalog} />
      </div>
    </section>
  );
}
