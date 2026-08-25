import { type EncounterPhaseAddress } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';
import { useEffect, useRef } from 'react';

import {
  presentBiomeFeedbackContext,
  type RouteFeedbackPresentation,
} from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { projectRouteNpcIndex } from '@planner/projections/routeNpcIndex';
import { projectRouteTraitOffers } from '@planner/projections/traitProjection';
import { routePanelSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { type RootState, useAppDispatch, useAppSelector } from '@planner/state/store';
import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import {
  FindingCount,
  NavigationStatusMarker,
  ProjectFindings,
} from '../feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '../feedback/semanticOwner';
import { BiomeWorkspace } from '../editor/biome/BiomeWorkspace';
import { RouteNpcIndex } from './RouteNpcIndex';
import { RouteOverview } from './RouteOverview';
import { RouteResourcesPanel } from './RouteResourcesPanel';
import { RouteShrinesPanel } from './RouteShrinesPanel';
import { RouteTraitsPanel } from './RouteTraitsPanel';
import { RouteWellsPanel } from './RouteWellsPanel';

export function RouteWorkspace({
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
    const selector = phaseControl?.querySelector<HTMLButtonElement>(
      'button.contextual-picker-trigger:not(:disabled)',
    );
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
          <button
            aria-current={activePanel.kind === 'resources' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'resources'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'resources' },
                }),
              )
            }
            type="button"
          >
            Resources
          </button>
          <button
            aria-current={activePanel.kind === 'shrines' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'shrines'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'shrines' },
                }),
              )
            }
            type="button"
          >
            Shrines
          </button>
          <button
            aria-current={activePanel.kind === 'wells' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={activePanel.kind === 'wells'}
            onClick={() =>
              dispatch(
                routePanelSelected({
                  routeKey: workspaceRoute.routeKey,
                  panel: { kind: 'wells' },
                }),
              )
            }
            type="button"
          >
            Wells
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
          focusByOwner={workspace.focusByOwner}
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
              interactions={interactions}
            />
          ) : activePanel.kind === 'npcIndex' ? (
            <RouteNpcIndex index={npcIndex} onNavigate={navigateNpcIndexEntry} />
          ) : activePanel.kind === 'traits' ? (
            <RouteTraitsPanel interactions={interactions} rows={traitRows} />
          ) : activePanel.kind === 'resources' ? (
            <RouteResourcesPanel route={workspaceRoute} />
          ) : activePanel.kind === 'shrines' ? (
            <RouteShrinesPanel route={workspaceRoute} />
          ) : activePanel.kind === 'wells' ? (
            <RouteWellsPanel route={workspaceRoute} />
          ) : activeBiomeProjection === undefined ? (
            <RouteOverview
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              project={project}
              workspaceRoute={workspaceRoute}
              interactions={interactions}
            />
          ) : (
            <BiomeWorkspace
              biome={activeBiomeProjection}
              focusByOwner={workspace.focusByOwner}
              interactions={interactions}
              runStateLaunchers={workspace.runStateLaunchers}
            />
          )}
        </div>
      </div>
    </div>
  );
}
