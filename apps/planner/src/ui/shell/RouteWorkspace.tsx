import { ArtworkIcon } from '@planner/ui/artwork/ArtworkIcon';
import { biomeIcon } from '@planner/ui/artwork/roomArtwork';
import {
  navigationArtwork,
  routeNavigationArtwork,
} from '@planner/ui/artwork/navigation/navigationArtwork';
import type { EncounterPhaseAddress, ProjectDocument } from '@run-planner/engine/authored-project';
import { type Catalog } from '@run-planner/engine/catalog-schema';
import { type ProjectEvaluation } from '@run-planner/engine/simulation';
import { useEffect, useRef, useState } from 'react';

import { type RouteFeedbackPresentation } from '@planner/projections/evaluationProjection';
import type { RouteEditorNavigation } from '@planner/projections/editorNavigation';
import { projectRouteNpcIndex } from '@planner/projections/routeNpcIndex';
import {
  projectRouteHermesShrineIndex,
  projectRouteStygianWellIndex,
} from '@planner/projections/routeRoomFeatureIndex';
import { projectRouteTraitOffers } from '@planner/projections/rewards/traitProjection';
import { routePanelSelected, semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { useAppDispatch, useAppSelector } from '@planner/state/store';
import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceRoute,
} from '@planner/projections/structured-workspace';
import { NavigationStatusMarker, ProjectFindings } from '../feedback/EvaluationFeedback';
import { semanticOwnerControlElementId } from '../feedback/semanticOwner';
import { BiomeWorkspace } from '../editor/biome/BiomeWorkspace';
import type { DraftRunController } from '@planner/workspace/draftRun';
import type { NavigationPinPreference } from '@planner/persistence/navigationPinPreference';
import type { BiomeRailPinPreference } from '@planner/persistence/biomeRailPinPreference';
import { RouteDraftPanel } from './RouteDraftPanel';
import { RouteNpcIndex } from './RouteNpcIndex';
import { RouteLoadoutPanel } from './RouteLoadoutPanel';
import { RouteScopePanel } from './RouteScopePanel';
import { RouteResourcesPanel } from './RouteResourcesPanel';
import { RouteShrinesPanel } from './RouteShrinesPanel';
import { RouteTraitsPanel } from './RouteTraitsPanel';
import { RouteWellsPanel } from './RouteWellsPanel';

const routeScopePanel = Object.freeze({ kind: 'route' as const });

const fixedRoutePanels = Object.freeze([
  Object.freeze({ kind: 'route' as const, label: 'Route' }),
  Object.freeze({ kind: 'draft' as const, label: 'Draft' }),
  Object.freeze({ kind: 'loadout' as const, label: 'Loadout' }),
]);

