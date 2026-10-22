import { type CSSProperties, useRef, useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';

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
import type { BuildIdentity } from '@planner/composition/buildIdentity';
import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import type { GameStatusController } from '@planner/persistence/gameModuleHost';
import type { BugReportOperations } from '@planner/workspace/bugReport';
import type { CommunityEventController } from '@planner/workspace/communityEvents';
import type { SlotRebuildController } from '@planner/workspace/slotRebuild';
import type { DraftRunController } from '@planner/workspace/draftRun';
import type { CloseRequestController } from '@planner/workspace/closeRequest';
import { PomResolutionDialog } from '../editor/rewards/PomResolutionEditor';
import { TraitOfferDialog } from '../editor/rewards/TraitOfferEditor';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectNameField } from '../project/ProjectNameField';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { ActionIcon } from '../controls/ActionIcon';
import { HintLayer } from '../controls/HintLayer';
import { RouteWorkspace } from './RouteWorkspace';
import { FindingTargetScope } from '../feedback/useFindingTarget';
import { useAppScale } from './useAppScale';
import { ReleaseUpdateCheck } from './ReleaseUpdates';
import { NoticeArea } from './NoticeArea';
import { GameHeaderControls } from './GameHeaderControls';
import { GamePanel } from './GamePanel';
import { BugReportDialog } from './BugReportDialog';
import { CloseConfirmDialog } from './CloseConfirmDialog';
import { hintProps } from '@planner/ui/controls/hint';
import { routeBannerArtwork } from '@planner/ui/artwork/route-banners/routeBannerArtwork';

