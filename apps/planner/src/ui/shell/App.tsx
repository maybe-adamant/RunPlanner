import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';
import { semanticAddressKey } from '@run-planner/engine/authored-project';

import {
  nextRepairSelection,
  projectFeedbackHierarchy,
} from '@planner/projections/evaluationProjection';
import {
  projectRouteNavigation,
  type EditorNavigation,
} from '@planner/projections/editorNavigation';
import {
  selectPresentProject,
  selectProjectEvaluation,
  type RootState,
  useAppDispatch,
  useAppSelector,
} from '@planner/state/store';
import { findingSelected } from '@planner/state/editorSessionSlice';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import type { AppScalePreference } from '@planner/persistence/appScalePreference';
import type { LoadoutPresetController } from '@planner/persistence/loadoutPresets';
import type { BuildIdentity } from '@planner/composition/buildIdentity';
import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { BugReportOperations } from '@planner/workspace/bugReport';
import type { CatalogFeedController } from '@planner/workspace/catalogFeed';
import type { CommunityEventController } from '@planner/workspace/communityEvents';
import type { SlotRebuildController } from '@planner/workspace/slotRebuild';
import type { DraftRunController } from '@planner/workspace/draftRun';
import type { CloseRequestController } from '@planner/workspace/closeRequest';
import { PomResolutionDialog } from '../editor/rewards/PomResolutionEditor';
import { TraitOfferDialog } from '../editor/rewards/TraitOfferEditor';
import { HintLayer } from '../controls/HintLayer';
import { HomeScreen } from '../home/HomeScreen';
import { RouteWorkspace } from './RouteWorkspace';
import { FindingTargetScope } from '../feedback/useFindingTarget';
import { useAppScale } from './useAppScale';
import { LoadoutPresetsContext } from './loadoutPresetsContext';
import { NoticeArea } from './NoticeArea';
import { EditorHeader } from './EditorHeader';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { routeBannerArtwork } from '@planner/ui/artwork/route-banners/routeBannerArtwork';

interface AppProps {
  readonly appScalePreference?: AppScalePreference;
  /** The planner's Arcana and Vow presets; absent where none are kept. */
  readonly loadoutPresets?: LoadoutPresetController;
  /** Present only in the desktop application. */
  readonly bugReport?: BugReportOperations;
  readonly buildIdentity: BuildIdentity;
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  /** Asks before closing while the open plan's latest edits could not be saved. */
  readonly closeRequest?: CloseRequestController;
  readonly draftRun: DraftRunController;
  readonly editorNavigation: EditorNavigation;
  /** Present only in the desktop application. */
  readonly communityEvents?: CommunityEventController;
  readonly gameStatus?: GameStatusController;
  /** Present only in the desktop application. */
  readonly planCatalog?: CatalogFeedController;
  readonly projectOperations: ProjectOperations;
  readonly releaseUpdates?: ReleaseUpdateController;
  /** Present only in the desktop application. */
  readonly slotRebuild?: SlotRebuildController;
  readonly selectStructuredWorkspace: (
    state: RootState,
  ) => StructuredWorkspaceProjection | undefined;
}