export function RouteWorkspace({
  catalog,
  draftRun,
  navigation,
  navigationPinPreference,
  biomeRailPinPreference,
  feedback,
  interactions,
  project,
  projectEvaluation,
  workspace,
  workspaceRoute,
}: {
  readonly catalog: Catalog;
  readonly draftRun: DraftRunController;
  readonly navigation: RouteEditorNavigation;
  readonly navigationPinPreference?: NavigationPinPreference;
  readonly biomeRailPinPreference?: BiomeRailPinPreference;
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
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  const replacementRevision = useAppSelector(
    (state) => state.editorSession.workspaceReplacementRevision,
  );
  const replacementKey = `${project.projectId}:${replacementRevision}`;
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
      case 'draft':
      case 'route':
      case 'loadout':
      case 'biome':
        return true;
    }
  })();
  const displayedPanel = activePanelAvailable ? activePanel : routeScopePanel;
  const contentLayout =
    displayedPanel.kind === 'biome' && activeBiomeProjection === undefined
      ? 'route'
      : displayedPanel.kind;

  useEffect(() => {
    if (activePanelAvailable) return;
    dispatch(
      routePanelSelected({
        routeKey: workspaceRoute.routeKey,
        panel: { kind: 'route' },
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
    pendingNpcPhaseFocus.current = null;
    phaseControl?.focus({ preventScroll: true });
  }, [displayedPanel, workspaceRoute.routeKey]);

  const [pinned, setPinnedState] = useState(() => navigationPinPreference?.read() ?? true);
  const [navigationOpen, setNavigationOpen] = useState(false);
  const setPinned = (next: boolean): void => {
    setPinnedState(next);
    navigationPinPreference?.write(next);
  };
  const navigateNpcIndexEntry = (phase: EncounterPhaseAddress): void => {
    pendingNpcPhaseFocus.current = phase;
    dispatch(semanticOwnerNavigated(phase));
  };
  // The plan's next repair, a pill on the heading of whichever panel is shown.
  const findingPill = (
    <ProjectFindings
      catalog={catalog}
      issue={routeEvaluation.issue}
      focusByOwner={workspace.focusByOwner}
      route={workspaceRoute}
      // The plan's findings beyond those of the repair shown.
      otherFindings={Math.max(
        0,
        projectEvaluation.findings.length - (routeEvaluation.issue?.reasons.length ?? 0),
      )}
    />
  );

  return (
    <div className="editor-workspace" data-navigation-pinned={pinned}>
      <div
        className="panel-navigation-column"
        data-open={navigationOpen || undefined}
        onClickCapture={(event) => {
          // An unpinned list closes once a panel is chosen from it.
          if (!pinned && (event.target as Element).closest('.panel-navigation-item') !== null)
            setNavigationOpen(false);
        }}
        onMouseLeave={() => setNavigationOpen(false)}
      >
        <button
          aria-expanded={pinned || navigationOpen}
          aria-label={pinned ? 'Unpin panels' : navigationOpen ? 'Pin panels' : 'Show panels'}
          className="panel-navigation-pin"
          onClick={() => {
            if (pinned) {
              setPinned(false);
              setNavigationOpen(false);
            } else if (navigationOpen) {
              setPinned(true);
              setNavigationOpen(false);
            } else setNavigationOpen(true);
          }}
          type="button"
        >
          {pinned ? '⇤' : navigationOpen ? '⇥' : '☰'}
        </button>
        <nav className="panel-navigation" aria-label={`${navigation.label} panels`}>
          {/* Panels stay put while a draft runs. */}
          <fieldset className="panel-navigation-fieldset" disabled={drafting}>
            <p className="navigation-label">{navigation.label}</p>
            {fixedRoutePanels.map((panel) => (
              <button
                aria-current={displayedPanel.kind === panel.kind ? 'page' : undefined}
                aria-label={panel.label}
                className="panel-navigation-item"
                data-active={displayedPanel.kind === panel.kind}
                key={panel.kind}
                onClick={() =>
                  dispatch(
                    routePanelSelected({
                      routeKey: workspaceRoute.routeKey,
                      panel: { kind: panel.kind },
                    }),
                  )
                }
                type="button"
                {...(panel.kind === 'loadout'
                  ? {
                      'aria-describedby': `${workspaceRoute.routeKey}-loadout-navigation-feedback`,
                    }
                  : {})}
              >
                <PanelLabel
                  icon={
                    panel.kind === 'route'
                      ? routeNavigationArtwork[workspaceRoute.routeKey]
                      : navigationArtwork[panel.kind]
                  }
                  label={panel.label}
                />
                {panel.kind === 'loadout' ? (
                  <span
                    aria-label={`${feedback.loadout.status.label}${feedback.loadout.findingCount === 0 ? '' : `, ${feedback.loadout.findingCount} findings`}`}
                    className="navigation-feedback"
                    id={`${workspaceRoute.routeKey}-loadout-navigation-feedback`}
                  >
                    <NavigationStatusMarker status={feedback.loadout.status} />
                  </span>
                ) : null}
              </button>
            ))}
            <div className="panel-navigation-separator" role="separator" />
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
                    displayedPanel.kind === 'biome' &&
                    biomeProjection.biomeKey === displayedBiomeKey
                      ? 'page'
                      : undefined
                  }
                  aria-describedby={feedbackId}
                  aria-label={biomeProjection.label}
                  className="panel-navigation-item"
                  data-active={
                    displayedPanel.kind === 'biome' &&
                    biomeProjection.biomeKey === displayedBiomeKey
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
                  <span className="panel-navigation-biome">
                    <ArtworkIcon
                      className="panel-navigation-icon"
                      source={biomeIcon(biomeProjection.biomeKey)}
                    />
                    <span>{biomeProjection.label}</span>
                  </span>
                  <span
                    aria-label={`${biomeFeedback.status.label}${biomeFeedback.findingCount === 0 ? '' : `, ${biomeFeedback.findingCount} findings`}`}
                    className="navigation-feedback"
                    id={feedbackId}
                  >
                    <NavigationStatusMarker status={biomeFeedback.status} />
                  </span>
                </button>
              );
            })}
            {hasRouteIndexes ? (
              <div className="panel-navigation-separator" role="separator" />
            ) : null}
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
                <PanelLabel icon={navigationArtwork.npcIndex} label="NPCs" />
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
                <PanelLabel icon={navigationArtwork.traits} label="Traits" />
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
                <PanelLabel icon={navigationArtwork.resources} label="Resources" />
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
                <PanelLabel icon={navigationArtwork.shrines} label="Shrines" />
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
                <PanelLabel icon={navigationArtwork.wells} label="Wells" />
              </button>
            ) : null}
          </fieldset>
        </nav>
      </div>
      <div className="editor-panel" aria-live="polite">
        <div className="editor-panel-content" data-editor-layout={contentLayout}>
          {displayedPanel.kind === 'route' ? (
            <RouteScopePanel
              headingAside={findingPill}
              authoredRoute={project.route}
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              replacementKey={replacementKey}
              workspaceRoute={workspaceRoute}
            />
          ) : displayedPanel.kind === 'draft' ? (
            <RouteDraftPanel
              headingAside={findingPill}
              catalog={catalog}
              draftRun={draftRun}
              interactions={interactions}
              project={project}
              workspaceRoute={workspaceRoute}
            />
          ) : displayedPanel.kind === 'loadout' ? (
            <RouteLoadoutPanel
              headingAside={findingPill}
              catalog={catalog}
              project={project}
              workspaceRoute={workspaceRoute}
              interactions={interactions}
            />
          ) : displayedPanel.kind === 'npcIndex' ? (
            <RouteNpcIndex
              headingAside={findingPill}
              index={npcIndex}
              onNavigate={navigateNpcIndexEntry}
            />
          ) : displayedPanel.kind === 'traits' ? (
            <RouteTraitsPanel
              headingAside={findingPill}
              interactions={interactions}
              rows={traitRows}
            />
          ) : displayedPanel.kind === 'resources' ? (
            <RouteResourcesPanel headingAside={findingPill} route={workspaceRoute} />
          ) : displayedPanel.kind === 'shrines' ? (
            <RouteShrinesPanel headingAside={findingPill} rows={shrineRows} />
          ) : displayedPanel.kind === 'wells' ? (
            <RouteWellsPanel headingAside={findingPill} rows={wellRows} />
          ) : activeBiomeProjection === undefined ? (
            <RouteScopePanel
              headingAside={findingPill}
              authoredRoute={project.route}
              catalog={catalog}
              label={navigation.label}
              navigation={navigation}
              feedback={feedback}
              replacementKey={replacementKey}
              workspaceRoute={workspaceRoute}
            />
          ) : (
            <BiomeWorkspace
              biome={activeBiomeProjection}
              {...(biomeRailPinPreference === undefined
                ? {}
                : { railPinPreference: biomeRailPinPreference })}
              focusByOwner={workspace.focusByOwner}
              interactions={interactions}
              repairBanner={findingPill}
              runStateLaunchers={workspace.runStateLaunchers}
            />
          )}
        </div>
      </div>
    </div>
  );
}

/** A panel's icon and name; folded navigation shows the icon alone. */
function PanelLabel({
  icon,
  label,
}: {
  readonly icon: string | null | undefined;
  readonly label: string;
}) {
  return (
    <span className="panel-navigation-biome">
      <ArtworkIcon className="panel-navigation-icon" source={icon ?? undefined} />
      <span>{label}</span>
    </span>
  );
}
