// @vitest-environment jsdom

import { catalog } from '@run-planner/catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createHubSlotAddress,
  createHubVisitAddress,
  createIncomingRewardAddress,
  createLocalChildAddress,
  createLocalChildGroupAddress,
  createLocalRewardAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  evaluateNBiome,
  simulateProject,
  type HubBiomePlan,
  type ProjectDocument,
} from '@run-planner/core';
import type { ResolvedRewardOffer } from '@run-planner/core/reward-kernel';
import { cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createPlannerCapabilities } from '../application/capabilities';
import { createCandidateProjectionService } from '../application/candidateProjection';
import { createPlannerStore, selectPresentProject, useAppSelector } from '../application/store';
import { HubBiomeEditor } from './HubBiomeEditor';

const biome = createBiomeAddress('Surface', 'N');
const fixedOccurrenceIds = {
  opening: createOccurrenceId('editor-n-opening'),
  preHub: createOccurrenceId('editor-n-prehub'),
  preboss: createOccurrenceId('editor-n-preboss'),
};
const openSlotKeys = [
  'combat11',
  'combat10',
  'combat09',
  'combat05',
  'combat03',
  'combat02',
  'combat01',
  'miniBoss01',
  'combat23',
] as const;
const visitSlotKeys = [
  'combat05',
  'miniBoss01',
  'combat02',
  'combat11',
  'combat23',
  'combat09',
] as const;
const dormantScope = Object.freeze({ simulatableBiomeKeys: Object.freeze([]) });

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function occurrenceId(slotKey: string) {
  return createOccurrenceId(`editor-n-${slotKey}`);
}

function nPlan(project: ProjectDocument): HubBiomePlan {
  const plan = project.routes
    .find((route) => route.routeKey === biome.routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  if (plan?.kind !== 'HubBiome') {
    throw new Error('dormant N editor fixture has no Hub plan');
  }
  return plan;
}

function replaceIncoming(
  project: ProjectDocument,
  slotKey: string,
  value: ResolvedRewardOffer,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(biome, occurrenceId(slotKey)),
    value,
  });
}

function replaceLocal(
  project: ProjectDocument,
  parentSlotKey: string,
  sideSlotKey: string,
  rewardType: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceLocalReward',
    reward: createLocalRewardAddress(biome, occurrenceId(parentSlotKey), 'sideRooms', sideSlotKey),
    value: { rewardType },
  });
}

function configureSideRooms(project: ProjectDocument): ProjectDocument {
  let configured = project;
  for (const [parentSlotKey, sideSlotKeys] of Object.entries({
    combat05: ['sideDoor1', 'sideDoor2', 'sideDoor3'],
    combat02: ['sideDoor1', 'sideDoor2'],
    combat11: ['sideDoor1'],
  })) {
    for (const sideSlotKey of sideSlotKeys) {
      configured = applyProjectCommand(configured, catalog, {
        kind: 'ReplaceSideRoomGeneration',
        sideRoom: createLocalChildAddress(
          biome,
          occurrenceId(parentSlotKey),
          'sideRooms',
          sideSlotKey,
        ),
        generation: 'generated',
      });
    }
  }
  for (const [parentSlotKey, enteredSlotKeys] of [
    ['combat05', ['sideDoor2', 'sideDoor1']],
    ['combat02', ['sideDoor1']],
    ['combat11', ['sideDoor1']],
  ] as const) {
    configured = applyProjectCommand(configured, catalog, {
      kind: 'ReplaceSideRoomEntryOrder',
      group: createLocalChildGroupAddress(biome, occurrenceId(parentSlotKey), 'sideRooms'),
      enteredSlotKeys,
    });
  }
  configured = replaceLocal(configured, 'combat05', 'sideDoor1', 'MaxManaDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor2', 'MaxHealthDropSmall');
  configured = replaceLocal(configured, 'combat05', 'sideDoor3', 'EmptyMaxHealthSmallDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor1', 'RoomMoneyTinyDrop');
  configured = replaceLocal(configured, 'combat02', 'sideDoor2', 'AirBoost');
  return replaceLocal(configured, 'combat11', 'sideDoor1', 'EarthBoost');
}

