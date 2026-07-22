// @vitest-environment jsdom

import { catalog } from '@run-planner/catalog';
import { simulateProject, type ProjectDocument } from '@run-planner/core';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlannerCapabilities } from '../application/capabilities';
import { createCandidateProjectionService } from '../application/candidateProjection';
import {
  createPlannerStore,
  selectPresentProject,
  selectProjectEvaluation,
  useAppSelector,
} from '../application/store';
import {
  createEmptyNProject as emptyProject,
  createRepresentativeNProject as representativeProject,
  nBiome as biome,
  nFixedOccurrenceIds as fixedOccurrenceIds,
  nOccurrenceId as occurrenceId,
  nVisitSlotKeys as visitSlotKeys,
  requireNPlan as nPlan,
} from '../testing/nProject';
import { HubBiomeEditor } from './HubBiomeEditor';

const activeScope = Object.freeze({ simulatableBiomeKeys: Object.freeze(['N']) });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function NEditorHarness({
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const evaluation = useAppSelector(selectProjectEvaluation)
    .routes.find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  const plan = nPlan(project);
  if (evaluation !== undefined && evaluation.kind !== 'HubBiome') {
    throw new Error('N editor fixture received a non-Hub evaluation');
  }
  return (
    <HubBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluation}
      plan={plan}
      routeKey={biome.routeKey}
    />
  );
}

function renderNEditor(project: ProjectDocument) {
  const capabilities = createPlannerCapabilities(catalog, {
    authorableBiomeKeys: ['N'],
    simulatableBiomeKeys: ['N'],
    editableBiomeKeys: ['N'],
  });
  const evaluateProject = (current: ProjectDocument) =>
    simulateProject(catalog, current, activeScope);
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
      <NEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { store, user, ...view };
}

describe('N editor projection', () => {
  it('initializes fixed leaves through the active Surface simulation', async () => {
    const { store, user } = renderNEditor(emptyProject());

    expect(screen.getByRole('heading', { name: 'City of Ephyra' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Initialize City of Ephyra' }));

    expect(screen.getByRole('heading', { name: 'Opening' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pre-Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(
      nPlan(store.getState().projectWorkspace.history.present).topology?.fixedRooms,
    ).toHaveLength(3);
    expect(
      simulateProject(catalog, store.getState().projectWorkspace.history.present, activeScope)
        .routes[1],
    ).toMatchObject({
      status: 'incomplete',
      biomes: [{ kind: 'HubBiome', biomeKey: 'N', completion: 'incomplete' }],
      horizon: { kind: 'incomplete', biomeKey: 'N' },
    });
  });

  it('opens the fixed Medea slot without exposing an editable reward selector', async () => {
    const { user } = renderNEditor(emptyProject());
    await user.click(screen.getByRole('button', { name: 'Initialize City of Ephyra' }));
    const storySlot = screen.getByRole('article', { name: 'Medea Hub slot' });

    expect(within(storySlot).getByText('Closed fixed slot.')).toBeTruthy();
    await user.click(within(storySlot).getByRole('checkbox', { name: 'Medea open' }));

    expect(within(storySlot).getByText('Fixed reward: Story')).toBeTruthy();
    expect(within(storySlot).queryByRole('combobox')).toBeNull();
  });

  it('edits the physical board, visit timeline, side state, rewards, and shop semantically', async () => {
    const { store, user } = renderNEditor(representativeProject());

    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(26);
    expect(
      screen
        .getAllByRole<HTMLInputElement>('checkbox', { name: / open$/ })
        .filter((control) => control.checked),
    ).toHaveLength(9);
    expect(
      Array.from(
        { length: 6 },
        (_, index) => (screen.getByLabelText(`Visit ${index + 1} room`) as HTMLSelectElement).value,
      ),
    ).toEqual(visitSlotKeys);

    const combat05Details = screen.getByRole('article', { name: 'Combat 05 visit details' });
    const sideCards = combat05Details.querySelectorAll<HTMLElement>('.ephyra-side-card');
    expect(sideCards).toHaveLength(3);
    const thirdSide = sideCards[2]!;
    await user.click(within(thirdSide).getByRole('button', { name: /^Enter / }));
    await user.click(within(thirdSide).getByRole('button', { name: /^Move .* earlier$/ }));
    const afterSideEdit = nPlan(store.getState().projectWorkspace.history.present).topology;
    const combat05 = afterSideEdit?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId('combat05'),
    );
    expect(combat05?.state).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: {
        sideDoor1: { enteredOrdinal: 3 },
        sideDoor2: { enteredOrdinal: 1 },
        sideDoor3: { enteredOrdinal: 2 },
      },
    });

    const sideReward = within(thirdSide).getByLabelText('Reward') as HTMLSelectElement;
    const replacementSideReward = Array.from(sideReward.options).find(
      (option) => option.value !== sideReward.value,
    )?.value;
    if (replacementSideReward === undefined) {
      throw new Error('side-room reward selector has no replacement value');
    }
    await user.selectOptions(sideReward, replacementSideReward);
    const afterSideReward = nPlan(store.getState().projectWorkspace.history.present).topology;
    const rewardedCombat05 = afterSideReward?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === occurrenceId('combat05'),
    );
    expect(rewardedCombat05?.state).toMatchObject({
      kind: 'ephyraCombat',
      sideRooms: { sideDoor3: { offer: { rewardType: replacementSideReward } } },
    });

    const combat05Slot = screen.getByRole('article', { name: 'Combat 05 Hub slot' });
    await user.selectOptions(within(combat05Slot).getByLabelText('Reward'), 'MaxHealthDropBig');
    expect(
      nPlan(store.getState().projectWorkspace.history.present).topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === occurrenceId('combat05'),
      )?.state,
    ).toMatchObject({ kind: 'ephyraCombat', offer: { rewardType: 'MaxHealthDropBig' } });

    await user.selectOptions(screen.getByLabelText('Visit 1 room'), 'combat01');
    expect(nPlan(store.getState().projectWorkspace.history.present).topology?.visitOrder[0]).toBe(
      'combat01',
    );

    const boarSlot = screen.getByRole('article', { name: 'Erymanthian Boar Hub slot' });
    const boarOpen = within(boarSlot).getByRole('checkbox', {
      name: 'Erymanthian Boar open',
    });
    await user.click(boarOpen);
    fireEvent.blur(boarOpen);
    fireEvent.focus(boarOpen);
    await waitFor(() =>
      expect(boarOpen.closest('label')?.getAttribute('data-candidate-support')).toBe('impossible'),
    );
    expect(within(boarSlot).getByLabelText('1 finding')).toBeTruthy();

    const purchased = screen.getAllByRole('checkbox', { name: 'Purchased' })[0]!;
    await user.click(purchased);
    const preboss = nPlan(
      store.getState().projectWorkspace.history.present,
    ).topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === fixedOccurrenceIds.preboss,
    );
    expect(preboss?.state).toMatchObject({
      kind: 'shop',
      shop: { offers: { Boon: { purchased: true } } },
    });
  }, 20_000);
});
