// @vitest-environment jsdom

import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createExitSelectionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures';
import { createRepresentativeNOPQProject } from '@run-planner/test-fixtures';
import { renderPlannerForInteraction } from '../fixtures/renderPlanner';

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
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });

    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() =>
      application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, opening)),
      ),
    );
    await view.user.click(screen.getByText('Customize'));
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

    const gate = await screen.findByRole('article', { name: 'Chaos gate exit' });
    await view.user.selectOptions(within(gate).getByLabelText('Map'), 'Chaos_06');
    await view.user.click(within(gate).getByLabelText('Take Chaos gate'));
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

    await view.user.click(screen.getByRole('button', { name: /Next step.*Continue route/ }));
    await view.user.click(screen.getByRole('button', { name: 'Add next decision' }));
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
    expect(screen.getByRole('button', { name: 'Add next decision' })).toBeTruthy();
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

  it('authors a terminal Preboss through the direct decision flow and undoes to its envelope', async () => {
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
    await view.user.click(screen.getByRole('button', { name: 'Add next decision' }));
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
    expect(terminalDecision()).toMatchObject({
      kind: 'exit',
      normal: { kind: 'batch', targets: [] },
    });

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
    ).toEqual(['ReplaceWithTakeoverBatch']);
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
    expect(terminalDecision()).toMatchObject({
      kind: 'exit',
      normal: { kind: 'batch', targets: [] },
    });
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
    expect(within(automaticReturn).getByRole('button', { name: 'Door 1 room' })).toBeTruthy();
    expect(within(automaticReturn).getByRole('button', { name: 'Reward' })).toBeTruthy();
    const evaluation = simulateProject(application.catalog, failed);
    const gEvaluation = evaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    if (gEvaluation === undefined || !('rewards' in gEvaluation)) {
      throw new Error('Anomaly failure must retain an evaluated G reward prefix');
    }
    const anomalyReward = createIncomingRewardAddress(goldenGBiome, anomaly);
    const hasRewardEvent = (kind: 'rewardOffered' | 'concreteAcquisition') =>
      gEvaluation.rewards.branches.some((branch) =>
        branch.events.some(
          (event) =>
            event.kind === kind &&
            semanticAddressKey(event.origin) === semanticAddressKey(anomalyReward),
        ),
      );
    expect(hasRewardEvent('rewardOffered')).toBe(true);
    expect(hasRewardEvent('concreteAcquisition')).toBe(false);
  });

  it('takes a selected Zagreus contract through its automatic host return in the browser', async () => {
    const application = createApplication();
    const fBiome = createBiomeAddress('Underworld', 'F');
    const opening = createOccurrenceId('product-zagreus-opening');
    const shop = createOccurrenceId('product-zagreus-shop');
    const contract = createOccurrenceId('product-zagreus-contract');
    const returned = createOccurrenceId('product-zagreus-return');
    const normalOne = createOccurrenceId('product-zagreus-normal-one');
    const normalTwo = createOccurrenceId('product-zagreus-normal-two');
    const source = { kind: 'occurrence' as const, occurrenceId: shop };
    const additional = createAdditionalExitAddress(fBiome, source.occurrenceId, 'zagreusContract');
    let project = applyProjectCommand(
      createProjectDocument(application.catalog, {
        configuredBiomeCounts: { Underworld: 1 },
        name: 'Zagreus product return',
        projectId: 'product-zagreus-return',
      }),
      application.catalog,
      {
        biome: fBiome,
        kind: 'CreateStart',
        occurrenceId: opening,
        gameName: 'F_Opening01',
      },
    );
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, { kind: 'occurrence', occurrenceId: opening }),
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: opening,
      }),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, { kind: 'occurrence', occurrenceId: opening }, 'exit1'),
      occurrenceId: shop,
      gameName: 'F_Shop01',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'AddZagreusContract',
      additional,
      occurrenceId: contract,
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, source),
      storeKey: 'RunProgress',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, source, 'exit1'),
      occurrenceId: normalOne,
      gameName: 'F_Combat01',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, source, 'exit2'),
      occurrenceId: normalTwo,
      gameName: 'F_Combat02',
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const view = renderPlannerForInteraction({ application });
    await view.user.click(screen.getByRole('button', { name: 'Underworld' }));
    await view.user.click(screen.getByRole('button', { name: 'Erebus' }));
    act(() =>
      application.store.dispatch(semanticOwnerFocused(createExitDecisionAddress(fBiome, source))),
    );

    expect((screen.getByLabelText('Take Zagreus contract') as HTMLInputElement).checked).toBe(
      false,
    );
    await view.user.click(screen.getByLabelText('Take Zagreus contract'));
    expect(
      screen.getByRole('article', { name: 'Zagreus contract exit' }).getAttribute('data-picked'),
    ).toBe('true');
    let selected = application.store.getState().projectWorkspace.history.present;
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'CreateBatch',
      decision: createExitDecisionAddress(fBiome, { kind: 'occurrence', occurrenceId: contract }),
    });
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(fBiome, {
        kind: 'occurrence',
        occurrenceId: contract,
      }),
      storeKey: 'RunProgress',
    });
    selected = applyProjectCommand(selected, application.catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(fBiome, { kind: 'occurrence', occurrenceId: contract }, 'exit1'),
      occurrenceId: returned,
      gameName: 'F_Combat03',
    });
    const selectedEvaluation = simulateProject(application.catalog, selected);
    const fEvaluation = selectedEvaluation.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    if (
      fEvaluation === undefined ||
      (!('snapshot' in fEvaluation) && !('materializedPrefix' in fEvaluation))
    ) {
      throw new Error('Selected Zagreus contract must materialize an F prefix');
    }
    const materialized =
      'snapshot' in fEvaluation ? fEvaluation.snapshot : fEvaluation.materializedPrefix;
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
