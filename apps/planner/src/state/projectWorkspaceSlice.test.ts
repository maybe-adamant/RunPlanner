import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createDefaultRouteLoadout,
  createEmptyProjectDocument,
  createEncounterPhaseAddress,
  echoLastRewardPickupEntryKey,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createRouteAddress,
  createTraitOfferAddress,
  hermesShrineDeliveryEntryKey,
  type ProjectCommand,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { describe, expect, it, vi } from 'vitest';

import { createInitialProject } from '../composition/projectBootstrap';
import { semanticOwnerFocused } from './editorSessionSlice';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from './projectWorkspaceSlice';
import {
  createPlannerStore,
  selectCanRedoProject,
  selectCanUndoProject,
  selectPresentProject,
  selectProjectEvaluation,
  selectProjectHistory,
} from './store';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createCompleteFGProject,
  createGoldenFGHProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
} from '@run-planner/test-fixtures/underworld';
import {
  createSurfaceNShrineSideRoomDeliveryCheckpoint,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
} from '@run-planner/test-fixtures/surface';

function createStore() {
  const assembleProjectEvaluation = vi.fn((project: ProjectDocument) =>
    simulateProjectAssembly(catalog, project),
  );
  const store = createPlannerStore({
    assembleProjectEvaluation,
    catalog,
    initialProject: createInitialProject(catalog),
  });
  return { assembleProjectEvaluation, store };
}

