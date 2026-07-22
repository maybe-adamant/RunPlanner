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
  simulateProject,
  type LinearBiomeProjectEvaluation,
  type LinearBiomePlan,
  type OccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlannerCapabilities } from '../application/capabilities';
import { createCandidateProjectionService } from '../application/candidateProjection';
import { createProjectSimulationScope } from '../application/capabilityConfiguration';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../application/store';
import { LinearBiomeEditor } from './LinearBiomeEditor';
import { ProjectHistoryControls } from './ProjectHistoryControls';

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
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const plan = iPlan(project);
  const continuation = plan.topology?.continuations[0];
  const evaluation: LinearBiomeProjectEvaluation = Object.freeze({
    kind: 'LinearBiome',
    biomeKey: biome.biomeKey,
    origin: biome,
    completion: 'incomplete',
    findings:
      continuation === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              code: 'continuationMissing' as const,
              severity: 'error' as const,
              phase: 'completeness' as const,
              origin: createContinuationAddress(biome, continuation.parentOccurrenceId),
              evidence: Object.freeze({ internalGameName: 'I_Story01' }),
            }),
          ]),
  });
  return (
    <>
      <ProjectHistoryControls />
      <LinearBiomeEditor
        candidateProjection={candidateProjection}
        catalog={catalog}
        evaluation={evaluation}
        plan={plan}
        routeKey={biome.routeKey}
      />
    </>
  );
}

function renderI(project: ProjectDocument) {
  const active = ['F', 'G', 'H', 'I'];
  const capabilities = createPlannerCapabilities(catalog, {
    authorableBiomeKeys: active,
    simulatableBiomeKeys: active,
    editableBiomeKeys: active,
  });
  const simulationScope = createProjectSimulationScope(capabilities);
  const evaluateProject = (current: ProjectDocument) =>
    simulateProject(catalog, current, simulationScope);
  const store = createPlannerStore({
    capabilities,
    catalog,
    evaluateProject,
    initialProject: project,
  });
  const candidateProjection = createCandidateProjectionService(catalog, evaluateProject);
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <IEditorHarness candidateProjection={candidateProjection} />
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
    const type = within(firstDecision as HTMLElement).getByLabelText('Type');
    expect(within(type).getByRole('option', { name: 'Preboss' })).toBeTruthy();
    await user.selectOptions(type, 'Preboss');
    expect(
      within(within(firstDecision as HTMLElement).getByLabelText('Room')).getByRole('option', {
        name: /Preboss/,
      }),
    ).toHaveProperty('value', 'I_PreBoss02');
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
    expect(screen.getAllByLabelText('1 finding').length).toBeGreaterThan(0);
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
