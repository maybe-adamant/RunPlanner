import { createRouteAddress, type AuthoredRoutePlan } from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';
import { type ProjectRouteEvaluation } from '@run-planner/engine/simulation';

import { presentProjectStatus, presentRouteStatus } from '../../projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '../../state/projectWorkspaceSlice';
import type { EditorNavigation, RouteEditorNavigation } from '../../projections/editorNavigation';
import {
  routePanelSelected,
  routeSelected,
  settingsSelected,
} from '../../state/editorSessionSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  useAppDispatch,
  useAppSelector,
} from '../../state/store';
import type { ProjectOperations } from '../../workspace/projectOperations';
import type { CandidateProjectionService } from '../../projections/candidateProjection';
import { ProjectFindings, SemanticOwnerMarker, StatusBadge } from '../feedback/EvaluationFeedback';
import { LinearBiomeEditor } from '../editor/linear/LinearBiomeEditor';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { HubBiomeEditor } from '../editor/hub/HubBiomeEditor';

interface AppProps {
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
}

function RouteOverview({
  label,
  navigation,
  route,
  routeEvaluation,
}: {
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly route: AuthoredRoutePlan;
  readonly routeEvaluation: ProjectRouteEvaluation;
}) {
  const dispatch = useAppDispatch();
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
          disabled={navigation.biomePanels.length === 0 && route.biomes.length === 0}
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
          {navigation.biomePanels.map((biome, index) => (
            <option key={biome.biomeKey} value={index + 1}>
              {biome.label}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-description">
        Configured biomes form one contiguous route prefix. Removing a biome also removes every
        authored room beneath it; Undo restores the exact prior project.
      </p>
    </section>
  );
}

function RouteWorkspace({
  candidateProjection,
  catalog,
  navigation,
  route,
  routeEvaluation,
}: {
  readonly candidateProjection: CandidateProjectionService;
  readonly catalog: Catalog;
  readonly navigation: RouteEditorNavigation;
  readonly route: AuthoredRoutePlan;
  readonly routeEvaluation: ProjectRouteEvaluation;
}) {
  const dispatch = useAppDispatch();
  const selectedBiomeKey = useAppSelector(
    (state) => state.editorSession.activeBiomeKeyByRoute[route.routeKey] ?? null,
  );
  const configuredPanels = navigation.biomePanels.filter((panel) =>
    route.biomes.some((biome) => biome.biomeKey === panel.biomeKey),
  );
  const activeBiomePlan = route.biomes.find((biome) => biome.biomeKey === selectedBiomeKey);
  const activeBiomeEvaluation = routeEvaluation.biomes.find(
    (biome) => biome.biomeKey === selectedBiomeKey,
  );
  if (
    activeBiomePlan !== undefined &&
    activeBiomeEvaluation !== undefined &&
    activeBiomePlan.kind !== activeBiomeEvaluation.kind
  ) {
    throw new Error(`${activeBiomeEvaluation.biomeKey} plan and evaluation kinds do not match`);
  }
  const displayedBiomeKey = activeBiomePlan?.biomeKey ?? null;

  return (
    <div className="editor-workspace">
      <nav className="panel-navigation" aria-label={`${navigation.label} panels`}>
        <p className="navigation-label">{navigation.label}</p>
        <button
          aria-current={displayedBiomeKey === null ? 'page' : undefined}
          className="panel-navigation-item"
          data-active={displayedBiomeKey === null}
          onClick={() => dispatch(routePanelSelected({ routeKey: route.routeKey, biomeKey: null }))}
          type="button"
        >
          Route
        </button>
        {configuredPanels.map((panel) => (
          <button
            aria-current={panel.biomeKey === displayedBiomeKey ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={panel.biomeKey === displayedBiomeKey}
            key={panel.biomeKey}
            onClick={() =>
              dispatch(routePanelSelected({ routeKey: route.routeKey, biomeKey: panel.biomeKey }))
            }
            type="button"
          >
            {panel.label}
          </button>
        ))}
      </nav>
      <div className="editor-panel" aria-live="polite">
        {displayedBiomeKey === null ? (
          <RouteOverview
            label={navigation.label}
            navigation={navigation}
            route={route}
            routeEvaluation={routeEvaluation}
          />
        ) : activeBiomePlan?.kind === 'HubBiome' ? (
          <HubBiomeEditor
            candidateProjection={candidateProjection}
            catalog={catalog}
            evaluation={
              activeBiomeEvaluation?.kind === 'HubBiome' ? activeBiomeEvaluation : undefined
            }
            plan={activeBiomePlan}
            routeKey={route.routeKey}
          />
        ) : activeBiomePlan?.kind === 'LinearBiome' ? (
          <LinearBiomeEditor
            candidateProjection={candidateProjection}
            catalog={catalog}
            evaluation={
              activeBiomeEvaluation?.kind === 'LinearBiome' ? activeBiomeEvaluation : undefined
            }
            plan={activeBiomePlan}
            routeKey={route.routeKey}
          />
        ) : null}
      </div>
    </div>
  );
}

export function App({
  candidateProjection,
  catalog,
  catalogSummary,
  editorNavigation,
  projectOperations,
}: AppProps) {
  const activeRouteKey = useAppSelector((state) => state.editorSession.activeRouteKey);
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector(selectProjectEvaluation);
  const dispatch = useAppDispatch();
  const activeRoute = project.routes.find((route) => route.routeKey === activeRouteKey);
  const activeRouteEvaluation = evaluation.routes.find(
    (route) => route.routeKey === activeRouteKey,
  );
  const activeRouteNavigation =
    activeRouteKey === null ? undefined : editorNavigation.routes.byKey[activeRouteKey];

  if (
    activeRouteKey !== null &&
    (activeRoute === undefined ||
      activeRouteEvaluation === undefined ||
      activeRouteNavigation === undefined)
  ) {
    throw new Error(`Editor session references unavailable route ${activeRouteKey}`);
  }

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
        {editorNavigation.routes.values.map((route) => (
          <button
            aria-current={route.routeKey === activeRouteKey ? 'page' : undefined}
            className="route-tab"
            data-active={route.routeKey === activeRouteKey}
            key={route.routeKey}
            onClick={() => dispatch(routeSelected(route.routeKey))}
            type="button"
          >
            {route.label}
          </button>
        ))}
        <button
          aria-current={activeRouteKey === null ? 'page' : undefined}
          className="route-tab"
          data-active={activeRouteKey === null}
          onClick={() => dispatch(settingsSelected())}
          type="button"
        >
          Settings
        </button>
      </nav>

      <ProjectFindings catalog={catalog} evaluation={evaluation} />

      {activeRoute !== undefined &&
        activeRouteEvaluation !== undefined &&
        activeRouteNavigation !== undefined && (
          <RouteWorkspace
            candidateProjection={candidateProjection}
            catalog={catalog}
            navigation={activeRouteNavigation}
            route={activeRoute}
            routeEvaluation={activeRouteEvaluation}
          />
        )}

      {activeRouteKey === null && (
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
