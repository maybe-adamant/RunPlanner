// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createAllTogetherSetAddress,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createEncounterPhaseAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createTraitAcquisitionTargetAddress,
  createShopOfferAddress,
  semanticAddressKey,
  seaStarDuplicateSiteKey,
  decodeProjectDocument,
  encodeProjectDocument,
} from '@run-planner/engine/authored-project';
import { derivedAcquisitionEntriesForProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import { catalog } from '@run-planner/hades2-catalog';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type {
  AutosaveRecoveryAdapter,
  AutosaveScheduler,
} from '@planner/persistence/autosaveRecovery';
import type { ProfileFileAdapter, ProfileFileReference } from '@planner/persistence/profileFile';
import type { GamePlanPublisher } from '@planner/persistence/gamePlanPublisher';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import {
  routePanelSelected,
  semanticOwnerFocused,
  semanticOwnerNavigated,
  traitOfferDialogOpened,
} from '@planner/state/editorSessionSlice';
import {
  createOpenTestApplication,
  renderPlannerForInteraction,
} from '@planner-test/fixtures/renderPlanner';
import {
  createGoldenEchoGiftHammerPendingProject,
  echoGiftHammerReplayAddress,
} from '@planner-test/fixtures/echoGiftHammer';
import { createEchoGoldHPrebossProject } from '@planner-test/fixtures/echoGoldShop';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';
import {
  reachedTraitOffers,
  authorLegalTraitOffers,
  prepareLegalPomTraitOffers,
  supportedTraitOffer,
} from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNOPQProject,
  loadSurfaceNResourcesProject,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
} from '@run-planner/test-fixtures/surface';

afterEach(cleanup);

function profileReference(fileName: string): ProfileFileReference {
  return { activate: () => Promise.resolve(), fileName, write: () => Promise.resolve() };
}

function profileAdapter(
  overrides: Pick<ProfileFileAdapter, 'load' | 'saveAs'> &
    Partial<Pick<ProfileFileAdapter, 'supportsSaveAs'>>,
): ProfileFileAdapter {
  return {
    clearActive: () => Promise.resolve(),
    restoreActive: () => Promise.resolve({ status: 'none' }),
    supportsSaveAs: false,
    ...overrides,
  };
}

function configuredBiomeCount(
  application: ReturnType<typeof renderPlannerForInteraction>['application'],
) {
  return application.store.getState().projectWorkspace.history!.present.route?.biomes.length;
}

function projectWithArtemisInErebus() {
  const initial = createCompleteFGProject();
  const phase = createEncounterPhaseAddress(
    goldenFBiome,
    { kind: 'occurrence', occurrenceId: goldenFOccurrenceId(5, 1) },
    'Encounter',
  );
  return {
    phase,
    project: authorLegalTraitOffers(
      applyProjectCommand(initial, catalog, {
        kind: 'SelectEncounter',
        phase,
        encounterKey: 'ArtemisCombatF',
      }),
    ),
  };
}

function seaStarRewardFixture() {
  const start = createOccurrenceId('sea-star-app-start');
  const preSeaStar = createOccurrenceId('sea-star-app-pre-trait');
  const seaStar = createOccurrenceId('sea-star-app-trait');
  const target = createOccurrenceId('sea-star-app-target');
  const startReward = createIncomingRewardAddress(goldenFBiome, start);
  const preSeaStarReward = createIncomingRewardAddress(goldenFBiome, preSeaStar);
  const seaStarReward = createIncomingRewardAddress(goldenFBiome, seaStar);
  const targetReward = createIncomingRewardAddress(goldenFBiome, target);
  let project = createProjectDocument(catalog, {
    projectId: 'sea-star-app-workflow',
    routeKey: 'Underworld',
    configuredBiomeCount: 1,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: startReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  project = authorLegalTraitOffers(project);
  const openingOffer = supportedTraitOffer(
    project,
    createTraitOfferAddress(startReward, 'source'),
    'Poseidon',
    'PoseidonWeaponBoon',
  );
  if (openingOffer === undefined) throw new Error('Sea Star fixture has no opening Poseidon offer');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(startReward, 'source'),
    value: openingOffer,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, { kind: 'occurrence', occurrenceId: start }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: start,
    }),
    storeKey: 'MetaProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, { kind: 'occurrence', occurrenceId: start }, 'exit1'),
    occurrenceId: preSeaStar,
    gameName: 'F_Combat02',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: preSeaStarReward,
    value: { rewardType: 'MetaCurrencyDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: preSeaStar,
    }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: preSeaStar,
    }),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: preSeaStar },
      'exit1',
    ),
    occurrenceId: seaStar,
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: preSeaStar },
      'exit2',
    ),
    occurrenceId: createOccurrenceId('sea-star-app-pre-trait-sibling'),
    gameName: 'F_Combat03',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      goldenFBiome,
      createOccurrenceId('sea-star-app-pre-trait-sibling'),
    ),
    value: { rewardType: 'MaxManaDrop' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: preSeaStar,
    }),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: seaStarReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'PoseidonUpgrade' } },
  });
  project = authorLegalTraitOffers(project);
  const seaStarOffer = supportedTraitOffer(
    project,
    createTraitOfferAddress(seaStarReward, 'source'),
    'Poseidon',
    'DoubleRewardBoon',
  );
  if (seaStarOffer === undefined) throw new Error('Sea Star fixture has no later Poseidon offer');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: createTraitOfferAddress(seaStarReward, 'source'),
    value: seaStarOffer,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: seaStar,
    }),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: seaStar,
    }),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: seaStar },
      'exit1',
    ),
    occurrenceId: target,
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId: seaStar },
      'exit2',
    ),
    occurrenceId: createOccurrenceId('sea-star-app-trait-sibling'),
    gameName: 'F_Combat04',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: createIncomingRewardAddress(
      goldenFBiome,
      createOccurrenceId('sea-star-app-trait-sibling'),
    ),
    value: { rewardType: 'WeaponUpgrade' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: seaStar,
    }),
    value: { kind: 'normal', exitKey: 'exit1' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: targetReward,
    value: { rewardType: 'RoomMoneyDrop' },
  });
  return {
    project,
    targetReward,
    targetAcquisition: createAcquisitionRoleAddress(targetReward, 'self'),
    target,
  };
}

function concaveStoneTraitFixture() {
  const base = seaStarRewardFixture();
  let project = applyProjectCommand(base.project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: {
      kind: 'keepsakeSelection',
      routeKey: 'Underworld',
      biomeKey: 'routeStart',
      owner: 'routeStart',
    },
    keepsakeKey: 'UnpickedBoonKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceConcaveStoneResult',
    trait: createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, createOccurrenceId('sea-star-app-start')),
      'source',
    ),
    value: { kind: 'noProc' },
  });
  return project;
}

function staleConcaveStoneTraitFixture() {
  const target = createTraitOfferAddress(
    createIncomingRewardAddress(goldenFBiome, createOccurrenceId('sea-star-app-trait')),
    'source',
  );
  let project = applyProjectCommand(seaStarRewardFixture().project, catalog, {
    kind: 'ReplaceConcaveStoneResult',
    trait: target,
    value: { kind: 'proc', optionKey: 'option2' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: {
      kind: 'keepsakeSelection',
      routeKey: 'Underworld',
      biomeKey: 'routeStart',
      owner: 'routeStart',
    },
    keepsakeKey: 'ManaOverTimeRefundKeepsake',
  });
  return { project, target };
}

function heroicConcaveStoneTraitFixture() {
  const startReward = createIncomingRewardAddress(
    goldenFBiome,
    createOccurrenceId('sea-star-app-start'),
  );
  const targetReward = createIncomingRewardAddress(
    goldenFBiome,
    createOccurrenceId('sea-star-app-trait'),
  );
  const target = createTraitOfferAddress(targetReward, 'source');
  let project = applyProjectCommand(seaStarRewardFixture().project, catalog, {
    kind: 'ReplaceStartingKeepsake',
    selection: {
      kind: 'keepsakeSelection',
      routeKey: 'Underworld',
      biomeKey: 'routeStart',
      owner: 'routeStart',
    },
    keepsakeKey: 'UnpickedBoonKeepsake',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceConcaveStoneResult',
    trait: createTraitOfferAddress(startReward, 'source'),
    value: { kind: 'noProc' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceIncomingReward',
    reward: targetReward,
    value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'DemeterUpgrade' } },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceTraitOffer',
    trait: target,
    value: {
      kind: 'traits',
      giverKey: 'Demeter',
      options: [
        { traitKey: 'KeepsakeLevelBoon', rarity: 'Duo' },
        { traitKey: 'DemeterWeaponBoon', rarity: 'Common' },
        { traitKey: 'DemeterSpecialBoon', rarity: 'Common' },
      ],
      selectedOptionKey: 'option1',
    },
  });
  return { project, target };
}

function allTogetherFindingFixture() {
  const application = createApplication();
  let project = createCompleteFGProject();
  const plans = [
    [goldenFBiome, goldenFOccurrenceId(2, 1), 'HeraCastBoon'],
    [goldenFBiome, goldenFOccurrenceId(6, 1), 'OmegaHeraProjectileBoon'],
    [goldenGBiome, goldenGOccurrenceId(1, 1), 'DamageSharePotencyBoon'],
    [goldenGBiome, goldenGOccurrenceId(6, 1), 'HeraSprintBoon'],
    [goldenGBiome, goldenGOccurrenceId(7, 1), 'AllElementalBoon'],
  ] as const;
  let target: ReturnType<typeof createTraitOfferAddress> | undefined;
  let optionKey: 'option1' | 'option2' | 'option3' | undefined;
  for (const [biomeAddress, occurrenceId, traitKey] of plans) {
    const reward = createIncomingRewardAddress(biomeAddress, occurrenceId);
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    project = authorLegalTraitOffers(project);
    const prepared = prepareLegalPomTraitOffers(project);
    project = prepared.project;
    const trace = reachedTraitOffers(project).find(
      (candidate) =>
        semanticAddressKey(candidate.address.owner) === semanticAddressKey(reward) &&
        candidate.acquisitionRole === 'source',
    );
    if (trace === undefined) throw new Error(`missing reached ${traitKey} offer`);
    const value = supportedTraitOffer(project, trace.address, 'Hera', traitKey);
    if (value === undefined || value.kind !== 'traits')
      throw new Error(`missing supported ${traitKey} offer`);
    const completeValue =
      traitKey !== 'AllElementalBoon'
        ? value
        : Object.freeze({
            ...value,
            options: Object.freeze(
              value.options.map((option) => {
                return option.traitKey !== 'AllElementalBoon'
                  ? option
                  : Object.freeze({
                      ...option,
                      allTogetherResult: Object.freeze({
                        earth: null,
                        fire: 'ElementalBaseDamageBoon',
                        air: 'ElementalDamageFloorBoon',
                        water: 'ElementalHealthBoon',
                      }),
                    });
              }),
            ) as typeof value.options,
          });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: trace.address,
      value: completeValue,
    });
    if (traitKey === 'AllElementalBoon') {
      target = trace.address;
      optionKey = completeValue.selectedOptionKey;
    }
  }
  if (target === undefined || optionKey === undefined)
    throw new Error('All Together target was not prepared');
  const set = createAllTogetherSetAddress(target, optionKey, 'earth');
  const occurrence = createOccurrenceAddress(goldenGBiome, goldenGOccurrenceId(7, 1));
  return { application, occurrence, project, set, target };
}

