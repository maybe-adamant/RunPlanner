import {
  canRedoProjectHistory,
  canUndoProjectHistory,
  type AuthoredRoutePlan,
  type Catalog,
  type CatalogSummary,
} from '@run-planner/core';

import {
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '../application/authoredProjectSlice';
import {
  sectionSelected,
  underworldPanelSelected,
  type PlannerSection,
  type UnderworldPanel,
} from '../application/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '../application/store';
import { FBiomeEditor } from './FBiomeEditor';

interface AppProps {
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
}

const sections: readonly { key: PlannerSection; label: string }[] = [
  { key: 'underworld', label: 'Underworld' },
  { key: 'surface', label: 'Surface' },
  { key: 'settings', label: 'Settings' },
];

const underworldPanels: readonly { key: UnderworldPanel; label: string }[] = [
  { key: 'route', label: 'Route' },
  { key: 'Underworld_F', label: 'Erebus' },
];

function RouteOverview({
  label,
  route,
}: {
  readonly label: string;
  readonly route: AuthoredRoutePlan;
}) {
  return (
    <section className="route-overview">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route settings</p>
          <h2>{label}</h2>
        </div>
        <span className="neutral-status">{route.biomes.length} configured</span>
      </header>
      <p className="panel-description">
        Route-prefix editing is not part of this smoke slice. The authored bootstrap currently
        configures only Erebus.
      </p>
    </section>
  );
}

export function App({ catalog, catalogSummary }: AppProps) {
  const activeSection = useAppSelector((state) => state.editorSession.activeSection);
  const activeUnderworldPanel = useAppSelector(
    (state) => state.editorSession.activeUnderworldPanel,
  );
  const history = useAppSelector((state) => state.authoredProject);
  const project = history.present;
  const dispatch = useAppDispatch();
  const underworld = project.routes.find((route) => route.routeKey === 'Underworld');
  const surface = project.routes.find((route) => route.routeKey === 'Surface');

  if (underworld === undefined || surface === undefined) {
    throw new Error('Authored project is missing a declared route');
  }

  const fPlan = underworld.biomes.find((biome) => biome.biomeStepKey === 'Underworld_F');

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hades II Run Director</p>
          <h1>Run Planner</h1>
        </div>
        <div className="header-actions">
          <span className="foundation-status">Authored editor smoke</span>
          <button
            disabled={!canUndoProjectHistory(history)}
            onClick={() => dispatch(authoredProjectUndoRequested())}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={!canRedoProjectHistory(history)}
            onClick={() => dispatch(authoredProjectRedoRequested())}
            type="button"
          >
            Redo
          </button>
        </div>
      </header>

      <nav className="route-tabs" aria-label="Planner sections">
        {sections.map((section) => (
          <button
            aria-current={section.key === activeSection ? 'page' : undefined}
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

      {activeSection === 'underworld' && (
        <div className="editor-workspace">
          <nav className="panel-navigation" aria-label="Underworld panels">
            <p className="navigation-label">Underworld</p>
            {underworldPanels.map((panel) => (
              <button
                className="panel-navigation-item"
                data-active={panel.key === activeUnderworldPanel}
                key={panel.key}
                onClick={() => dispatch(underworldPanelSelected(panel.key))}
                type="button"
              >
                {panel.label}
              </button>
            ))}
          </nav>
          <div className="editor-panel" aria-live="polite">
            {activeUnderworldPanel === 'route' || fPlan === undefined ? (
              <RouteOverview label="Underworld" route={underworld} />
            ) : (
              <FBiomeEditor catalog={catalog} plan={fPlan} />
            )}
          </div>
        </div>
      )}

      {activeSection === 'surface' && (
        <div className="editor-workspace">
          <nav className="panel-navigation" aria-label="Surface panels">
            <p className="navigation-label">Surface</p>
            <button className="panel-navigation-item" data-active="true" type="button">
              Route
            </button>
          </nav>
          <div className="editor-panel" aria-live="polite">
            <RouteOverview label="Surface" route={surface} />
          </div>
        </div>
      )}

      {activeSection === 'settings' && (
        <section className="settings-panel" aria-live="polite">
          <header className="panel-heading">
            <div>
              <p className="eyebrow">Application</p>
              <h2>Settings</h2>
            </div>
          </header>
          <dl className="catalog-summary">
            <div>
              <dt>Project</dt>
              <dd>{project.name}</dd>
            </div>
            <div>
              <dt>Catalog</dt>
              <dd>{catalogSummary.version}</dd>
            </div>
            <div>
              <dt>Rooms</dt>
              <dd>{catalogSummary.roomCount}</dd>
            </div>
          </dl>
        </section>
      )}
    </main>
  );
}