function emptyProject(): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: 'dormant-n-editor',
    name: 'Dormant N Editor',
    configuredBiomeCounts: { Surface: 1 },
  });
}

function representativeProject(): ProjectDocument {
  let project = applyProjectCommand(emptyProject(), catalog, {
    kind: 'CreateHubTopology',
    biome,
    fixedOccurrenceIds,
  });
  for (const hubSlotKey of openSlotKeys) {
    project = applyProjectCommand(project, catalog, {
      kind: 'OpenHubSlot',
      slot: createHubSlotAddress(biome, hubSlotKey),
      occurrenceId: occurrenceId(hubSlotKey),
    });
  }
  for (const [index, hubSlotKey] of visitSlotKeys.entries()) {
    project = applyProjectCommand(project, catalog, {
      kind: 'AppendHubVisit',
      visit: createHubVisitAddress(biome, index + 1),
      hubSlotKey,
    });
  }
  for (const [slotKey, offer] of Object.entries({
    combat01: { rewardType: 'MaxHealthDropBig' },
    combat02: { rewardType: 'MaxManaDropBig' },
    combat03: { rewardType: 'WeaponUpgrade' },
    combat05: { rewardType: 'HermesUpgrade' },
    combat09: { rewardType: 'SpellDrop' },
    combat10: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    },
    combat11: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'AresUpgrade' },
    },
    combat23: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'DemeterUpgrade' },
    },
    miniBoss01: {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource', source: 'HephaestusUpgrade' },
    },
  } satisfies Readonly<Record<string, ResolvedRewardOffer>>)) {
    project = replaceIncoming(project, slotKey, offer);
  }
  project = configureSideRooms(project);
  return applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: createShopOfferAddress(biome, fixedOccurrenceIds.preboss, 'MajorNonBoon'),
    value: { rewardType: 'MaxHealthDrop' },
  });
}

function DormantNEditorHarness({
  candidateProjection,
}: {
  readonly candidateProjection: ReturnType<typeof createCandidateProjectionService>;
}) {
  const project = useAppSelector(selectPresentProject);
  const plan = nPlan(project);
  return (
    <HubBiomeEditor
      candidateProjection={candidateProjection}
      catalog={catalog}
      evaluation={evaluateNBiome(catalog, biome.routeKey, plan)}
      plan={plan}
      routeKey={biome.routeKey}
    />
  );
}

function renderDormantN(project: ProjectDocument) {
  const capabilities = createPlannerCapabilities(catalog, {
    authorableBiomeKeys: ['N'],
    simulatableBiomeKeys: [],
    editableBiomeKeys: ['N'],
  });
  const evaluateProject = (current: ProjectDocument) =>
    simulateProject(catalog, current, dormantScope);
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
      <DormantNEditorHarness candidateProjection={candidateProjection} />
    </Provider>,
  );
  return { store, user, ...view };
}

describe('dormant N editor projection', () => {
  it('initializes fixed leaves without activating N route simulation', async () => {
    const { store, user } = renderDormantN(emptyProject());

    expect(screen.getByRole('heading', { name: 'City of Ephyra' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Initialize City of Ephyra' }));

    expect(screen.getByRole('heading', { name: 'Opening' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Pre-Hub' })).toBeTruthy();
    expect(screen.getByRole('heading', { name: 'Preboss' })).toBeTruthy();
    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(25);
    expect(
      nPlan(store.getState().projectWorkspace.history.present).topology?.fixedRooms,
    ).toHaveLength(3);
    expect(
      simulateProject(catalog, store.getState().projectWorkspace.history.present, dormantScope)
        .routes[1],
    ).toMatchObject({
      status: 'blocked',
      biomes: [],
      horizon: { kind: 'simulatorBoundary', biomeKey: 'N' },
    });
  });

  it('edits the physical board, visit timeline, side state, rewards, and shop semantically', async () => {
    const { store, user } = renderDormantN(representativeProject());

    expect(screen.getAllByRole('checkbox', { name: / open$/ })).toHaveLength(25);
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
