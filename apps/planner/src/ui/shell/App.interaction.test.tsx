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
  createRoomActionAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTargetAddress,
  createTraitOfferAddress,
  createTraitAcquisitionTargetAddress,
  createShopOfferAddress,
  semanticAddressKey,
  seaStarDuplicateSiteKey,
  roomActionKey,
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
import type { ProfileFileAdapter } from '@planner/persistence/profileFile';
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
import { renderPlannerForInteraction } from '@planner-test/fixtures/renderPlanner';
import {
  createGoldenEchoGiftHammerPendingProject,
  echoGiftHammerReplayAddress,
} from '@planner-test/fixtures/echoGiftHammer';
import { createEchoGoldHPrebossProject } from '@planner-test/fixtures/echoGoldShop';
import { semanticOwnerControlElementId, semanticOwnerElementId } from '../feedback/semanticOwner';
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

function configuredBiomeCount(
  application: ReturnType<typeof renderPlannerForInteraction>['application'],
) {
  return application.store.getState().projectWorkspace.history.present.routes[0]?.biomes.length;
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
    configuredBiomeCounts: { Underworld: 1 },
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
  return { application, project, set, target };
}

describe('planner history interaction', () => {
  it('binds visible history controls to semantic project history', async () => {
    const { application, user } = renderPlannerForInteraction();
    const undo = screen.getByRole('button', { name: 'Undo' });
    const redo = screen.getByRole('button', { name: 'Redo' });

    expect(undo.classList.contains('quiet-action')).toBe(true);
    expect(redo.classList.contains('quiet-action')).toBe(true);
    expect(undo).toHaveProperty('disabled', true);
    expect(redo).toHaveProperty('disabled', true);

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
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

  it('supports Ctrl/Cmd+Z, Ctrl/Cmd+Shift+Z, and Ctrl+Y', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

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
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');

    const input = screen.getByRole('textbox', { name: 'Text draft' });
    expect(fireEvent.keyDown(input, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);

    const editable = screen.getByRole('textbox', { name: 'Notes draft' });
    expect(fireEvent.keyDown(editable, { ctrlKey: true, key: 'z' })).toBe(true);
    expect(configuredBiomeCount(application)).toBe(1);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(1);
  });

  it('keeps navigation outside authored history', async () => {
    const { application, user } = renderPlannerForInteraction();

    await user.click(screen.getByRole('button', { name: 'Surface' }));

    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
  });

  it('activates route and configured-biome navigation from the keyboard', async () => {
    const { application, user } = renderPlannerForInteraction();

    const surface = screen.getByRole('button', { name: 'Surface' });
    surface.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activeRouteKey).toBe('Surface');
    expect(surface.getAttribute('aria-current')).toBe('page');

    const underworld = screen.getByRole('button', { name: 'Underworld' });
    underworld.focus();
    await user.keyboard(' ');
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');

    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    oceanus.focus();
    await user.keyboard('{Enter}');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'G',
    });
    expect(oceanus.getAttribute('aria-current')).toBe('page');

    const tartarus = screen.getByRole('button', { name: 'Tartarus' });
    tartarus.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'I',
    });
    expect(tartarus.getAttribute('aria-current')).toBe('page');

    const route = screen.getByRole('button', { name: 'Route' });
    route.focus();
    await user.keyboard(' ');
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
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
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;
    const npcEntry = screen.getByRole('button', {
      name: 'Inspect Artemis combat in Erebus · Encounter',
    });
    npcEntry.focus();
    await view.user.keyboard('{Enter}');

    expect(application.store.getState().editorSession).toMatchObject({
      activeRouteKey: 'Underworld',
      focusedSemanticOwner: phase,
      selectedFinding: null,
    });
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
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
        .selectStructuredWorkspace(application.store.getState())
        .interactions.traitOffers.get(semanticAddressKey(traitAddress)),
    ).toBeDefined();

    const selectedOption = within(dialog).getAllByLabelText('Selected')[1];
    if (selectedOption === undefined) throw new Error('Artemis option 2 selected radio is missing');
    await view.user.click(selectedOption);
    const save = within(dialog).getByRole('button', { name: 'Save trait offer' });
    await waitFor(() => expect(save).toHaveProperty('disabled', false));
    const historyBeforeSave = application.store.getState().projectWorkspace.history;
    await view.user.click(save);

    const savedInteraction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(traitAddress));
    if (savedInteraction?.value?.kind !== 'traits')
      throw new Error('saved Artemis offer must contain traits');
    expect(savedInteraction.value.selectedOptionKey).toBe('option2');
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeSave.past.length + 1,
    );

    await view.user.click(within(roomActions).getByRole('button', { name: /Edit Trait/ }));
    const completedDialog = await screen.findByRole('dialog');
    await view.user.click(
      within(completedDialog).getByRole('button', { name: 'Reset to unresolved' }),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .interactions.traitOffers.get(semanticAddressKey(traitAddress))?.value,
    ).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    const restoredInteraction = application
      .selectStructuredWorkspace(application.store.getState())
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
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const n = workspace.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
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
    const historyBeforeNavigation = application.store.getState().projectWorkspace.history;

    const miningRow = screen.getByText('Mining').closest('li');
    if (miningRow === null) throw new Error('Mining resource row is missing');
    await view.user.click(within(miningRow).getByRole('button', { name: 'Inspect placement' }));

    expect(application.store.getState().editorSession).toMatchObject({
      activeRouteKey: 'Surface',
      focusedSemanticOwner: createOccurrenceAddress(
        { kind: 'biome', routeKey: 'Surface', biomeKey: 'N' },
        createOccurrenceId('surface-n-opening'),
      ),
    });
    expect(application.store.getState().editorSession.activePanelByRoute.Surface).toEqual({
      kind: 'biome',
      biomeKey: 'N',
    });
    expect(application.store.getState().projectWorkspace.history).toBe(historyBeforeNavigation);
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
      .selectStructuredWorkspace(application.store.getState())
      .interactions.acquisitionConversions.get(semanticAddressKey(targetAcquisition));
    if (conversion === undefined)
      throw new Error(
        `Sea Star target conversion is absent: ${application.store
          .getState()
          .projectWorkspace.assembly.evaluation.findings.map((finding) => finding.code)
          .join(', ')}`,
      );
    expect(conversion.seaStarSupported).toBe(true);
    const view = renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', {
      name: 'Sea Star procced for Reward',
    });
    expect(checkbox).toHaveProperty('checked', false);
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(checkbox);

    await waitFor(() => expect(checkbox).toHaveProperty('checked', true));
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    const siteKey = seaStarDuplicateSiteKey(targetAcquisition);
    const child = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenFBiome, target), siteKey),
      'seaStarDuplicate',
    );
    await waitFor(() =>
      expect(document.getElementById(semanticOwnerElementId(child))).not.toBeNull(),
    );
    const childRow = document
      .getElementById(semanticOwnerElementId(child))
      ?.closest('[data-room-action-key]');
    expect(childRow?.textContent).toContain('seaStarDuplicate pickup');
    expect(
      application.store
        .getState()
        .projectWorkspace.history.present.routes[0]!.biomes[0]!.topology!.occurrences.find(
          (occurrence) => occurrence.occurrenceId === target,
        )?.acquisitionSites?.[siteKey]?.pickupEntries?.seaStarDuplicate?.offer,
    ).toEqual({ rewardType: 'RoomMoneyDrop' });

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(checkbox).toHaveProperty('checked', false));
    expect(document.getElementById(semanticOwnerElementId(child))).toBeNull();
    expect(
      application.store
        .getState()
        .projectWorkspace.history.present.routes[0]!.biomes[0]!.topology!.occurrences.find(
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
        .selectStructuredWorkspace(application.store.getState())
        .interactions.traitOffers.values(),
    ]
      .flatMap((interaction) => {
        const value = interaction.value;
        if (value?.kind !== 'traits') return [];
        return [
          {
            interaction,
            value,
            stone: interaction.optionDomain(value, value.selectedOptionKey).concaveStone,
          },
        ];
      })
      .find(({ stone, value }) => stone?.forOffer(value).load() !== undefined);
    if (beforeOpen === undefined) throw new Error('Concave Stone domain is absent');
    const target = beforeOpen.stone!.control.address;
    application.store.dispatch(traitOfferDialogOpened(target));
    const view = renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', { name: 'Concave Stone procced' });
    expect(checkbox).toHaveProperty('checked', false);
    expect(checkbox).toHaveProperty('disabled', false);
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(checkbox);

    await waitFor(() => expect(checkbox).toHaveProperty('checked', true));
    const persisted = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(target))?.value;
    expect(persisted).toMatchObject({
      kind: 'traits',
      concaveStoneResult: { kind: 'proc', optionKey: 'option2' },
    });
    expect(
      screen.getByRole('button', { name: 'Concave Stone residual trait' }).textContent,
    ).toBeTruthy();
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Concave Stone procced' })).toHaveProperty(
        'checked',
        false,
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .interactions.traitOffers.get(semanticAddressKey(target))?.value,
    ).toMatchObject({ concaveStoneResult: { kind: 'noProc' } });

    await view.user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(screen.getByRole('checkbox', { name: 'Concave Stone procced' })).toHaveProperty(
        'checked',
        true,
      ),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
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

    expect(await screen.findByRole('checkbox', { name: 'Concave Stone procced' })).toHaveProperty(
      'checked',
      true,
    );
    expect(
      await screen.findByRole('button', { name: 'Clear unavailable Concave Stone result' }),
    ).toBeTruthy();
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.findings,
    ).toContainEqual(
      expect.objectContaining({ code: 'concaveStoneResultUnavailable', origin: target }),
    );

    await view.user.click(
      screen.getByRole('button', { name: 'Clear unavailable Concave Stone result' }),
    );
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())
          .interactions.traitOffers.get(semanticAddressKey(target))?.value,
      ).not.toMatchObject({ concaveStoneResult: expect.anything() }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())
          .interactions.traitOffers.get(semanticAddressKey(target))?.value,
      ).toMatchObject({ concaveStoneResult: { kind: 'proc', optionKey: 'option2' } }),
    );
    await view.user.click(screen.getByRole('button', { name: 'Redo' }));
    await waitFor(() =>
      expect(
        application
          .selectStructuredWorkspace(application.store.getState())
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
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (interaction?.value?.kind !== 'traits') throw new Error('Heroic Stone offer is absent');
    const domain = interaction
      .optionDomain(interaction.value, interaction.value.selectedOptionKey)
      .concaveStone?.forOffer(interaction.value)
      .load();
    expect(domain).toMatchObject({ required: true, procSupport: 100 });
    application.store.dispatch(traitOfferDialogOpened(target));
    renderPlannerForInteraction({ application });

    const checkbox = await screen.findByRole('checkbox', { name: 'Concave Stone procced' });
    expect(checkbox).toHaveProperty('checked', true);
    expect(checkbox).toHaveProperty('disabled', true);
    expect(screen.getByRole('button', { name: 'Concave Stone residual trait' })).toBeTruthy();
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
    expect(session.activePanelByRoute.Underworld).toEqual({
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
    const initialWorkspace = application.selectStructuredWorkspace(application.store.getState());
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

    await view.user.click(screen.getByRole('button', { name: target.routeKey }));
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
      .selectStructuredWorkspace(application.store.getState())
      .interactions.traitOffers.get(semanticAddressKey(target));
    if (replacement === undefined) throw new Error('replacement trait interaction is missing');
    expect(replacement.value).toBeNull();
    const replacementValue = replacement.traitsStartingDraft?.();
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
      .selectStructuredWorkspace(application.store.getState())
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
      routes: Array<{
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
      }>;
    };
    const rawOccurrence = raw.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
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
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) => semanticAddressKey(candidate.origin) === semanticAddressKey(target),
      );
    if (finding === undefined) throw new Error('reached SpellDrop missing finding is absent');
    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('trait'));
    if (findingButton === undefined) throw new Error('SpellDrop finding is not presented');
    await view.user.click(findingButton);
    const destination = application
      .selectStructuredWorkspace(application.store.getState())
      .focusByOwner.get(semanticAddressKey(target));
    if (destination === undefined) throw new Error('SpellDrop destination is missing');
    expect(destination).toMatchObject({
      ownerAddress: target,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(application.store.getState().editorSession.traitDialogTarget).toBeNull();
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      destination.focusAddress,
    );
    expect(screen.queryByRole('dialog')).toBeNull();
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('SpellDrop pickup action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit spell/ }));
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
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly.evaluation.findings.filter(
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
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) => finding.origin.kind === 'traitOffer',
      );
    if (invalid === undefined) throw new Error('invalid reached Hammer finding is missing');
    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Hammer is incompatible'));
    if (findingButton === undefined) throw new Error('Hammer finding is not presented');
    await view.user.click(findingButton);

    const destination = application
      .selectStructuredWorkspace(application.store.getState())
      .focusByOwner.get(semanticAddressKey(invalid.origin));
    if (destination === undefined) throw new Error('invalid Hammer destination is missing');
    expect(destination).toMatchObject({
      ownerAddress: invalid.origin,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(screen.queryByRole('dialog')).toBeNull();
    expect(document.getElementById(semanticOwnerElementId(destination.focusAddress))).toBeTruthy();
    const action = document.getElementById(semanticOwnerControlElementId(destination.focusAddress));
    if (action === null) throw new Error('invalid Hammer pickup action is missing');
    await view.user.click(within(action).getByRole('button', { name: /Edit Trait/ }));
    const dialog = await screen.findByRole('dialog');
    expect(
      within(dialog).getAllByText(/Hammer is incompatible with this loadout/).length,
    ).toBeGreaterThan(0);
    expect(within(dialog).getByRole('status')).toBeTruthy();

    const interaction = application
      .selectStructuredWorkspace(application.store.getState())
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
        .projectWorkspace.assembly.evaluation.findings.some(
          (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(invalid.origin),
        ),
    ).toBe(false);
  });

  it('opens an exact Gold payload finding at the derived Shop inventory row', async () => {
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
      application.store.getState().projectWorkspace.assembly,
      site,
    ).find((entry) => entry.kind === 'echoDoubleShopReward');
    if (derived?.sourceOfferKey === undefined) throw new Error('Gold source offer is missing');
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'SelectDerivedShopEntry',
        site,
        entryKey: 'echoDoubleShopReward',
        sourceOfferKey: derived.sourceOfferKey,
      }),
    );
    const goldReference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: 'echoDoubleShopReward',
    };
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'InsertRoomAction',
        action: createRoomActionAddress(
          { kind: 'biome', routeKey: 'Underworld', biomeKey: 'H' },
          shop.occurrenceId,
          roomActionKey(goldReference),
        ),
        reference: goldReference,
        index: 1,
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
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'shopPurchaseUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(gold),
      );
    if (finding === undefined) throw new Error('exact Gold payload finding is missing');

    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Shop purchase is unavailable'));
    if (findingButton === undefined) throw new Error('Gold finding is not presented');
    expect(findingButton.classList.contains('findings-list-entry')).toBe(true);
    await view.user.click(findingButton);

    await waitFor(() =>
      expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(gold),
    );
    expect(
      application
        .selectStructuredWorkspace(application.store.getState())
        .focusByOwner.get(semanticAddressKey(gold)),
    ).toMatchObject({ ownerAddress: gold, biomeKey: 'H' });
    const marker = document.getElementById(semanticOwnerElementId(gold));
    expect(marker).toBeTruthy();
    const actionRow = marker?.closest('[data-room-action-key]');
    expect(actionRow?.textContent).toContain('Gold Gold Gold duplicate of Offer 3');
    expect(actionRow?.textContent).toContain('Shop purchase is unavailable');
  });

  it('opens and focuses the exact All Together set control from its finding', async () => {
    const { application, project, set, target } = allTogetherFindingFixture();
    application.store.dispatch(authoredProjectReplaced(project));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'allTogetherResultUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(set),
      );
    if (finding === undefined) throw new Error('All Together set finding is missing');
    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    await view.user.click(
      within(findings).getByRole('button', { name: /All Together outcome unavailable/ }),
    );

    const dialog = await screen.findByRole('dialog');
    const earth = within(dialog).getByRole('button', { name: /^Earth:/ });
    await waitFor(() => expect(document.activeElement).toBe(earth));
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(target);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(set);
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
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'targetedAcquisitionTargetMissing' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(child),
      );
    if (finding === undefined) throw new Error('targeted acquisition child finding is missing');
    const view = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings)
      .getAllByRole('button')
      .find((button) => button.textContent?.includes('Acquisition target is missing'));
    if (findingButton === undefined) throw new Error('targeted acquisition finding is not shown');
    await view.user.click(findingButton);

    const destination = application
      .selectStructuredWorkspace(application.store.getState())
      .focusByOwner.get(semanticAddressKey(child));
    if (destination === undefined) throw new Error('targeted acquisition destination is missing');
    expect(destination).toMatchObject({
      ownerAddress: child,
      focusAddress: { kind: 'roomAction' },
    });
    expect(destination).not.toHaveProperty('traitDialogTarget');
    expect(screen.queryByRole('dialog')).toBeNull();
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
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));

    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    ).interactions;
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
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Traits' }));
    const interactions = application.selectStructuredWorkspace(
      application.store.getState(),
    ).interactions;
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

  it('keeps blocked and cross-route biome pages visible and editable', async () => {
    const { user } = renderPlannerForInteraction();

    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    const oceanus = screen.getByRole('button', { name: 'Oceanus' });
    expect(within(oceanus).getByTitle('Blocked')).toBeTruthy();
    expect(
      document
        .getElementById(oceanus.getAttribute('aria-describedby') ?? '')
        ?.getAttribute('aria-label'),
    ).toBe('Blocked');

    await user.click(oceanus);
    const blockedBanner = screen.getByText(
      'Finish and fix Erebus before Oceanus can be evaluated. You can still edit it.',
    );
    expect(blockedBanner.getAttribute('role')).toBeNull();
    expect(blockedBanner.closest('.editor-panel')?.getAttribute('aria-live')).toBe('polite');
    expect(screen.getByRole('button', { name: 'Room' })).toHaveProperty('disabled', false);

    await user.click(screen.getByRole('button', { name: 'Surface' }));
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '4');
    // Route composition blocks the complete suffix at the first incomplete
    // biome. O/P/Q therefore retain their own structural frontiers while
    // each names N/Ephyra as the shared upstream semantic blocker.
    for (const [label, predecessor] of [
      ['Thessaly', 'Ephyra'],
      ['Olympus', 'Ephyra'],
      ['Summit', 'Ephyra'],
    ] as const) {
      const blockedSurfaceBiome = screen.getByRole('button', { name: label });
      expect(within(blockedSurfaceBiome).getByTitle('Blocked')).toBeTruthy();
      await user.click(blockedSurfaceBiome);
      expect(
        screen.getByText(
          new RegExp(`Finish and fix ${predecessor} before ${label} can be evaluated`),
        ),
      ).toBeTruthy();
      expect(screen.getByRole('button', { name: 'Room' })).toHaveProperty('disabled', false);
    }

    const ephyra = screen.getByRole('button', { name: 'Ephyra' });
    expect(within(ephyra).getByTitle('Incomplete')).toBeTruthy();

    await user.click(ephyra);
    expect(screen.getByText('Ephyra is not evaluated yet. You can still edit it.')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Room' })).toHaveProperty('disabled', false);
  });
});