describe('project workspace application state', () => {
  it('publishes an exact 30-Grasp loadout and rejects an impossible Redux command atomically', () => {
    const { store } = createStore();
    const route = createRouteAddress('Underworld');
    const exactThirty = [
      'ManaOverTime',
      'StatusVulnerability',
      'StartingGold',
      'RarityBoost',
      'LastStand',
      'ScreenReroll',
      'LowManaDamageBonus',
    ];
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceManualArcanaSelection',
        route,
        arcanaKeys: exactThirty,
      }),
    );
    const exactWorkspace = store.getState().projectWorkspace;
    expect(exactWorkspace.history.present.routes[0]?.loadout.manualArcanaKeys).toHaveLength(7);

    expect(() =>
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceManualArcanaSelection',
          route,
          arcanaKeys: [...exactThirty, 'HealthRegen'],
        }),
      ),
    ).toThrow('manual Arcana cost 31 exceeds starting Grasp capacity 30');
    expect(store.getState().projectWorkspace).toBe(exactWorkspace);
  });

  it('atomically boots one empty authored history and its exact evaluation', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const state = store.getState();
    const project = selectPresentProject(state);

    expect(project.projectId).toBe('run-plan');
    expect(project.routes).toEqual([
      {
        routeKey: 'Underworld',
        loadout: createDefaultRouteLoadout(catalog),
        resourcePlacements: {
          Exorcism: null,
          Fishing: null,
          Pickaxe: null,
          Shovel: null,
        },
        biomes: [],
      },
      {
        routeKey: 'Surface',
        loadout: createDefaultRouteLoadout(catalog),
        resourcePlacements: {
          Exorcism: null,
          Fishing: null,
          Pickaxe: null,
          Shovel: null,
        },
        biomes: [],
      },
    ]);
    expect(selectProjectEvaluation(state)).toBe(
      assembleProjectEvaluation.mock.results[0]?.value.evaluation,
    );
    expect(state.projectWorkspace.assembly.project).toBe(project);
    expect(selectProjectEvaluation(state)).toBe(state.projectWorkspace.assembly.evaluation);
    expect(assembleProjectEvaluation.mock.calls[0]?.[0]).toBe(project);
    expect(selectProjectEvaluation(state).status).toBe('empty');
    expect(selectCanUndoProject(state)).toBe(false);
    expect(selectCanRedoProject(state)).toBe(false);
  });

  it('rejects an otherwise valid assembly for a different authored identity', () => {
    const initialProject = createInitialProject(catalog);
    const foreignProject = createEmptyProjectDocument(catalog, {
      projectId: 'foreign-assembly',
    });

    expect(() =>
      createPlannerStore({
        assembleProjectEvaluation: () => simulateProjectAssembly(catalog, foreignProject),
        catalog,
        initialProject,
      }),
    ).toThrow(/does not match authored workspace identity/);
  });

  it('publishes one replacement evaluation after edit, undo, and redo', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const original = selectPresentProject(store.getState());
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
      }),
    );
    const configured = selectPresentProject(store.getState());
    const command = {
      kind: 'CreateStart',
      biome: createBiomeAddress('Underworld', 'F'),
      occurrenceId: createOccurrenceId('f-start'),
      gameName: 'F_Opening01',
    } as const satisfies ProjectCommand;

    store.dispatch(authoredProjectCommandDispatched(command));
    const editedState = store.getState();
    const editedHistory = selectProjectHistory(editedState);
    const editedPlan = editedHistory.present.routes[0]?.biomes[0];
    if (editedPlan === undefined) throw new Error('expected edited F plan');
    expect(editedHistory.past).toEqual([original, configured]);
    expect(editedPlan.topology?.startOccurrenceId).toBe('f-start');
    expect(editedHistory.future).toEqual([]);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(3);
    expect(assembleProjectEvaluation.mock.calls[2]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(editedState)).toBe(
      assembleProjectEvaluation.mock.results[2]?.value.evaluation,
    );

    store.dispatch(authoredProjectUndoRequested());
    const undoneState = store.getState();
    expect(selectPresentProject(undoneState)).toBe(configured);
    expect(selectProjectHistory(undoneState).future).toEqual([editedHistory.present]);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(4);
    expect(assembleProjectEvaluation.mock.calls[3]?.[0]).toBe(configured);
    expect(selectProjectEvaluation(undoneState)).toBe(
      assembleProjectEvaluation.mock.results[3]?.value.evaluation,
    );

    store.dispatch(authoredProjectRedoRequested());
    const redoneState = store.getState();
    expect(selectPresentProject(redoneState)).toBe(editedHistory.present);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(5);
    expect(assembleProjectEvaluation.mock.calls[4]?.[0]).toBe(editedHistory.present);
    expect(selectProjectEvaluation(redoneState)).toBe(
      assembleProjectEvaluation.mock.results[4]?.value.evaluation,
    );
  });

  it('reschedules one delayed Shrine delivery through simulation as one undo step', () => {
    const { store } = createStore();
    const source = createOccurrenceAddress(nBiome, nLocalOccurrenceId('combat11', 'sideDoor1'));
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    store.dispatch(authoredProjectReplaced(createSurfaceNShrineSideRoomDeliveryCheckpoint()));

    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'SetHermesShrinePurchase',
        occurrence: source,
        generationKey: 'initial:secondLeft',
        purchase: { delay: 2, rushed: false },
      }),
    );
    const delayTwo = selectPresentProject(store.getState());
    const nPlanAtDelayTwo = delayTwo.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const delayTwoHost = nPlanAtDelayTwo?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === nOccurrenceId('combat09'),
    );
    const retained =
      delayTwoHost?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey];
    expect(retained).toMatchObject({ offer: { rewardType: 'MaxHealthDrop' } });

    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'SetHermesShrinePurchase',
        occurrence: source,
        generationKey: 'initial:secondLeft',
        purchase: { delay: 3, rushed: false },
      }),
    );
    const delayThree = selectPresentProject(store.getState());
    const nPlanAtDelayThree = delayThree.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const deliveryOwners = nPlanAtDelayThree?.topology?.occurrences.filter(
      (occurrence) =>
        occurrence.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey] !== undefined,
    );
    expect(deliveryOwners).toHaveLength(1);
    expect(deliveryOwners?.[0]).toMatchObject({ gameName: 'N_Boss01' });
    expect(
      deliveryOwners?.[0]?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey],
    ).toEqual(retained);
    expect(deliveryOwners?.[0]?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
      encounterPhaseKey: 'Encounter',
    });
    expect(
      store
        .getState()
        .projectWorkspace.assembly.evaluation.findings.some(
          (finding) =>
            finding.origin.kind === 'acquisitionEntry' && finding.origin.entryKey === entryKey,
        ),
    ).toBe(false);

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(delayTwo);
  });

  it('undoes and redoes one atomic Echo Pom child edit with its outer selection', () => {
    const { store } = createStore();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = authorLegalTraitOffers(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: bridgeId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
          { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
        ],
        selectedOptionKey: 'option1',
      },
    });
    store.dispatch(authoredProjectReplaced(project));
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const before = selectPresentProject(store.getState());
    const bridge = before.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const editedOffer = Object.freeze({
      ...offer,
      selectedOptionKey: 'option3' as const,
      options: Object.freeze([
        offer.options[0],
        offer.options[1],
        Object.freeze({ ...offer.options[2], echoPomTarget: null }),
      ]) as typeof offer.options,
    });
    store.dispatch(
      authoredProjectCommandDispatched({ kind: 'ReplaceTraitOffer', trait, value: editedOffer }),
    );
    const edited = selectPresentProject(store.getState());
    expect(edited).not.toBe(before);

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('undoes and redoes one atomic complete All Together result edit', () => {
    const { store } = createStore();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1));
    const trait = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
    });
    const initialOffer = Object.freeze({
      kind: 'traits' as const,
      giverKey: 'Hera',
      options: Object.freeze([
        Object.freeze({
          traitKey: 'AllElementalBoon',
          rarity: 'Legendary' as const,
          allTogetherResult: Object.freeze({
            earth: 'ElementalDamageBoon',
            fire: 'ElementalBaseDamageBoon',
            air: 'ElementalDamageFloorBoon',
            water: 'ElementalHealthBoon',
          }),
        }),
        Object.freeze({ traitKey: 'HeraManaBoon', rarity: 'Common' as const }),
        Object.freeze({ traitKey: 'HeraSprintBoon', rarity: 'Common' as const }),
      ] as const),
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait,
      value: initialOffer,
    });
    store.dispatch(authoredProjectReplaced(project));
    const before = selectPresentProject(store.getState());
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceTraitOffer',
        trait,
        value: Object.freeze({
          ...initialOffer,
          options: Object.freeze([
            Object.freeze({
              ...initialOffer.options[0],
              allTogetherResult: Object.freeze({
                ...initialOffer.options[0].allTogetherResult,
                earth: 'ElementalOlympianDamageBoon',
              }),
            }),
            initialOffer.options[1],
            initialOffer.options[2],
          ] as const),
        }),
      }),
    );
    const edited = selectPresentProject(store.getState());
    expect(JSON.stringify(edited)).toContain('ElementalOlympianDamageBoon');
    expect(JSON.stringify(edited)).toContain('ElementalBaseDamageBoon');

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('undoes and redoes one atomic Echo Boon child edit with its outer selection', () => {
    const { store } = createStore();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = authorLegalTraitOffers(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: bridgeId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'EchoLastRunBoon' },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    store.dispatch(authoredProjectReplaced(project));
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const before = selectPresentProject(store.getState());
    const bridge = before.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const editedOffer = Object.freeze({
      ...offer,
      selectedOptionKey: 'option1' as const,
      options: Object.freeze([
        Object.freeze({
          traitKey: 'EchoLastRunBoon',
          echoLastRunBoon: Object.freeze({
            options: Object.freeze([
              Object.freeze({
                giverKey: 'Hera',
                traitKey: 'BoonDecayBoon',
                rarity: 'Heroic' as const,
                targetTraitKey: 'HephaestusWeaponBoon',
              }),
            ] as const),
            selectedOptionKey: 'option1' as const,
          }),
        }),
        offer.options[1],
        offer.options[2],
      ]) as typeof offer.options,
    });
    store.dispatch(
      authoredProjectCommandDispatched({ kind: 'ReplaceTraitOffer', trait, value: editedOffer }),
    );
    const edited = selectPresentProject(store.getState());
    expect(edited).not.toBe(before);

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('undoes and redoes an Echo replay selection with its required generated row', () => {
    const { store } = createStore();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    let project = createGoldenFGHProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = authorLegalTraitOffers(project);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: createTraitOfferAddress(
        createEncounterPhaseAddress(
          goldenHBiome,
          { kind: 'occurrence', occurrenceId: bridgeId },
          'Encounter',
        ),
        'selection',
      ),
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'EchoLastReward' },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'DiminishingHealthAndManaBoon' },
        ],
        selectedOptionKey: 'option2',
      },
    });
    store.dispatch(authoredProjectReplaced(project));
    const trait = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const before = selectPresentProject(store.getState());
    const bridge = before.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    const offer = bridge.encounters.traitOffersByPhase?.Encounter?.Story_Echo_01;
    if (offer?.kind !== 'traits') throw new Error('Echo offer is missing');
    const editedOffer = Object.freeze({
      ...offer,
      selectedOptionKey: 'option1' as const,
    });
    store.dispatch(
      authoredProjectCommandDispatched({ kind: 'ReplaceTraitOffer', trait, value: editedOffer }),
    );
    const edited = selectPresentProject(store.getState());
    expect(edited).not.toBe(before);
    const editedBridge = edited.routes[0]!.biomes.find(
      (biome) => biome.biomeKey === 'H',
    )!.topology!.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)!;
    expect(editedBridge.roomActions.order).toEqual([
      { kind: 'interactEncounter', phaseKey: 'Encounter' },
      {
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1'),
      },
    ]);
    expect(
      editedBridge.acquisitionSites?.roomExit?.pickupEntries?.[
        echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1')
      ],
    ).toBeDefined();

    store.dispatch(authoredProjectUndoRequested());
    expect(selectPresentProject(store.getState())).toBe(before);
    store.dispatch(authoredProjectRedoRequested());
    expect(selectPresentProject(store.getState())).toBe(edited);
  });

  it('retains the coherent workspace without resimulation for semantic and history no-ops', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const original = store.getState().projectWorkspace;

    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 0,
      }),
    );
    store.dispatch(authoredProjectUndoRequested());
    store.dispatch(authoredProjectRedoRequested());

    expect(store.getState().projectWorkspace).toBe(original);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(1);
  });

  it('replaces project history and evaluates the replacement as one publication', () => {
    const { assembleProjectEvaluation, store } = createStore();
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route: createRouteAddress('Underworld'),
        configuredBiomeCount: 1,
      }),
    );
    const replacement = createEmptyProjectDocument(catalog, {
      projectId: 'replacement',
    });

    store.dispatch(authoredProjectReplaced(replacement));
    const state = store.getState();
    expect(selectProjectHistory(state)).toEqual({ past: [], present: replacement, future: [] });
    expect(selectProjectEvaluation(state).status).toBe('empty');
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(3);
    expect(assembleProjectEvaluation.mock.calls[2]?.[0]).toBe(replacement);
    expect(selectProjectEvaluation(state)).toBe(
      assembleProjectEvaluation.mock.results[2]?.value.evaluation,
    );
  });

  it('keeps projected semantic focus outside authored history and evaluation work', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const before = store.getState().projectWorkspace;
    const owner = createBiomeAddress('Underworld', 'F');

    store.dispatch(semanticOwnerFocused(owner));

    expect(store.getState().projectWorkspace).toBe(before);
    expect(store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(1);
  });

  it('allows the complete authorable Underworld prefix', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const route = createRouteAddress('Underworld');
    store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ConfigureRoutePrefix',
        route,
        configuredBiomeCount: 4,
      }),
    );
    const fghiState = store.getState();
    expect(
      selectPresentProject(fghiState).routes[0]?.biomes.map((biome) => biome.biomeKey),
    ).toEqual(['F', 'G', 'H', 'I']);
    expect(selectProjectEvaluation(fghiState).status).toBe('incomplete');
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(2);
  });

  it('publishes an activated I replacement atomically', () => {
    const { assembleProjectEvaluation, store } = createStore();
    const replacement = createProjectDocument(catalog, {
      projectId: 'i-replacement',
      configuredBiomeCounts: { Underworld: 4 },
    });

    store.dispatch(authoredProjectReplaced(replacement));
    expect(selectPresentProject(store.getState())).toBe(replacement);
    expect(selectProjectEvaluation(store.getState())).toBe(
      assembleProjectEvaluation.mock.results[1]?.value.evaluation,
    );
    expect(assembleProjectEvaluation).toHaveBeenCalledTimes(2);
  });
});
