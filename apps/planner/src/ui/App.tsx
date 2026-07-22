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
  surfacePanelSelected,
  underworldPanelSelected,
  type PlannerSection,
  type SurfacePanel,
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
import { HubBiomeEditor } from './HubBiomeEditor';

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
  if (biomeKey !== 'F' && biomeKey !== 'G' && biomeKey !== 'H' && biomeKey !== 'I') {
    throw new Error(`${biomeKey} is not an Underworld editor panel`);
  }
  return biomeKey as UnderworldPanel;
}

function asSurfacePanel(biomeKey: string): SurfacePanel {
  if (biomeKey !== 'N') {
    throw new Error(`${biomeKey} is not a Surface editor panel`);
  }
  return biomeKey;
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
  const activeSurfacePanel = useAppSelector((state) => state.editorSession.activeSurfacePanel);
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
    activeUnderworldPanel === 'F' ||
    activeUnderworldPanel === 'G' ||
    activeUnderworldPanel === 'H' ||
    activeUnderworldPanel === 'I'
      ? activeUnderworldPanel
      : undefined;
  const activeBiomePlan = underworld.biomes.find((biome) => biome.biomeKey === activeBiomeKey);
  const activeBiomeEvaluation = underworldEvaluation.biomes.find(
    (biome) => biome.biomeKey === activeBiomeKey,
  );
  if (activeBiomeEvaluation !== undefined && activeBiomeEvaluation.kind !== 'LinearBiome') {
    throw new Error(`${activeBiomeEvaluation.biomeKey} did not produce a linear evaluation`);
  }
  const displayedUnderworldPanel =
    activeBiomeKey !== undefined && activeBiomePlan !== undefined ? activeBiomeKey : 'route';
  const configuredSurfacePanels = surfaceNavigation.biomePanels.filter((panel) =>
    surface.biomes.some((biome) => biome.biomeKey === panel.biomeKey),
  );
  const activeSurfaceBiomeKey = activeSurfacePanel === 'N' ? activeSurfacePanel : undefined;
  const activeSurfaceBiomePlan = surface.biomes.find(
    (biome) => biome.biomeKey === activeSurfaceBiomeKey,
  );
  const activeSurfaceBiomeEvaluation = surfaceEvaluation.biomes.find(
    (biome) => biome.biomeKey === activeSurfaceBiomeKey,
  );
  if (
    activeSurfaceBiomeEvaluation !== undefined &&
    activeSurfaceBiomeEvaluation.kind !== 'HubBiome'
  ) {
    throw new Error(`${activeSurfaceBiomeEvaluation.biomeKey} did not produce a Hub evaluation`);
  }
  const displayedSurfacePanel =
    activeSurfaceBiomeKey !== undefined && activeSurfaceBiomePlan !== undefined
      ? activeSurfaceBiomeKey
      : 'route';

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
            ) : activeBiomePlan?.kind === 'LinearBiome' ? (
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
              aria-current={displayedSurfacePanel === 'route' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedSurfacePanel === 'route'}
              onClick={() => dispatch(surfacePanelSelected('route'))}
              type="button"
            >
              Route
            </button>
            {configuredSurfacePanels.map((panel) => (
              <button
                aria-current={panel.biomeKey === displayedSurfacePanel ? 'page' : undefined}
                className="panel-navigation-item"
                data-active={panel.biomeKey === displayedSurfacePanel}
                key={panel.biomeKey}
                onClick={() => dispatch(surfacePanelSelected(asSurfacePanel(panel.biomeKey)))}
                type="button"
              >
                {panel.label}
              </button>
            ))}
          </nav>
          <div className="editor-panel" aria-live="polite">
            {displayedSurfacePanel === 'route' ? (
              <RouteOverview
                catalog={catalog}
                label="Surface"
                navigation={surfaceNavigation}
                route={surface}
                routeEvaluation={surfaceEvaluation}
              />
            ) : activeSurfaceBiomePlan?.kind === 'HubBiome' ? (
              <HubBiomeEditor
                candidateProjection={candidateProjection}
                catalog={catalog}
                evaluation={activeSurfaceBiomeEvaluation}
                plan={activeSurfaceBiomePlan}
                routeKey={surface.routeKey}
              />
            ) : null}
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