describe('route loadout interaction', () => {
  it('presents starting Grasp capacity and disables Arcana or Void choices that exceed it', async () => {
    const { user } = renderPlannerForInteraction();
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    const weapon = screen.getByRole('combobox', { name: 'Weapon' });
    const aspect = screen.getByRole('combobox', { name: 'Aspect' });
    expect(startingKeepsake.closest('.route-keepsake-controls')).toBeTruthy();
    expect(weapon.closest('.route-weapon-controls')).toBe(aspect.closest('.route-weapon-controls'));
    expect(weapon.closest('.route-keepsake-controls')).toBeNull();
    const arcana = screen.getByRole('group', { name: 'Arcana, 0 active' });
    const arcanaSummary = arcana.querySelector('summary');
    if (arcanaSummary === null) throw new Error('Arcana summary is missing');
    await user.click(arcanaSummary);
    for (const label of [
      'The Unseen',
      'Origination',
      'The Boatman',
      'Excellence',
      'Death',
      'The Champions',
      'The Huntress',
    ]) {
      await user.click(screen.getByRole('checkbox', { name: label }));
    }

    expect(arcana.textContent).toContain('30 / 30 Grasp');
    expect(screen.getByRole('checkbox', { name: 'The Sorceress' })).toHaveProperty(
      'disabled',
      true,
    );

    const fear = screen.getByRole('group', { name: 'Fear, 0 total' });
    const fearSummary = fear.querySelector('summary');
    if (fearSummary === null) throw new Error('Fear summary is missing');
    await user.click(fearSummary);
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
    const voidRank = screen.getByRole('combobox', { name: 'Vow of Void rank' });
    expect(within(voidRank).getByRole('option', { name: '0' })).toHaveProperty('disabled', false);
    expect(within(voidRank).getByRole('option', { name: '1' })).toHaveProperty('disabled', true);
  });

  it('authors one of the complete starting-keepsake inventory through route settings', async () => {
    const { application, user } = renderPlannerForInteraction();
    const selector = screen.getByRole('button', { name: 'Starting keepsake' });

    await user.click(selector);
    const keepsakeList = screen.getByRole('listbox');
    expect(within(keepsakeList).getByText('Time Piece')).toBeTruthy();

    await user.click(within(keepsakeList).getByText('Time Piece'));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .startingKeepsakeKey,
    ).toBe('GoldifyKeepsake');
    expect(selector.textContent).toContain('Time Piece');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(selector.textContent).not.toContain('Time Piece');
  });

  it('authors the Jeweled Pom result at route start', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    await user.click(startingKeepsake);
    await user.click(within(screen.getByRole('listbox')).getByText('Jeweled Pom'));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .keepsakeEquipResults?.jeweledPom,
    ).toBeUndefined();
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.routes[0],
    ).toMatchObject({
      status: 'incomplete',
      biomes: [],
      processing: { active: null, blockedSuffix: ['F'] },
      summary: { evaluatedBiomeCount: 0, blockedBiomeCount: 1, eligibleForExecutionPlan: false },
    });

    const result = await screen.findByRole('button', { name: 'Jeweled Pom result' });
    const missingFinding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) => finding.code === 'keepsakeEquipResultMissing',
      );
    if (missingFinding === undefined) throw new Error('missing Jeweled Pom finding is absent');
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    await user.click(within(findings).getByRole('button', { name: /Choose Jeweled Pom result/ }));
    expect(application.store.getState().editorSession.selectedFinding?.origin).toEqual(
      missingFinding.origin,
    );
    await user.click(result);
    const resultList = screen.getByRole('listbox');
    await waitFor(() => expect(within(resultList).getByText('Last Gasp')).toBeTruthy());
    await user.click(within(resultList).getByText('Last Gasp'));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .keepsakeEquipResults?.jeweledPom,
    ).toEqual({
      traitKey: 'HadesDeathDefianceDamageBoon',
    });
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.routes[0]?.biomes,
    ).toHaveLength(1);

    expect(screen.queryByRole('checkbox', { name: 'Death Defiance condition met' })).toBeNull();
  });

  it('repairs the route-start Experimental Hammer result through its projected control', async () => {
    const { application, user } = renderPlannerForInteraction();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');
    const startingKeepsake = screen.getByRole('button', { name: 'Starting keepsake' });
    await user.click(startingKeepsake);
    await user.click(within(screen.getByRole('listbox')).getByText('Experimental Hammer'));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .keepsakeEquipResults?.experimentalHammer,
    ).toBeUndefined();
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.routes[0],
    ).toMatchObject({
      status: 'incomplete',
      biomes: [],
      processing: { active: null, blockedSuffix: ['F'] },
      summary: { evaluatedBiomeCount: 0, blockedBiomeCount: 1, eligibleForExecutionPlan: false },
    });

    const result = await screen.findByRole('button', { name: 'Experimental Hammer result' });
    const finding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
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
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .keepsakeEquipResults?.experimentalHammer,
    ).toEqual({ kind: 'selected', traitKey: authoredTraitKey });
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.routes[0]?.biomes,
    ).toHaveLength(1);
    expect(result.textContent).toContain('Wicked Thrasher');

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      screen.getByRole('button', { name: 'Experimental Hammer result' }).textContent,
    ).toContain('Choose compatible Hammer');
    expect(
      application.store.getState().projectWorkspace.assembly.evaluation.routes[0]?.biomes,
    ).toHaveLength(0);
  });

  it('navigates to and repairs the reached I Gift Hammer child', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenEchoGiftHammerPendingProject()));
    const missing = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) =>
          finding.code === 'keepsakeEquipResultMissing' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(echoGiftHammerReplayAddress),
      );
    if (missing === undefined) throw new Error('I Gift Hammer finding is missing');
    const interaction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.keepsakeEquipResults.get(semanticAddressKey(echoGiftHammerReplayAddress));
    if (interaction?.owner.resultKind !== 'experimentalHammer')
      throw new Error('I Gift Hammer interaction is missing');
    const candidate = interaction
      .load()
      .picker.sections.flatMap((section) => section.items)
      .find((option) => option.value !== '__exhausted' && option.state === 'possible');
    if (candidate === undefined) throw new Error('I Gift Hammer has no selectable result');

    const { user } = renderPlannerForInteraction({ application });
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    await user.click(
      within(findings).getByRole('button', { name: /Choose Experimental Hammer result/ }),
    );

    expect(application.store.getState().editorSession.selectedFinding?.origin).toEqual(
      echoGiftHammerReplayAddress,
    );
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
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
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'I')?.echoKeepsakeReplayResults
        ?.experimentalHammer,
    ).toEqual({ kind: 'selected', traitKey: candidate.value });
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly.evaluation.findings.some(
          (finding) =>
            semanticAddressKey(finding.origin) === semanticAddressKey(echoGiftHammerReplayAddress),
        ),
    ).toBe(false);
  });

  it('authors Arcana and Fear through bounded controls with undo and redo', async () => {
    const { application, user } = renderPlannerForInteraction();

    const arcana = screen.getByRole('group', { name: 'Arcana, 0 active' });
    const arcanaSummary = arcana.querySelector('summary');
    if (arcanaSummary === null) throw new Error('Arcana summary is missing');
    await user.click(arcanaSummary);
    expect(screen.getByRole('checkbox', { name: 'The Moon (automatic)' })).toHaveProperty(
      'disabled',
      true,
    );
    await user.click(screen.getByRole('checkbox', { name: /The Sorceress/ }));

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);
    expect(screen.getByRole('group', { name: 'Arcana, 3 active' })).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual([]);
    await user.click(screen.getByRole('button', { name: 'Redo' }));
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout
        .manualArcanaKeys,
    ).toEqual(['ChanneledCast']);

    const fear = screen.getByRole('group', { name: 'Fear, 0 total' });
    const fearSummary = fear.querySelector('summary');
    if (fearSummary === null) throw new Error('Fear summary is missing');
    await user.click(fearSummary);
    await user.selectOptions(screen.getByLabelText('Vow of Pain rank'), '3');

    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout.fearRanks
        .EnemyDamageShrineUpgrade,
    ).toBe(3);
    expect(screen.getByRole('group', { name: 'Fear, 5 total' })).toBeTruthy();
  });
});

