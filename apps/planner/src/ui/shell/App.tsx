import { semanticAddressKey } from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';

import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import type { EditorNavigation } from '@planner/projections/editorNavigation';
import { routeSelected, settingsSelected } from '@planner/state/editorSessionSlice';
import {
  selectPresentProject,
  selectProjectEvaluation,
  type RootState,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import { FindingCount, StatusBadge } from '../feedback/EvaluationFeedback';
import { PomResolutionDialog } from '../editor/rewards/PomResolutionEditor';
import { TraitOfferDialog } from '../editor/rewards/TraitOfferEditor';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { RouteWorkspace } from './RouteWorkspace';

interface AppProps {
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
  readonly selectStructuredWorkspace: (state: RootState) => StructuredWorkspaceProjection;
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
  const levelResolutionDialogTarget = useAppSelector(
    (state) => state.editorSession.levelResolutionDialogTarget ?? null,
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
        <div className="app-brand">
          <h1>Run Planner</h1>
        </div>
        <ProjectFileControls operations={projectOperations} />
      </header>

      <div className="app-navigation-bar">
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
        <ProjectHistoryControls />
      </div>

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
      {levelResolutionDialogTarget === null ? null : (
        <PomResolutionDialog
          interactions={workspace.interactions}
          key={semanticAddressKey(levelResolutionDialogTarget)}
          target={levelResolutionDialogTarget}
        />
      )}
    </main>
  );
}
