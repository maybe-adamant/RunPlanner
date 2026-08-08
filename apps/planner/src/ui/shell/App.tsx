import {
  createRouteAddress,
  semanticAddressKey,
  type EncounterPhaseAddress,
} from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';
import { useEffect, useRef } from 'react';

import {
  presentBiomeFeedbackContext,
  projectFeedbackHierarchy,
  type RouteFeedbackPresentation,
} from '@planner/projections/evaluationProjection';
import { projectRouteNpcIndex } from '@planner/projections/routeNpcIndex';
import { authoredProjectCommandDispatched } from '@planner/state/projectWorkspaceSlice';
import type {
  EditorNavigation,
  RouteEditorNavigation,
} from '@planner/projections/editorNavigation';
import {
  routePanelSelected,
  routeSelected,
  semanticOwnerNavigated,
  settingsSelected,
} from '@planner/state/editorSessionSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  type RootState,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type {
  StructuredWorkspaceProjection,
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
import { semanticOwnerControlElementId } from '../feedback/semanticOwner';
import { BiomeWorkspace } from '../editor/biome/BiomeWorkspace';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { RouteNpcIndex } from './RouteNpcIndex';
import { RouteTraitsPanel } from './RouteTraitsPanel';
import { TraitOfferDialog } from '../editor/rewards/TraitOfferEditor';
import { projectRouteTraitOffers } from '@planner/projections/traitProjection';

interface AppProps {
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
  readonly selectStructuredWorkspace: (state: RootState) => StructuredWorkspaceProjection;
}

function presentBiomeList(labels: readonly string[]): string {
  if (labels.length === 0) return '';
  if (labels.length === 1) return labels[0]!;
  const last = labels[labels.length - 1]!;
  if (labels.length === 2) return `${labels[0]} and ${last}`;
  return `${labels.slice(0, -1).join(', ')}, and ${last}`;
}

function RouteOverview({
  catalog,
  label,
  navigation,
  feedback,
  project,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly label: string;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  readonly project: RootState['projectWorkspace']['history']['present'];
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const configuredBiomeCount = workspaceRoute.biomes.length;
  const configuredBiomeLabels = navigation.biomePanels
    .slice(0, configuredBiomeCount)
    .map((biome) => biome.label);
  const lastConfiguredBiome = configuredBiomeLabels[configuredBiomeLabels.length - 1];
  const routeExtent =
    lastConfiguredBiome === undefined ? 'No biomes' : `Through ${lastConfiguredBiome}`;
  const routeDescription =
    configuredBiomeLabels.length === 0
      ? 'No biomes configured.'
      : `Configuring ${presentBiomeList(configuredBiomeLabels)}.`;
  const authoredRoute = project.routes.find((route) => route.routeKey === workspaceRoute.routeKey);
  if (authoredRoute === undefined)
    throw new Error(`Missing authored route ${workspaceRoute.routeKey}`);
  const weapon = catalog.weapons.byKey[authoredRoute.loadout.weaponKey];
  if (weapon === undefined) throw new Error(`Missing weapon ${authoredRoute.loadout.weaponKey}`);
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
          <span className="neutral-status">{routeExtent}</span>
        </div>
      </header>
      <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-configured-prefix`}>
        <span>Configure route up to</span>
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
          <option value={0}>No biomes</option>
          {navigation.biomePanels.map((biome, index) => (
            <option key={biome.biomeKey} value={index + 1}>
              {biome.label}
            </option>
          ))}
        </select>
      </label>
      <p className="panel-description">{routeDescription}</p>
      <div className="route-loadout-controls">
        <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-weapon`}>
          <span>Weapon</span>
          <select
            id={`${workspaceRoute.routeKey}-weapon`}
            onChange={(event) => {
              const next = catalog.weapons.byKey[event.target.value];
              if (next === undefined) return;
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceRouteLoadout',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  weaponKey: next.key,
                  aspectKey: next.defaultAspectKey,
                }),
              );
            }}
            value={weapon.key}
          >
            {catalog.weapons.values.map((candidate) => (
              <option key={candidate.key} value={candidate.key}>
                {candidate.label}
              </option>
            ))}
          </select>
        </label>
        <label className="field-control" htmlFor={`${workspaceRoute.routeKey}-aspect`}>
          <span>Aspect</span>
          <select
            id={`${workspaceRoute.routeKey}-aspect`}
            onChange={(event) =>
              dispatch(
                authoredProjectCommandDispatched({
                  kind: 'ReplaceRouteLoadout',
                  route: createRouteAddress(workspaceRoute.routeKey),
                  weaponKey: weapon.key,
                  aspectKey: event.target.value,
                }),
              )
            }
            value={authoredRoute.loadout.aspectKey}
          >
            {weapon.aspectKeys.map((aspectKey) => {
              const aspect = catalog.aspects.byKey[aspectKey];
              if (aspect === undefined) return null;
              return (
                <option key={aspect.key} value={aspect.key}>
                  {aspect.label}
                </option>
              );
            })}
          </select>
        </label>
      </div>
    </section>
  );
}

