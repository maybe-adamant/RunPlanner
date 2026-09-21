import { useState } from 'react';
import * as Popover from '@radix-ui/react-popover';

import {
  PROJECT_DOCUMENT_SCHEMA_VERSION,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { type Catalog, type CatalogSummary } from '@run-planner/engine/catalog-schema';

import { projectFeedbackHierarchy } from '@planner/projections/evaluationProjection';
import {
  projectRouteNavigation,
  type EditorNavigation,
} from '@planner/projections/editorNavigation';
import {
  selectPresentProject,
  selectProjectEvaluation,
  type RootState,
  useAppSelector,
} from '@planner/state/store';
import type { ProjectOperations } from '@planner/workspace/projectOperations';
import type { StructuredWorkspaceProjection } from '@planner/projections/structured-workspace';
import type { AppScalePreference } from '@planner/persistence/appScalePreference';
import type { BuildIdentity } from '@planner/composition/buildIdentity';
import type { ReleaseUpdateController } from '@planner/persistence/releaseUpdates';
import { PomResolutionDialog } from '../editor/rewards/PomResolutionEditor';
import { TraitOfferDialog } from '../editor/rewards/TraitOfferEditor';
import { ProjectFileControls } from '../project/ProjectFileControls';
import { ProjectHistoryControls } from '../project/ProjectHistoryControls';
import { ActionIcon } from '../controls/ActionIcon';
import { RouteWorkspace } from './RouteWorkspace';
import { FindingTargetScope } from '../feedback/useFindingTarget';
import { useAppScale } from './useAppScale';
import { ReleaseUpdateCheck, ReleaseUpdateNotice } from './ReleaseUpdates';

interface AppProps {
  readonly appScalePreference?: AppScalePreference;
  readonly buildIdentity: BuildIdentity;
  readonly catalog: Catalog;
  readonly catalogSummary: CatalogSummary;
  readonly editorNavigation: EditorNavigation;
  readonly projectOperations: ProjectOperations;
  readonly releaseUpdates?: ReleaseUpdateController;
  readonly selectStructuredWorkspace: (
    state: RootState,
  ) => StructuredWorkspaceProjection | undefined;
}

export function App({
  appScalePreference,
  buildIdentity,
  catalog,
  catalogSummary,
  editorNavigation,
  projectOperations,
  releaseUpdates,
  selectStructuredWorkspace,
}: AppProps) {
  const scalePercent = useAppScale(appScalePreference);
  const project = useAppSelector(selectPresentProject);
  const [entryOpen, setEntryOpen] = useState(project === undefined);
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

  if (workspace !== undefined && activeRouteNavigation === undefined) {
    throw new Error(`Editor navigation references unavailable route ${workspace.route.routeKey}`);
  }

  return (
    <FindingTargetScope
      {...(workspace === undefined ? {} : { authoringReadiness: workspace.authoringReadiness })}
      findings={workspace?.findingsByRepairTarget}
    >
      <main className="app-shell">
        <header className="app-header" data-entry={showEntry || undefined}>
          <div className="app-brand">
            <h1>Run Planner</h1>
            {activeRouteNavigation === undefined || showEntry ? null : (
              <>
                <span aria-hidden="true" className="app-brand-separator">
                  ·
                </span>
                <span className="app-route-identity">{activeRouteNavigation.label}</span>
              </>
            )}
          </div>
          <div className="app-header-actions" data-entry={showEntry || undefined}>
            <ProjectFileControls
              beforeFileMenu={
                <output aria-label="App scale" className="app-scale-value" title="App scale">
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
                          {...(buildIdentity.commit === undefined
                            ? {}
                            : { title: buildIdentity.commit })}
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

        {releaseUpdates === undefined ? null : <ReleaseUpdateNotice controller={releaseUpdates} />}

        {project !== undefined &&
          !showEntry &&
          evaluation !== undefined &&
          workspace !== undefined &&
          activeRouteNavigation !== undefined &&
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

        {showEntry || traitDialogTarget === null || workspace === undefined ? null : (
          <TraitOfferDialog
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
      </main>
    </FindingTargetScope>
  );
}
