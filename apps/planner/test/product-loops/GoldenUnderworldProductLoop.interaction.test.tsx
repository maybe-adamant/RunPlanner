// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createEncounterPhaseAddress,
  createEchoLastRunBoonAddress,
  createIncomingRewardAddress,
  createLocalRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  createTraitOfferAddress,
  echoLastRewardPickupEntryKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectReplaced,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import {
  createGoldenFGHIProject,
  goldenHBiome,
  goldenFBiome,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { loadSurfaceNOPQProject } from '@run-planner/test-fixtures/surface';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('underworld product loop', () => {
  it('creates a required pickup atomically and opens its move-only Room Actions workflow without evaluation work', async () => {
    const application = createApplication();
    const biome = createBiomeAddress('Underworld', 'F');
    const occurrenceId = createOccurrenceId('mandatory-default-product');
    application.store.dispatch(
      authoredProjectReplaced(
        createProjectDocument(application.catalog, {
          projectId: 'mandatory-default-product',
          configuredBiomeCounts: { Underworld: 1 },
        }),
      ),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'CreateStart',
        biome,
        occurrenceId,
        gameName: 'F_Opening01',
      }),
    );
    const beforeReward = application.store.getState().projectWorkspace.history.present;
    const historyBefore = application.store.getState().projectWorkspace.history.past.length;
    application.store.dispatch(
      authoredProjectCommandDispatched({
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, occurrenceId),
        value: {
          rewardType: 'Boon',
          payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
        },
      }),
    );
    const authoredOccurrence = () =>
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((plan) => plan.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    expect(authoredOccurrence()?.roomActions.order).toEqual([
      {
        kind: 'interactIncomingReward',
        producerPoint: 'roomRewardPickup',
        acquisitionRole: 'source',
      },
    ]);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(biome, occurrenceId)),
      ),
    );
    const evaluationBefore = application.store.getState().projectWorkspace.assembly.evaluation;
    await view.user.click(screen.getByRole('tab', { name: 'Room Actions' }));
    const actions = screen.getByRole('region', { name: 'Room Actions' });
    const requiredRow = within(actions)
      .getByText('Pick up Boon')
      .closest<HTMLElement>('[data-room-action-key]');
    if (requiredRow === null) throw new Error('required pickup row is missing');
    expect(within(requiredRow).queryByText('Position')).toBeNull();
    expect(within(requiredRow).queryByRole('button', { name: 'Remove' })).toBeNull();
    expect(application.store.getState().projectWorkspace.assembly.evaluation).toBe(
      evaluationBefore,
    );

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history.present).toBe(beforeReward);
  });

  it('renders F through I through one shared biome workspace surface', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    for (const [label, structure] of [
      ['Erebus', 'Erebus route structure'],
      ['Oceanus', 'Oceanus route structure'],
      ['Fields', 'Fields route structure'],
      ['Tartarus', 'Tartarus route structure'],
    ] as const) {
      await view.user.click(screen.getByRole('button', { name: label }));
      expect(screen.getByRole('region', { name: structure })).toBeTruthy();
      expect(document.querySelector('.biome-workspace')).not.toBeNull();
    }

    const evaluation = application.store.getState().projectWorkspace.assembly.evaluation;
    expect(evaluation).toMatchObject({
      findings: [],
      status: 'valid',
      summary: { configuredBiomeCount: 4, eligibleForExecutionPlan: true },
    });
    expect(document.body.textContent).not.toContain('F_Combat');
    expect(document.body.textContent).not.toContain('Linear topology');
  });

  it('repairs a stale Echo replay identity through the focused generated Room Action row', async () => {
    const application = createApplication();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    const combat09 = createOccurrenceId('golden-h-combat09');
    const echoOwner = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const replayKey = echoLastRewardPickupEntryKey('Encounter', 'Story_Echo_01', 'option1');
    const replayEntry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(createOccurrenceAddress(goldenHBiome, bridgeId), 'roomExit'),
      replayKey,
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: combat09,
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'EchoLastReward' },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
        rarificationActions: [],
      },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry: replayEntry,
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(
        goldenHBiome,
        createOccurrenceId('golden-h-combat03'),
        'cages',
        'cage1',
      ),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceLocalReward',
      reward: createLocalRewardAddress(goldenHBiome, combat09, 'cages', 'cage2'),
      value: { rewardType: 'MaxHealthDrop' },
    });
    const roomActionOrderBefore = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)
      ?.roomActions.order;
    if (roomActionOrderBefore === undefined) throw new Error('Echo room action order is missing');
    application.store.dispatch(authoredProjectReplaced(project));

    const staleFinding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (finding) =>
          finding.code === 'rewardSourceUnavailable' &&
          semanticAddressKey(finding.origin) === semanticAddressKey(replayEntry),
      );
    if (staleFinding === undefined) throw new Error('stale Echo replay finding is missing');
    const findingIndex = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.indexOf(staleFinding);
    const rewardInteraction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.rewards.get(semanticAddressKey(replayEntry));
    if (rewardInteraction === undefined) throw new Error('Echo replay interaction is missing');
    expect(rewardInteraction).toMatchObject({ selected: { rewardType: 'WeaponUpgrade' } });
    const repairRewardType = rewardInteraction.authoredRewardTypes[0];
    if (repairRewardType === undefined) throw new Error('Echo replay has no repair reward');
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    const findingButton = within(findings).getAllByRole('button')[findingIndex];
    if (findingButton === undefined) throw new Error('stale Echo replay finding is not presented');
    await view.user.click(findingButton);

    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(replayEntry);
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'H',
    });
    const replayRow = document.getElementById(semanticOwnerControlElementId(replayEntry));
    if (!(replayRow instanceof HTMLElement))
      throw new Error('focused Echo Room Action row is missing');
    const reward = within(replayRow).getByRole('button', { name: 'Reward' });
    await view.user.click(reward);
    expect(await screen.findByRole('listbox')).toBeTruthy();
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched(
          rewardInteraction.intentFor({ rewardType: repairRewardType }).command,
        ),
      ),
    );

    const authoredOccurrence = () =>
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'H')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId);
    await waitFor(() => {
      expect(authoredOccurrence()?.roomActions.order).toEqual(roomActionOrderBefore);
      expect(authoredOccurrence()?.acquisitionSites?.roomExit).toMatchObject({
        pickupEntries: { [replayKey]: { offer: { rewardType: repairRewardType } } },
      });
    });
    expect(
      application.store
        .getState()
        .projectWorkspace.assembly.evaluation.findings.some(
          (finding) => semanticAddressKey(finding.origin) === semanticAddressKey(replayEntry),
        ),
    ).toBe(false);

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    expect(authoredOccurrence()?.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: { [replayKey]: { offer: { rewardType: 'WeaponUpgrade' } } },
    });
    act(() => application.store.dispatch(authoredProjectRedoRequested()));
    expect(authoredOccurrence()?.acquisitionSites?.roomExit).toMatchObject({
      pickupEntries: { [replayKey]: { offer: { rewardType: repairRewardType } } },
    });
  });

  it('opens a missing Boon Boon Boon finding at its forced child checkpoint', async () => {
    const application = createApplication();
    const bridgeId = createOccurrenceId('golden-h-bridge01');
    const echoOwner = createTraitOfferAddress(
      createEncounterPhaseAddress(
        goldenHBiome,
        { kind: 'occurrence', occurrenceId: bridgeId },
        'Encounter',
      ),
      'selection',
    );
    const child = createEchoLastRunBoonAddress(echoOwner, 'option1');
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenHBiome, {
        kind: 'occurrence',
        occurrenceId: createOccurrenceId('golden-h-combat09'),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceTraitOffer',
      trait: echoOwner,
      value: {
        kind: 'traits',
        giverKey: 'Echo',
        options: [
          { traitKey: 'EchoLastRunBoon' },
          { traitKey: 'DiminishingDodgeBoon' },
          { traitKey: 'EchoDoubleLevelBoon', echoPomTarget: null },
        ],
        selectedOptionKey: 'option1',
        deathDefianceConditionMet: false,
        rarificationActions: [],
      },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const finding = application.store
      .getState()
      .projectWorkspace.assembly.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'echoLastRunBoonMissing' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(child),
      );
    if (finding === undefined) throw new Error('BBB child finding is missing');

    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    const findings = screen.getByRole('heading', { name: 'Findings' }).closest('section');
    if (findings === null) throw new Error('Findings panel is missing');
    await view.user.click(
      within(findings).getByRole('button', { name: /Choose the Boon Boon Boon outcomes/ }),
    );

    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByText('Echo offer > Boon Boon Boon choice')).toBeDefined();
    const childControl = document.getElementById(semanticOwnerControlElementId(child));
    if (!(childControl instanceof HTMLElement)) throw new Error('BBB child control is missing');
    await waitFor(() => expect(document.activeElement).toBe(childControl));
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(child);
    expect(application.store.getState().editorSession.traitDialogTarget).toEqual(echoOwner);
    expect(dialog.textContent).not.toContain('Picked up');
  });

  it('authors, configures, selects, and continues through a natural Chaos gate', async () => {
    const application = createApplication();
    const opening = createOccurrenceId('product-natural-chaos-opening');
    let project = createProjectDocument(application.catalog, {
      configuredBiomeCounts: { Underworld: 1 },
      projectId: 'natural-chaos-product-loop',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateStart',
      biome: goldenFBiome,
      occurrenceId: opening,
      gameName: 'F_Opening01',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward: createIncomingRewardAddress(goldenFBiome, opening),
      value: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
    });
    project = authorLegalTraitOffers(project);
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, opening)),
      ),
    );
    await view.user.click(screen.getByRole('button', { name: 'Add Chaos gate' }));

    const topology = () =>
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')?.topology;
    const authoredGate = topology()
      ?.occurrences.find((occurrence) => occurrence.occurrenceId === opening)
      ?.additionalExits.find((additional) => additional.kind === 'naturalChaos');
    if (authoredGate === undefined) throw new Error('natural Chaos gate was not authored');
    const chaosOccurrenceId = authoredGate.occurrenceId;
    const source = { kind: 'occurrence' as const, occurrenceId: opening };
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createExitDecisionAddress(goldenFBiome, source)),
      ),
    );

    await view.user.selectOptions(screen.getByLabelText(/Reward Pool/), 'MetaProgress');
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const normalRoom = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-disabled') !== 'true');
    if (normalRoom === undefined) throw new Error('natural Chaos normal lane has no room choice');
    await view.user.click(normalRoom);
    const normalDecision = topology()?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === opening,
    );
    const normalTarget =
      normalDecision?.kind === 'exit' ? normalDecision.normal.targets[0] : undefined;
    if (normalTarget === undefined) throw new Error('natural Chaos normal target is missing');
    const normalReward = createIncomingRewardAddress(goldenFBiome, normalTarget.occurrenceId);
    const rewardInteraction = application
      .selectStructuredWorkspace(application.store.getState())
      .interactions.rewards.get(semanticAddressKey(normalReward));
    if (rewardInteraction === undefined) throw new Error('natural Chaos reward editor is missing');
    const rewardDomain = await rewardInteraction.load();
    const supportedReward = rewardDomain.types.find(
      (option) => option.evaluation.kind === 'incomingReward' && option.evaluation.result.supported,
    )?.supportingOffer;
    if (supportedReward === undefined) throw new Error('natural Chaos target has no valid reward');
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched(rewardInteraction.intentFor(supportedReward).command),
      ),
    );

    const gate = await screen.findByRole('article', { name: 'Chaos gate exit' });
    await view.user.selectOptions(within(gate).getByLabelText('Map'), 'Chaos_06');
    expect((within(gate).getByLabelText('Map') as HTMLSelectElement).value).toBe('Chaos_06');
    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect((within(gate).getByLabelText('Map') as HTMLSelectElement).value).toBe('Chaos_01');
    await view.user.selectOptions(within(gate).getByLabelText('Map'), 'Chaos_06');
    await view.user.click(within(gate).getByRole('button', { name: 'Open Chaos 06 room' }));
    const enteredChaos = screen.getByRole('complementary', { name: 'Details' });
    expect(within(enteredChaos).queryByLabelText('Map')).toBeNull();
    expect(within(enteredChaos).queryByLabelText('Room')).toBeNull();
    expect(within(enteredChaos).queryByLabelText('Reward')).toBeNull();
    expect(within(enteredChaos).queryByText(/Incoming door reward|Trial Upgrade/)).toBeNull();
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createExitDecisionAddress(goldenFBiome, source)),
      ),
    );
    const configuredGate = await screen.findByRole('article', { name: 'Chaos gate exit' });
    await view.user.click(within(configuredGate).getByLabelText('Take Chaos gate'));
    expect(
      topology()?.occurrences.find((occurrence) => occurrence.occurrenceId === chaosOccurrenceId)
        ?.gameName,
    ).toBe('Chaos_06');
    expect(
      topology()?.decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === opening,
      ),
    ).toMatchObject({
      selection: { kind: 'additional', additionalExitKey: 'naturalChaos' },
    });
    application.store.dispatch(
      authoredProjectReplaced(
        authorLegalTraitOffers(application.store.getState().projectWorkspace.history.present),
      ),
    );
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, chaosOccurrenceId)),
      ),
    );
    await view.user.click(screen.getByRole('tab', { name: 'Room Actions' }));
    expect(within(enteredChaos).getByRole('region', { name: 'Room Actions' })).toBeTruthy();
    expect(within(enteredChaos).queryByText(/Incoming door reward/)).toBeNull();

    await view.user.click(screen.getByRole('button', { name: /Next step.*Continue route/ }));
    expect(
      topology()?.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaosOccurrenceId,
      ),
    ).toBe(false);
    await view.user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    const rewardPool = screen.getByRole('combobox', { name: /Reward Pool/ });
    await view.user.click(rewardPool);
    let nextPool: HTMLOptionElement | undefined;
    await waitFor(() => {
      nextPool = within(rewardPool)
        .getAllByRole('option')
        .find(
          (option): option is HTMLOptionElement =>
            option instanceof HTMLOptionElement &&
            ['forced', 'possible'].includes(option.dataset.candidateSupport ?? ''),
        );
      expect(nextPool).toBeDefined();
    });
    if (nextPool === undefined) throw new Error('Chaos frontier has no selectable reward pool');
    await view.user.selectOptions(rewardPool, nextPool.value);
    expect(
      topology()?.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaosOccurrenceId,
      ),
    ).toBe(true);

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      topology()?.decisions.some(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === chaosOccurrenceId,
      ),
    ).toBe(false);
  });

  it('keeps a blocked downstream biome structurally authorable through the workspace', async () => {
    const application = createApplication();
    const view = renderPlannerForInteraction({ application });

    await view.user.selectOptions(screen.getByLabelText('Configure route up to'), '2');
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    expect(
      screen.getByText(
        'Finish and fix Erebus before Oceanus can be evaluated. You can still edit it.',
      ),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Start biome' })).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Start biome' }));
    const structure = screen.getByRole('region', { name: 'Oceanus route structure' });
    await view.user.click(within(structure).getByRole('button', { name: /Continue route/ }));
    await view.user.click(screen.getByRole('tab', { name: 'Room Doors' }));
    expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Remove these doors' })).toBeNull();
    expect(screen.queryByText('Add doors')).toBeNull();
    const g = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(g?.topology).not.toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Start biome' })).toBeTruthy());
    const undone = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    expect(undone?.topology).toBeNull();
  });

  it('shrinks a route prefix immediately and preserves existing undo behavior', async () => {
    const application = createApplication();
    application.store.dispatch(
      authoredProjectCommandDispatched({
        configuredBiomeCount: 1,
        kind: 'ConfigureRoutePrefix',
        route: { kind: 'route', routeKey: 'Underworld' },
      }),
    );
    application.store.dispatch(
      authoredProjectCommandDispatched({
        biome: createBiomeAddress('Underworld', 'F'),
        gameName: 'F_Opening02',
        kind: 'CreateStart',
        occurrenceId: createOccurrenceId('underworld-prefix-undo-start'),
      }),
    );
    const beforeShrink = application.store.getState().projectWorkspace.history.present;
    const view = renderPlannerForInteraction({ application });
    const confirmation = vi.spyOn(globalThis, 'confirm');

    await view.user.click(screen.getByRole('button', { name: 'Route' }));
    await view.user.selectOptions(screen.getByLabelText('Configure route up to'), '0');
    expect(application.store.getState().projectWorkspace.assembly.evaluation.status).toBe('empty');
    expect(confirmation).not.toHaveBeenCalled();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(application.store.getState().projectWorkspace.history.present).toBe(beforeShrink);
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    expect(screen.getByRole('button', { name: /Opening/ })).toBeTruthy();
  });

  it('keeps pointer and keyboard workflows available across decisions, fixed stages, Hub, and completion landmarks', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    const fStructure = screen.getByRole('region', { name: 'Erebus route structure' });
    const ordinary = fStructure.querySelector<HTMLButtonElement>(
      '[data-kind="ordinaryBatch"] button',
    );
    if (ordinary === null) throw new Error('F ordinary batch rail node is missing');
    act(() => ordinary.focus());
    await view.user.keyboard('{Enter}');
    expect(
      screen
        .getByRole('complementary', { name: 'Details' })
        .querySelector('.biome-occurrence-workbench > header h3'),
    ).not.toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    const gStructure = screen.getByRole('region', { name: 'Oceanus route structure' });
    const takeover = gStructure.querySelector<HTMLButtonElement>(
      '[data-kind="takeoverBatch"] button',
    );
    if (takeover === null) throw new Error('G takeover rail node is missing');
    await view.user.click(takeover);
    expect(screen.getByRole('heading', { level: 3, name: 'Entering Preboss' })).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Tartarus' }));
    const iStructure = screen.getByRole('region', { name: 'Tartarus route structure' });
    const mixed = iStructure.querySelector<HTMLButtonElement>('[data-kind="mixedBatch"] button');
    if (mixed === null) throw new Error('I mixed batch rail node is missing');
    await view.user.click(mixed);
    expect(screen.getByRole('heading', { level: 3, name: /^Entering Preboss/ })).toBeTruthy();

    act(() => application.store.dispatch(authoredProjectReplaced(loadSurfaceNOPQProject())));
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    const nStructure = screen.getByRole('region', { name: 'Ephyra route structure' });
    const preHub = Array.from(
      nStructure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.textContent?.includes('Pre-Hub'));
    if (preHub === undefined) throw new Error('N PreHub rail stage is missing');
    await view.user.click(preHub);
    expect(
      within(screen.getByRole('complementary', { name: 'Details' })).getByRole('heading', {
        level: 3,
        name: /^Entering Pre-Hub/,
      }),
    ).toBeTruthy();

    const hub = nStructure.querySelector<HTMLButtonElement>('[data-kind="hubDecision"] button');
    if (hub === null) throw new Error('N Hub rail node is missing');
    await view.user.click(hub);
    const hubSlot = screen.getByRole('checkbox', { name: 'Combat 04 open' }) as HTMLInputElement;
    act(() => hubSlot.focus());
    await view.user.keyboard('[Space]');
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Combat 04 open' }) as HTMLInputElement).checked,
      ).toBe(true),
    );

    await view.user.click(screen.getByRole('button', { name: 'Olympus' }));
    const pStructure = screen.getByRole('region', { name: 'Olympus route structure' });
    expect(pStructure.querySelector('[data-kind="completion"]')).toBeNull();
    const completion = within(pStructure).getByRole('region', { name: 'Biome completion' });
    expect(within(completion).getByText('Prometheus')).toBeTruthy();
  }, 10_000);

  it('carries an Anomaly failure through the browser without acquiring its retained offer', async () => {
    const application = createApplication();
    const anomaly = goldenGOccurrenceId(3, 2);
    const source = goldenGOccurrenceId(2, 1);
    const returned = createOccurrenceId('product-anomaly-return');
    let project = createGoldenFGHIProject();
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SwitchTargetToAnomaly',
      target: createTargetAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: source },
        'exit2',
      ),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: goldenGOccurrenceId(3, 1),
      }),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: source,
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: anomaly,
      }),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: anomaly,
      }),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(
        goldenGBiome,
        { kind: 'occurrence', occurrenceId: anomaly },
        'exit1',
      ),
      occurrenceId: returned,
      gameName: 'G_Combat04',
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenGBiome, anomaly)),
      ),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Cleared' }));
    const failed = application.store.getState().projectWorkspace.history.present;
    expect(
      failed.routes
        .find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'G')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === anomaly)?.state,
    ).toMatchObject({ kind: 'anomaly', success: false });
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(
          createExitDecisionAddress(goldenGBiome, {
            kind: 'occurrence',
            occurrenceId: anomaly,
          }),
        ),
      ),
    );
    const automaticReturn = screen.getByRole('group', {
      name: 'Outgoing doors room offers',
    });
    expect(within(automaticReturn).getAllByRole('article')).toHaveLength(1);
    expect(within(automaticReturn).queryByRole('radio')).toBeNull();
    expect(
      within(automaticReturn).getByRole('button', { name: 'Open Combat 04 room' }),
    ).toBeTruthy();
    const evaluation = simulateProject(application.catalog, failed);
    const gEvaluation = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (gEvaluation === undefined || !('rewards' in gEvaluation)) {
      throw new Error('Anomaly failure must retain an evaluated G reward prefix');
    }
    const anomalyReward = createIncomingRewardAddress(goldenGBiome, anomaly);
    const materialized =
      'snapshot' in gEvaluation ? gEvaluation.snapshot : gEvaluation.materializedPrefix;
    const anomalyRoom = materialized.decisions
      .filter((decision) => decision.kind === 'batch')
      .flatMap((decision) => decision.targets)
      .find((target) => target.room.occurrenceId === anomaly)?.room;
    expect(anomalyRoom?.incomingReward?.offer).toBeDefined();
    const hasConcreteAcquisition = gEvaluation.rewards.branches.some((branch) =>
      branch.events.some(
        (event) =>
          event.kind === 'concreteAcquisition' &&
          semanticAddressKey(event.origin) === semanticAddressKey(anomalyReward),
      ),
    );
    expect(hasConcreteAcquisition).toBe(false);
  });

  it('takes a selected Zagreus contract through its automatic host return in the browser', async () => {
    const application = createApplication();
    const biome = goldenGBiome;
    const shop = goldenGOccurrenceId(5, 1);
    const contract = createOccurrenceId('product-zagreus-contract');
    const returned = createOccurrenceId('product-zagreus-return');
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(biome, source.occurrenceId, 'zagreusContract');
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: contract,
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(biome, {
        kind: 'occurrence',
        occurrenceId: goldenGOccurrenceId(6, 1),
      }),
    });
    project = authorLegalTraitOffers(project);
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    act(() =>
      application.store.dispatch(semanticOwnerFocused(createExitDecisionAddress(biome, source))),
    );

    expect((screen.getByLabelText('Take Zagreus contract') as HTMLInputElement).checked).toBe(
      false,
    );
    const contractCard = screen.getByRole('article', { name: 'Zagreus contract exit' });
    await view.user.click(within(contractCard).getByRole('button', { name: /^Open .* room$/ }));
    const contractWorkbench = screen.getByRole('complementary', { name: 'Details' });
    expect(
      within(contractWorkbench).queryByText(/Incoming door reward|Infernal Contract Boon/),
    ).toBeNull();
    expect(within(contractWorkbench).queryByRole('button', { name: 'Reward' })).toBeNull();
    act(() =>
      application.store.dispatch(semanticOwnerFocused(createExitDecisionAddress(biome, source))),
    );
    await view.user.click(screen.getByLabelText('Take Zagreus contract'));
    expect(
      screen.getByRole('article', { name: 'Zagreus contract exit' }).getAttribute('data-picked'),
    ).toBe('true');
    act(() =>
      application.store.dispatch(semanticOwnerFocused(createOccurrenceAddress(biome, contract))),
    );
    await view.user.click(screen.getByRole('tab', { name: 'Room Actions' }));
    expect(within(contractWorkbench).getByRole('region', { name: 'Room Actions' })).toBeTruthy();
    expect(within(contractWorkbench).queryByText(/Incoming door reward/)).toBeNull();
    let selected = application.store.getState().projectWorkspace.history.present;
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: contract }),
    });
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(biome, {
        kind: 'occurrence',
        occurrenceId: contract,
      }),
      storeKey: 'RunProgress',
    });
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(biome, { kind: 'occurrence', occurrenceId: contract }, 'exit1'),
      occurrenceId: returned,
      gameName: 'G_Combat04',
    });
    const selectedEvaluation = simulateProject(application.catalog, selected);
    const gEvaluation = selectedEvaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((candidate) => candidate.biomeKey === 'G');
    if (
      gEvaluation === undefined ||
      (!('snapshot' in gEvaluation) && !('materializedPrefix' in gEvaluation))
    ) {
      throw new Error('Selected Zagreus contract must materialize a G prefix');
    }
    const materialized =
      'snapshot' in gEvaluation ? gEvaluation.snapshot : gEvaluation.materializedPrefix;
    expect(
      materialized.decisions
        .filter((decision) => decision.kind === 'batch')
        .flatMap((decision) => decision.additional)
        .map((target) => target.room.gameName),
    ).toContain('C_Boss01');
    const returnDecision = materialized.decisions.find(
      (decision) =>
        decision.kind === 'batch' &&
        decision.source.kind === 'occurrence' &&
        decision.source.occurrenceId === contract,
    );
    expect(returnDecision).toMatchObject({
      kind: 'batch',
      targets: [{ room: { occurrenceId: returned } }],
    });
  });
});
