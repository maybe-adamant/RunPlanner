import { createRouteAddress } from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';

import {
  presentBiomeFeedbackContext,
  projectFeedbackHierarchy,
  type RouteFeedbackPresentation,
} from '@planner/projections/evaluationProjection';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import type {
  EditorNavigation,
  RouteEditorNavigation,
} from '@planner/projections/editorNavigation';
import {
  routePanelSelected,
  routeSelected,
  settingsSelected,
} from '@planner/state/editorSessionSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type {
  StructuredWorkspaceProjection,
  StructuredWorkspaceProjectionService,
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import {
  FindingCount,
  NavigationStatusMarker,
  ProjectFindings,
  SemanticOwnerMarker,
  StatusBadge,
} from '../feedback/EvaluationFeedback';
import { BiomeWorkspace } from '../editor/biome/BiomeWorkspace';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';

interface AppProps {
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}

function RouteOverview({
  label,
  navigation,
  feedback,
  workspaceRoute,
}: {
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const configuredBiomeCount = workspaceRoute.biomes.length;
  return (
    <section className="route-overview">
      <header className="panel-heading">
        <div>
          <p className="eyebrow">Route settings</p>
          <h2>{label}</h2>
        </div>
        <div className="panel-heading-actions">
          <SemanticOwnerMarker address={workspaceRoute.marker.address} />
          <StatusBadge status={feedback.status} />
          <FindingCount count={feedback.findingCount} label={`${label} findings`} />
          <span className="neutral-status">{configuredBiomeCount} configured</span>
        </div>
      </header>
      <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-configured-prefix`}>
        <span>Configured biomes</span>
        <select
          disabled={navigation.biomePanels.length === 0 && configuredBiomeCount === 0}
          id={`${workspaceRoute.routeKey}-configured-prefix`}
          onChange={(event) => {
            const nextConfiguredBiomeCount = Number(event.target.value);
            dispatch(
              authoredProjectCommandDispatched({
                kind: 'ConfigureRoutePrefix',
                route: createRouteAddress(workspaceRoute.routeKey),
                configuredBiomeCount: nextConfiguredBiomeCount,
              }),
            );
          }}
          value={configuredBiomeCount}
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
  catalog,
  navigation,
  feedback,
  interactions,
  projectEvaluation,
  workspace,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly projectEvaluation: ProjectEvaluation;
  readonly workspace: StructuredWorkspaceProjection;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const selectedBiomeKey = useAppSelector(
    (state) => state.editorSession.activeBiomeKeyByRoute[workspaceRoute.routeKey] ?? null,
  );
  const activeBiomeProjection = workspaceRoute.biomes.find(
    (biome) => biome.biomeKey === selectedBiomeKey,
  );
  const displayedBiomeKey = activeBiomeProjection?.biomeKey ?? null;
  const activeBiomeFeedback =
    displayedBiomeKey === null ? undefined : feedback.biomes.get(displayedBiomeKey);
  const routeEvaluation = projectEvaluation.routes.find(
    (route) => route.routeKey === workspaceRoute.routeKey,
  );
  if (routeEvaluation === undefined) {
    throw new Error(`Project evaluation omitted route ${workspaceRoute.routeKey}`);
  }
  if (displayedBiomeKey !== null && activeBiomeFeedback === undefined) {
    throw new Error(
      `${workspaceRoute.routeKey} feedback omitted configured biome ${displayedBiomeKey}`,
    );
  }
  const contextMessage =
    activeBiomeFeedback === undefined
      ? undefined
      : presentBiomeFeedbackContext(catalog, activeBiomeFeedback);

  return (
    <div className="editor-workspace">
      <div className="panel-navigation-column">
        <nav className="panel-navigation" aria-label={`${navigation.label} panels`}>
          <p className="navigation-label">{navigation.label}</p>
          <button
            aria-current={displayedBiomeKey === null ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={displayedBiomeKey === null}
            onClick={() =>
              dispatch(routePanelSelected({ routeKey: workspaceRoute.routeKey, biomeKey: null }))
            }
            type="button"
          >
            Route
          </button>
          {workspaceRoute.rail.map((biomeProjection) => {
            const biomeFeedback = feedback.biomes.get(biomeProjection.biomeKey);
            if (biomeFeedback === undefined) {
              throw new Error(
                `${workspaceRoute.routeKey} feedback omitted configured biome ${biomeProjection.biomeKey}`,
              );
            }
            const feedbackId = `${workspaceRoute.routeKey}-${biomeProjection.biomeKey}-navigation-feedback`;
            return (
              <button
                aria-current={biomeProjection.biomeKey === displayedBiomeKey ? 'page' : undefined}
                aria-describedby={feedbackId}
                aria-label={biomeProjection.label}
                className="panel-navigation-item"
                data-active={biomeProjection.biomeKey === displayedBiomeKey}
                data-feedback-context={biomeFeedback.context}
                data-projection-source={biomeProjection.source}
                key={biomeProjection.biomeKey}
                onClick={() =>
                  dispatch(
                    routePanelSelected({
                      routeKey: workspaceRoute.routeKey,
                      biomeKey: biomeProjection.biomeKey,
                    }),
                  )
                }
                type="button"
              >
                <span>{biomeProjection.label}</span>
                <span
                  aria-label={`${biomeFeedback.status.label}${biomeFeedback.findingCount === 0 ? '' : `, ${biomeFeedback.findingCount} findings`}`}
                  className="navigation-feedback"
                  id={feedbackId}
                >
                  <NavigationStatusMarker status={biomeFeedback.status} />
                  <FindingCount
                    count={biomeFeedback.findingCount}
                    label={`${biomeProjection.label} findings`}
                  />
                </span>
              </button>
            );
          })}
        </nav>
      </div>
      <div className="editor-panel" aria-live="polite">
        <ProjectFindings
          catalog={catalog}
          emptyMessage={
            routeEvaluation.status === 'empty'
              ? 'Configure a biome in this route to begin simulation.'
              : 'No findings in this route.'
          }
          findings={routeEvaluation.findings}
        />
        <div
          className="editor-panel-content"
          data-editor-layout={displayedBiomeKey === null ? 'overview' : 'biome'}
        >
          {contextMessage === undefined ? null : (
            <p
              className="feedback-context-banner"
              data-feedback-context={activeBiomeFeedback?.context}
            >
              {contextMessage}
            </p>
          )}
          {displayedBiomeKey === null ? (
            <RouteOverview
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              workspaceRoute={workspaceRoute}
            />
          ) : activeBiomeProjection === undefined ? null : (
            <BiomeWorkspace
              biome={activeBiomeProjection}
              focusByOwner={workspace.focusByOwner}
              interactions={interactions}
            />
          )}
        </div>
      </div>
    </div>
  );
}

export function App({
  catalog,
  catalogSummary,
  editorNavigation,
  projectOperations,
  structuredWorkspace,
}: AppProps) {
  const activeRouteKey = useAppSelector((state) => state.editorSession.activeRouteKey);
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector(selectProjectEvaluation);
  const workspace = structuredWorkspace.project(project, evaluation);
  const dispatch = useAppDispatch();
  const feedback = projectFeedbackHierarchy(evaluation);
  const activeRouteNavigation =
    activeRouteKey === null ? undefined : editorNavigation.routes.byKey[activeRouteKey];
  const activeRouteFeedback =
    activeRouteKey === null ? undefined : feedback.routes.get(activeRouteKey);
  const activeWorkspaceRoute = workspace.routes.find((route) => route.routeKey === activeRouteKey);

  if (
    activeRouteKey !== null &&
    (activeRouteNavigation === undefined ||
      activeRouteFeedback === undefined ||
      activeWorkspaceRoute === undefined)
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
          <StatusBadge status={feedback.status} />
          <FindingCount count={feedback.findingCount} label="project findings" />
          <ProjectHistoryControls />
        </div>
      </header>

      <ProjectFileControls operations={projectOperations} />

      <nav className="route-tabs" aria-label="Planner sections">
        {editorNavigation.routes.values.map((route) => {
          const routeFeedback = feedback.routes.get(route.routeKey);
          if (routeFeedback === undefined) {
            throw new Error(`Feedback omitted route ${route.routeKey}`);
          }
          const feedbackId = `${route.routeKey}-route-feedback`;
          return (
            <button
              aria-current={route.routeKey === activeRouteKey ? 'page' : undefined}
              aria-describedby={feedbackId}
              aria-label={route.label}
              className="route-tab"
              data-active={route.routeKey === activeRouteKey}
              key={route.routeKey}
              onClick={() => dispatch(routeSelected(route.routeKey))}
              type="button"
            >
              <span>{route.label}</span>
              <span
                aria-label={`${routeFeedback.status.label}${routeFeedback.findingCount === 0 ? '' : `, ${routeFeedback.findingCount} findings`}`}
                className="navigation-feedback"
                id={feedbackId}
              >
                <StatusBadge status={routeFeedback.status} />
                <FindingCount
                  count={routeFeedback.findingCount}
                  label={`${route.label} findings`}
                />
              </span>
            </button>
          );
        })}
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

      {activeRouteNavigation !== undefined &&
        activeRouteFeedback !== undefined &&
        activeWorkspaceRoute !== undefined && (
          <RouteWorkspace
            catalog={catalog}
            feedback={activeRouteFeedback}
            interactions={workspace.interactions}
            navigation={activeRouteNavigation}
            projectEvaluation={evaluation}
            workspace={workspace}
            workspaceRoute={activeWorkspaceRoute}
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
