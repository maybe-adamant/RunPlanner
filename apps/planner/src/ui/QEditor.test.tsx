// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createContinuationAddress,
  createTargetAddress,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createPlannerCapabilities } from '../composition/capabilities';
import { createCandidateProjectionService } from '../projections/candidateProjection';
import { createProjectSimulationScope } from '../composition/capabilityConfiguration';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../state/store';
import { createRepresentativeNOPQProject, qBiome, qOccurrenceIds } from '../testing/surfaceProject';
import { LinearBiomeEditor } from './LinearBiomeEditor';

afterEach(cleanup);

function qPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === qBiome.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === qBiome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('Q editor fixture has no linear plan');
  }
  return plan;
}

function QEditorHarness({
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector((state) =>
    state.projectWorkspace.evaluation.routes
      .find((route) => route.routeKey === qBiome.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === qBiome.biomeKey),
  );
  if (evaluation?.kind !== 'LinearBiome') {
    throw new Error('Q editor fixture has no linear evaluation');
  }
  return (
    <LinearBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluation}
      plan={qPlan(project)}
      routeKey={qBiome.routeKey}
    />
  );
}

function renderQ(project = createRepresentativeNOPQProject()) {
  const active = ['F', 'G', 'H', 'I', 'N', 'O', 'P', 'Q'];
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
      <QEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { candidateProjection, project, store, user, ...view };
}

describe('Q candidates and editor projection', () => {
  it('uses the declaration-owned pool for every staged room candidate', () => {
    const { candidateProjection, project } = renderQ();
    const firstFork = catalog.rooms.byKey.Q_Combat03;
    const ordinary = catalog.rooms.byKey.Q_Combat01;
    if (firstFork === undefined || ordinary === undefined) {
      throw new Error('Q candidate rooms are missing');
    }

    expect(
      candidateProjection.roomTargets(
        project,
        createTargetAddress(qBiome, qOccurrenceIds.foyer, 1),
        [firstFork, ordinary],
      ),
    ).toMatchObject([
      {
        value: { gameName: 'Q_Combat03' },
        evaluation: { context: 'evaluated', support: 'forced' },
      },
      {
        value: { gameName: 'Q_Combat01' },
        evaluation: { context: 'evaluated', support: 'impossible' },
      },
    ]);

    const foyerDecision = screen
      .getByRole('heading', { name: 'Doors from Entrance' })
      .closest('section');
    if (foyerDecision === null) {
      throw new Error('Q foyer decision is missing');
    }
    const roomOptions = within(foyerDecision)
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(roomOptions).toContain('Combat 10');
    expect(roomOptions).toContain('Combat 11');
    expect(roomOptions).not.toContain('Combat 01');
  });

  it('renders rewardless stages, miniboss rewards, and only the direct terminal frontier', async () => {
    const withoutTerminal = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveTerminalTransition',
      continuation: createContinuationAddress(qBiome, qOccurrenceIds.secondMiniboss1),
    });
    const { store, user } = renderQ(withoutTerminal);

    expect(screen.getByRole('heading', { name: 'Summit' })).toBeTruthy();
    expect(screen.getAllByText('No room-local reward.').length).toBeGreaterThan(3);
    expect(screen.queryByText('Reward pool')).toBeNull();
    expect(screen.getAllByText('Reward').length).toBeGreaterThanOrEqual(4);
    expect(
      (screen.getByRole('button', { name: 'Add Next Decision' }) as HTMLButtonElement).disabled,
    ).toBe(true);
    const terminalButton = screen.getByRole('button', { name: 'Go to Preboss' });
    expect((terminalButton as HTMLButtonElement).disabled).toBe(false);

    await user.click(terminalButton);

    expect(screen.getByRole('heading', { name: 'Preboss from Tail' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(
      qPlan(store.getState().projectWorkspace.history.present).topology?.continuations.at(-1),
    ).toMatchObject({ kind: 'terminal', pickedExitIndex: 1 });
    expect(
      (screen.getByRole('button', { name: 'Continue With Rooms' }) as HTMLButtonElement).disabled,
    ).toBe(true);
  }, 30_000);
});
