// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createContinuationAddress,
  createOccurrenceId,
  createPickedAddress,
  createProjectDocument,
  createTargetAddress,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import type { StructuredWorkspaceProjectionService } from '../../../projections/structuredWorkspace';
import {
  createPlannerStore,
  selectPresentProject,
  selectProjectEvaluation,
  useAppSelector,
} from '../../../state/store';
import { createStructuredWorkspaceTestServices } from '../../../../test/fixtures/structuredWorkspace';
import { LinearBiomeEditor } from './LinearBiomeEditor';
import { ProjectHistoryControls } from '../../project/ProjectHistoryControls';

const biome = createBiomeAddress('Underworld', 'I');
afterEach(cleanup);

function iPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('I editor fixture has no I plan');
  }
  return plan;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId | null,
  targets: readonly { readonly gameName: string; readonly occurrenceId: OccurrenceId }[],
  pickedExitIndex: number,
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parentOccurrenceId),
  });
  for (const [index, target] of targets.entries()) {
    next = applyProjectCommand(next, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, parentOccurrenceId, index + 1),
      occurrenceId: target.occurrenceId,
      gameName: target.gameName,
    });
  }
  return applyProjectCommand(next, catalog, {
    kind: 'SetPicked',
    picked: createPickedAddress(biome, parentOccurrenceId),
    exitIndex: pickedExitIndex,
  });
}

function iProject(stage: 'empty' | 'rewards' | 'preboss'): ProjectDocument {
  let project = createProjectDocument(catalog, {
    projectId: `i-editor-${stage}`,
    name: 'I Editor',
    configuredBiomeCounts: { Underworld: 4 },
  });
  if (stage === 'empty') {
    return project;
  }
  const combat01 = createOccurrenceId('editor-i-combat01');
  const combat02 = createOccurrenceId('editor-i-combat02');
  const combat03 = createOccurrenceId('editor-i-combat03');
  project = appendBatch(project, null, [{ gameName: 'I_Combat01', occurrenceId: combat01 }], 1);
  project = appendBatch(
    project,
    combat01,
    [
      { gameName: 'I_Combat02', occurrenceId: combat02 },
      { gameName: 'I_Combat03', occurrenceId: combat03 },
    ],
    2,
  );
  if (stage === 'rewards') {
    return project;
  }
  return appendBatch(
    project,
    combat03,
    [
      { gameName: 'I_PreBoss02', occurrenceId: createOccurrenceId('editor-i-preboss') },
      { gameName: 'I_Combat04', occurrenceId: createOccurrenceId('editor-i-peer') },
    ],
    1,
  );
}

function IEditorHarness({
  structuredWorkspace,
}: {
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}) {
  const project = useAppSelector(selectPresentProject);
  const plan = iPlan(project);
  const projectEvaluation = useAppSelector(selectProjectEvaluation);
  const evaluation = projectEvaluation.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (evaluation !== undefined && evaluation.kind !== 'LinearBiome') {
    throw new Error('I editor fixture received a non-Linear evaluation');
  }
  return (
    <>
      <ProjectHistoryControls />
      <LinearBiomeEditor
        catalog={catalog}
        contextual={structuredWorkspace.project(project, projectEvaluation).contextual}
        evaluation={evaluation?.kind === 'LinearBiome' ? evaluation : undefined}
        plan={plan}
        routeKey={biome.routeKey}
      />
    </>
  );
}

function renderI(project: ProjectDocument) {
  const evaluateProject = (current: ProjectDocument) => simulateProject(catalog, current);
  const store = createPlannerStore({
    catalog,
    evaluateProject,
    initialProject: project,
  });
  const { structuredWorkspace } = createStructuredWorkspaceTestServices(evaluateProject);
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <IEditorHarness structuredWorkspace={structuredWorkspace} />
    </Provider>,
  );
  return { store, user, ...view };
}

