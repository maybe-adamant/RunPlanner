// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  createBatchRewardStoreAddress,
  createTargetAddress,
  type LinearBiomePlan,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { cleanup, render, screen } from '@testing-library/react';
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
  createRepresentativeNOPProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import { LinearBiomeEditor } from './LinearBiomeEditor';

afterEach(cleanup);

function pPlan(project: ProjectDocument): LinearBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === pBiome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === pBiome.biomeKey);
  if (plan?.kind !== 'LinearBiome') {
    throw new Error('P editor fixture has no P plan');
  }
  return plan;
}

function PEditorHarness({
  structuredWorkspace,
}: {
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}) {
  const project = useAppSelector(selectPresentProject);
  const projectEvaluation = useAppSelector(selectProjectEvaluation);
  const evaluation = projectEvaluation.routes
    .find((route) => route.routeKey === pBiome.routeKey)
    ?.biomes.find((biome) => biome.biomeKey === pBiome.biomeKey);
  if (evaluation?.kind !== 'LinearBiome') {
    throw new Error('P editor fixture has no linear evaluation');
  }
  return (
    <LinearBiomeEditor
      catalog={catalog}
      interactions={structuredWorkspace.project(project, projectEvaluation).interactions}
      evaluation={evaluation}
      plan={pPlan(project)}
      routeKey={pBiome.routeKey}
    />
  );
}

function renderP() {
  const project = createRepresentativeNOPProject();
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
      <PEditorHarness structuredWorkspace={structuredWorkspace} />
    </Provider>,
  );
  return { candidates, project, store, user, ...view };
}

describe('P candidates and editor projection', () => {
  it('projects exit compatibility and carried store pressure through normal candidates', () => {
    const { candidates } = renderP();
    const indoor = catalog.rooms.byKey.P_Combat02;
    const outdoor = catalog.rooms.byKey.P_Combat05;
    if (indoor === undefined || outdoor === undefined) {
      throw new Error('P candidate fixture rooms are missing');
    }

    expect(
      candidates.roomTargets(createTargetAddress(pBiome, pOccurrenceIds.intro, 1), [
        indoor,
        outdoor,
      ]),
    ).toMatchObject([
      {
        value: { gameName: 'P_Combat02' },
        evaluation: {
          context: 'evaluated',
          support: 'impossible',
          findings: [{ code: 'targetRoomUnavailable' }],
        },
      },
      {
        value: { gameName: 'P_Combat05' },
        evaluation: { context: 'evaluated', support: 'possible' },
      },
    ]);
    expect(
      candidates.batchRewardStores(
        createBatchRewardStoreAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        ['RunProgress', 'MetaProgress'],
      ),
    ).toMatchObject([
      { value: 'RunProgress', evaluation: { context: 'evaluated', support: 'impossible' } },
      { value: 'MetaProgress', evaluation: { context: 'evaluated', support: 'forced' } },
    ]);
  }, 10_000);

  it('edits ordinary leaves and projects the forked terminal without internal phase controls', async () => {
    const { store, user } = renderP();

    expect(screen.getByRole('heading', { name: 'Olympus' })).toBeTruthy();
    expect(screen.queryByText('Precombat')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Preboss from Combat 12' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Free Reward' })).toBeTruthy();
    expect(screen.queryByLabelText('Type')).toBeNull();
    await user.click(screen.getAllByLabelText('Room')[0]!);
    expect((await screen.findAllByRole('option')).length).toBeGreaterThan(0);
    await user.keyboard('{Escape}');

    await user.click(screen.getByLabelText('Enter terminal exit 2'));

    expect(
      pPlan(store.getState().projectWorkspace.history.present).topology?.continuations.find(
        (continuation) => continuation.parentOccurrenceId === pOccurrenceId('P_Combat12', 8, 1),
      ),
    ).toMatchObject({ kind: 'terminal', pickedExitIndex: 2 });
  }, 30_000);
});
