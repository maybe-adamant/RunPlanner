import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { fireEvent, render, screen, within } from '@testing-library/react';
import userEvent, { type UserEvent } from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { catalog } from '@run-planner/hades2-catalog';
import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import type {
  StructuredWorkspaceProjection,
  WorkspaceAuthoringFrontier,
  WorkspaceBiome,
  WorkspaceHubTab,
  WorkspaceMixedBatchNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceRoomTab,
  WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import { createEditorSessionReducer } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { selectPresentProject, useAppSelector } from '@planner/state/store';
import { BiomeWorkspace } from '@planner/ui/editor/biome/BiomeWorkspace';
import {
  AuthoringFrontier,
  BatchDoorsDetail,
  TopologyRemovalAction,
} from '@planner/ui/editor/biome/DecisionWorkbench';
import { BiomeInspectorNode } from '@planner/ui/editor/biome/BiomeInspectorNode';
import { HubDecisionWorkbench } from '@planner/ui/editor/biome/HubDecisionWorkbench';
import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { TraitOfferDialog } from '@planner/ui/editor/rewards/TraitOfferEditor';
import { PomResolutionDialog } from '@planner/ui/editor/rewards/PomResolutionEditor';
import { FindingTargetScope } from '@planner/ui/feedback/useFindingTarget';
import {
  catalogFindingLabels,
  projectFindingLabels,
} from '@planner/projections/evaluationProjection';
import { projectStructuredWorkspaceFixture } from '../fixtures/structuredWorkspace';

interface ProjectedHarnessProps {
  readonly application: PlannerApplication;
  readonly biomeKey: string;
  readonly renderBiome: (
    biome: WorkspaceBiome,
    workspace: ReturnType<PlannerApplication['structuredWorkspace']['project']>,
  ) => ReactNode;
  readonly routeKey: string;
}

function ProjectedHarness({ application, biomeKey, renderBiome, routeKey }: ProjectedHarnessProps) {
  const workspace = useAppSelector(application.selectStructuredWorkspace);
  const traitDialogTarget = useAppSelector(
    (state) => state.editorSession.traitDialogTarget ?? null,
  );
  const pomDialogTarget = useAppSelector(
    (state) => state.editorSession.levelResolutionDialogTarget ?? null,
  );
  const project = useAppSelector(selectPresentProject);
  if (workspace === undefined || project === undefined)
    throw new Error('workspace projection is unavailable');
  const biome = workspace.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return (
    <FindingTargetScope
      authoringReadiness={workspace.authoringReadiness}
      findings={workspace.findingsByRepairTarget}
      labels={projectFindingLabels(catalog, project)}
    >
      {renderBiome(biome, workspace)}
      {traitDialogTarget === null ? null : (
        <TraitOfferDialog interactions={workspace.interactions} target={traitDialogTarget} />
      )}
      {pomDialogTarget === null ? null : (
        <PomResolutionDialog interactions={workspace.interactions} target={pomDialogTarget} />
      )}
    </FindingTargetScope>
  );
}

function renderProjectedHarness(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  renderBiome: ProjectedHarnessProps['renderBiome'],
  application: PlannerApplication = createApplication(),
) {
  application.store.dispatch(authoredProjectReplaced(project));
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      <ProjectedHarness
        application={application}
        biomeKey={biomeKey}
        renderBiome={renderBiome}
        routeKey={routeKey}
      />
    </Provider>,
  );
  return { application, user, ...view };
}

export function staticWorkspaceFixture(project: ProjectDocument): {
  readonly store: ReturnType<typeof createStaticPresentationStore>;
  readonly workspace: StructuredWorkspaceProjection;
} {
  const { assembly, workspace } = projectStructuredWorkspaceFixture(project);
  const store = createStaticPresentationStore(assembly);
  return { store, workspace };
}

function createStaticPresentationStore(
  assembly: ReturnType<typeof projectStructuredWorkspaceFixture>['assembly'],
) {
  return configureStore({
    middleware: (getDefaultMiddleware) =>
      getDefaultMiddleware({ immutableCheck: false, serializableCheck: false }),
    reducer: {
      editorSession: createEditorSessionReducer(catalog),
      projectWorkspace: (state = { assembly }) => state,
    },
  });
}

