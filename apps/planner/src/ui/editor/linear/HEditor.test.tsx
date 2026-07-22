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
import { simulateProject, type LinearBiomeProjectEvaluation } from '@run-planner/engine/simulation';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplicationCapabilities } from '../../../composition/capabilityConfiguration';
import {
  createCandidateProjectionService,
  type CandidateProjectionService,
} from '../../../projections/candidateProjection';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../../../state/store';
import { LinearBiomeEditor } from './LinearBiomeEditor';

const biome = createBiomeAddress('Underworld', 'H');
afterEach(cleanup);

function hPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('H editor fixture has no H plan');
  }
  return plan;
}

function appendBatch(
  project: ProjectDocument,
  parentOccurrenceId: OccurrenceId,
  targets: readonly { readonly gameName: string; readonly occurrenceId: OccurrenceId }[],
  cageOutcome: 'min' | 'max' = 'min',
): ProjectDocument {
  let next = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    continuation: createContinuationAddress(biome, parentOccurrenceId),
  });
  if (cageOutcome === 'max') {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceFieldsCageOutcome',
      continuation: createContinuationAddress(biome, parentOccurrenceId),
      cageOutcome,
    });
  }
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
    exitIndex: 1,
  });
}

function hProject(withTerminal: boolean): ProjectDocument {
  const start = createOccurrenceId('editor-h-start');
  const combat02 = createOccurrenceId('editor-h-combat02');
  const combat09 = createOccurrenceId('editor-h-combat09');
  const combat03 = createOccurrenceId('editor-h-combat03');
  const bridge = createOccurrenceId('editor-h-bridge');
  const miniboss = createOccurrenceId('editor-h-miniboss');
  const combat05 = createOccurrenceId('editor-h-combat05');
  const combat04 = createOccurrenceId('editor-h-combat04');
  let project = createProjectDocument(catalog, {
    projectId: 'h-editor',
    name: 'H Editor',
    configuredBiomeCounts: { Underworld: 3 },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'H_Intro',
  });
  project = appendBatch(project, start, [{ gameName: 'H_Combat02', occurrenceId: combat02 }]);
  project = appendBatch(
    project,
    combat02,
    [
      { gameName: 'H_Combat09', occurrenceId: combat09 },
      { gameName: 'H_Combat03', occurrenceId: combat03 },
    ],
    'max',
  );
  project = appendBatch(project, combat09, [
    { gameName: 'H_Bridge01', occurrenceId: bridge },
    { gameName: 'H_MiniBoss01', occurrenceId: miniboss },
  ]);
  project = appendBatch(project, bridge, [
    { gameName: 'H_Combat05', occurrenceId: combat05 },
    { gameName: 'H_Combat04', occurrenceId: combat04 },
  ]);
  if (!withTerminal) {
    return project;
  }
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTerminalTransition',
    continuation: createContinuationAddress(biome, combat05),
    targetOccurrenceIds: [
      createOccurrenceId('editor-h-terminal-shop'),
      createOccurrenceId('editor-h-terminal-free'),
    ],
  });
  return applyProjectCommand(project, catalog, {
    kind: 'SetTerminalPicked',
    picked: createPickedAddress(biome, combat05),
    exitIndex: 1,
  });
}

function HEditorHarness({
  candidateProjection,
}: {
  readonly candidateProjection: CandidateProjectionService;
}) {
  const project = useAppSelector(selectPresentProject);
  const plan = hPlan(project);
  const firstContinuation = plan.topology?.continuations[0];
  const evaluation: LinearBiomeProjectEvaluation = Object.freeze({
    kind: 'LinearBiome',
    biomeKey: biome.biomeKey,
    origin: biome,
    completion: 'incomplete',
    findings:
      firstContinuation === undefined
        ? Object.freeze([])
        : Object.freeze([
            Object.freeze({
              code: 'continuationMissing' as const,
              severity: 'error' as const,
              phase: 'completeness' as const,
              origin: createContinuationAddress(biome, firstContinuation.parentOccurrenceId),
              evidence: Object.freeze({ internalGameName: 'H_Intro' }),
            }),
          ]),
  });
  return (
    <LinearBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluation}
      plan={plan}
      routeKey={biome.routeKey}
    />
  );
}

