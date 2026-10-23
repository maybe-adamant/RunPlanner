import type { Catalog } from '@run-planner/engine/catalog-schema';
import type { AppScale } from '../shell/useAppScale';
import { LoadoutPresetsSettings } from './LoadoutPresetsSettings';

export function SettingsScreen({
  catalog,
  scale,
}: {
  readonly catalog: Catalog;
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
        <LoadoutPresetsSettings catalog={catalog} />
      </div>
    </section>
  );
}
