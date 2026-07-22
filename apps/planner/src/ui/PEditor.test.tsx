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

import { createPlannerCapabilities } from '../application/capabilities';
import { createCandidateProjectionService } from '../application/candidateProjection';
import { createProjectSimulationScope } from '../application/capabilityConfiguration';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../application/store';
import {
  createRepresentativeNOPProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '../testing/surfaceProject';
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
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector((state) =>
    state.projectWorkspace.evaluation.routes
      .find((route) => route.routeKey === pBiome.routeKey)
      ?.biomes.find((biome) => biome.biomeKey === pBiome.biomeKey),
  );
  if (evaluation?.kind !== 'LinearBiome') {
    throw new Error('P editor fixture has no linear evaluation');
  }
  return (
    <LinearBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluation}
      plan={pPlan(project)}
      routeKey={pBiome.routeKey}
    />
  );
}

function renderP() {
  const project = createRepresentativeNOPProject();
  const active = ['F', 'G', 'H', 'I', 'N', 'O', 'P'];
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
      <PEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { candidateProjection, project, store, user, ...view };
}

describe('P candidates and editor projection', () => {
  it('projects exit compatibility and carried store pressure through normal candidates', () => {
    const { candidateProjection, project } = renderP();
    const indoor = catalog.rooms.byKey.P_Combat02;
    const outdoor = catalog.rooms.byKey.P_Combat05;
    if (indoor === undefined || outdoor === undefined) {
      throw new Error('P candidate fixture rooms are missing');
    }

    expect(
      candidateProjection.roomTargets(
        project,
        createTargetAddress(pBiome, pOccurrenceIds.intro, 1),
        [indoor, outdoor],
      ),
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
      candidateProjection.batchRewardStores(
        project,
        createBatchRewardStoreAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
        ['RunProgress', 'MetaProgress'],
      ),
    ).toMatchObject([
      { value: 'RunProgress', evaluation: { context: 'evaluated', support: 'impossible' } },
      { value: 'MetaProgress', evaluation: { context: 'evaluated', support: 'forced' } },
    ]);
  });

  it('edits ordinary leaves and projects the forked terminal without internal phase controls', async () => {
    const { store, user } = renderP();

    expect(screen.getByRole('heading', { name: 'Mount Olympus' })).toBeTruthy();
    expect(screen.queryByText('Precombat')).toBeNull();
    expect(screen.getByRole('heading', { name: 'Preboss from Combat 15' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss Shop' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Free Reward' })).toBeTruthy();

    await user.click(screen.getByLabelText('Enter terminal exit 2'));

    expect(
      pPlan(store.getState().projectWorkspace.history.present).topology?.continuations.find(
        (continuation) => continuation.parentOccurrenceId === pOccurrenceId('P_Combat15', 9, 1),
      ),
    ).toMatchObject({ kind: 'terminal', pickedExitIndex: 2 });
  }, 30_000);
});
