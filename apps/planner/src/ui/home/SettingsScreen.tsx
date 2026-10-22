import type { BuildIdentity } from '@planner/composition/buildIdentity';
import type { AppScale } from '../shell/useAppScale';

export function SettingsScreen({
  buildIdentity,
  scale,
}: {
  readonly buildIdentity: BuildIdentity;
  readonly scale: AppScale;
}) {
  return (
    <section aria-labelledby="settings-title" className="home-page">
      <div className="home-page-heading">
        <div>
          <p className="eyebrow">Settings</p>
          <h2 id="settings-title">Preferences</h2>
        </div>
      </div>
      <div className="home-settings">
        <section aria-labelledby="settings-display-title" className="home-panel home-card">
          <h3 className="home-section-title" id="settings-display-title">
            Display
          </h3>
          <div className="home-setting-row">
            <div>
              <div className="home-setting-label" id="settings-scale-label">
                App scale
              </div>
              <div className="home-setting-hint">
                Size of all text and controls. Ctrl/Cmd + and − change it anywhere.
              </div>
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
        <p className="home-about-line">Run Planner {buildIdentity.version}</p>
      </div>
    </section>
  );
}