describe('project profile interaction', () => {
  it('saves, replaces, and reloads the project through the visible profile controls', async () => {
    let profileJson: string | null = null;
    let profileFileName: string | null = null;
    const profileFile: ProfileFileAdapter = {
      save: (fileName, json) => {
        profileFileName = fileName;
        profileJson = json;
        return Promise.resolve('saved');
      },
      load: () =>
        Promise.resolve(
          profileJson === null || profileFileName === null
            ? null
            : { fileName: profileFileName, json: profileJson },
        ),
    };
    const application = createApplication({ profileFile });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('button', { name: 'New' }).classList.contains('danger-action')).toBe(
      true,
    );
    expect(
      screen.getByRole('button', { name: 'Save Profile' }).classList.contains('secondary-action'),
    ).toBe(true);
    expect(
      screen.getByRole('button', { name: 'Load Profile' }).classList.contains('danger-action'),
    ).toBe(true);
    expect(screen.getByText('Unsaved')).toBeTruthy();
    await user.selectOptions(screen.getByLabelText('Configure route up to'), '1');
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
    const savedEvaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    await user.click(screen.getByRole('button', { name: 'Save Profile' }));
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

    await user.click(screen.getByRole('button', { name: 'New' }));
    expect(configuredBiomeCount(application)).toBe(0);
    expect(screen.getByText('Created a new project.')).toBeTruthy();
    expect(screen.getByText('Unsaved')).toBeTruthy();

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));
    expect(await screen.findByText('Loaded the profile.')).toBeTruthy();
    expect(configuredBiomeCount(application)).toBe(1);
    expect(
      application.store.getState().projectWorkspace.history.present.routes[0]?.loadout,
    ).toMatchObject({
      manualArcanaKeys: ['ChanneledCast'],
      fearRanks: { EnemyDamageShrineUpgrade: 3 },
    });
    expect(application.store.getState().projectWorkspace.history.past).toEqual([]);
    expect(application.store.getState().projectWorkspace.history.future).toEqual([]);
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toEqual(
      savedEvaluation,
    );
    expect(screen.getByText('Clean')).toBeTruthy();
  });

  it('presents a restored startup project as recovered', () => {
    const source = createApplication();
    const json = encodeProjectDocument(source.store.getState().projectWorkspace.history.present);
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
    });
    const { user } = renderPlannerForInteraction({ application });

    expect(screen.getByRole('alert').textContent).toBe(
      'Autosave recovery failed: $: must be valid JSON',
    );
    expect(screen.getByText('Unsaved')).toBeTruthy();
    const discard = screen.getByRole('button', { name: 'Discard Autosave' });
    expect(discard.classList.contains('danger-action')).toBe(true);
    await user.click(discard);

    expect(recoveryJson).toBeNull();
    expect(screen.queryByText('Autosave recovery failed: $: must be valid JSON')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Discard Autosave' })).toBeNull();
    expect(screen.getByText('Discarded the unreadable autosave.')).toBeTruthy();
  });

  it('presents a load failure and retains the current workspace', async () => {
    const application = createApplication({
      profileFile: {
        save: () => Promise.resolve('saved'),
        load: () => Promise.resolve({ fileName: 'broken.runplanner.json', json: '{not json' }),
      },
    });
    const workspace = application.store.getState().projectWorkspace;
    const { user } = renderPlannerForInteraction({ application });

    await user.click(screen.getByRole('button', { name: 'Load Profile' }));

    expect((await screen.findByRole('alert')).textContent).toBe(
      'Load Profile failed: $: must be valid JSON',
    );
    expect(application.store.getState().projectWorkspace).toBe(workspace);
  });
});