function renderH(project: ProjectDocument) {
  const capabilities = createApplicationCapabilities(catalog);
  const evaluateProject = (current: ProjectDocument) => simulateProject(catalog, current);
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
      <HEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { store, user, ...view };
}

describe('H editor projection', () => {
  it('edits Fields outcomes and bounded cage leaves through semantic commands', async () => {
    const { store, user } = renderH(hProject(true));

    expect(screen.getByRole('heading', { name: 'Fields of Mourning' })).toBeTruthy();
    const outcomes = screen.getAllByLabelText('Fields door roll');
    const firstOutcome = document.querySelector<HTMLSelectElement>(
      '#batch-editor-h-start-cage-outcome',
    );
    expect(outcomes).toHaveLength(4);
    expect(within(outcomes[0]!).getByRole('option', { name: 'Min (2)' })).toBeTruthy();
    expect(within(outcomes[0]!).getByRole('option', { name: 'Max (3)' })).toBeTruthy();
    expect(firstOutcome).toHaveProperty('value', 'min');
    expect(firstOutcome?.getAttribute('data-candidate-support')).toBe('unavailable');
    expect(screen.getAllByLabelText('1 finding').length).toBeGreaterThan(0);
    expect(
      screen.getByText(
        'No offered room uses the Fields multi-cage count; Max still affects later Fields rolls.',
      ),
    ).toBeTruthy();

    const cageGroups = screen.getAllByLabelText('Fields cage rewards');
    const firstCageThree = within(cageGroups[0]!).getByRole('region', { name: 'Cage 3' });
    expect(within(firstCageThree).getByText('Dormant')).toBeTruthy();

    if (firstOutcome === null) {
      throw new Error('first Fields outcome selector is missing');
    }
    await user.selectOptions(firstOutcome, 'max');
    expect(within(firstCageThree).getByText('Active')).toBeTruthy();

    const firstCage = within(cageGroups[0]!).getByRole('region', { name: 'Cage 1' });
    await user.selectOptions(within(firstCage).getByLabelText('Reward'), 'MaxHealthDrop');

    const plan = hPlan(store.getState().projectWorkspace.history.present);
    const firstBatch = plan.topology?.continuations[0];
    const combat = plan.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === createOccurrenceId('editor-h-combat02'),
    );
    expect(firstBatch).toMatchObject({ batchState: { cageOutcome: 'max' } });
    expect(combat?.state).toMatchObject({
      kind: 'fieldsCombat',
      cages: { cage1: { rewardType: 'MaxHealthDrop' } },
    });
    expect(screen.getByText('Preboss Shop')).toBeTruthy();
    expect(screen.getByText('Free Reward')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Continue With Rooms' })).toHaveProperty(
      'disabled',
      true,
    );
  }, 10_000);

  it('uses fixed-count frontier gating at the terminal frontier', () => {
    renderH(hProject(false));

    expect(screen.getByRole('button', { name: 'Add Next Decision' })).toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toHaveProperty('disabled', false);
    expect(
      screen
        .getAllByRole('button', { name: 'Replace With Preboss' })
        .every((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);
  });

  it('keeps Preboss unavailable before the fourth ordinary Fields decision', () => {
    const project = applyProjectCommand(hProject(false), catalog, {
      kind: 'RemoveBatch',
      continuation: createContinuationAddress(biome, createOccurrenceId('editor-h-bridge')),
    });
    renderH(project);

    expect(screen.getByRole('button', { name: 'Add Next Decision' })).toHaveProperty(
      'disabled',
      false,
    );
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toHaveProperty('disabled', true);
  });
});
