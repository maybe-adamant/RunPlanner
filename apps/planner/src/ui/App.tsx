import {
  createRouteAddress,
  type AuthoredRoutePlan,
  type Catalog,
  type CatalogSummary,
} from '@run-planner/core';

import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '../application/projectWorkspaceSlice';
import type { EditorNavigation, RouteEditorNavigation } from '../application/editorNavigation';
import {
  sectionSelected,
  underworldPanelSelected,
  type PlannerSection,
  type UnderworldPanel,
} from '../application/editorSessionSlice';
import {
  selectCanRedoProject,
  selectCanUndoProject,
  selectPresentProject,
  useAppDispatch,
  useAppSelector,
} from '../application/store';
import { FBiomeEditor } from './FBiomeEditor';

interface AppProps {
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
}

const sections: readonly { key: PlannerSection; label: string }[] = [
  { key: 'underworld', label: 'Underworld' },
  { key: 'surface', label: 'Surface' },
  { key: 'settings', label: 'Settings' },
];

function asUnderworldPanel(biomeKey: string): UnderworldPanel {
  if (biomeKey !== 'F') {
    throw new Error(`${biomeKey} is not an Underworld editor panel`);
  }
  return biomeKey as UnderworldPanel;
}

function RouteOverview({
  catalog,
  label,
  navigation,
  route,
}: {
  readonly catalog: Catalog;
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly route: AuthoredRoutePlan;
}) {
  const dispatch = useAppDispatch();
  const currentPrefixAvailable =
    route.biomes.length <= navigation.configurablePrefixBiomePanels.length;
  const currentTerminalBiome = route.biomes.at(-1);
  const currentTerminalDeclaration =
    currentTerminalBiome === undefined
      ? undefined
      : catalog.biomes.byKey[currentTerminalBiome.biomeKey];
  if (currentTerminalBiome !== undefined && currentTerminalDeclaration === undefined) {
    throw new Error(`${route.routeKey} references unknown biome ${currentTerminalBiome.biomeKey}`);
  }

  return (
    <section className="route-overview">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route settings</p>
          <h2>{label}</h2>
        </div>
        <span className="neutral-status">{route.biomes.length} configured</span>
      </header>
      <label className="field-control" htmlFor={`${route.routeKey}-configured-prefix`}>
        <span>Configured biomes</span>
        <select
          disabled={
            navigation.configurablePrefixBiomePanels.length === 0 && route.biomes.length === 0
          }
          id={`${route.routeKey}-configured-prefix`}
          onChange={(event) => {
            const configuredBiomeCount = Number(event.target.value);
            const removedBiomeCount = route.biomes.length - configuredBiomeCount;
            if (
              removedBiomeCount > 0 &&
              !globalThis.confirm(
                `Remove ${removedBiomeCount} configured ${removedBiomeCount === 1 ? 'biome' : 'biomes'} and all authored state in the removed prefix? Undo can restore it.`,
              )
            ) {
              return;
            }
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ConfigureRoutePrefix',
                route: createRouteAddress(route.routeKey),
                configuredBiomeCount,
              }),
            );
          }}
          value={route.biomes.length}
        >
          <option value={0}>None</option>
          {navigation.configurablePrefixBiomePanels.map((biome, index) => (
            <option key={biome.biomeKey} value={index + 1}>
              {biome.label}
            </option>
          ))}
          {!currentPrefixAvailable && currentTerminalDeclaration !== undefined && (
            <option disabled value={route.biomes.length}>
              {currentTerminalDeclaration.label} (not active)
            </option>
          )}
        </select>
      </label>
      <p className="panel-description">
        Configured biomes form one contiguous route prefix. Removing a biome also removes every
        authored room beneath it; Undo restores the exact prior project.
      </p>
    </section>
  );
}

export function App({ catalog, catalogSummary, editorNavigation }: AppProps) {
  const activeSection = useAppSelector((state) => state.editorSession.activeSection);
  const activeUnderworldPanel = useAppSelector(
    (state) => state.editorSession.activeUnderworldPanel,
  );
  const project = useAppSelector(selectPresentProject);
  const canUndo = useAppSelector(selectCanUndoProject);
  const canRedo = useAppSelector(selectCanRedoProject);
  const dispatch = useAppDispatch();
  const underworld = project.routes.find((route) => route.routeKey === 'Underworld');
  const surface = project.routes.find((route) => route.routeKey === 'Surface');
  const underworldNavigation = editorNavigation.routes.Underworld;
  const surfaceNavigation = editorNavigation.routes.Surface;

  if (
    underworld === undefined ||
    surface === undefined ||
    underworldNavigation === undefined ||
    surfaceNavigation === undefined
  ) {
    throw new Error('Authored project is missing a declared route');
  }

  const fPlan = underworld.biomes.find((biome) => biome.biomeKey === 'F');
  const configuredUnderworldPanels = underworldNavigation.biomePanels.filter((panel) =>
    underworld.biomes.some((biome) => biome.biomeKey === panel.biomeKey),
  );
  const displayedUnderworldPanel =
    activeUnderworldPanel === 'F' && fPlan !== undefined ? 'F' : 'route';

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hades II Run Director</p>
          <h1>Run Planner</h1>
        </div>
        <div className="header-actions">
          <span className="foundation-status">Project editor</span>
          <button
            disabled={!canUndo}
            onClick={() => dispatch(authoredProjectUndoRequested())}
            type="button"
          >
            Undo
          </button>
          <button
            disabled={!canRedo}
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
            <button
              className="panel-navigation-item"
              data-active={displayedUnderworldPanel === 'route'}
              onClick={() => dispatch(underworldPanelSelected('route'))}
              type="button"
            >
              Route
            </button>
            {configuredUnderworldPanels.map((panel) => (
              <button
                className="panel-navigation-item"
                data-active={panel.biomeKey === displayedUnderworldPanel}
                key={panel.biomeKey}
                onClick={() => dispatch(underworldPanelSelected(asUnderworldPanel(panel.biomeKey)))}
                type="button"
              >
                {panel.label}
              </button>
            ))}
          </nav>
          <div className="editor-panel" aria-live="polite">
            {displayedUnderworldPanel === 'route' ? (
              <RouteOverview
                catalog={catalog}
                label="Underworld"
                navigation={underworldNavigation}
                route={underworld}
              />
            ) : fPlan !== undefined ? (
              <FBiomeEditor catalog={catalog} plan={fPlan} routeKey={underworld.routeKey} />
            ) : null}
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
            <RouteOverview
              catalog={catalog}
              label="Surface"
              navigation={surfaceNavigation}
              route={surface}
            />
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