interface AppProps {
  readonly appScalePreference?: AppScalePreference;
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
  bugReport,
  buildIdentity,
  catalog,
  catalogSummary,
  closeRequest,
  draftRun,
  editorNavigation,
  communityEvents,
  gameStatus,
  projectOperations,
  releaseUpdates,
  slotRebuild,
  selectStructuredWorkspace,
}: AppProps) {
  const scalePercent = useAppScale(appScalePreference);
  const project = useAppSelector(selectPresentProject);
  const previousFile = useAppSelector((state) => state.librarySession.previousFileOffer);
  // The entry panel stays open only for the plan it was opened over; opening any plan closes it.
  const opened = useAppSelector((state) => state.librarySession.opened);
  const [entryOver, setEntryOver] = useState<{ readonly plan: object | null } | null>(null);
  const entryOpen = entryOver !== null && entryOver.plan === opened;
  const setEntryOpen = (open: boolean) => setEntryOver(open ? { plan: opened } : null);
  const [aboutReporting, setAboutReporting] = useState(false);
  // Which part of the Game panel opens focused, or null while it is closed.
  const [gameOpen, setGameOpen] = useState<'panel' | 'plans' | null>(null);
  const dispatch = useAppDispatch();
  const gameButton = useRef<HTMLButtonElement>(null);
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
  const showEntry = project === undefined || entryOpen;
  const routeBanner =
    activeRouteNavigation === undefined || showEntry
      ? null
      : (routeBannerArtwork[activeRouteNavigation.routeKey] ?? null);
  const repairIssue = evaluation?.route.issue;
  // A running draft holds the workspace on the Draft panel.
  const drafting = useAppSelector((state) => state.draftSession.run.kind === 'running');
  const showFindings =
    repairIssue === undefined || workspace === undefined || drafting
      ? undefined
      : () => {
          setGameOpen(null);
          setEntryOpen(false);
          dispatch(findingSelected(nextRepairSelection(repairIssue, workspace.focusByOwner)));
        };

  if (workspace !== undefined && activeRouteNavigation === undefined) {
    throw new Error(`Editor navigation references unavailable route ${workspace.route.routeKey}`);
  }

  return (
    <FindingTargetScope
      {...(workspace === undefined ? {} : { authoringReadiness: workspace.authoringReadiness })}
      findings={workspace?.findingsByRepairTarget}
    >
      <main className="app-shell">
        <header
          className="app-header"
          data-entry={showEntry || undefined}
          {...(routeBanner === null || activeRouteNavigation === undefined
            ? {}
            : {
                'data-route-banner': activeRouteNavigation.routeKey,
                style: { '--route-banner': `url("${routeBanner}")` } as CSSProperties,
              })}
        >
          <div className="app-brand">
            <h1>Run Planner</h1>
            {project === undefined || showEntry ? null : (
              <>
                <span aria-hidden="true" className="app-brand-separator">
                  ·
                </span>
                <ProjectNameField key={project.name} name={project.name} />
              </>
            )}
          </div>
          <div className="app-header-actions">
            <ProjectFileControls
              beforeFileMenu={
                <output
                  aria-label="App scale"
                  className="app-scale-value"
                  {...hintProps('App scale', undefined, 'App scale')}
                >
                  <ActionIcon name="zoom" />
                  {scalePercent}%
                </output>
              }
              catalog={catalog}
              hasProject={project !== undefined}
              entryOpen={showEntry}
              onEntryOpenChange={setEntryOpen}
              operations={projectOperations}
              routes={editorNavigation.routes.values}
            />
            {!showEntry && <ProjectHistoryControls hasProject />}
            <div className="header-about-controls">
              <GameHeaderControls
                buttonRef={gameButton}
                {...(gameStatus === undefined ? {} : { gameStatus })}
                onOpen={() => setGameOpen('panel')}
                onOpenPlans={() => setGameOpen('plans')}
                operations={projectOperations}
                {...(activeWorkspaceRoute?.runModifiers.startPointBlock === undefined
                  ? {}
                  : { startPointBlock: activeWorkspaceRoute.runModifiers.startPointBlock })}
              />
              <Popover.Root>
                <Popover.Trigger asChild>
                  <button className="quiet-action action-compact" type="button">
                    <ActionIcon name="info" />
                    About
                  </button>
                </Popover.Trigger>
                <Popover.Portal>
                  <Popover.Content
                    align="end"
                    aria-label="About Run Planner"
                    className="about-popover"
                    collisionPadding={12}
                    sideOffset={8}
                  >
                    <dl className="about-product-summary">
                      <div>
                        <dt>Version</dt>
                        <dd>{buildIdentity.version}</dd>
                      </div>
                      <div>
                        <dt>Build</dt>
                        <dd
                          {...hintProps(
                            buildIdentity.commit === undefined ? undefined : buildIdentity.commit,
                          )}
                        >
                          {buildIdentity.build}
                        </dd>
                      </div>
                      <div>
                        <dt>Schema</dt>
                        <dd>{PROJECT_DOCUMENT_SCHEMA_VERSION}</dd>
                      </div>
                      <div>
                        <dt>Catalog</dt>
                        <dd>{catalogSummary.version}</dd>
                      </div>
                    </dl>
                    {releaseUpdates === undefined ? null : (
                      <ReleaseUpdateCheck controller={releaseUpdates} />
                    )}
                    {bugReport === undefined ? null : (
                      <div className="about-support">
                        <Popover.Close asChild>
                          <button
                            className="secondary-action action-compact"
                            onClick={() => setAboutReporting(true)}
                            type="button"
                          >
                            Create bug report…
                          </button>
                        </Popover.Close>
                      </div>
                    )}
                    <section className="about-shortcuts" aria-labelledby="about-shortcuts-title">
                      <h2 id="about-shortcuts-title">Keyboard shortcuts</h2>
                      <dl>
                        <div>
                          <dt>App scale</dt>
                          <dd>
                            <kbd>Ctrl/Cmd</kbd> + <kbd>+</kbd> / <kbd>−</kbd>
                            <span className="shortcut-alternative">or</span>
                            <kbd>Ctrl</kbd> + mouse wheel
                          </dd>
                        </div>
                        <div>
                          <dt>Reset scale</dt>
                          <dd>
                            <kbd>Ctrl/Cmd</kbd> + <kbd>0</kbd>
                          </dd>
                        </div>
                        <div>
                          <dt>Undo</dt>
                          <dd>
                            <kbd>Ctrl/Cmd</kbd> + <kbd>Z</kbd>
                          </dd>
                        </div>
                        <div>
                          <dt>Redo</dt>
                          <dd>
                            <kbd>Ctrl/Cmd</kbd> + <kbd>Shift</kbd> + <kbd>Z</kbd>
                            <span className="shortcut-alternative">or</span>
                            <kbd>Ctrl</kbd> + <kbd>Y</kbd>
                          </dd>
                        </div>
                      </dl>
                    </section>
                    <Popover.Arrow className="about-popover-arrow" />
                  </Popover.Content>
                </Popover.Portal>
              </Popover.Root>
            </div>
          </div>
        </header>

        <NoticeArea
          communityEvents={communityEvents}
          {...(gameStatus === undefined ? {} : { gameStatus })}
          {...(previousFile === null
            ? {}
            : { previousFile: { fileName: previousFile.fileName, operations: projectOperations } })}
          releaseUpdates={releaseUpdates}
        />

        {aboutReporting && bugReport !== undefined && (
          <BugReportDialog onClose={() => setAboutReporting(false)} operations={bugReport} />
        )}

        {gameOpen !== null && (
          <GamePanel
            {...(bugReport === undefined ? {} : { bugReport })}
            catalog={catalog}
            {...(communityEvents === undefined ? {} : { communityEvents })}
            focusPlans={gameOpen === 'plans'}
            {...(gameStatus === undefined ? {} : { gameStatus })}
            onClose={() => {
              setGameOpen(null);
              gameButton.current?.focus();
            }}
            {...(showFindings === undefined ? {} : { onShowFindings: showFindings })}
            {...(slotRebuild === undefined ? {} : { slotRebuild })}
            operations={projectOperations}
          />
        )}

        {project !== undefined &&
          !showEntry &&
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

        {showEntry || traitDialogTarget === null || workspace === undefined ? null : (
          <TraitOfferDialog
            findings={workspace.traitDialogFindings(traitDialogTarget)}
            interactions={workspace.interactions}
            key={semanticAddressKey(traitDialogTarget)}
            target={traitDialogTarget}
          />
        )}
        {showEntry || levelResolutionDialogTarget === null || workspace === undefined ? null : (
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
  );
}
