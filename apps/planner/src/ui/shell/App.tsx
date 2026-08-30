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
  readonly selectStructuredWorkspace: (
    state: RootState,
  ) => StructuredWorkspaceProjection | undefined;
}

export function App({
  catalog,
  catalogSummary,
  editorNavigation,
  projectOperations,
  selectStructuredWorkspace,
}: AppProps) {
  const activeSection = useAppSelector((state) => state.editorSession.activeSection);
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
  const feedback = evaluation === undefined ? undefined : projectFeedbackHierarchy(evaluation);
  const activeRouteNavigation =
    workspace === undefined ? undefined : editorNavigation.routes.byKey[workspace.route.routeKey];
  const activeRouteFeedback = feedback?.route;
  const activeWorkspaceRoute = workspace?.route;

  if (workspace !== undefined && activeRouteNavigation === undefined) {
    throw new Error(`Editor navigation references unavailable route ${workspace.route.routeKey}`);
  }

  return (
    <main className="app-shell">
      <header className="app-header">
        <div className="app-brand">
          <h1>Run Planner</h1>
        </div>
        <ProjectFileControls
          hasProject={project !== undefined}
          operations={projectOperations}
          routes={editorNavigation.routes.values}
        />
      </header>

      <div className="app-navigation-bar">
        <nav className="route-tabs" aria-label="Planner sections">
          {activeRouteNavigation !== undefined && activeRouteFeedback !== undefined && (
            <button
              aria-current={activeSection === 'route' ? 'page' : undefined}
              aria-describedby={`${activeRouteNavigation.routeKey}-route-feedback`}
              aria-label={activeRouteNavigation.label}
              className="route-tab"
              data-active={activeSection === 'route'}
              onClick={() => dispatch(routeSelected(activeRouteNavigation.routeKey))}
              type="button"
            >
              <span>{activeRouteNavigation.label}</span>
              <span
                aria-label={`${activeRouteFeedback.status.label}${activeRouteFeedback.findingCount === 0 ? '' : `, ${activeRouteFeedback.findingCount} findings`}`}
                className="navigation-feedback"
                id={`${activeRouteNavigation.routeKey}-route-feedback`}
              >
                <StatusBadge status={activeRouteFeedback.status} />
                <FindingCount
                  count={activeRouteFeedback.findingCount}
                  label={`${activeRouteNavigation.label} findings`}
                />
              </span>
            </button>
          )}
          {project !== undefined && (
            <button
              aria-current={activeSection === 'settings' ? 'page' : undefined}
              className="route-tab"
              data-active={activeSection === 'settings'}
              onClick={() => dispatch(settingsSelected())}
              type="button"
            >
              Settings
            </button>
          )}
        </nav>
        <ProjectHistoryControls hasProject={project !== undefined} />
      </div>

      {project !== undefined &&
        evaluation !== undefined &&
        workspace !== undefined &&
        activeRouteNavigation !== undefined &&
        activeRouteFeedback !== undefined &&
        activeWorkspaceRoute !== undefined &&
        activeSection === 'route' && (
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

      {project !== undefined && activeSection === 'settings' && (
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

      {traitDialogTarget === null || workspace === undefined ? null : (
        <TraitOfferDialog
          interactions={workspace.interactions}
          key={semanticAddressKey(traitDialogTarget)}
          target={traitDialogTarget}
        />
      )}
      {levelResolutionDialogTarget === null || workspace === undefined ? null : (
        <PomResolutionDialog
          interactions={workspace.interactions}
          key={semanticAddressKey(levelResolutionDialogTarget)}
          target={levelResolutionDialogTarget}
        />
      )}
    </main>
  );
}