function RouteWorkspace({
  catalog,
  navigation,
  feedback,
  interactions,
  project,
  projectEvaluation,
  workspace,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly navigation: RouteEditorNavigation;
  readonly feedback: RouteFeedbackPresentation;
  readonly interactions: WorkspaceInteractionCatalog;
  readonly project: RootState['projectWorkspace']['history']['present'];
  readonly projectEvaluation: ProjectEvaluation;
  readonly workspace: StructuredWorkspaceProjection;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const pendingNpcPhaseFocus = useRef<EncounterPhaseAddress | null>(null);
  const activePanel = useAppSelector(
    (state) => state.editorSession.activePanelByRoute[workspaceRoute.routeKey],
  );
  if (activePanel === undefined) {
    throw new Error(`Editor session omitted panel state for ${workspaceRoute.routeKey}`);
  }
  const activeBiomeProjection =
    activePanel.kind !== 'biome'
      ? undefined
      : workspaceRoute.biomes.find((biome) => biome.biomeKey === activePanel.biomeKey);
  const displayedBiomeKey = activeBiomeProjection?.biomeKey;
  const activeBiomeFeedback =
    displayedBiomeKey === undefined ? undefined : feedback.biomes.get(displayedBiomeKey);
  const routeEvaluation = projectEvaluation.routes.find(
    (route) => route.routeKey === workspaceRoute.routeKey,
  );
  if (routeEvaluation === undefined) {
    throw new Error(`Project evaluation omitted route ${workspaceRoute.routeKey}`);
  }
  if (displayedBiomeKey !== undefined && activeBiomeFeedback === undefined) {
    throw new Error(
      `${workspaceRoute.routeKey} feedback omitted configured biome ${displayedBiomeKey}`,
    );
  }
  const contextMessage =
    activeBiomeFeedback === undefined
      ? undefined
      : presentBiomeFeedbackContext(catalog, activeBiomeFeedback);
  const npcIndex = projectRouteNpcIndex(catalog, routeEvaluation, workspace.focusByOwner);
  const traitRows = projectRouteTraitOffers(
    catalog,
    project,
    projectEvaluation,
    workspaceRoute.routeKey,
    interactions,
  );
  const contentLayout =
    activePanel.kind === 'biome' && activeBiomeProjection === undefined
      ? 'overview'
      : activePanel.kind;

  /**
   * Semantic navigation owns the session destination. This short-lived local
   * continuation restores native keyboard focus after the NPC-index row itself
   * unmounts during that panel change.
   */
  useEffect(() => {
    const phase = pendingNpcPhaseFocus.current;
    if (phase === null) return;
    if (
      activePanel.kind !== 'biome' ||
      activePanel.biomeKey !== phase.biomeKey ||
      workspaceRoute.routeKey !== phase.routeKey
    ) {
      pendingNpcPhaseFocus.current = null;
      return;
    }
    const phaseControl = document.getElementById(semanticOwnerControlElementId(phase));
    const selector = phaseControl?.querySelector<HTMLSelectElement>('select:not(:disabled)');
    pendingNpcPhaseFocus.current = null;
    selector?.focus({ preventScroll: true });
  }, [activePanel, workspaceRoute.routeKey]);

  const navigateNpcIndexEntry = (phase: EncounterPhaseAddress): void => {
    pendingNpcPhaseFocus.current = phase;
    dispatch(semanticOwnerNavigated(phase));
  };

  return (
    <div className="editor-workspace">
      <div className="panel-navigation-column">
        <nav className="panel-navigation" aria-label={`${navigation.label} panels`}>
          <p className="navigation-label">{navigation.label}</p>
          <button
            aria-current={activePanel.kind === 'overview' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'overview'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'overview' },
                }),
              )
            }
            type="button"
          >
            Route
          </button>
          <button
            aria-current={activePanel.kind === 'npcIndex' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'npcIndex'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'npcIndex' },
                }),
              )
            }
            type="button"
          >
            NPCs
          </button>
          <button
            aria-current={activePanel.kind === 'traits' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'traits'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'traits' },
                }),
              )
            }
            type="button"
          >
            Traits
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
                aria-current={
                  activePanel.kind === 'biome' && biomeProjection.biomeKey === displayedBiomeKey
                    ? 'page'
                    : undefined
                }
                aria-describedby={feedbackId}
                aria-label={biomeProjection.label}
                className="panel-navigation-item"
                data-active={
                  activePanel.kind === 'biome' && biomeProjection.biomeKey === displayedBiomeKey
                }
                data-feedback-context={biomeFeedback.context}
                data-projection-source={biomeProjection.source}
                key={biomeProjection.biomeKey}
                onClick={() =>
                  dispatch(
                    routePanelSelected({
                      routeKey: workspaceRoute.routeKey,
                      panel: { kind: 'biome', biomeKey: biomeProjection.biomeKey },
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
        <div className="editor-panel-content" data-editor-layout={contentLayout}>
          {contextMessage === undefined ? null : (
            <p
              className="feedback-context-banner"
              data-feedback-context={activeBiomeFeedback?.context}
            >
              {contextMessage}
            </p>
          )}
          {activePanel.kind === 'overview' ? (
            <RouteOverview
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              project={project}
              workspaceRoute={workspaceRoute}
            />
          ) : activePanel.kind === 'npcIndex' ? (
            <RouteNpcIndex index={npcIndex} onNavigate={navigateNpcIndexEntry} />
          ) : activePanel.kind === 'traits' ? (
            <RouteTraitsPanel interactions={interactions} rows={traitRows} />
          ) : activeBiomeProjection === undefined ? (
            <RouteOverview
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              project={project}
              workspaceRoute={workspaceRoute}
            />
          ) : (
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
  selectStructuredWorkspace,
}: AppProps) {
  const activeRouteKey = useAppSelector((state) => state.editorSession.activeRouteKey);
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector(selectProjectEvaluation);
  const workspace = useAppSelector(selectStructuredWorkspace);
  const traitDialogTarget = useAppSelector(
    (state) => state.editorSession.traitDialogTarget ?? null,
  );
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
            project={project}
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

      {traitDialogTarget === null ? null : (
        <TraitOfferDialog
          interactions={workspace.interactions}
          key={semanticAddressKey(traitDialogTarget)}
          target={traitDialogTarget}
        />
      )}
    </main>
  );
}
