import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { render } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { configureStore } from '@reduxjs/toolkit';
import type { ReactNode } from 'react';
import { Provider } from 'react-redux';

import { catalog } from '@run-planner/hades2-catalog';
import { createApplication, type PlannerApplication } from '@planner/composition/createApplication';
import type {
  StructuredWorkspaceProjection,
  WorkspaceAuthoringFrontier,
  WorkspaceBiome,
  WorkspaceMixedBatchNode,
  WorkspaceOccurrenceWorkbenchNode,
  WorkspaceOrdinaryBatchNode,
  WorkspaceTakeoverBatchNode,
} from '@planner/projections/structured-workspace';
import { createEditorSessionReducer } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { useAppSelector } from '@planner/state/store';
import { BiomeWorkspace } from '@planner/ui/editor/biome/BiomeWorkspace';
import {
  AuthoringFrontier,
  BatchWorkbench,
  TopologyRemovalAction,
} from '@planner/ui/editor/biome/DecisionWorkbench';
import { HubDecisionWorkbench } from '@planner/ui/editor/biome/HubDecisionWorkbench';
import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
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
  const biome = workspace.routes
    .find((candidate) => candidate.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return renderBiome(biome, workspace);
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

function staticWorkspaceFixture(project: ProjectDocument): {
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
      profileSession: (state: Record<string, never> = {}) => state,
      projectWorkspace: (state = { assembly }) => state,
    },
  });
}

function staticBiome(
  workspace: StructuredWorkspaceProjection,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiome {
  const biome = workspace.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return biome;
}

export function workspaceProjection(application: PlannerApplication) {
  const state = application.store.getState().projectWorkspace;
  return application.structuredWorkspace.project(state.assembly);
}

export function workspaceBiome(
  application: PlannerApplication,
  routeKey: string,
  biomeKey: string,
): WorkspaceBiome {
  const biome = workspaceProjection(application)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
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
      if (subject.kind === 'frontier') {
        return (
          <AuthoringFrontier frontier={subject.frontier} interactions={workspace.interactions} />
        );
      }
      return (
        <BatchWorkbench
          interactions={workspace.interactions}
          label={biome.label}
          node={subject.node}
        />
      );
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
      return (
        <HubDecisionWorkbench
          frontier={biome.frontier}
          interactions={workspace.interactions}
          node={node}
        />
      );
    },
    application,
  );
}

export function renderStaticHubDecisionWorkbench(
  project: ProjectDocument,
  routeKey = 'Surface',
  biomeKey = 'N',
) {
  const { store, workspace } = staticWorkspaceFixture(project);
  const biome = staticBiome(workspace, routeKey, biomeKey);
  const node = biome.nodes.find((candidate) => candidate.kind === 'hubDecision');
  if (node?.kind !== 'hubDecision') throw new Error('Hub decision workbench is missing');
  return render(
    <Provider store={store}>
      <HubDecisionWorkbench
        frontier={biome.frontier}
        interactions={workspace.interactions}
        node={node}
      />
    </Provider>,
  );
}

export function renderOccurrenceWorkbench(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  select: (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined,
  application?: PlannerApplication,
) {
  return renderProjectedHarness(
    project,
    routeKey,
    biomeKey,
    (biome, workspace) => {
      const node = select(biome);
      if (node === undefined) return <p>No occurrence workbench</p>;
      return (
        <OccurrenceWorkbench
          interactions={workspace.interactions}
          presentation={node.inspectorPresentation}
          room={node.room}
        />
      );
    },
    application,
  );
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
      <OccurrenceWorkbench
        interactions={workspace.interactions}
        presentation={node.inspectorPresentation}
        room={node.room}
      />
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
  const workbench =
    subject.kind === 'frontier' ? (
      <AuthoringFrontier frontier={subject.frontier} interactions={workspace.interactions} />
    ) : (
      <BatchWorkbench
        interactions={workspace.interactions}
        label={biome.label}
        node={subject.node}
      />
    );
  return render(<Provider store={store}>{workbench}</Provider>);
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
