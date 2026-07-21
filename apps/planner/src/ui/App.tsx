import {
  createRouteAddress,
  type AuthoredRoutePlan,
  type Catalog,
  type CatalogSummary,
  type ProjectRouteEvaluation,
} from '@run-planner/core';

import { presentProjectStatus, presentRouteStatus } from '../application/evaluationProjection';
import { authoredProjectCommandDispatched } from '../application/projectWorkspaceSlice';
import type { EditorNavigation, RouteEditorNavigation } from '../application/editorNavigation';
import {
  sectionSelected,
  underworldPanelSelected,
  type PlannerSection,
  type UnderworldPanel,
} from '../application/editorSessionSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  useAppDispatch,
  useAppSelector,
} from '../application/store';
import type { ProjectOperations } from '../application/projectOperations';
import type { CandidateProjectionService } from '../application/candidateProjection';
import { ProjectFindings, SemanticOwnerMarker, StatusBadge } from './EvaluationFeedback';
import { LinearBiomeEditor } from './LinearBiomeEditor';
import { ProjectFileControls } from './ProjectFileControls';
import { ProjectHistoryControls } from './ProjectHistoryControls';

interface AppProps {
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
}

const sections: readonly { key: PlannerSection; label: string }[] = [
  { key: 'underworld', label: 'Underworld' },
  { key: 'surface', label: 'Surface' },
  { key: 'settings', label: 'Settings' },
];

function asUnderworldPanel(biomeKey: string): UnderworldPanel {
  if (biomeKey !== 'F' && biomeKey !== 'G' && biomeKey !== 'H') {
    throw new Error(`${biomeKey} is not an Underworld editor panel`);
  }
  return biomeKey as UnderworldPanel;
}

function RouteOverview({
  catalog,
  label,
  navigation,
  route,
  routeEvaluation,
}: {
  readonly catalog: Catalog;
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly route: AuthoredRoutePlan;
  readonly routeEvaluation: ProjectRouteEvaluation;
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
        <div className="panel-heading-actions">
          <SemanticOwnerMarker address={createRouteAddress(route.routeKey)} />
          <StatusBadge status={presentRouteStatus(routeEvaluation)} />
          <span className="neutral-status">{route.biomes.length} configured</span>
        </div>
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

export function App({
  candidateProjection,
  catalog,
  catalogSummary,
  editorNavigation,
  projectOperations,
}: AppProps) {
  const activeSection = useAppSelector((state) => state.editorSession.activeSection);
  const activeUnderworldPanel = useAppSelector(
    (state) => state.editorSession.activeUnderworldPanel,
  );
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector(selectProjectEvaluation);
  const dispatch = useAppDispatch();
  const underworld = project.routes.find((route) => route.routeKey === 'Underworld');
  const surface = project.routes.find((route) => route.routeKey === 'Surface');
  const underworldNavigation = editorNavigation.routes.Underworld;
  const surfaceNavigation = editorNavigation.routes.Surface;
  const underworldEvaluation = evaluation.routes.find((route) => route.routeKey === 'Underworld');
  const surfaceEvaluation = evaluation.routes.find((route) => route.routeKey === 'Surface');

  if (
    underworld === undefined ||
    surface === undefined ||
    underworldNavigation === undefined ||
    surfaceNavigation === undefined ||
    underworldEvaluation === undefined ||
    surfaceEvaluation === undefined
  ) {
    throw new Error('Authored project is missing a declared route');
  }

  const configuredUnderworldPanels = underworldNavigation.biomePanels.filter((panel) =>
    underworld.biomes.some((biome) => biome.biomeKey === panel.biomeKey),
  );
  const activeBiomeKey =
    activeUnderworldPanel === 'F' || activeUnderworldPanel === 'G' || activeUnderworldPanel === 'H'
      ? activeUnderworldPanel
      : undefined;
  const activeBiomePlan = underworld.biomes.find((biome) => biome.biomeKey === activeBiomeKey);
  const activeBiomeEvaluation = underworldEvaluation.biomes.find(
    (biome) => biome.biomeKey === activeBiomeKey,
  );
  const displayedUnderworldPanel =
    activeBiomeKey !== undefined && activeBiomePlan !== undefined ? activeBiomeKey : 'route';

  return (
    <main className="app-shell">
      <header className="app-header">
        <div>
          <p className="eyebrow">Hades II Run Director</p>
          <h1>Run Planner</h1>
        </div>
        <div className="header-actions">
          <span className="foundation-status">Project editor</span>
          <StatusBadge status={presentProjectStatus(evaluation)} />
          <ProjectHistoryControls />
        </div>
      </header>

      <ProjectFileControls operations={projectOperations} />

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

      <ProjectFindings catalog={catalog} evaluation={evaluation} />

      {activeSection === 'underworld' && (
        <div className="editor-workspace">
          <nav className="panel-navigation" aria-label="Underworld panels">
            <p className="navigation-label">Underworld</p>
            <button
              aria-current={displayedUnderworldPanel === 'route' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedUnderworldPanel === 'route'}
              onClick={() => dispatch(underworldPanelSelected('route'))}
              type="button"
            >
              Route
            </button>
            {configuredUnderworldPanels.map((panel) => (
              <button
                aria-current={panel.biomeKey === displayedUnderworldPanel ? 'page' : undefined}
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
                routeEvaluation={underworldEvaluation}
              />
            ) : activeBiomePlan !== undefined ? (
              <LinearBiomeEditor
                candidateProjection={candidateProjection}
                catalog={catalog}
                evaluation={activeBiomeEvaluation}
                plan={activeBiomePlan}
                routeKey={underworld.routeKey}
              />
            ) : null}
          </div>
        </div>
      )}

      {activeSection === 'surface' && (
        <div className="editor-workspace">
          <nav className="panel-navigation" aria-label="Surface panels">
            <p className="navigation-label">Surface</p>
            <button
              aria-current="page"
              className="panel-navigation-item"
              data-active="true"
              type="button"
            >
              Route
            </button>
          </nav>
          <div className="editor-panel" aria-live="polite">
            <RouteOverview
              catalog={catalog}
              label="Surface"
              navigation={surfaceNavigation}
              route={surface}
              routeEvaluation={surfaceEvaluation}
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
