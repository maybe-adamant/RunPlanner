import {
  type EncounterPhaseAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';
import { useEffect, useRef } from 'react';

import {
  presentBiomeFeedbackContext,
  type RouteFeedbackPresentation,
} from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { projectRouteNpcIndex } from '@planner/projections/routeNpcIndex';
import {
  projectRouteHermesShrineIndex,
  projectRouteStygianWellIndex,
} from '@planner/projections/routeRoomFeatureIndex';
import { projectRouteTraitOffers } from '@planner/projections/traitProjection';
import { routePanelSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
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

const routeOverviewPanel = Object.freeze({ kind: 'overview' as const });

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
  readonly project: ProjectDocument;
  readonly projectEvaluation: ProjectEvaluation;
  readonly workspace: StructuredWorkspaceProjection;
  readonly workspaceRoute: WorkspaceRoute;
}) {
  const dispatch = useAppDispatch();
  const pendingNpcPhaseFocus = useRef<EncounterPhaseAddress | null>(null);
  const activePanel = useAppSelector((state) => state.editorSession.activePanel);
  const activeBiomeProjection =
    activePanel.kind !== 'biome'
      ? undefined
      : workspaceRoute.biomes.find((biome) => biome.biomeKey === activePanel.biomeKey);
  const displayedBiomeKey = activeBiomeProjection?.biomeKey;
  const activeBiomeFeedback =
    displayedBiomeKey === undefined ? undefined : feedback.biomes.get(displayedBiomeKey);
  const routeEvaluation =
    projectEvaluation.route.routeKey === workspaceRoute.routeKey
      ? projectEvaluation.route
      : undefined;
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
  const shrineRows = projectRouteHermesShrineIndex(workspaceRoute);
  const wellRows = projectRouteStygianWellIndex(workspaceRoute);
  const hasNpcIndex = npcIndex.groups.length > 0;
  const hasTraits = traitRows.length > 0;
  const hasResources = workspaceRoute.resources.some(
    (resource) => resource.placement !== undefined,
  );
  const hasShrines = shrineRows.length > 0;
  const hasWells = wellRows.length > 0;
  const hasRouteIndexes = hasNpcIndex || hasTraits || hasResources || hasShrines || hasWells;
  const activePanelAvailable = (() => {
    switch (activePanel.kind) {
      case 'npcIndex':
        return hasNpcIndex;
      case 'traits':
        return hasTraits;
      case 'resources':
        return hasResources;
      case 'shrines':
        return hasShrines;
      case 'wells':
        return hasWells;
      case 'overview':
      case 'biome':
        return true;
    }
  })();
  const displayedPanel = activePanelAvailable ? activePanel : routeOverviewPanel;
  const contentLayout =
    displayedPanel.kind === 'biome' && activeBiomeProjection === undefined
      ? 'overview'
      : displayedPanel.kind;

  useEffect(() => {
    if (activePanelAvailable) return;
    dispatch(
      routePanelSelected({
        routeKey: workspaceRoute.routeKey,
        panel: { kind: 'overview' },
      }),
    );
  }, [activePanelAvailable, dispatch, workspaceRoute.routeKey]);

  /**
   * Semantic navigation owns the session destination. This short-lived local
   * continuation restores native keyboard focus after the NPC-index row itself
   * unmounts during that panel change.
   */
  useEffect(() => {
    const phase = pendingNpcPhaseFocus.current;
    if (phase === null) return;
    if (
      displayedPanel.kind !== 'biome' ||
      displayedPanel.biomeKey !== phase.biomeKey ||
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
  }, [displayedPanel, workspaceRoute.routeKey]);

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
            aria-current={displayedPanel.kind === 'overview' ? 'page' : undefined}
            className="panel-navigation-item"
            data-active={displayedPanel.kind === 'overview'}
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
                  displayedPanel.kind === 'biome' && biomeProjection.biomeKey === displayedBiomeKey
                    ? 'page'
                    : undefined
                }
                aria-describedby={feedbackId}
                aria-label={biomeProjection.label}
                className="panel-navigation-item"
                data-active={
                  displayedPanel.kind === 'biome' && biomeProjection.biomeKey === displayedBiomeKey
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
          {hasRouteIndexes ? <div className="panel-navigation-separator" role="separator" /> : null}
          {hasNpcIndex ? (
            <button
              aria-current={displayedPanel.kind === 'npcIndex' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedPanel.kind === 'npcIndex'}
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
          ) : null}
          {hasTraits ? (
            <button
              aria-current={displayedPanel.kind === 'traits' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedPanel.kind === 'traits'}
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
          ) : null}
          {hasResources ? (
            <button
              aria-current={displayedPanel.kind === 'resources' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedPanel.kind === 'resources'}
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
          ) : null}
          {hasShrines ? (
            <button
              aria-current={displayedPanel.kind === 'shrines' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedPanel.kind === 'shrines'}
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
          ) : null}
          {hasWells ? (
            <button
              aria-current={displayedPanel.kind === 'wells' ? 'page' : undefined}
              className="panel-navigation-item"
              data-active={displayedPanel.kind === 'wells'}
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
          ) : null}
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
          {displayedPanel.kind === 'overview' ? (
            <RouteOverview
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              project={project}
              workspaceRoute={workspaceRoute}
              interactions={interactions}
            />
          ) : displayedPanel.kind === 'npcIndex' ? (
            <RouteNpcIndex index={npcIndex} onNavigate={navigateNpcIndexEntry} />
          ) : displayedPanel.kind === 'traits' ? (
            <RouteTraitsPanel interactions={interactions} rows={traitRows} />
          ) : displayedPanel.kind === 'resources' ? (
            <RouteResourcesPanel route={workspaceRoute} />
          ) : displayedPanel.kind === 'shrines' ? (
            <RouteShrinesPanel rows={shrineRows} />
          ) : displayedPanel.kind === 'wells' ? (
            <RouteWellsPanel rows={wellRows} />
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