describe('planner history interaction', () => {
  it('places the same route repair in the biome rail or above non-biome content', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHProject()));
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: createRouteAddress('Underworld'),
        weaponKey: 'WeaponDagger',
        aspectKey: 'DaggerBackstabAspect',
      }),
    );
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (issue === undefined) throw new Error('weapon change must produce a repair');
    const { user } = renderPlannerForInteraction({ application });
    const repair = () => {
      const headings = screen.getAllByRole('heading', { name: 'Next repair' });
      expect(headings).toHaveLength(1);
      return headings[0]!.closest('section')!;
    };

    await user.click(screen.getByRole('button', { name: 'Erebus' }));
    const copy = repair().textContent;
    expect(repair().parentElement).toBe(
      screen.getByRole('region', { name: 'Erebus route structure' }),
    );
    expect(repair().nextElementSibling?.textContent).toContain('Erebus');
    expect(screen.queryByText('Route structure')).toBeNull();

    await user.click(screen.getByRole('button', { name: 'Oceanus' }));
    expect(repair().parentElement).toBe(
      screen.getByRole('region', { name: 'Oceanus route structure' }),
    );
    expect(repair().textContent).toBe(copy);
    await user.click(within(repair()).getByRole('button'));
    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    expect(repair().parentElement).toBe(
      screen.getByRole('region', { name: 'Erebus route structure' }),
    );
    expect(screen.queryByRole('dialog')).toBeNull();

    for (const label of ['Loadout', 'Traits']) {
      await user.click(screen.getByRole('button', { name: label }));
      expect(repair().parentElement?.className).toBe('editor-panel');
      expect(repair().textContent).toBe(copy);
    }
  });

  it('repeatedly routes the selected Fields Optional 3 issue to its Overview picker', async () => {
    const application = createApplication();
    const original = createGoldenFGHProject();
    const fields = original.route.biomes
      .find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((room) => room.gameName === 'H_Combat02');
    if (fields?.state.kind !== 'fieldsCombat') throw new Error('H_Combat02 fixture is missing');
    const project = {
      ...original,
      route: {
        ...original.route,
        biomes: original.route.biomes.map((biome) =>
          biome.biomeKey !== 'H' || biome.topology === null
            ? biome
            : {
                ...biome,
                topology: {
                  ...biome.topology,
                  occurrences: biome.topology.occurrences.map((room) =>
                    room.occurrenceId !== fields.occurrenceId || room.state.kind !== 'fieldsCombat'
                      ? room
                      : {
                          ...room,
                          state: {
                            ...room.state,
                            optionalRewardCount: 3,
                            optionalRewards: { ...room.state.optionalRewards, optional3: null },
                          },
                        },
                  ),
                },
              },
        ),
      },
    };
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (entry) =>
          entry.code === 'rewardMissing' &&
          entry.origin.kind === 'localReward' &&
          entry.origin.slotKey === 'optional3' &&
          entry.origin.occurrenceId === fields.occurrenceId,
      );
    if (finding === undefined) throw new Error('Optional 3 definition finding is missing');
    const destination = workspace.focusByOwner.get(semanticAddressKey(finding.origin))!;
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (
      issue === undefined ||
      semanticAddressKey(issue.owner) !== semanticAddressKey(finding.origin)
    ) {
      throw new Error('Optional 3 must be the selected assessment issue');
    }
    application.store.dispatch(
      semanticOwnerNavigated(
        createOccurrenceAddress(
          { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
          fields.occurrenceId,
        ),
      ),
    );
    const view = renderPlannerForInteraction({ application });
    const targetSelector = `[data-semantic-owner='${semanticAddressKey(destination.focusAddress)}']`;
    const picker = view.container.querySelector<HTMLButtonElement>(targetSelector);
    expect(picker?.tagName).toBe('BUTTON');
    expect(picker?.getAttribute('data-has-findings')).toBe('true');
    expect(picker?.hasAttribute('aria-description')).toBe(true);
    expect(view.container.querySelectorAll(targetSelector)).toHaveLength(1);
    for (let attempt = 0; attempt < 2; attempt += 1) {
      await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));
      expect(view.container.querySelector(targetSelector)).toBeNull();
      const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
      if (repair === null) throw new Error('selected repair banner is missing');
      await view.user.click(within(repair).getByRole('button'));
      const repairedPicker = view.container.querySelector<HTMLButtonElement>(targetSelector);
      await waitFor(() => expect(document.activeElement).toBe(repairedPicker));
      expect(repairedPicker?.getAttribute('data-selected-finding')).toBe('true');
      expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
        'true',
      );
      expect(
        Array.from(
          view.container.querySelectorAll('[data-workspace-node][data-selected="true"]'),
        ).map((node) => node.getAttribute('data-workspace-node')),
      ).toEqual([destination.selectedRailKey]);
    }
    expect(application.store.getState().projectWorkspace.history!.present).toBe(project);
  });
  it('keeps route identity, document history, and project information in the header', async () => {
    const { user } = renderPlannerForInteraction();

    expect(document.querySelector('.app-route-identity')?.textContent).toBe('Underworld');
    expect(screen.queryByRole('navigation', { name: 'Planner sections' })).toBeNull();
    expect(screen.getByRole('group', { name: 'Project history' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'About' }));

    const about = await screen.findByRole('dialog', { name: 'About Run Planner' });
    expect(within(about).getByText('Schema')).toBeTruthy();
    expect(within(about).getByText('Catalog')).toBeTruthy();
    expect(within(about).queryByText('MIT')).toBeNull();
    expect(within(about).getByRole('heading', { name: 'Keyboard shortcuts' })).toBeTruthy();
    expect(within(about).getByText('App scale', { selector: 'dt' })).toBeTruthy();
    expect(within(about).getByText('Reset scale', { selector: 'dt' })).toBeTruthy();
    expect(within(about).getAllByText('Ctrl/Cmd', { selector: 'kbd' })).toHaveLength(4);
    expect(within(about).queryByText('Rooms')).toBeNull();
    expect(screen.getByRole('button', { name: 'Loadout' })).toBeTruthy();
  });

  it('requires an explicit game profile and plan slot before publishing', async () => {
    const publications: { targetId: string; slotNumber: number; json: string }[] = [];
    const gamePlanPublisher: GamePlanPublisher = {
      discoverProfiles: () =>
        Promise.resolve({
          status: 'available',
          targets: [
            { id: 'profile-a', label: 'Profile A', moduleVersion: '0.0.1' },
            { id: 'profile-b', label: 'Profile B', moduleVersion: '0.0.1' },
          ],
          message: 'Choose a profile.',
        }),
      publish: (targetId, slotNumber, json) => {
        publications.push({ targetId, slotNumber, json });
        return Promise.resolve({ status: 'published', message: 'Published.' });
      },
    };
    const application = createApplication({ gamePlanPublisher });
    const project = createCompleteFGProject();
    application.store.dispatch(
      authoredProjectReplaced({
        ...project,
        route: { ...project.route, biomes: project.route.biomes.slice(0, 1) },
      }),
    );
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Publish to Game…' }));
    const publicationDialog = await screen.findByRole('dialog', { name: 'Publish to game' });
    expect(publications).toHaveLength(0);
    expect(document.querySelector('.project-file-actions')?.contains(publicationDialog)).toBe(
      false,
    );
    expect(within(publicationDialog).getByLabelText('Profile')).toBeTruthy();
    expect(within(publicationDialog).getByLabelText('Slot')).toBeTruthy();
    expect(within(publicationDialog).getByRole('button', { name: /^Publish$/ })).toHaveProperty(
      'disabled',
      true,
    );

    await user.click(screen.getByRole('button', { name: /^Cancel$/ }));
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Publish to Game…' }));
    expect((screen.getByLabelText('Profile') as HTMLSelectElement).value).toBe('');
    expect((screen.getByLabelText('Slot') as HTMLSelectElement).value).toBe('');

    await user.selectOptions(screen.getByLabelText('Profile'), 'profile-b');
    await user.selectOptions(screen.getByLabelText('Slot'), '3');
    await user.click(screen.getByRole('button', { name: /^Publish$/ }));

    expect(publications).toHaveLength(1);
    expect(publications[0]).toMatchObject({ targetId: 'profile-b', slotNumber: 3 });
    expect(screen.getByText('Published to game profile profile-b, Slot 3.')).toBeTruthy();
  });

  it('preselects the only compatible profile without selecting a publication slot', async () => {
    const publications: { targetId: string; slotNumber: number; json: string }[] = [];
    const application = createApplication({
      gamePlanPublisher: {
        discoverProfiles: () =>
          Promise.resolve({
            status: 'available' as const,
            targets: [{ id: 'profile-a', label: 'Profile A', moduleVersion: '0.0.1' }],
            message: 'Choose a profile.',
          }),
        publish: (targetId, slotNumber, json) => {
          publications.push({ targetId, slotNumber, json });
          return Promise.resolve({ status: 'published' as const, message: 'Published.' });
        },
      },
    });
    const project = createCompleteFGProject();
    application.store.dispatch(
      authoredProjectReplaced({
        ...project,
        route: { ...project.route, biomes: project.route.biomes.slice(0, 1) },
      }),
    );
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Publish to Game…' }));

    expect((screen.getByLabelText('Profile') as HTMLSelectElement).value).toBe('profile-a');
    expect((screen.getByLabelText('Slot') as HTMLSelectElement).value).toBe('');
    expect(
      Array.from((screen.getByLabelText('Slot') as HTMLSelectElement).options).map(
        (option) => option.value,
      ),
    ).toEqual(['', '1', '2', '3', '4', '5', '6']);
    expect(publications).toHaveLength(0);
  });

  it('binds visible history controls to semantic project history', async () => {
    const { application, user } = renderPlannerForInteraction();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    expect(undo.classList.contains('quiet-action')).toBe(true);
    expect(redo.classList.contains('quiet-action')).toBe(true);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );

    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);

    await user.click(undo);

    expect(configuredBiomeCount(application)).toBe(0);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', false);

    await user.click(redo);

    expect(configuredBiomeCount(application)).toBe(1);
    expect(undo).toHaveProperty('disabled', false);
    expect(redo).toHaveProperty('disabled', true);
  });

  it('creates and edits the F start in Loadout with ordinary Undo and timeline repair', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );

    const beforeEntry = application.store.getState().projectWorkspace.history!;
    await user.click(screen.getByRole('button', { name: 'Starting room' }));
    await user.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      beforeEntry.past.length + 1,
    );
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history!.present).toBe(
      beforeEntry.present,
    );
    expect(screen.getByRole('button', { name: 'Starting room' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Redo' }));

    expect(application.store.getState().editorSession.activePanel).toEqual({ kind: 'overview' });
    expect(screen.getByLabelText('Start room configuration')).toBeTruthy();
    expect(screen.getByText('Room')).toBeTruthy();
    expect(screen.getByText('Reward')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Undo' })).not.toHaveProperty('disabled', true);
    const initial = application.store.getState().projectWorkspace.history!.present;
    const identity = () => screen.getByRole('region', { name: 'Start room configuration' });
    await user.click(within(identity()).getByRole('button', { name: 'Room' }));
    const alternative = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
    if (alternative === undefined) throw new Error('missing alternative opening');
    await user.click(alternative);
    expect(application.store.getState().editorSession.activePanel).toEqual({ kind: 'overview' });
    expect(application.store.getState().projectWorkspace.history!.present).not.toEqual(initial);
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history!.present).toEqual(initial);

    const repair = () => screen.getByRole('region', { name: 'Next repair' });
    await user.click(within(repair()).getByRole('button'));
    expect(application.store.getState().editorSession.activePanel).toEqual({ kind: 'overview' });
    expect(within(identity()).getByLabelText('Reward').getAttribute('data-selected-finding')).toBe(
      'true',
    );

    await user.click(within(identity()).getByLabelText('Reward'));
    await user.click(within(await screen.findByRole('listbox')).getByText('Hammer'));
    expect(application.store.getState().editorSession.activePanel).toEqual({ kind: 'overview' });
    expect(
      application.store.getState().projectWorkspace.history!.present.route.biomes[0]?.topology
        ?.occurrences[0]?.state,
    ).toMatchObject({
      kind: 'counted',
      reward: { offer: { rewardType: 'WeaponUpgrade' } },
    });
    await user.click(within(repair()).getByRole('button'));
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
    expect(screen.queryByRole('region', { name: 'Start room configuration' })).toBeNull();
    const timeline = screen.getByRole('tabpanel', { name: 'Room Timeline' });
    expect(
      within(timeline).getByRole('button', { name: 'Choose Trait; trait is not selected' }),
    ).toBeTruthy();
    expect(timeline.querySelector('[data-selected-finding="true"]')).not.toBeNull();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history!.present).toEqual(initial);
  });

  it('keeps relocated opening controls locked behind incomplete loadout results', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'Starting room' }));
    await user.click(within(screen.getByRole('listbox')).getAllByRole('option')[0]!);
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceStartingKeepsake',
          keepsakeKey: 'HadesAndPersephoneKeepsake',
          selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
        }),
      ),
    );
    const identity = screen.getByRole('region', { name: 'Start room configuration' });
    const before = application.store.getState().projectWorkspace.history;
    for (const name of ['Room', 'Reward']) {
      const control = within(identity).getByRole('button', { name });
      expect(control).toHaveProperty('disabled', true);
      await user.click(control);
      await user.click(within(identity).getByText(name, { selector: 'label' }));
    }
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(application.store.getState().projectWorkspace.history).toBe(before);
  });

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z', shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { metaKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { key: 'z', metaKey: true, shiftKey: true })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'z' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(0);

    expect(fireEvent.keyDown(window, { ctrlKey: true, key: 'y' })).toBe(false);
    expect(configuredBiomeCount(application)).toBe(1);
  });

  it('leaves native text and content-editable undo behavior untouched', async () => {
    const { application, user } = renderPlannerForInteraction({
      companion: (
        <>
          <input aria-label="Text draft" defaultValue="Draft" />
          <div
            aria-label="Notes draft"
            contentEditable
            role="textbox"
            suppressContentEditableWarning
          >
            Notes
          </div>
        </>
      ),
    });
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );

    const input = screen.getByRole('textbox', { name: 'Text draft' });
    expect(fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);

    const editable = screen.getByRole('textbox', { name: 'Notes draft' });
    expect(fireEvent.keyDown(editable, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(1);
  });

  it('keeps navigation outside authored history', async () => {
    const { application, user } = renderPlannerForInteraction({ startWithProject: false });

    await user.click(screen.getByRole('button', { name: 'Surface' }));

    expect(application.store.getState().editorSession.activeSection).toBe('route');
    expect(application.store.getState().projectWorkspace.kind).toBe('openProject');
    expect(application.store.getState().projectWorkspace.history?.present.route.routeKey).toBe(
      'Surface',
    );
    expect(application.store.getState().projectWorkspace.history!.past).toEqual([]);
  });

  it('activates the selected route and configured-biome navigation from the keyboard', async () => {
    const { application, user } = renderPlannerForInteraction({ startWithProject: false });

    const underworld = screen.getByRole('button', { name: 'Underworld' });
    underworld.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().projectWorkspace.history?.present.route.routeKey).toBe(
      'Underworld',
    );
    expect(document.querySelector('.app-route-identity')?.textContent).toBe('Underworld');
    expect(screen.getByRole('button', { name: 'Loadout' }).getAttribute('aria-current')).toBe(
      'page',
    );
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '4',
      }),
    );

    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    oceanus.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'G',
    });
    expect(oceanus.getAttribute('aria-current')).toBe('page');

    const tartarus = screen.getByRole('button', { name: 'Tartarus' });
    tartarus.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'I',
    });
    expect(tartarus.getAttribute('aria-current')).toBe('page');

    const route = screen.getByRole('button', { name: 'Loadout' });
    route.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'overview',
    });
    expect(route.getAttribute('aria-current')).toBe('page');
  });

  it('opens an NPC index row at its exact room phase without authoring history', async () => {
    const { phase, project } = projectWithArtemisInErebus();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'NPCs' }));
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history!;
    const npcEntry = screen.getByRole('button', {
      name: 'Inspect Artemis combat in Erebus · Encounter',
    });
    npcEntry.focus();
    await view.user.keyboard('{Enter}');

    expect(application.store.getState().editorSession).toMatchObject({
      activeSection: 'route',
      focusedSemanticOwner: phase,
      selectedFinding: null,
    });
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().projectWorkspace.history!).toBe(historyBeforeNavigation);
    const encounter = screen.getByRole('button', { name: 'Encounter' });
    expect(encounter.textContent).toContain('Artemis combat');
    await waitFor(() => expect(document.activeElement).toBe(encounter));

    const traitAddress = createTraitOfferAddress(phase, 'selection');
    const roomActions = screen.getByRole('region', { name: 'Room Timeline' });
    const traitLauncher = within(roomActions).getByRole('button', { name: /Edit Trait/ });
    expect(traitLauncher.getAttribute('data-trait-status')).toBe('valid');
    await view.user.click(traitLauncher);
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe('Artemis');
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(traitAddress);
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.get(semanticAddressKey(traitAddress)),
    ).toBeDefined();

    const selectedOption = within(dialog).getAllByLabelText('Selected')[1];
    if (selectedOption === undefined) throw new Error('Artemis option 2 selected radio is missing');
    await view.user.click(selectedOption);
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    const historyBeforeSave = application.store.getState().projectWorkspace.history!;
    await view.user.click(save);

    const savedInteraction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (savedInteraction?.value?.kind !== 'traits')
      throw new Error('saved Artemis offer must contain traits');
    expect(savedInteraction.value.selectedOptionKey).toBe('option2');
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBeforeSave.past.length + 1,
    );

    await view.user.click(within(roomActions).getByRole('button', { name: /Edit Trait/ }));
    const completedDialog = await screen.findByRole('dialog');
    await view.user.click(
      within(completedDialog).getByRole('button', { name: 'Reset to unresolved' }),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.get(semanticAddressKey(traitAddress))?.value,
    ).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    const restoredInteraction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (restoredInteraction?.value?.kind !== 'traits') {
      throw new Error('restored Artemis offer must contain traits');
    }
    expect(restoredInteraction.value.selectedOptionKey).toBe('option2');
  });

  it('keeps a Hub main-visit trait editor on its occurrence Timeline after dismissal', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'biome', biomeKey: 'N' } }),
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const n = workspace.route.biomes.find((biome) => biome.biomeKey === 'N');
    const hub = n?.rail.find(
      (entry): entry is Extract<(typeof n.rail)[number], { readonly kind: 'hubGroup' }> =>
        entry.kind === 'hubGroup',
    );
    const visit = hub?.visits.find((candidate) =>
      candidate.node.room.rewardControls.some((control) =>
        control.traitOffers?.some((trait) => trait.address.owner.kind === 'incomingReward'),
      ),
    );
    if (hub === undefined || visit === undefined) {
      throw new Error('N Hub main visit with an incoming-reward trait is missing');
    }
    const trait = visit.node.room.rewardControls
      .flatMap((control) => control.traitOffers ?? [])
      .find((candidate) => candidate.address.owner.kind === 'incomingReward');
    if (trait === undefined) throw new Error('N Hub main-visit trait control is missing');

    const view = renderPlannerForInteraction({ application });
    const hubRailButton = view.container.querySelector<HTMLButtonElement>(
      '[data-kind="hubDecision"] > button',
    );
    if (hubRailButton === null) throw new Error('N Hub rail button is missing');
    await view.user.click(hubRailButton);
    await view.user.click(
      screen.getByRole('button', {
        name: new RegExp(`^Visit ${visit.visitIndex} · ${visit.node.room.label}`),
      }),
    );
    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    const mainOccurrence = visit.node.room.marker.address;
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(mainOccurrence);
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const traitLauncher = document.getElementById(
      `trait-launcher-${semanticAddressKey(trait.address)}`,
    );
    if (!(traitLauncher instanceof HTMLButtonElement)) {
      throw new Error('N Hub main-visit trait launcher is missing from its Timeline');
    }
    expect(actions.contains(traitLauncher)).toBe(true);
    await view.user.click(traitLauncher);
    const dialog = await screen.findByRole('dialog');
    await view.user.click(within(dialog).getByRole('button', { name: 'Close trait offer' }));

    expect(screen.queryByRole('dialog')).toBeNull();
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(trait.address);
    expect(
      screen.getByRole('heading', { level: 3, name: `Entering ${visit.node.room.label}` }),
    ).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Room Timeline' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const selectedVisitRail = Array.from(
      view.container.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === visit.marker.focusKey);
    expect(selectedVisitRail?.dataset.selected).toBe('true');
  });

  it('navigates a resource index row to its exact selected room without authoring history', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(loadSurfaceNResourcesProject()));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Surface', panel: { kind: 'resources' } }),
    );
    const view = renderPlannerForInteraction({ application });
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history!;

    const miningRow = screen.getByText('Mining').closest('li');
    if (miningRow === null) throw new Error('Mining resource row is missing');
    await view.user.click(within(miningRow).getByRole('button', { name: 'Inspect placement' }));

    expect(application.store.getState().editorSession).toMatchObject({
      activeSection: 'route',
      focusedSemanticOwner: createOccurrenceAddress(
        { kind: 'biome', routeKey: 'Surface', biomeKey: 'N' },
        createOccurrenceId('surface-n-opening'),
      ),
    });
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'N',
    });
    expect(application.store.getState().projectWorkspace.history!).toBe(historyBeforeNavigation);
  });

  it('authors and undoes the exact Sea Star checkbox row in the room timeline', async () => {
    const { project, target, targetAcquisition, targetReward } = seaStarRewardFixture();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    application.store.dispatch(
      routePanelSelected({
        routeKey: 'Underworld',
        panel: { kind: 'biome', biomeKey: 'F' },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(targetAcquisition));
    const conversion = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.acquisitionConversions.get(semanticAddressKey(targetAcquisition));
    if (conversion === undefined)
      throw new Error(
        `Sea Star target conversion is absent: ${application.store
          .getState()
          .projectWorkspace.assembly!.evaluation.findings.map((finding) => finding.code)
          .join(', ')}`,
      );
    expect(conversion.seaStarSupported).toBe(true);
    const view = renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Sea Star procced for Reward',
    });
    expect(checkbox).toHaveProperty('checked', false);
    const historyBefore = application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(checkbox);

    await waitFor(() => expect(checkbox).toHaveProperty('checked', true));
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    const siteKey = seaStarDuplicateSiteKey(targetAcquisition);
    const child = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenFBiome, target), siteKey),
      'seaStarDuplicate',
    );
    const childDestination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(child))!;
    const childTarget = () =>
      document.getElementById(semanticOwnerControlElementId(childDestination.focusAddress));
    await waitFor(() => expect(childTarget()).not.toBeNull());
    const childRow = childTarget()?.closest('[data-room-action-key]');
    expect(childDestination.focusAddress.kind).toBe('roomAction');
    if (childDestination.focusAddress.kind !== 'roomAction') {
      throw new Error('Sea Star duplicate does not focus its room action');
    }
    expect(childRow?.getAttribute('data-room-action-key')).toBe(
      childDestination.focusAddress.actionKey,
    );
    expect(childRow?.textContent).toContain('Interact Gold');
    expect(
      application.store
        .getState()
        .projectWorkspace.history!.present.route!.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === target,
        )?.acquisitionSites?.[siteKey]?.pickupEntries?.seaStarDuplicate?.offer,
    ).toEqual({ rewardType: 'RoomMoneyDrop' });

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(checkbox).toHaveProperty('checked', false));
    expect(childTarget()).toBeNull();
    expect(
      application.store
        .getState()
        .projectWorkspace.history!.present.route!.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === target,
        )?.acquisitionSites?.[siteKey],
    ).toBeUndefined();
    expect(semanticAddressKey(targetReward)).toBe(semanticAddressKey(targetAcquisition.owner));
  });

  it('authors, freezes, undoes, and redoes an optional Concave Stone result through its offer command', async () => {
    const project = concaveStoneTraitFixture();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'F' } }),
    );
    const beforeOpen = [
      ...application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.values(),
    ]
      .flatMap((interaction) => {
        const value = interaction.value;
        if (value?.kind !== 'traits') return [];
        return [
          {
            interaction,
            value,
            stone: interaction
              .optionDomain(value, value.selectedOptionKey)
              .children.find(
                (
                  child,
                ): child is Extract<
                  typeof child,
                  { readonly child: { readonly kind: 'concaveStone' } }
                > => child.child.kind === 'concaveStone',
              ),
          },
        ];
      })
      .find(({ stone, value }) => stone?.forOffer(value).load() !== undefined);
    if (beforeOpen === undefined) throw new Error('Concave Stone domain is absent');
    const target = beforeOpen.stone!.child.address;
    application.store.dispatch(traitOfferDialogOpened(target));
    const view = renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', { name: 'Concave Stone Activated' });
    expect(checkbox).toHaveProperty('checked', false);
    expect(checkbox).toHaveProperty('disabled', false);
    const historyBefore = application.store.getState().projectWorkspace.history!.past.length;

    await view.user.click(checkbox);

    await waitFor(() => expect(checkbox).toHaveProperty('checked', true));
    expect(screen.getByRole('button', { name: 'Concave Stone target' }).textContent).toBeTruthy();
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(historyBefore);
    await view.user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    const persisted = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(target))?.value;
    expect(persisted).toMatchObject({
      kind: 'traits',
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    });
    expect(application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );

    application.store.dispatch(traitOfferDialogOpened(target));
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Concave Stone Activated' })).toHaveProperty(
        'checked',
        false,
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.get(semanticAddressKey(target))?.value,
    ).toMatchObject({ concaveStoneResult: { kind: 'noProc' } });

    await view.user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Concave Stone Activated' })).toHaveProperty(
        'checked',
        true,
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .interactions.traitOffers.get(semanticAddressKey(target))?.value,
    ).toMatchObject({ concaveStoneResult: { kind: 'proc', optionKey: 'option2' } });
  });

  it('keeps a stale later Concave Stone result visible and clears it through the real store', async () => {
    const { project, target } = staleConcaveStoneTraitFixture();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'F' } }),
    );
    application.store.dispatch(traitOfferDialogOpened(target));
    const view = renderPlannerForInteraction({ application });

    expect(await screen.findByRole('checkbox', { name: 'Concave Stone Activated' })).toHaveProperty(
      'checked',
      true,
    );
    expect(
      await screen.findByRole('button', { name: 'Clear unavailable Concave Stone result' }),
    ).toBeTruthy();
    expect(
      application.store.getState().projectWorkspace.assembly!.evaluation.findings,
    ).toContainEqual(
      expect.objectContaining({ code: 'concaveStoneResultUnavailable', origin: target }),
    );

    await view.user.click(
      screen.getByRole('button', { name: 'Clear unavailable Concave Stone result' }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Save trait offer' }));
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())!
          .interactions.traitOffers.get(semanticAddressKey(target))?.value,
      ).not.toMatchObject({ concaveStoneResult: expect.anything() }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())!
          .interactions.traitOffers.get(semanticAddressKey(target))?.value,
      ).toMatchObject({ concaveStoneResult: { kind: 'proc', optionKey: 'option2' } }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())!
          .interactions.traitOffers.get(semanticAddressKey(target))?.value,
      ).not.toMatchObject({ concaveStoneResult: expect.anything() }),
    );
  });

  it('renders a same-screen Heroic Concave Stone proc as forced while retaining its frozen residual picker', async () => {
    const { project, target } = heroicConcaveStoneTraitFixture();
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    application.store.dispatch(
      routePanelSelected({ routeKey: 'Underworld', panel: { kind: 'biome', biomeKey: 'F' } }),
    );
    const interaction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (interaction?.value?.kind !== 'traits') throw new Error('Heroic Stone offer is absent');
    const domain = interaction
      .optionDomain(interaction.value, interaction.value.selectedOptionKey)
      .children.find(
        (
          child,
        ): child is Extract<typeof child, { readonly child: { readonly kind: 'concaveStone' } }> =>
          child.child.kind === 'concaveStone',
      )
      ?.forOffer(interaction.value)
      .load();
    expect(domain).toMatchObject({ required: true, procSupport: 100 });
    application.store.dispatch(traitOfferDialogOpened(target));
    renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', { name: 'Concave Stone Activated' });
    expect(checkbox).toHaveProperty('checked', true);
    expect(checkbox).toHaveProperty('disabled', true);
    expect(screen.getByText('Concave Stone · Chance: 100%')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Concave Stone target' })).toBeTruthy();
  });

  it('hands a route trait row through exact biome navigation and restores focus on Escape', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = screen.getAllByRole('button', { name: /Edit Trait/ })[0];
    if (launcher === undefined) throw new Error('route trait launcher is missing');
    launcher.focus();
    await view.user.keyboard('{Enter}');

    const session = application.store.getState().editorSession;
    if (session.focusedSemanticOwner?.kind !== 'traitOffer') {
      throw new Error('route trait navigation did not retain the exact trait owner');
    }
    expect(session.traitDialogTarget).toEqual(session.focusedSemanticOwner);
    expect(session.activePanel).toEqual({
      kind: 'biome',
      biomeKey: session.focusedSemanticOwner.biomeKey,
    });
    const dialog = await screen.findByRole('dialog');
    expect(dialog).toBeTruthy();
    expect(dialog.tagName).toBe('DIALOG');
    const appHeader = document.querySelector('.app-header');
    expect(appHeader).not.toBeNull();
    expect((appHeader as HTMLElement & { inert: boolean }).inert).toBe(true);

    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.id).toBe(launcher.id);
  });

  it('lets an open trait picker consume Escape before dismissing its dialog draft', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = screen.getAllByRole('button', { name: /Edit Trait/ })[0];
    if (launcher === undefined) throw new Error('route trait launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    const selected = within(dialog).getAllByLabelText('Selected')[1];
    if (selected === undefined) throw new Error('option 2 selected radio is missing');
    await view.user.click(selected);
    const traitPicker = within(dialog).getByLabelText('option1 trait');
    await view.user.click(traitPicker);
    expect(screen.getAllByRole('combobox').length).toBeGreaterThan(0);

    await view.user.keyboard('{Escape}');
    expect(screen.getByRole('dialog')).toBe(dialog);
    expect(document.activeElement).toBe(traitPicker);
    expect(selected).toHaveProperty('checked', true);

    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.activeElement?.id).toBe(launcher.id);
  });

  it('resets an open trait editor across parent replacement and undo', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState())!;
    const traitInteraction = [...initialWorkspace.interactions.traitOffers.values()].find(
      (candidate) => {
        if (
          candidate.owner.owner.kind !== 'incomingReward' ||
          candidate.owner.owner.occurrenceId.includes('start')
        )
          return false;
        const reward = initialWorkspace.interactions.rewards.get(
          semanticAddressKey(candidate.owner.owner),
        );
        return reward?.authoredRewardTypes.includes('Boon') ?? false;
      },
    );
    if (traitInteraction === undefined) throw new Error('incoming trait editor fixture is missing');
    const target = traitInteraction.owner;
    if (target.owner.kind !== 'incomingReward') throw new Error('incoming trait owner is missing');
    const initialValue = traitInteraction.value;
    if (initialValue?.kind !== 'traits')
      throw new Error('incoming trait fixture must offer traits');
    const replacementSource = traitInteraction.giver.key === 'Ares' ? 'ZeusUpgrade' : 'AresUpgrade';
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const launcher = document.getElementById(`trait-launcher-${semanticAddressKey(target)}`);
    if (launcher === null) throw new Error('trait editor launcher is missing');
    await view.user.click(launcher);
    const dialog = await screen.findByRole('dialog');
    const traitTrigger = within(dialog).getByLabelText('option1 trait');
    expect(traitTrigger.textContent).toContain(
      application.catalog.traits.byKey[initialValue.options[0]?.traitKey ?? '']?.label,
    );

    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceIncomingReward',
        reward: target.owner,
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: replacementSource },
        },
      }),
    );
    const replacement = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (replacement === undefined) throw new Error('replacement trait interaction is missing');
    expect(replacement.value).toBeNull();
    const replacementValue = replacement.traitOfferStartingOutcome?.();
    if (replacementValue?.kind !== 'traits')
      throw new Error('replacement trait interaction must provide a transient traits draft');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('option1 trait').textContent).toContain(
        application.catalog.traits.byKey[replacementValue.options[0]?.traitKey ?? '']?.label,
      ),
    );
    expect(replacement.value).not.toEqual(initialValue);
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      replacement.giver.label,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    const restored = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (restored === undefined) throw new Error('restored trait interaction is missing');
    const restoredValue = restored.value;
    if (restoredValue?.kind !== 'traits')
      throw new Error('restored trait interaction must offer traits');
    await waitFor(() =>
      expect(within(dialog).getByLabelText('option1 trait').textContent).toContain(
        application.catalog.traits.byKey[restoredValue.options[0]?.traitKey ?? '']?.label,
      ),
    );
    expect(restored.value).toEqual(initialValue);
    expect(within(dialog).getByRole('heading', { level: 2 }).textContent).toBe(
      restored.giver.label,
    );
  });

  it('routes an unresolved SpellDrop finding through its pickup action', async () => {
    const application = createApplication();
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const selected = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    const raw = JSON.parse(encodeProjectDocument(selected)) as {
      route: {
        routeKey: string;
        biomes: Array<{
          biomeKey: string;
          topology: {
            occurrences: Array<{
              occurrenceId: string;
              state: { reward?: { traitOffersByAcquisitionRole?: { self?: unknown } } };
            }>;
          } | null;
        }>;
      };
    };
    const rawOccurrence = raw.route.biomes
      .find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    if (rawOccurrence?.state.reward?.traitOffersByAcquisitionRole === undefined) {
      throw new Error('SpellDrop fixture has no self child to unset');
    }
    rawOccurrence.state.reward.traitOffersByAcquisitionRole.self = null;
    application.store.dispatch(authoredProjectReplaced(decodeProjectDocument(raw, catalog)));
    const target = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(target),
      );
    if (finding === undefined) throw new Error('reached SpellDrop missing finding is absent');
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (issue === undefined || semanticAddressKey(issue.owner) !== semanticAddressKey(target)) {
      throw new Error('SpellDrop must be the selected assessment issue');
    }
    const view = renderPlannerForInteraction({ application });
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('next repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const destination = workspace.focusByOwner.get(semanticAddressKey(target));
    if (destination === undefined) throw new Error('SpellDrop destination is missing');
    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    expect(destination).toMatchObject({
      ownerAddress: target,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      destination.focusAddress,
    );
    expect(destination.selectedRailKey).toBeDefined();
    expect(
      [...document.querySelectorAll('.biome-rail-node[data-selected="true"]')].map((node) =>
        node.getAttribute('data-workspace-node'),
      ),
    ).toEqual([destination.selectedRailKey]);
    expect(screen.queryByRole('dialog')).toBeNull();
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('SpellDrop pickup action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit Spell/ }));
    expect(await screen.findByRole('dialog')).toBeTruthy();
  });

  it('keeps Selene-dormant SpellDrop children out of findings, markers, destinations, and interactions', () => {
    const application = createApplication();
    const occurrenceId = goldenFOccurrenceId(10, 2);
    let project = applyProjectCommand(createGoldenFGHProject(), catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRouteLoadout',
      route: { kind: 'route', routeKey: 'Underworld' },
      weaponKey: 'WeaponSuit',
      aspectKey: 'SuitHexAspect',
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const target = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.filter(
          (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(target),
        ),
    ).toEqual([]);
    expect(workspace.interactions.traitOffers.has(semanticAddressKey(target))).toBe(false);
    expect(workspace.focusByOwner.has(semanticAddressKey(target))).toBe(false);
    application.dispose();
  });

  it('routes a reached-invalid trait finding through its pickup action', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceRouteLoadout',
        route: { kind: 'route', routeKey: 'Underworld' },
        weaponKey: 'WeaponDagger',
        aspectKey: 'DaggerBackstabAspect',
      }),
    );
    const invalid = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (finding) => finding.origin.kind === 'traitOffer',
      );
    if (invalid === undefined) throw new Error('invalid reached Hammer finding is missing');
    const view = renderPlannerForInteraction({ application });
    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(invalid.origin));
    if (destination === undefined) throw new Error('invalid Hammer destination is missing');
    if (destination.routeKey === undefined || destination.biomeKey === undefined) {
      throw new Error('invalid Hammer destination has no biome panel');
    }
    application.store.dispatch(
      routePanelSelected({
        routeKey: destination.routeKey,
        panel: { kind: 'biome', biomeKey: destination.biomeKey },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(destination.focusAddress));
    expect(destination).toMatchObject({
      ownerAddress: invalid.origin,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(
        document.getElementById(semanticOwnerControlElementId(destination.focusAddress)),
      ).toBeTruthy(),
    );
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('invalid Hammer pickup action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit Trait/ }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getAllByText(/Hammer incompatible with loadout/).length).toBeGreaterThan(
      0,
    );
    expect(within(dialog).getByRole('status')).toBeTruthy();

    const interaction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.traitOffers.get(semanticAddressKey(invalid.origin));
    if (interaction === undefined) throw new Error('invalid Hammer interaction is missing');
    const correctedTraitKeys = [
      'DaggerBlinkAoETrait',
      'DaggerSpecialJumpTrait',
      'DaggerSpecialLineTrait',
    ] as const;
    for (const [index, traitKey] of correctedTraitKeys.entries()) {
      await view.user.click(within(dialog).getByLabelText(`option${index + 1} trait`));
      const choice = screen
        .getAllByText(application.catalog.traits.byKey[traitKey]?.label ?? traitKey)
        .find((element) => element.closest('[cmdk-item]') !== null);
      if (choice === undefined) throw new Error(`Hammer picker has no ${traitKey} choice`);
      await view.user.click(choice);
    }
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    await view.user.click(save);
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.some(
          (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(invalid.origin),
        ),
    ).toBe(false);
  });

  it('opens an exact Gold payload at its Timeline pickup', async () => {
    const application = createApplication();
    const shop = createOccurrenceAddress(
      { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
      createOccurrenceId('golden-h-preboss-shop'),
    );
    const site = createAcquisitionSiteAddress(shop, 'roomExit');
    const gold = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
    application.store.dispatch(authoredProjectReplaced(createEchoGoldHPrebossProject()));
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(
          { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
          shop.occurrenceId,
          'Minor',
        ),
        purchased: true,
      }),
    );
    const derived = derivedAcquisitionEntriesForProjectEvaluationAssembly(
      application.store.getState().projectWorkspace.assembly!,
      site,
    ).find((entry) => entry.kind === 'echoDoubleShopReward');
    if (derived?.sourceOfferKey === undefined) throw new Error('Gold source offer is missing');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'PlaceEchoGoldPickup',
        site,
        entryKey: 'echoDoubleShopReward',
        sourceOfferKey: derived.sourceOfferKey,
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceAcquisitionEntryOffer',
        entry: gold,
        value: { rewardType: 'MaxHealthDrop' },
      }),
    );
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'shopPurchaseUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(gold),
      );
    if (finding === undefined) throw new Error('exact Gold payload finding is missing');

    const view = renderPlannerForInteraction({ application });
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (issue === undefined || semanticAddressKey(issue.owner) !== semanticAddressKey(gold)) {
      throw new Error('Gold payload must be the selected assessment issue');
    }
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await view.user.click(within(repair).getByRole('button'));

    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(gold))!;
    await waitFor(() =>
      expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
        destination.focusAddress,
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())!
        .focusByOwner.get(semanticAddressKey(gold)),
    ).toMatchObject({ ownerAddress: gold, biomeKey: 'H' });
    const actionRow = document.getElementById(
      semanticOwnerControlElementId(destination.focusAddress),
    );
    expect(actionRow?.getAttribute('data-has-findings')).toBe('true');
    expect(document.activeElement).toBe(actionRow);
    expect(actionRow?.closest('li')?.textContent).toContain('Gold Gold Gold');
    expect(actionRow?.hasAttribute('aria-description')).toBe(true);
  });

  it('opens an All Together editor through semantic focus on its visible Timeline trait action', async () => {
    const { application, project, set, target } = allTogetherFindingFixture();
    application.store.dispatch(authoredProjectReplaced(project));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'allTogetherResultUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(set),
      );
    if (finding === undefined) throw new Error('All Together set finding is missing');
    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(set));
    if (destination === undefined) throw new Error('All Together set destination is missing');
    expect(destination).not.toHaveProperty('traitDialogTarget');
    application.store.dispatch(semanticOwnerNavigated(set));
    const view = renderPlannerForInteraction({ application });

    await waitFor(() =>
      expect(
        document.getElementById(semanticOwnerControlElementId(destination.focusAddress)),
      ).toBeTruthy(),
    );
    const actionRow = document.getElementById(
      semanticOwnerControlElementId(destination.focusAddress),
    );
    expect(actionRow?.getAttribute('data-has-findings')).toBe('true');
    const traitLauncher = within(actionRow!).getByRole('button', { name: /Trait/ });
    await view.user.click(traitLauncher);

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('button', { name: /^Earth:/ })).toBeTruthy();
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(target);
  });

  it('keeps an invalid All Together offer visible on its occurrence Timeline before navigation', async () => {
    const { application, occurrence, project } = allTogetherFindingFixture();
    application.store.dispatch(authoredProjectReplaced(project));
    application.store.dispatch(semanticOwnerNavigated(occurrence));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('tab', { name: 'Room Timeline' }));

    const timeline = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(timeline).getByRole('button', { name: /Trait/ })).toBeTruthy();
  });

  it('routes a targeted-acquisition finding through its pickup action', async () => {
    const application = createApplication();
    let project = createCompleteFGProject();
    let target: ReturnType<typeof createTraitOfferAddress> | undefined;
    let optionKey: 'option1' | 'option2' | 'option3' | undefined;
    for (const [occurrenceId, giverKey, source, traitKey] of [
      [goldenFOccurrenceId(2, 1), 'Apollo', 'ApolloUpgrade', 'ApolloCastBoon'],
      [goldenFOccurrenceId(6, 1), 'Hera', 'HeraUpgrade', 'BoonDecayBoon'],
    ] as const) {
      const reward = createIncomingRewardAddress(goldenFBiome, occurrenceId);
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceIncomingReward',
        reward,
        value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source } },
      });
      project = authorLegalTraitOffers(project);
      project = prepareLegalPomTraitOffers(project).project;
      const trace = reachedTraitOffers(project).find(
        (candidate) =>
          semanticAddressKey(candidate.address.owner) === semanticAddressKey(reward) &&
          candidate.acquisitionRole === 'source',
      );
      if (trace === undefined) throw new Error(`missing reached ${traitKey} offer`);
      const value =
        traitKey === 'BoonDecayBoon'
          ? ({
              kind: 'traits',
              giverKey: 'Hera',
              options: [
                { traitKey: 'BoonDecayBoon', rarity: 'Common' },
                { traitKey: 'HeraSpecialBoon', rarity: 'Common' },
                { traitKey: 'HeraSprintBoon', rarity: 'Common' },
              ],
              selectedOptionKey: 'option1',
            } as const)
          : supportedTraitOffer(project, trace.address, giverKey, traitKey);
      if (value === undefined || value.kind !== 'traits')
        throw new Error(`missing authored ${traitKey} offer`);
      const authored =
        traitKey !== 'BoonDecayBoon'
          ? value
          : Object.freeze({
              ...value,
              options: Object.freeze(
                value.options.map((option) =>
                  option.traitKey === 'BoonDecayBoon'
                    ? Object.freeze({
                        traitKey: option.traitKey,
                        ...(option.rarity === undefined ? {} : { rarity: option.rarity }),
                      })
                    : option,
                ),
              ) as typeof value.options,
            });
      project = applyProjectCommand(project, application.catalog, {
        kind: 'ReplaceTraitOffer',
        trait: trace.address,
        value: authored,
      });
      if (traitKey === 'BoonDecayBoon') {
        target = trace.address;
        optionKey = authored.selectedOptionKey;
      }
    }
    if (target === undefined || optionKey === undefined)
      throw new Error('targeted acquisition fixture was not prepared');
    const child = createTraitAcquisitionTargetAddress(target, optionKey);
    application.store.dispatch(authoredProjectReplaced(project));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'targetedAcquisitionTargetMissing' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(child),
      );
    if (finding === undefined) throw new Error('targeted acquisition child finding is missing');
    const view = renderPlannerForInteraction({ application });
    application.store.dispatch(semanticOwnerNavigated(child));

    const destination = application
      .selectStructuredWorkspace(application.store.getState())!
      .focusByOwner.get(semanticAddressKey(child));
    if (destination === undefined) throw new Error('targeted acquisition destination is missing');
    expect(destination).toMatchObject({
      ownerAddress: child,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(screen.queryByRole('dialog')).toBeNull();
    await waitFor(() =>
      expect(
        document.getElementById(semanticOwnerControlElementId(destination.focusAddress)),
      ).toBeTruthy(),
    );
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('targeted acquisition action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit Trait/ }));
    const dialog = await screen.findByRole('dialog');
    const targetControl = within(dialog).getByLabelText(`${optionKey} acquisition target`);
    expect(targetControl).toBeTruthy();
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(target);
  });

  it('edits ordinary, room Hammer, and acquired Shop Hammer offers through shared controls', async () => {
    const application = createApplication();
    let project = loadSurfaceNOPQProject();
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat07', 4, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceShopOffer',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
      value: { rewardType: 'WeaponUpgradeDrop' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'MajorNonBoon'),
      purchased: true,
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));

    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    )!.interactions;
    const visibleLauncher = (
      kind: 'olympian' | 'hermes' | 'hammer',
      ownerKind?: string,
      requireVisible = true,
    ) => {
      const interaction = [...interactions.traitOffers.values()].find(
        (candidate) =>
          candidate.giver.providerKind === kind &&
          (ownerKind === undefined || candidate.owner.owner.kind === ownerKind) &&
          (!requireVisible ||
            document.getElementById(`trait-launcher-${semanticAddressKey(candidate.owner)}`) !==
              null),
      );
      if (interaction === undefined) throw new Error(`visible ${kind} trait launcher is missing`);
      return interaction;
    };

    const ordinary = visibleLauncher('olympian');
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(ordinary.owner)}`)!,
    );
    const ordinaryDialog = await screen.findByRole('dialog');
    expect(within(ordinaryDialog).getByLabelText('option1 rarity')).toBeTruthy();
    await view.user.click(
      within(ordinaryDialog).getByRole('button', { name: 'Close trait offer' }),
    );

    const roomHammer = visibleLauncher('hammer', 'incomingReward', false);
    application.store.dispatch(semanticOwnerNavigated(roomHammer.owner));
    const roomHammerDialog = await screen.findByRole('dialog');
    expect(within(roomHammerDialog).queryByLabelText('option1 rarity')).toBeNull();
    expect(within(roomHammerDialog).queryByText('Rarity', { selector: 'span' })).toBeNull();
    await view.user.click(
      within(roomHammerDialog).getByRole('button', { name: 'Close trait offer' }),
    );

    const shopHammer = visibleLauncher('hammer', 'shopOffer', false);
    application.store.dispatch(semanticOwnerNavigated(shopHammer.owner));
    const shopHammerDialog = await screen.findByRole('dialog');
    expect(within(shopHammerDialog).queryByLabelText('option1 rarity')).toBeNull();
  });

  it('edits a reached Hermes offer with the shared rarity-aware editor', async () => {
    const application = createApplication();
    let project = createCompleteFGProject({ prebossSource: 'G_Combat14' });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: goldenGOccurrenceId(7, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-free-2'),
      ),
      value: { rewardType: 'HermesUpgrade' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(
        goldenGBiome,
        createOccurrenceId('golden-g-preboss-free-3'),
      ),
      value: { rewardType: 'StackUpgrade' },
    });
    project = authorLegalTraitOffers(project);
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    )!.interactions;
    const hermes = interactions.traitOffers.get(
      semanticAddressKey(
        createTraitOfferAddress(
          createIncomingRewardAddress(goldenGBiome, createOccurrenceId('golden-g-preboss-free-2')),
          'self',
        ),
      ),
    );
    if (hermes === undefined) throw new Error('reached Hermes trait launcher is missing');
    application.store.dispatch(
      routePanelSelected({
        routeKey: hermes.owner.routeKey,
        panel: { kind: 'biome', biomeKey: hermes.owner.biomeKey },
      }),
    );
    application.store.dispatch(semanticOwnerFocused(hermes.owner));
    await waitFor(() =>
      expect(
        document.getElementById(`trait-launcher-${semanticAddressKey(hermes.owner)}`),
      ).not.toBeNull(),
    );
    await view.user.click(
      document.getElementById(`trait-launcher-${semanticAddressKey(hermes.owner)}`)!,
    );
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByLabelText('option1 rarity')).toBeTruthy();
  });

  it('keeps blocked biome pages visible and editable within the selected route', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '4',
      }),
    );
    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    expect(within(oceanus).getByTitle('Blocked')).toBeTruthy();
    expect(
      document
        .getElementById(oceanus.getAttribute('aria-describedby') ?? '')
        ?.getAttribute('aria-label'),
    ).toBe('Blocked');

    await user.click(oceanus);
    const blockedBanner = screen.getByText(
      'Finish and fix Erebus before Oceanus can be evaluated.',
    );
    expect(blockedBanner.getAttribute('role')).toBeNull();
    expect(blockedBanner.closest('.editor-panel')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.queryByRole('button', { name: 'Start biome' })).toBeNull();
    expect(
      application.store.getState().projectWorkspace.history!.present.route.biomes[1]?.topology
        ?.occurrences[0]?.gameName,
    ).toBe('G_Intro');

    // A project owns one route, so sibling-route pages are no longer
    // available to switch into from this workspace.
    expect(screen.queryByRole('button', { name: 'Surface' })).toBeNull();
  });
});

describe('route loadout interaction', () => {
  it('selects weapon then aspect atomically, with cancellable staging and ordinary Undo', async () => {
    const { application, user } = renderPlannerForInteraction();
    const before = application.store.getState().projectWorkspace.history!;
    const suit = application.catalog.weapons.byKey['WeaponSuit']!;
    const selene = application.catalog.aspects.byKey['SuitHexAspect']!;
    await user.click(screen.getByRole('button', { name: 'Starting weapon' }));
    await user.click(within(screen.getByRole('listbox')).getByText(suit.label));
    expect(application.store.getState().projectWorkspace.history).toBe(before);
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    expect(options).toHaveLength(suit.aspectKeys.length);
    for (const key of suit.aspectKeys) {
      expect(
        within(screen.getByRole('listbox')).getByText(
          application.catalog.aspects.byKey[key]!.label,
        ),
      ).toBeTruthy();
    }
    await user.keyboard('{Escape}');
    expect(application.store.getState().projectWorkspace.history).toBe(before);
    await user.click(screen.getByRole('button', { name: 'Starting weapon' }));
    await user.click(within(screen.getByRole('listbox')).getByText(suit.label));
    await user.click(within(screen.getByRole('listbox')).getByText(selene.label));
    expect(screen.queryByRole('listbox')).toBeNull();
    const after = application.store.getState().projectWorkspace.history!;
    expect(after.past).toHaveLength(before.past.length + 1);
    expect(after.present.route.loadout).toMatchObject({
      weaponKey: suit.key,
      aspectKey: selene.key,
    });
    expect(screen.getByRole('button', { name: 'Starting weapon' }).textContent).toContain(
      selene.label,
    );
    expect(screen.getByText('Hex talent layout')).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history!.present).toEqual(before.present);
  });

  it('opens and closes loadout dialogs without changing authorship, returning focus to their launchers', async () => {
    const { application, user } = renderPlannerForInteraction();
    const history = application.store.getState().projectWorkspace.history;
    for (const title of ['Arcana', 'Fear']) {
      const launcher = screen.getByRole('button', { name: `Edit ${title}` });
      await user.click(launcher);
      expect(screen.getByRole('dialog', { name: title })).toBeTruthy();
      expect(document.activeElement).toBe(screen.getByRole('button', { name: `Close ${title}` }));
      await user.keyboard('{Escape}');
      expect(screen.queryByRole('dialog')).toBeNull();
      expect(document.activeElement).toBe(launcher);
      await user.click(launcher);
      await user.click(screen.getByRole('button', { name: `Close ${title}` }));
      expect(document.activeElement).toBe(launcher);
    }
    expect(screen.getByRole('button', { name: 'Starting weapon' })).toBeTruthy();
    expect(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).toBeTruthy();
    expect(application.store.getState().projectWorkspace.history).toBe(history);
  });

  it('presents starting Grasp capacity and disables Arcana or Void choices that exceed it', async () => {
    const { user } = renderPlannerForInteraction();
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    const weapon = screen.getByRole('button', { name: 'Starting weapon' });
    expect(startingKeepsake.closest('.route-keepsake-controls')).toBeTruthy();
    expect(weapon.closest('.route-keepsake-controls')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Edit Arcana' }));
    const arcana = screen.getByRole('group', { name: 'Arcana, 0 active' });
    const artwork = Array.from(arcana.querySelectorAll('img'));
    expect(artwork).toHaveLength(catalog.arcanaCards.values.length);
    expect(new Set(artwork.map((image) => image.getAttribute('src'))).size).toBe(25);
    expect(artwork.every((image) => image.getAttribute('src')?.endsWith('.webp'))).toBe(true);
    for (const label of [
      'The Unseen',
      'Origination',
      'The Boatman',
      'Excellence',
      'Death',
      'The Champions',
      'The Huntress',
    ]) {
      await user.click(screen.getByRole('button', { name: label }));
    }

    expect(arcana.textContent).toContain('30 / 30 Grasp');
    expect(screen.getByRole('button', { name: 'The Sorceress' })).toHaveProperty('disabled', true);

    await user.click(screen.getByRole('button', { name: 'Close Arcana' }));
    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    const fear = screen.getByRole('group', { name: 'Fear, 0 total' });
    expect(
      Array.from(fear.querySelectorAll<HTMLElement>('.fear-rank-control')).map(
        (control) => control.dataset.fearVowKey,
      ),
    ).toEqual([
      'EnemyDamageShrineUpgrade',
      'EnemyHealthShrineUpgrade',
      'EnemyShieldShrineUpgrade',
      'EnemySpeedShrineUpgrade',
      'EnemyCountShrineUpgrade',
      'NextBiomeEnemyShrineUpgrade',
      'EnemyRespawnShrineUpgrade',
      'EnemyEliteShrineUpgrade',
      'HealingReductionShrineUpgrade',
      'ShopPricesShrineUpgrade',
      'MinibossCountShrineUpgrade',
      'BoonSkipShrineUpgrade',
      'BiomeSpeedShrineUpgrade',
      'LimitGraspShrineUpgrade',
      'BoonManaReserveShrineUpgrade',
      'BanUnpickedBoonsShrineUpgrade',
      'BossDifficultyShrineUpgrade',
    ]);
    expect(
      fear
        .querySelector('[data-fear-vow-key="BossDifficultyShrineUpgrade"]')
        ?.getAttribute('data-rival'),
    ).toBe('true');
    const voidRank = screen.getByRole('button', { name: 'Vow of Void, rank 0 of 4' });
    expect(voidRank.getAttribute('aria-disabled')).toBe('true');
    await user.click(voidRank);
    expect(screen.getByRole('button', { name: 'Vow of Void, rank 0 of 4' })).toBeTruthy();
  });

  it('authors one of the complete starting-keepsake inventory through route settings', async () => {
    const { application, user } = renderPlannerForInteraction();
    const selector = screen.getByRole('button', { name: 'Starting keepsake' });

    await user.click(selector);
    const keepsakeList = screen.getByRole('listbox');
    expect(within(keepsakeList).getByText('Time Piece')).toBeTruthy();

    await user.click(within(keepsakeList).getByText('Time Piece'));

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .startingKeepsakeKey,
    ).toBe('GoldifyKeepsake');
    expect(selector.textContent).toContain('Time Piece');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(selector.textContent).not.toContain('Time Piece');
  });

  it('authors the Jeweled Pom result at route start', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    await user.click(startingKeepsake);
    await user.click(within(screen.getByRole('listbox')).getByText('Jeweled Pom'));

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .keepsakeEquipResults?.jeweledPom,
    ).toBeUndefined();
    expect(application.store.getState().projectWorkspace.assembly!.evaluation.route).toMatchObject({
      status: 'incomplete',
      biomes: [],
      processing: { active: null, blockedSuffix: ['F'] },
      summary: { evaluatedBiomeCount: 0, blockedBiomeCount: 1, eligibleForExecutionPlan: false },
    });

    await screen.findByRole('button', { name: 'Jeweled Pom result' });
    const missingFinding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (finding) => finding.code === 'keepsakeEquipResultMissing',
      );
    if (missingFinding === undefined) throw new Error('missing Jeweled Pom finding is absent');
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (
      issue === undefined ||
      semanticAddressKey(issue.owner) !== semanticAddressKey(missingFinding.origin)
    ) {
      throw new Error('Jeweled Pom must be the selected assessment issue');
    }
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('selected repair banner is missing');
    await user.click(within(repair).getByRole('button'));
    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: issue.owner,
    });
    await user.click(screen.getByRole('button', { name: 'Jeweled Pom result' }));
    const resultList = screen.getByRole('listbox');
    await waitFor(() => expect(within(resultList).getByText('Last Gasp')).toBeTruthy());
    await user.click(within(resultList).getByText('Last Gasp'));

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .keepsakeEquipResults?.jeweledPom,
    ).toEqual({
      traitKey: 'HadesDeathDefianceDamageBoon',
    });
    expect(
      application.store.getState().projectWorkspace.assembly!.evaluation.route?.biomes,
    ).toHaveLength(1);

    expect(screen.queryByRole('checkbox', { name: 'Death Defiance condition met' })).toBeNull();
  });

  it('repairs the route-start Experimental Hammer result through its projected control', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    await user.click(startingKeepsake);
    await user.click(within(screen.getByRole('listbox')).getByText('Experimental Hammer'));

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .keepsakeEquipResults?.experimentalHammer,
    ).toBeUndefined();
    expect(application.store.getState().projectWorkspace.assembly!.evaluation.route).toMatchObject({
      status: 'incomplete',
      biomes: [],
      processing: { active: null, blockedSuffix: ['F'] },
      summary: { evaluatedBiomeCount: 0, blockedBiomeCount: 1, eligibleForExecutionPlan: false },
    });

    const result = await screen.findByRole('button', { name: 'Experimental Hammer result' });
    const finding = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (candidate) => candidate.code === 'keepsakeEquipResultMissing',
      );
    if (finding === undefined) throw new Error('missing Hammer finding is absent');
    const authoredTraitKey = 'StaffDoubleAttackTrait';
    await user.click(result);
    const resultList = screen.getByRole('listbox');
    await waitFor(() =>
      expect(
        within(resultList)
          .getByText('Wicked Thrasher')
          .closest('[cmdk-item]')
          ?.getAttribute('data-candidate-state'),
      ).toBe('possible'),
    );
    await user.click(within(resultList).getByText('Wicked Thrasher'));
    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .keepsakeEquipResults?.experimentalHammer,
    ).toEqual({ kind: 'selected', traitKey: authoredTraitKey });
    expect(
      application.store.getState().projectWorkspace.assembly!.evaluation.route?.biomes,
    ).toHaveLength(1);
    expect(result.textContent).toContain('Wicked Thrasher');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      screen.getByRole('button', { name: 'Experimental Hammer result' }).textContent,
    ).toContain('Choose compatible Hammer');
    expect(
      application.store.getState().projectWorkspace.assembly!.evaluation.route?.biomes,
    ).toHaveLength(0);
  });

  it('navigates to and repairs the reached I Gift Hammer child', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenEchoGiftHammerPendingProject()));
    const missing = application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.find(
        (finding) =>
          finding.code === 'keepsakeEquipResultMissing' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(echoGiftHammerReplayAddress),
      );
    if (missing === undefined) throw new Error('I Gift Hammer finding is missing');
    const issue = application.store.getState().projectWorkspace.assembly!.evaluation.issue;
    if (
      issue === undefined ||
      semanticAddressKey(issue.owner) !== semanticAddressKey(echoGiftHammerReplayAddress)
    ) {
      throw new Error('I Gift Hammer must be the selected assessment issue');
    }
    const interaction = application
      .selectStructuredWorkspace(application.store.getState())!
      .interactions.keepsakeEquipResults.get(semanticAddressKey(echoGiftHammerReplayAddress));
    if (interaction?.owner.resultKind !== 'experimentalHammer')
      throw new Error('I Gift Hammer interaction is missing');
    const candidate = interaction
      .load()
      .picker.sections.flatMap((section) => section.items)
      .find((option) => option.value !== '__exhausted' && option.state === 'possible');
    if (candidate === undefined) throw new Error('I Gift Hammer has no selectable result');

    const { user } = renderPlannerForInteraction({ application });
    const repair = screen.getByRole('heading', { name: 'Next repair' }).closest('section');
    if (repair === null) throw new Error('I Gift Hammer repair banner is missing');
    await user.click(within(repair).getByRole('button'));

    expect(application.store.getState().editorSession.selectedFinding).toMatchObject({
      key: issue.regionKey,
      origin: echoGiftHammerReplayAddress,
    });
    expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'I',
    });
    const result = await screen.findByRole('button', { name: 'Experimental Hammer result' });
    await user.click(result);
    const resultList = screen.getByRole('listbox');
    const candidateLabel =
      candidate.value === '__exhausted'
        ? 'No compatible Hammer'
        : (catalog.traits.byKey[candidate.value]?.label ?? candidate.value);
    const selected = within(resultList).getByText(candidateLabel);
    await waitFor(() =>
      expect(selected.closest('[cmdk-item]')?.getAttribute('data-candidate-state')).toBe(
        'possible',
      ),
    );
    await user.click(selected);

    expect(
      application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'I')
        ?.echoKeepsakeReplayResults?.experimentalHammer,
    ).toEqual({ kind: 'selected', traitKey: candidate.value });
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly!.evaluation.findings.some(
          (finding) =>
            semanticAddressKey(finding.origin) === semanticAddressKey(echoGiftHammerReplayAddress),
        ),
    ).toBe(false);
  });

  it('authors Arcana and Fear through bounded controls with undo and redo', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(screen.getByRole('button', { name: 'Edit Arcana' }));
    expect(screen.getByRole('button', { name: 'The Moon (automatic)' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('button', { name: /The Sorceress/ }));
    expect(screen.getByRole('button', { name: 'The Sorceress' }).getAttribute('aria-pressed')).toBe(
      'true',
    );
    const queen = screen.getByRole('button', { name: 'The Queen (automatic)' });
    expect(queen).toHaveProperty('disabled', true);
    expect(queen.getAttribute('aria-pressed')).toBe('true');

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);
    expect(screen.getByRole('group', { name: 'Arcana, 3 active' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close Arcana' }));

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .manualArcanaKeys,
    ).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);

    await user.click(screen.getByRole('button', { name: 'Edit Fear' }));
    const pain = screen.getByRole('button', { name: 'Vow of Pain, rank 0 of 3' });
    await user.click(pain);
    await user.click(pain);
    await user.click(pain);
    expect(screen.getByRole('button', { name: 'Vow of Pain, rank 3 of 3' })).toBeTruthy();
    await user.click(pain);
    expect(screen.getByRole('button', { name: 'Vow of Pain, rank 0 of 3' })).toBeTruthy();
    pain.focus();
    await user.keyboard('[Space]');
    expect(screen.getByRole('button', { name: 'Vow of Pain, rank 1 of 3' })).toBeTruthy();
    await user.pointer({ target: pain, keys: '[MouseRight]' });
    expect(screen.getByRole('button', { name: 'Vow of Pain, rank 0 of 3' })).toBeTruthy();
    await user.click(pain);
    await user.click(pain);
    await user.click(pain);

    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout.fearRanks
        .EnemyDamageShrineUpgrade,
    ).toBe(3);
    expect(screen.getByRole('group', { name: 'Fear, 5 total' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Close Fear' }));
    expect(screen.getByRole('button', { name: 'Edit Fear' }).textContent).toBe(
      'Fear · 1 active · 5/67 Fear',
    );
    expect(screen.getByRole('button', { name: 'Edit Arcana' }).textContent).toBe(
      'Arcana · 3 active · 1/30 Grasp',
    );
  });
});

describe('project profile interaction', () => {
  it('uses the menu primitive for keyboard navigation, Escape focus return, and outside dismissal', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createCompleteFGProject()));
    const { user } = renderPlannerForInteraction({ application });
    const trigger = screen.getByRole('button', { name: 'File' });

    trigger.focus();
    await user.keyboard('{Enter}');

    const menu = screen.getByRole('menu', { name: 'File' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['New', 'Load…', 'Save']);
    expect(within(menu).getAllByRole('separator')).toHaveLength(1);
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'New' }));

    await user.keyboard('{ArrowDown}');
    expect(document.activeElement).toBe(within(menu).getByRole('menuitem', { name: 'Load…' }));
    await user.keyboard('{Escape}');

    expect(screen.queryByRole('menu')).toBeNull();
    expect(document.activeElement).toBe(trigger);

    await user.click(trigger);
    expect(screen.getByRole('menu', { name: 'File' })).toBeTruthy();
    fireEvent.pointerDown(document.body);
    expect(screen.queryByRole('menu')).toBeNull();
  });

  it('exposes native Save As, reports its result, and closes before pending work', async () => {
    let finishLoad: (() => void) | undefined;
    let menuVisibleWhenLoadStarted: boolean | undefined;
    const savedAs: string[] = [];
    const application = createApplication({
      profileFile: profileAdapter({
        supportsSaveAs: true,
        saveAs: (_fileName, json) => {
          savedAs.push(json);
          return Promise.resolve(profileReference('alternate.runplanner.json'));
        },
        load: () => {
          menuVisibleWhenLoadStarted = screen.queryByRole('menu') !== null;
          return new Promise<null>((resolve) => {
            finishLoad = () => resolve(null);
          });
        },
      }),
    });
    application.store.dispatch(authoredProjectReplaced(createCompleteFGProject()));
    const { user } = renderPlannerForInteraction({ application });
    const trigger = screen.getByRole('button', { name: 'File' });

    await user.click(trigger);
    const menu = screen.getByRole('menu', { name: 'File' });
    expect(
      within(menu)
        .getAllByRole('menuitem')
        .map((item) => item.textContent?.trim()),
    ).toEqual(['New', 'Load…', 'Save', 'Save As…']);
    expect(within(menu).getByRole('menuitem', { name: 'Save As…' })).toHaveProperty(
      'ariaDisabled',
      null,
    );

    await user.click(within(menu).getByRole('menuitem', { name: 'Save As…' }));
    expect(await screen.findByText('Saved as a new file.')).toBeTruthy();
    expect(savedAs).toHaveLength(1);

    await user.click(trigger);
    await user.click(
      within(screen.getByRole('menu', { name: 'File' })).getByRole('menuitem', { name: 'Load…' }),
    );
    expect(screen.queryByRole('menu')).toBeNull();
    expect(menuVisibleWhenLoadStarted).toBe(false);
    expect(trigger).toHaveProperty('disabled', true);
    expect(screen.getByRole('region', { name: 'Project profile' }).getAttribute('aria-busy')).toBe(
      'true',
    );

    finishLoad?.();
    expect(await screen.findByText('Load Profile cancelled.')).toBeTruthy();
    expect(trigger).toHaveProperty('disabled', false);
  });

  it('saves, replaces, and reloads the project through the visible profile controls', async () => {
    let profileJson: string | null = null;
    let profileFileName: string | null = null;
    const storedFile = (fileName: string): ProfileFileReference => ({
      activate: () => Promise.resolve(),
      fileName,
      write: (json) => {
        profileJson = json;
        return Promise.resolve();
      },
    });
    const profileFile = profileAdapter({
      saveAs: (fileName, json) => {
        profileFileName = fileName;
        profileJson = json;
        return Promise.resolve(storedFile(fileName));
      },
      load: () =>
        Promise.resolve(
          profileJson === null || profileFileName === null
            ? null
            : { file: storedFile(profileFileName), json: profileJson },
        ),
    });
    const application = createApplication({ profileFile });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.queryByRole('button', { name: 'New' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Save' })).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Load' }).classList.contains('secondary-action'),
    ).toBe(true);
    expect(screen.queryByText('Unsaved')).toBeNull();
    await user.click(
      within(screen.getByRole('group', { name: 'Choose route' })).getByRole('button', {
        name: 'Underworld',
      }),
    );
    await user.click(screen.getByRole('button', { name: 'File' }));
    const fileMenu = screen.getByRole('menu', { name: 'File' });
    expect(within(fileMenu).getByRole('menuitem', { name: 'New' })).toBeTruthy();
    expect(within(fileMenu).getByRole('menuitem', { name: 'Save' })).toBeTruthy();
    expect(within(fileMenu).getByRole('menuitem', { name: 'Load…' })).toBeTruthy();
    await user.keyboard('{Escape}');
    expect(screen.getByText('Unsaved')).toBeTruthy();
    await user.click(
      within(screen.getByRole('radiogroup', { name: 'Biomes to configure' })).getByRole('radio', {
        name: '1',
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceManualArcanaSelection',
        route: createRouteAddress('Underworld'),
        arcanaKeys: ['ChanneledCast'],
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceFearVowRank',
        route: createRouteAddress('Underworld'),
        vowKey: 'EnemyDamageShrineUpgrade',
        rank: 3,
      }),
    );
    const savedEvaluation = application.store.getState().projectWorkspace.assembly!.evaluation;
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Save' }));
    expect(await screen.findByText('Saved the profile.')).toBeTruthy();
    expect(screen.getByText('Clean')).toBeTruthy();
    expect(profileFileName).toBe('run-plan.runplanner.json');

    act(() => {
      application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceFearVowRank',
          route: createRouteAddress('Underworld'),
          vowKey: 'EnemyDamageShrineUpgrade',
          rank: 2,
        }),
      );
    });
    expect(screen.getByText('Dirty')).toBeTruthy();
    expect(profileJson).not.toBeNull();

    const workspaceBeforeNew = application.store.getState().projectWorkspace;
    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New' }));
    expect(screen.getByRole('heading', { name: 'Choose a new route' })).toBeTruthy();
    expect(screen.queryByRole('navigation', { name: 'Planner sections' })).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(application.store.getState().projectWorkspace).toBe(workspaceBeforeNew);
    expect(screen.getByText('Dirty')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'New' }));
    await user.click(
      within(screen.getByRole('group', { name: 'Choose route' })).getByRole('button', {
        name: 'Underworld',
      }),
    );
    expect(configuredBiomeCount(application)).toBe(1);
    expect(screen.getByText('Created a new project.')).toBeTruthy();
    expect(screen.getByText('Unsaved')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'File' }));
    await user.click(screen.getByRole('menuitem', { name: 'Load…' }));
    expect(await screen.findByText('Loaded the profile.')).toBeTruthy();
    expect(configuredBiomeCount(application)).toBe(1);
    expect(
      application.store.getState().projectWorkspace.history!.present.route?.loadout,
    ).toMatchObject({
      manualArcanaKeys: ['ChanneledCast'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(application.store.getState().projectWorkspace.history!.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history!.future).toEqual([]);
    expect(application.store.getState().projectWorkspace.assembly!.evaluation).toEqual(
      savedEvaluation,
    );
    expect(screen.getByText('Clean')).toBeTruthy();
  });

  it('presents a restored startup project as recovered', () => {
    const source = createOpenTestApplication();
    const json = encodeProjectDocument(source.store.getState().projectWorkspace.history!.present);
    const application = createApplication({
      autosaveRecovery: {
        read: () => json,
        write: () => {},
        clear: () => {},
      },
      autosaveScheduler: { schedule: () => () => {} },
    });

    renderPlannerForInteraction({ application });

    expect(screen.getByText('Recovered')).toBeTruthy();
  });

  it('presents corrupt recovery and exposes its explicit discard action', async () => {
    let recoveryJson: string | null = '{not json';
    const exported: { fileName: string; json: string }[] = [];
    const recovery: AutosaveRecoveryAdapter = {
      read: () => recoveryJson,
      write: (json) => {
        recoveryJson = json;
      },
      clear: () => {
        recoveryJson = null;
      },
    };
    const scheduler: AutosaveScheduler = {
      schedule: () => () => {},
    };
    const application = createApplication({
      autosaveRecovery: recovery,
      autosaveScheduler: scheduler,
      profileFile: profileAdapter({
        saveAs: (fileName, json) => {
          exported.push({ fileName, json });
          return Promise.resolve(profileReference(fileName));
        },
        load: () => Promise.resolve(null),
      }),
    });
    const { user } = renderPlannerForInteraction({ application, startWithProject: false });

    expect(screen.getByRole('alert').textContent).toBe(
      'Autosave recovery failed: $: must be valid JSON',
    );
    expect(screen.queryByText('Unsaved')).toBeNull();
    await user.click(screen.getByRole('button', { name: 'Export Autosave' }));
    expect(exported).toEqual([
      { fileName: 'run-planner-autosave.runplanner.json', json: '{not json' },
    ]);
    expect(recoveryJson).toBe('{not json');
    expect(screen.getByText('Exported the autosave copy.')).toBeTruthy();
    const discard = screen.getByRole('button', { name: 'Discard' });
    expect(discard.classList.contains('danger-action')).toBe(true);
    await user.click(discard);

    expect(recoveryJson).toBeNull();
    expect(screen.queryByText('Autosave recovery failed: $: must be valid JSON')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard' })).toBeNull();
    expect(screen.getByText('Discarded the unreadable autosave.')).toBeTruthy();
  });

  it('presents a load failure and retains the current workspace', async () => {
    const application = createApplication({
      profileFile: profileAdapter({
        saveAs: (fileName) => Promise.resolve(profileReference(fileName)),
        load: () =>
          Promise.resolve({ file: profileReference('broken.runplanner.json'), json: '{not json' }),
      }),
    });
    const workspace = application.store.getState().projectWorkspace;
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Load Profile failed: $: must be valid JSON',
    );
    expect(application.store.getState().projectWorkspace).toBe(workspace);
    expect(screen.getByRole('group', { name: 'Choose route' })).toBeTruthy();
  });

  it('closes the initial route chooser after loading a valid current-schema route', async () => {
    const source = createOpenTestApplication('Surface');
    const profileJson = encodeProjectDocument(
      source.store.getState().projectWorkspace.history!.present,
    );
    const application = createApplication({
      profileFile: profileAdapter({
        saveAs: (fileName) => Promise.resolve(profileReference(fileName)),
        load: () =>
          Promise.resolve({ file: profileReference('surface.runplanner.json'), json: profileJson }),
      }),
    });
    const { user } = renderPlannerForInteraction({ application, startWithProject: false });

    expect(screen.getByRole('group', { name: 'Choose route' })).toBeTruthy();
    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(await screen.findByText('Loaded the profile.')).toBeTruthy();
    expect(screen.queryByRole('group', { name: 'Choose route' })).toBeNull();
    expect(document.querySelector('.app-route-identity')?.textContent).toBe('Surface');
  });

  it('preserves the initial route chooser when loading is cancelled', async () => {
    const application = createApplication({
      profileFile: profileAdapter({
        saveAs: (fileName) => Promise.resolve(profileReference(fileName)),
        load: () => Promise.resolve(null),
      }),
    });
    const { user } = renderPlannerForInteraction({ application, startWithProject: false });

    await user.click(screen.getByRole('button', { name: 'Load' }));

    expect(await screen.findByText('Load Profile cancelled.')).toBeTruthy();
    expect(screen.getByRole('group', { name: 'Choose route' })).toBeTruthy();
  });
});