export function App({
  appScalePreference,
  loadoutPresets,
  bugReport,
  buildIdentity,
  catalog,
  catalogSummary,
  closeRequest,
  draftRun,
  editorNavigation,
  communityEvents,
  gameStatus,
  planCatalog,
  projectOperations,
  releaseUpdates,
  slotRebuild,
  selectStructuredWorkspace,
}: AppProps) {
  const scale = useAppScale(appScalePreference);
  const project = useAppSelector(selectPresentProject);
  const view = useAppSelector((state) => state.librarySession.view);
  const dispatch = useAppDispatch();
  const evaluation = useAppSelector(selectProjectEvaluation);
  const workspace = useAppSelector(selectStructuredWorkspace);
  const traitDialogTarget = useAppSelector(
    (state) => state.editorSession.traitDialogTarget ?? null,
  );
  const levelResolutionDialogTarget = useAppSelector(
    (state) => state.editorSession.levelResolutionDialogTarget ?? null,
  );
  const feedback = evaluation === undefined ? undefined : projectFeedbackHierarchy(evaluation);
  const activeRouteNavigation =
    project === undefined ? undefined : projectRouteNavigation(catalog, project.route);
  const activeRouteFeedback = feedback?.route;
  const activeWorkspaceRoute = workspace?.route;
  // The editor shows only while a plan is open.
  const showEditor = view.kind === 'editor' && project !== undefined;
  const routeBanner =
    activeRouteNavigation === undefined
      ? null
      : (routeBannerArtwork[activeRouteNavigation.routeKey] ?? null);
  const repairIssue = evaluation?.route.issue;
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  const showFindings =
    repairIssue === undefined || workspace === undefined || drafting
      ? undefined
      : () => dispatch(findingSelected(nextRepairSelection(repairIssue, workspace.focusByOwner)));

  if (workspace !== undefined && activeRouteNavigation === undefined) {
    throw new Error(`Editor navigation references unavailable route ${workspace.route.routeKey}`);
  }

  const notices = <NoticeArea communityEvents={communityEvents} releaseUpdates={releaseUpdates} />;

  return (
    <LoadoutPresetsContext.Provider value={loadoutPresets ?? null}>
      <FindingTargetScope
        {...(workspace === undefined ? {} : { authoringReadiness: workspace.authoringReadiness })}
        findings={workspace?.findingsByRepairTarget}
      >
        <main className="app-shell" data-view={showEditor ? 'editor' : 'home'}>
          {showEditor &&
          activeRouteFeedback !== undefined &&
          activeRouteNavigation !== undefined ? (
            <EditorHeader
              banner={
                routeBanner === null
                  ? null
                  : { routeKey: activeRouteNavigation.routeKey, url: routeBanner }
              }
              gameStatus={gameStatus}
              name={project.name}
              onShowFindings={showFindings}
              operations={projectOperations}
              readiness={activeRouteFeedback.status}
              {...(activeWorkspaceRoute?.runModifiers.startPointBlock === undefined
                ? {}
                : { startPointBlock: activeWorkspaceRoute.runModifiers.startPointBlock })}
            />
          ) : null}

          {/* Notices sit under the screen's own header: the editor's here, Home's in Home. */}
          {showEditor ? notices : null}

          {showEditor ? null : (
            <HomeScreen
              notices={notices}
              bugReport={bugReport}
              buildIdentity={buildIdentity}
              catalog={catalog}
              catalogSummary={catalogSummary}
              communityEvents={communityEvents}
              gameStatus={gameStatus}
              operations={projectOperations}
              planCatalog={planCatalog}
              releaseUpdates={releaseUpdates}
              routes={editorNavigation.routes.values}
              scale={scale}
              slotRebuild={slotRebuild}
              tab={view.kind === 'home' ? view.tab : 'library'}
            />
          )}

          {showEditor &&
            evaluation !== undefined &&
            workspace !== undefined &&
            activeRouteNavigation !== undefined &&
            activeRouteFeedback !== undefined &&
            activeWorkspaceRoute !== undefined && (
              <RouteWorkspace
                catalog={catalog}
                draftRun={draftRun}
                feedback={activeRouteFeedback}
                interactions={workspace.interactions}
                navigation={activeRouteNavigation}
                project={project}
                projectEvaluation={evaluation}
                workspace={workspace}
                workspaceRoute={activeWorkspaceRoute}
              />
            )}

          {!showEditor || traitDialogTarget === null || workspace === undefined ? null : (
            <TraitOfferDialog
              findings={workspace.traitDialogFindings(traitDialogTarget)}
              interactions={workspace.interactions}
              key={semanticAddressKey(traitDialogTarget)}
              target={traitDialogTarget}
            />
          )}
          {!showEditor || levelResolutionDialogTarget === null || workspace === undefined ? null : (
            <PomResolutionDialog
              interactions={workspace.interactions}
              key={semanticAddressKey(levelResolutionDialogTarget)}
              target={levelResolutionDialogTarget}
            />
          )}
          {closeRequest === undefined ? null : <CloseConfirmDialog controller={closeRequest} />}
          <HintLayer />
        </main>
      </FindingTargetScope>
    </LoadoutPresetsContext.Provider>
  );
}