describe('I editor projection', () => {
  it('renders fixed entries and edits the bounded Clockwork setting with history', async () => {
    const { store, user } = renderI(iProject('empty'));

    expect(screen.getByRole('heading', { name: 'Tartarus' })).toBeTruthy();
    const entries = screen.getByRole('group', { name: 'Fixed biome entries' });
    expect(within(entries).getByRole('heading', { name: 'Entrance' })).toBeTruthy();
    expect(within(entries).getByRole('heading', { name: 'Hades' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to Preboss' })).toBeNull();

    const cap = screen.getByLabelText('Maximum NonGoal rewards');
    await user.selectOptions(cap, '5');
    expect(iPlan(store.getState().projectWorkspace.history.present).state).toMatchObject({
      maxNonGoalRewards: 5,
    });
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(iPlan(store.getState().projectWorkspace.history.present).state).toMatchObject({
      maxNonGoalRewards: 3,
    });
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(iPlan(store.getState().projectWorkspace.history.present).state).toMatchObject({
      maxNonGoalRewards: 5,
    });

    await user.click(screen.getByRole('button', { name: 'Add Next Decision' }));
    expect(iPlan(store.getState().projectWorkspace.history.present).topology).toMatchObject({
      startOccurrenceId: null,
      continuations: [{ kind: 'batch', parentOccurrenceId: null }],
    });
    expect(screen.getByRole('heading', { name: 'Doors from Hades' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Go to Preboss' })).toBeNull();
    const firstDecision = screen
      .getByRole('heading', { name: 'Doors from Hades' })
      .closest('.decision-card');
    if (firstDecision === null) {
      throw new Error('first Clockwork decision card is missing');
    }
    const room = within(firstDecision as HTMLElement).getByLabelText('Room');
    expect(within(firstDecision as HTMLElement).queryByLabelText('Type')).toBeNull();
    await user.click(room);
    const preboss = screen
      .getAllByRole('option')
      .find(
        (candidate) =>
          candidate.querySelector('.contextual-picker-item-label')?.textContent === 'Preboss',
      );
    expect(preboss).toBeDefined();
    await user.click(preboss!);
    expect(within(firstDecision as HTMLElement).getByLabelText('Room').textContent).toContain(
      'Preboss',
    );
  });

  it('derives Goal markers while retaining editable NonGoal reward leaves', () => {
    renderI(iProject('rewards'));

    const decisions = screen.getAllByRole('heading', { name: /Doors from/ });
    expect(decisions).toHaveLength(2);
    expect(screen.getAllByText('Clockwork Goal')).toHaveLength(2);
    expect(screen.getByText('NonGoal')).toBeTruthy();
    const secondDecision = decisions[1]?.closest('.decision-card');
    if (secondDecision === null || secondDecision === undefined) {
      throw new Error('second Clockwork decision card is missing');
    }
    expect(within(secondDecision as HTMLElement).getAllByLabelText('Reward')).toHaveLength(1);
  });

  it('renders a generated preboss beside its peer and exposes only the picked WorldShop', async () => {
    const { user } = renderI(iProject('preboss'));

    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Combat 04' })).toBeTruthy();
    expect(screen.getByText('Offer 1')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Add Next Decision' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Go to Preboss' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace With Preboss' })).toBeNull();

    const prebossHeading = screen.getByRole('heading', { name: 'Preboss' });
    const decision = prebossHeading.closest('.decision-card');
    if (decision === null) {
      throw new Error('generated preboss decision card is missing');
    }
    await user.click(within(decision as HTMLElement).getByRole('radio', { name: 'Pick exit 2' }));
    expect(screen.queryByText('Offer 1')).toBeNull();
    expect(screen.getByRole('button', { name: 'Add Next Decision' })).toBeTruthy();

    await user.click(within(decision as HTMLElement).getByRole('radio', { name: 'Pick exit 1' }));
    expect(screen.getByText('Offer 1')).toBeTruthy();
  });
});
