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
  createRoomActionAddress,
  createTargetAddress,
  createTraitOfferAddress,
  echoLastRewardPickupEntryKey,
  roomActionKey,
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
import {
  createGoldenFGHIProject,
  authorLegalTraitOffers,
  goldenHBiome,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

describe('underworld product loop', () => {
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

  it('replaces an existing room on its door card while the entered workbench stays identity-read-only', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const view = renderPlannerForInteraction({ application });
    const source = { kind: 'occurrence' as const, occurrenceId: goldenFStartId };
    const decision = createExitDecisionAddress(goldenFBiome, source);
    const target = createTargetAddress(goldenFBiome, source, 'exit1');
    const targetOccurrenceId = goldenFOccurrenceId(1, 1);
    const originalGameName = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find(
        (occurrence) => occurrence.occurrenceId === targetOccurrenceId,
      )?.gameName;

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() => application.store.dispatch(semanticOwnerFocused(decision)));
    const inspector = screen.getByRole('complementary', { name: 'Details' });
    await view.user.click(within(inspector).getByRole('button', { name: 'Door 1 room' }));
    const replacement = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true',
      );
    if (replacement === undefined) throw new Error('F target has no replacement room');
    await view.user.click(replacement);

    const replaced = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === targetOccurrenceId);
    expect(replaced?.gameName).not.toBe(originalGameName);
    expect(application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    const replacedRoom =
      replaced?.gameName === undefined
        ? undefined
        : application.catalog.rooms.byKey[replaced.gameName];
    if (replacedRoom === undefined) throw new Error('replaced F target room is missing');
    await view.user.click(
      within(inspector).getByRole('button', { name: `Open ${replacedRoom.label} room` }),
    );
    const workbench = inspector.querySelector('.biome-occurrence-workbench');
    if (!(workbench instanceof HTMLElement)) throw new Error('entered target workbench is missing');
    expect(within(workbench).queryByLabelText(/room$/i)).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    expect(
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === targetOccurrenceId)
        ?.gameName,
    ).toBe(originalGameName);
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
    const replayAction = Object.freeze({
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit',
      entryKey: replayKey,
    });
    const currentOrder = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === bridgeId)
      ?.roomActions.order;
    if (currentOrder === undefined) throw new Error('Echo room action order is missing');
    project = applyProjectCommand(project, application.catalog, {
      kind: 'InsertRoomAction',
      action: createRoomActionAddress(goldenHBiome, bridgeId, roomActionKey(replayAction)),
      reference: replayAction,
      index: currentOrder.length,
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
      name: 'Natural Chaos product loop',
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

    await view.user.selectOptions(screen.getByLabelText(/Base reward pool/), 'MetaProgress');
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
    const rewardPool = screen.getByRole('combobox', { name: /Base reward pool/ });
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

  it('authors a terminal Preboss atomically and undoes to provisional doors', async () => {
    const application = createApplication();
    const sourceOccurrenceId = goldenFOccurrenceId(10, 1);
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: sourceOccurrenceId,
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const dispatch = vi.spyOn(application.store, 'dispatch');
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, sourceOccurrenceId)),
      ),
    );
    await view.user.click(screen.getByRole('button', { name: /Next step.*Continue route/ }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy());

    const topology = () =>
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')?.topology;
    const terminalDecision = () =>
      topology()?.decisions.find(
        (decision) =>
          decision.kind === 'exit' &&
          decision.source.kind === 'occurrence' &&
          decision.source.occurrenceId === sourceOccurrenceId,
      );
    expect(terminalDecision()).toBeUndefined();

    const historyBeforeTakeover = application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const preboss = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-candidate-state') === 'forced');
    if (preboss === undefined) throw new Error('terminal F decision has no forced Preboss choice');
    dispatch.mockClear();

    await view.user.click(preboss);

    expect(
      dispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload.kind),
    ).toEqual(['CreateTakeoverBatch']);
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeTakeover + 1,
    );
    const authored = terminalDecision();
    expect(
      authored?.kind === 'exit' && authored.normal.kind === 'batch'
        ? authored.normal.targets.map(
            (target) =>
              topology()?.occurrences.find(
                (occurrence) => occurrence.occurrenceId === target.occurrenceId,
              )?.gameName,
          )
        : [],
    ).toEqual(['F_PreBoss01', 'F_PreBoss01']);

    await view.user.click(screen.getByRole('button', { name: 'Undo' }));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy());
    expect(terminalDecision()).toBeUndefined();
    expect(screen.queryByRole('button', { name: 'Remove these doors' })).toBeNull();
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

  it('uses one projected semantic repair command for retained ordinary and takeover exits', async () => {
    const ordinaryOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    const ordinaryApplication = createApplication();
    const ordinaryProject = applyProjectCommand(
      createGoldenFGHIProject(),
      ordinaryApplication.catalog,
      {
        kind: 'ReplaceOccurrenceRoom',
        occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
        gameName: 'F_Combat01',
      },
    );
    ordinaryApplication.store.dispatch(authoredProjectReplaced(ordinaryProject));
    const ordinaryDispatch = vi.spyOn(ordinaryApplication.store, 'dispatch');
    const ordinaryView = renderPlannerForInteraction({ application: ordinaryApplication });

    await ordinaryView.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await ordinaryView.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() => ordinaryApplication.store.dispatch(semanticOwnerFocused(ordinaryOwner)));
    expect(screen.queryByText(/Repair removes/)).toBeNull();
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    const ordinaryHistoryBefore =
      ordinaryApplication.store.getState().projectWorkspace.history.past.length;
    ordinaryDispatch.mockClear();

    await ordinaryView.user.click(screen.getByRole('button', { name: 'Remove unavailable doors' }));

    expect(ordinaryApplication.store.getState().projectWorkspace.history.past).toHaveLength(
      ordinaryHistoryBefore + 1,
    );
    const ordinaryTopology = ordinaryApplication.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')?.topology;
    expect(
      ordinaryTopology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(2, 1),
      ),
    ).toBe(true);
    expect(
      ordinaryTopology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === goldenFOccurrenceId(2, 2),
      ),
    ).toBe(false);
    expect(
      ordinaryDispatch.mock.calls
        .map(([action]) => action)
        .filter(authoredProjectCommandDispatched.match)
        .map((action) => action.payload),
    ).toEqual([{ kind: 'ReconcileBatchExitCapacity', decision: ordinaryOwner }]);
    ordinaryView.unmount();
    ordinaryApplication.dispose();

    const baseApplication = createApplication();
    const complete = createGoldenFGHIProject();
    const gPlan = complete.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const takeover = gPlan?.topology?.decisions.find(
      (decision) =>
        decision.kind === 'exit' &&
        decision.normal.kind === 'batch' &&
        decision.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeover?.kind !== 'exit' || takeover.source.kind !== 'occurrence') {
      throw new Error('Golden G takeover source is missing');
    }
    const takeoverSource = takeover.source;
    const takeoverProject = applyProjectCommand(complete, baseApplication.catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeoverSource.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    const takeoverApplication = createApplication();
    takeoverApplication.store.dispatch(authoredProjectReplaced(takeoverProject));
    const takeoverDispatch = vi.spyOn(takeoverApplication.store, 'dispatch');
    const takeoverView = renderPlannerForInteraction({ application: takeoverApplication });
    const takeoverOwner = createExitDecisionAddress(goldenGBiome, takeoverSource);

    await takeoverView.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await takeoverView.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    act(() => takeoverApplication.store.dispatch(semanticOwnerFocused(takeoverOwner)));
    expect(screen.queryByText(/Repair will reconcile/)).toBeNull();
    const takeoverHistoryBefore =
      takeoverApplication.store.getState().projectWorkspace.history.past.length;
    takeoverDispatch.mockClear();

    await takeoverView.user.click(screen.getByRole('button', { name: 'Fix Preboss doors' }));

    expect(takeoverApplication.store.getState().projectWorkspace.history.past).toHaveLength(
      takeoverHistoryBefore + 1,
    );
    const takeoverTopology = takeoverApplication.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G')?.topology;
    expect(
      takeoverTopology?.occurrences.some(
        (occurrence) => occurrence.occurrenceId === takeoverSource.occurrenceId,
      ),
    ).toBe(true);
    const takeoverCommands = takeoverDispatch.mock.calls
      .map(([action]) => action)
      .filter(authoredProjectCommandDispatched.match)
      .map((action) => action.payload);
    expect(takeoverCommands).toHaveLength(1);
    const takeoverCommand = takeoverCommands[0];
    if (takeoverCommand?.kind !== 'ReconcileTakeoverBatch') {
      throw new Error('Takeover repair must dispatch ReconcileTakeoverBatch');
    }
    expect(takeoverCommand).toMatchObject({
      decision: takeoverOwner,
      gameName: 'G_PreBoss01',
    });
    expect(Object.keys(takeoverCommand.targetOccurrenceIds)).toEqual(['exit1']);
    expect(Object.values(takeoverCommand.targetOccurrenceIds)).toHaveLength(1);
    takeoverApplication.dispose();
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
      screen.getByRole('heading', { level: 3, name: 'Choose a room and reward' }),
    ).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Oceanus' }));
    const gStructure = screen.getByRole('region', { name: 'Oceanus route structure' });
    const takeover = gStructure.querySelector<HTMLButtonElement>(
      '[data-kind="takeoverBatch"] button',
    );
    if (takeover === null) throw new Error('G takeover rail node is missing');
    await view.user.click(takeover);
    expect(screen.getByRole('heading', { level: 2, name: 'Preboss' })).toBeTruthy();

    await view.user.click(screen.getByRole('button', { name: 'Tartarus' }));
    const iStructure = screen.getByRole('region', { name: 'Tartarus route structure' });
    const mixed = iStructure.querySelector<HTMLButtonElement>('[data-kind="mixedBatch"] button');
    if (mixed === null) throw new Error('I mixed batch rail node is missing');
    await view.user.click(mixed);
    expect(
      screen.getByRole('heading', { level: 3, name: 'Choose a room and reward' }),
    ).toBeTruthy();

    act(() =>
      application.store.dispatch(authoredProjectReplaced(createRepresentativeNOPQProject())),
    );
    await view.user.click(screen.getByRole('button', { name: 'Surface' }));
    await view.user.click(screen.getByRole('button', { name: 'Ephyra' }));
    const nStructure = screen.getByRole('region', { name: 'Ephyra route structure' });
    const preHub = Array.from(
      nStructure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.textContent?.includes('Pre-Hub'));
    if (preHub === undefined) throw new Error('N PreHub rail stage is missing');
    await view.user.click(preHub);
    expect(screen.getAllByRole('heading', { name: 'Pre-Hub' })).toHaveLength(1);

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
      name: /^Decision \d+ room offers$/,
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
