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

import type { StructuredWorkspaceProjectionService } from '../../../projections/structuredWorkspace';
import {
  createPlannerStore,
  selectPresentProject,
  selectProjectEvaluation,
  useAppSelector,
} from '../../../state/store';
import { createStructuredWorkspaceTestServices } from '../../../../test/fixtures/structuredWorkspace';
import {
  createRepresentativeNOPQProject,
  qBiome,
  qOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
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
  structuredWorkspace,
}: {
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}) {
  const project = useAppSelector(selectPresentProject);
  const projectEvaluation = useAppSelector(selectProjectEvaluation);
  const evaluation = projectEvaluation.routes
    .find((route) => route.routeKey === qBiome.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === qBiome.biomeKey);
  if (evaluation?.kind !== 'LinearBiome') {
    throw new Error('Q editor fixture has no linear evaluation');
  }
  return (
    <LinearBiomeEditor
      catalog={catalog}
      contextual={structuredWorkspace.project(project, projectEvaluation).contextual}
      evaluation={evaluation}
      plan={qPlan(project)}
      routeKey={qBiome.routeKey}
    />
  );
}

function renderQ(project = createRepresentativeNOPQProject()) {
  const evaluateProject = (current: ProjectDocument) => simulateProject(catalog, current);
  const store = createPlannerStore({
    catalog,
    evaluateProject,
    initialProject: project,
  });
  const { candidateSessions, structuredWorkspace } = createStructuredWorkspaceTestServices();
  const candidates = candidateSessions.bind(project, selectProjectEvaluation(store.getState()));
  const user = userEvent.setup();
  const view = render(
    <Provider store={store}>
      <QEditorHarness structuredWorkspace={structuredWorkspace} />
    </Provider>,
  );
  return { candidates, project, store, user, ...view };
}

describe('Q candidates and editor projection', () => {
  it('uses the declaration-owned pool for every staged room candidate', async () => {
    const { candidates, user } = renderQ();
    const firstFork = catalog.rooms.byKey.Q_Combat03;
    const ordinary = catalog.rooms.byKey.Q_Combat01;
    if (firstFork === undefined || ordinary === undefined) {
      throw new Error('Q candidate rooms are missing');
    }

    expect(
      candidates.roomTargets(createTargetAddress(qBiome, qOccurrenceIds.foyer, 1), [
        firstFork,
        ordinary,
      ]),
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
    await user.click(within(foyerDecision).getByLabelText('Room'));
    const roomOptions = screen
      .getAllByRole('option')
      .map((option) => option.querySelector('.contextual-picker-item-label')?.textContent);
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
