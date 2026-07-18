import type { CatalogSummary } from '@run-planner/core';

import { sectionSelected, type PlannerSection } from '../application/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '../application/store';

interface AppProps {
  readonly catalogSummary: CatalogSummary;
}

const sections: readonly { key: PlannerSection; label: string }[] = [
  { key: 'underworld', label: 'Underworld' },
  { key: 'surface', label: 'Surface' },
  { key: 'settings', label: 'Settings' },
];

export function App({ catalogSummary }: AppProps) {
  const activeSection = useAppSelector((state) => state.editorSession.activeSection);
  const dispatch = useAppDispatch();

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hades II Run Director</p>
          <h1>Run Planner</h1>
        </div>
        <span className="foundation-status">Catalog migration active</span>
      </header>

      <nav className="route-tabs" aria-label="Planner sections">
        {sections.map((section) => (
          <button
            className="route-tab"
            data-active={section.key === activeSection}
            key={section.key}
            onClick={() => dispatch(sectionSelected(section.key))}
            type="button"
          >
            {section.label}
          </button>
        ))}
      </nav>

      <section className="workspace" aria-live="polite">
        <div className="workspace-copy">
          <p className="eyebrow">Phase 1</p>
          <h2>{sections.find((section) => section.key === activeSection)?.label}</h2>
          <p>
            The application composition root is active. Verified F/G declarations are available
            through the standalone catalog boundary.
          </p>
        </div>

        <dl className="catalog-summary">
          <div>
            <dt>Catalog</dt>
            <dd>{catalogSummary.version}</dd>
          </div>
          <div>
            <dt>Routes</dt>
            <dd>{catalogSummary.routeCount}</dd>
          </div>
          <div>
            <dt>Biome steps</dt>
            <dd>{catalogSummary.biomeStepCount}</dd>
          </div>
          <div>
            <dt>Reward primitives</dt>
            <dd>{catalogSummary.rewardPrimitiveCount}</dd>
          </div>
          <div>
            <dt>Rooms</dt>
            <dd>{catalogSummary.roomCount}</dd>
          </div>
        </dl>
      </section>
    </main>
  );
}