function staticBiome(
  workspace: StructuredWorkspaceProjection,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiome {
  const biome = workspace.route.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return biome;
}

export function workspaceProjection(application: PlannerApplication) {
  const state = application.store.getState().projectWorkspace;
  if (state.kind !== 'openProject')
    throw new Error('workspace projection requires an open project');
  return application.structuredWorkspace.project(state.assembly);
}

export function workspaceBiome(
  application: PlannerApplication,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiome {
  const biome = workspaceProjection(application).route?.biomes.find(
    (candidate) => candidate.biomeKey === biomeKey,
  );
  if (biome === undefined) {
    throw new Error(`${routeKey}/${biomeKey} has no projected workspace biome`);
  }
  return biome;
}

export function renderWorkspace(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  application?: PlannerApplication,
) {
  return renderProjectedHarness(
    project,
    routeKey,
    biomeKey,
    (biome, workspace) => (
      <BiomeWorkspace
        biome={biome}
        focusByOwner={workspace.focusByOwner}
        interactions={workspace.interactions}
        runStateLaunchers={workspace.runStateLaunchers}
      />
    ),
    application,
  );
}

export type DecisionWorkbenchNode =
  WorkspaceMixedBatchNode | WorkspaceOrdinaryBatchNode | WorkspaceTakeoverBatchNode;

export type DecisionWorkbenchSubject =
  | { readonly kind: 'frontier'; readonly frontier: WorkspaceAuthoringFrontier }
  | { readonly kind: 'node'; readonly node: DecisionWorkbenchNode };

/** A decision's doors as its source room shows them: on that room's Timeline. */
function DecisionDoors({
  biome,
  subject,
  workspace,
}: {
  readonly biome: WorkspaceBiome;
  readonly subject: DecisionWorkbenchSubject;
  readonly workspace: StructuredWorkspaceProjection;
}) {
  const stage = biome.occurrenceStages.find((candidate) =>
    subject.kind === 'node'
      ? candidate.outgoing.kind === 'authoredDecision' &&
        candidate.outgoing.decisionNodeKey === subject.node.key
      : candidate.outgoing.kind === 'frontier' &&
        candidate.outgoing.frontier.marker.focusKey === subject.frontier.marker.focusKey,
  );
  const source = biome.nodes.find((node) => node.key === stage?.sourceOccurrenceNodeKey);
  if (stage === undefined || source?.kind !== 'occurrenceWorkbench') {
    return subject.kind === 'frontier' ? (
      <AuthoringFrontier frontier={subject.frontier} interactions={workspace.interactions} />
    ) : (
      <BatchDoorsDetail
        interactions={workspace.interactions}
        markFor={() => undefined}
        node={subject.node}
      />
    );
  }
  return (
    <BiomeInspectorNode
      frontier={biome.frontier}
      interactions={workspace.interactions}
      label={biome.label}
      node={subject.kind === 'node' ? subject.node : source}
      outgoing={stage.outgoing}
      {...(subject.kind === 'node' ? { outgoingDecision: subject.node } : {})}
      roomTab={source.room.doorsTab}
      // Opening a decision is navigating to its doors, as its rail stop does.
      doorsRequested
      sourceOccurrence={source}
    />
  );
}

export function renderDecisionWorkbench(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  select: (biome: WorkspaceBiome) => DecisionWorkbenchSubject | undefined,
  application?: PlannerApplication,
) {
  return renderProjectedHarness(
    project,
    routeKey,
    biomeKey,
    (biome, workspace) => {
      const subject = select(biome);
      if (subject === undefined) return <p>No decision workbench</p>;
      return <DecisionDoors biome={biome} subject={subject} workspace={workspace} />;
    },
    application,
  );
}

export function renderHubDecisionWorkbench(
  project: ProjectDocument,
  routeKey = 'Surface',
  biomeKey = 'N',
  application: PlannerApplication = createApplication(),
) {
  return renderProjectedHarness(
    project,
    routeKey,
    biomeKey,
    (biome, workspace) => {
      const node = biome.nodes.find((candidate) => candidate.kind === 'hubDecision');
      if (node?.kind !== 'hubDecision') return <p>No Hub decision workbench</p>;
      return <HubDecisionWorkbench interactions={workspace.interactions} node={node} />;
    },
    application,
  );
}

export function renderStaticHubDecisionWorkbench(
  project: ProjectDocument,
  routeKey = 'Surface',
  biomeKey = 'N',
  options: {
    readonly navigationRevision?: number;
    readonly findingNavigationRevision?: number;
    readonly initialTab?: WorkspaceHubTab;
  } = {},
) {
  const { store, workspace } = staticWorkspaceFixture(project);
  const biome = staticBiome(workspace, routeKey, biomeKey);
  const node = biome.nodes.find((candidate) => candidate.kind === 'hubDecision');
  if (node?.kind !== 'hubDecision') throw new Error('Hub decision workbench is missing');
  const workbench = (next: typeof options) => (
    <Provider store={store}>
      <FindingTargetScope
        authoringReadiness={workspace.authoringReadiness}
        findings={workspace.findingsByRepairTarget}
        labels={catalogFindingLabels(catalog)}
      >
        <HubDecisionWorkbench
          {...(next.navigationRevision === undefined
            ? {}
            : { navigationRevision: next.navigationRevision })}
          {...(next.findingNavigationRevision === undefined
            ? {}
            : { findingNavigationRevision: next.findingNavigationRevision })}
          {...(next.initialTab === undefined ? {} : { initialTab: next.initialTab })}
          interactions={workspace.interactions}
          node={node}
        />
      </FindingTargetScope>
    </Provider>
  );
  const view = render(workbench(options));
  return {
    ...view,
    rerenderHub: (next: typeof options) => view.rerender(workbench(next)),
  };
}

export function renderOccurrenceWorkbench(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  select: (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined,
  application?: PlannerApplication,
  options: {
    readonly findingNavigationRevision?: number;
    readonly initialSideRoomSlotKey?: string;
    readonly initialTab?: WorkspaceRoomTab;
  } = {},
) {
  let currentOptions = options;
  const renderBiome: ProjectedHarnessProps['renderBiome'] = (biome, workspace) => {
    const node = select(biome);
    if (node === undefined) return <p>No occurrence workbench</p>;
    return (
      <OccurrenceWorkbench
        {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
        {...(currentOptions.findingNavigationRevision === undefined
          ? {}
          : { findingNavigationRevision: currentOptions.findingNavigationRevision })}
        {...(currentOptions.initialSideRoomSlotKey === undefined
          ? {}
          : { initialSideRoomSlotKey: currentOptions.initialSideRoomSlotKey })}
        {...(currentOptions.initialTab === undefined
          ? {}
          : { initialTab: currentOptions.initialTab })}
        interactions={workspace.interactions}
        {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
        room={node.room}
      />
    );
  };
  const view = renderProjectedHarness(project, routeKey, biomeKey, renderBiome, application);
  return {
    ...view,
    rerenderOccurrence: (next: typeof options) => {
      currentOptions = next;
      view.rerender(
        <Provider store={view.application.store}>
          <ProjectedHarness
            application={view.application}
            biomeKey={biomeKey}
            renderBiome={renderBiome}
            routeKey={routeKey}
          />
        </Provider>,
      );
    },
  };
}

export function renderStaticOccurrenceWorkbench(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  select: (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined,
) {
  const { store, workspace } = staticWorkspaceFixture(project);
  const biome = staticBiome(workspace, routeKey, biomeKey);
  const node = select(biome);
  if (node === undefined) throw new Error('Occurrence workbench is missing');
  return render(
    <Provider store={store}>
      <FindingTargetScope
        authoringReadiness={workspace.authoringReadiness}
        findings={workspace.findingsByRepairTarget}
        labels={catalogFindingLabels(catalog)}
      >
        <OccurrenceWorkbench
          {...(node.incomingDoor === undefined ? {} : { incomingDoor: node.incomingDoor })}
          interactions={workspace.interactions}
          {...(node.localVisit === undefined ? {} : { localVisit: node.localVisit })}
          room={node.room}
        />
      </FindingTargetScope>
    </Provider>,
  );
}

export function renderStaticDecisionWorkbench(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  select: (biome: WorkspaceBiome) => DecisionWorkbenchSubject | undefined,
) {
  const { store, workspace } = staticWorkspaceFixture(project);
  const biome = staticBiome(workspace, routeKey, biomeKey);
  const subject = select(biome);
  if (subject === undefined) throw new Error('Decision workbench is missing');
  const workbench = <DecisionDoors biome={biome} subject={subject} workspace={workspace} />;
  return render(
    <Provider store={store}>
      <FindingTargetScope
        authoringReadiness={workspace.authoringReadiness}
        findings={workspace.findingsByRepairTarget}
        labels={catalogFindingLabels(catalog)}
      >
        {workbench}
      </FindingTargetScope>
    </Provider>,
  );
}

export function renderBiomeClearAction(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
) {
  return renderProjectedHarness(project, routeKey, biomeKey, (biome, workspace) => {
    const interaction = workspace.interactions.topologyRemovals.get(biome.marker.focusKey);
    if (interaction === undefined) return <p>No biome clearing action</p>;
    return <TopologyRemovalAction interaction={interaction} label={`Clear ${biome.label}`} />;
  });
}

/** Opens a room Timeline's door editor, which stays collapsed until something asks for it. */
export function expandDoors(scope: HTMLElement = document.body): void {
  const disclosure = within(scope).getByRole('button', { name: 'Door details' });
  if (disclosure.getAttribute('aria-expanded') !== 'true') fireEvent.click(disclosure);
}

/** Opens the room's Leave room picker, or its nth where it has several, and returns its options. */
export async function openLeavePicker(
  user: UserEvent,
  scope: HTMLElement = document.body,
  index = 0,
): Promise<HTMLElement> {
  const leave = within(scope).getAllByRole('listitem', { name: 'Leave room' })[index];
  if (leave === undefined) throw new Error(`the room has no Leave room row ${index + 1}`);
  await user.click(within(leave).getByRole('button', { name: 'Exit door' }));
  return screen.findByRole('listbox');
}

/** The Leave room picker's options by name, the picked one marked. */
export function leaveOptionNames(options: HTMLElement): readonly string[] {
  return within(options)
    .getAllByRole('option')
    .map(
      (option) =>
        `${option.getAttribute('aria-label') ?? ''}${option.getAttribute('data-selected-value') === 'true' ? ' (picked)' : ''}${option.getAttribute('aria-disabled') === 'true' ? ' (disabled)' : ''}`,
    );
}
