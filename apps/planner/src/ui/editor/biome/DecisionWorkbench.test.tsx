// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type BiomeAddress,
  type ProjectDocument,
  type SemanticAddress,
} from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it, vi } from 'vitest';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import type { WorkspaceBiome } from '@planner/projections/structured-workspace';
import { authoredProjectUndoRequested } from '@planner/state/projectWorkspaceSlice';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
} from '@run-planner/test-fixtures';
import {
  createRepresentativeNOPQProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '@run-planner/test-fixtures';
import {
  renderBiomeClearAction,
  renderDecisionWorkbench,
  renderStaticDecisionWorkbench,
  type DecisionWorkbenchNode,
  type DecisionWorkbenchSubject,
  workspaceBiome,
} from '@planner-test/support/biome-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
});

function emptyProject(routeKey: 'Surface' | 'Underworld'): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `decision-workbench-empty-${routeKey}`,
    name: `Decision workbench empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: 1 },
  });
}

function ownerMatches(node: DecisionWorkbenchNode, owner: SemanticAddress): boolean {
  return semanticAddressKey(node.owner) === semanticAddressKey(owner);
}

function subjectForOwner(owner: SemanticAddress) {
  return (biome: WorkspaceBiome): DecisionWorkbenchSubject | undefined => {
    const node = biome.nodes.find(
      (candidate): candidate is DecisionWorkbenchNode =>
        (candidate.kind === 'linkedExit' ||
          candidate.kind === 'ordinaryBatch' ||
          candidate.kind === 'mixedBatch' ||
          candidate.kind === 'takeoverBatch') &&
        ownerMatches(candidate, owner),
    );
    if (node !== undefined) return { kind: 'node', node };
    return biome.frontier !== null &&
      semanticAddressKey(biome.frontier.owner) === semanticAddressKey(owner)
      ? { frontier: biome.frontier, kind: 'frontier' }
      : undefined;
  };
}

function currentFrontier(biome: WorkspaceBiome): DecisionWorkbenchSubject | undefined {
  return biome.frontier === null ||
    (biome.frontier.kind !== 'start' && biome.frontier.kind !== 'exitDecision')
    ? undefined
    : { frontier: biome.frontier, kind: 'frontier' };
}

function firstNodeOfKind(kind: DecisionWorkbenchNode['kind']) {
  return (biome: WorkspaceBiome): DecisionWorkbenchSubject | undefined => {
    const node = biome.nodes.find(
      (candidate): candidate is DecisionWorkbenchNode => candidate.kind === kind,
    );
    return node === undefined ? undefined : { kind: 'node', node };
  };
}

function fTwoDoorBatchProject(): {
  readonly owner: ReturnType<typeof createExitDecisionAddress>;
  readonly project: ProjectDocument;
} {
  const start = createOccurrenceId('decision-workbench-f-start');
  const combat = createOccurrenceId('decision-workbench-f-combat');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = applyProjectCommand(emptyProject('Underworld'), catalog, {
    kind: 'CreateStart',
    biome: goldenFBiome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateBatch',
    decision: createExitDecisionAddress(goldenFBiome, source),
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(goldenFBiome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  const owner = createExitDecisionAddress(goldenFBiome, {
    kind: 'occurrence',
    occurrenceId: combat,
  });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: owner });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(goldenFBiome, owner.source),
    storeKey: 'RunProgress',
  });
  return { owner, project };
}

function nOpeningPreHubProject(): ProjectDocument {
  const project = applyProjectCommand(emptyProject('Surface'), catalog, {
    kind: 'CreateStart',
    biome: nBiome,
    occurrenceId: nOccurrenceIds.opening,
  });
  return applyProjectCommand(project, catalog, {
    kind: 'CreateLinkedExit',
    decision: createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    }),
    occurrenceId: nOccurrenceIds.preHub,
  });
}

function takeoverDecision(project: ProjectDocument) {
  const plan = project.routes
    .find((route) => route.routeKey === 'Underworld')
    ?.biomes.find((biome) => biome.biomeKey === 'G');
  const decision = plan?.topology?.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      candidate.normal.kind === 'batch' &&
      candidate.normal.targets.every(
        (target) =>
          plan.topology?.occurrences.find(
            (occurrence) => occurrence.occurrenceId === target.occurrenceId,
          )?.gameName === 'G_PreBoss01',
      ),
  );
  if (decision?.kind !== 'exit' || decision.source.kind !== 'occurrence') {
    throw new Error('G takeover source is missing');
  }
  return {
    decision,
    occurrenceId: decision.source.occurrenceId,
  };
}

function requiredTakeoverOwner(
  project: ProjectDocument,
  routeKey: 'Surface' | 'Underworld',
  biome: BiomeAddress,
  gameName: string,
): { readonly owner: ReturnType<typeof createExitDecisionAddress>; readonly targetCount: number } {
  const plan = project.routes
    .find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biome.biomeKey);
  const decision = plan?.topology?.decisions.find(
    (candidate) =>
      candidate.kind === 'exit' &&
      candidate.normal.kind === 'batch' &&
      candidate.normal.targets.length > 0 &&
      candidate.normal.targets.every(
        (target) =>
          plan.topology?.occurrences.find(
            (occurrence) => occurrence.occurrenceId === target.occurrenceId,
          )?.gameName === gameName,
      ),
  );
  if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
    throw new Error(`${biome.biomeKey} required takeover is missing`);
  }
  return {
    owner: createExitDecisionAddress(biome, decision.source),
    targetCount: decision.normal.targets.length,
  };
}

describe('DecisionWorkbench', () => {
  it('authors the fixed N start and exposes only its linked-exit frontier', async () => {
    const view = renderDecisionWorkbench(emptyProject('Surface'), 'Surface', 'N', currentFrontier);
    expect(screen.getByText('Start with Opening')).toBeTruthy();
    expect(screen.queryByText('N_Opening01')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Starting room' })).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Start biome' }));
    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const openingId = plan?.topology?.startOccurrenceId;
    if (openingId === undefined) throw new Error('N Opening was not authored');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, openingId),
    );
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add fixed next room' })).toBeTruthy(),
    );
    expect(screen.queryByText('Add Preboss doors')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Check Preboss rooms' })).toBeNull();

    const historyBeforeLinked =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(screen.getByRole('button', { name: 'Add fixed next room' }));
    let linkedOccurrenceId: ReturnType<typeof createOccurrenceId> | undefined;
    await waitFor(() => {
      const updated = view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N');
      const linked = updated?.topology?.decisions.find(
        (decision) => decision.kind === 'exit' && decision.normal.kind === 'linked',
      );
      linkedOccurrenceId =
        linked?.kind === 'exit' && linked.normal.kind === 'linked'
          ? linked.normal.occurrenceId
          : undefined;
      expect(linkedOccurrenceId).toBeDefined();
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeLinked + 1,
    );
    if (linkedOccurrenceId === undefined) throw new Error('N linked occurrence was not authored');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(nBiome, linkedOccurrenceId),
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Add fixed next room' })).toBeTruthy(),
    );
  });

  it('authors only the next physical target and publishes its room and reward controls', async () => {
    const { owner, project } = fTwoDoorBatchProject();
    const view = renderDecisionWorkbench(project, 'Underworld', 'F', subjectForOwner(owner));
    expect(screen.queryByText('partial')).toBeNull();
    const targetOwner = createTargetAddress(goldenFBiome, owner.source, 'exit1');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    expect(screen.getByRole('button', { name: 'Door 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    const later = screen.getByLabelText('Door 2 room') as HTMLSelectElement;
    expect(later.disabled).toBe(true);
    expect(later.textContent).toContain('Choose Door 1 first.');

    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const possible = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-disabled') !== 'true');
    if (possible === undefined) throw new Error('F Exit 1 has no selectable projected room');
    await view.user.click(possible);
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Door 2 room' })).not.toHaveProperty(
        'disabled',
        true,
      ),
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      targetOwner,
    );
    const authoredOffer = document.querySelector<HTMLElement>(
      '.biome-target-row:not([data-missing="true"])',
    );
    if (authoredOffer === null) throw new Error('F authored room offer is missing');
    expect(within(authoredOffer).getByRole('button', { name: 'Reward' })).toBeTruthy();

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(screen.getByRole('article', { name: 'Door 1 unspecified room offer' })).toBeTruthy(),
    );
    expect((screen.getByLabelText('Door 2 room') as HTMLSelectElement).disabled).toBe(true);
  });

  it('publishes picked-room and reward edits as separate atomic decision commands', async () => {
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(pBiome, {
        kind: 'occurrence',
        occurrenceId: pOccurrenceId('P_Combat03', 1, 1),
      }),
    });
    const owner = createExitDecisionAddress(pBiome, {
      kind: 'occurrence',
      occurrenceId: pOccurrenceIds.intro,
    });
    const view = renderDecisionWorkbench(project, 'Surface', 'P', subjectForOwner(owner));
    const unpicked = screen
      .getAllByRole('radio')
      .find((radio) => !(radio as HTMLInputElement).checked);
    const offer = unpicked?.closest<HTMLElement>('.biome-target-row');
    if (unpicked === undefined || offer === null || offer === undefined) {
      throw new Error('P Decision 1 has no unpicked room offer');
    }
    const roomLabel = offer.getAttribute('aria-label')?.replace(/ room offer$/, '');
    if (roomLabel === undefined) throw new Error('P unpicked room label is missing');

    const historyBeforePick =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(unpicked);
    await waitFor(() => expect((unpicked as HTMLInputElement).checked).toBe(true));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforePick + 1,
    );

    const selectedNode = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
      (node) =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (selectedNode?.kind !== 'ordinaryBatch') throw new Error('P Decision 1 is missing');
    const selectedTarget = selectedNode.targets.find((target) => target.room.label === roomLabel);
    if (selectedTarget === undefined) throw new Error('P selected target is missing');
    const rewardBefore = selectedTarget.room.rewardControls.map((control) => control.offer);

    const selectedOffer = screen.getByRole('article', { name: `${roomLabel} room offer` });
    await view.user.click(within(selectedOffer).getByRole('button', { name: 'Reward' }));
    const replacement = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('aria-disabled') !== 'true' &&
          option.getAttribute('data-selected-value') !== 'true' &&
          !/Boon|Devotion|Blind Box/.test(option.textContent ?? ''),
      );
    if (replacement === undefined) throw new Error('P picked room has no replacement reward');
    const historyBeforeReward =
      view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(replacement);
    await waitFor(() => {
      const node = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
        (candidate) =>
          candidate.kind === 'ordinaryBatch' &&
          semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
      );
      const target =
        node?.kind === 'ordinaryBatch'
          ? node.targets.find((candidate) => candidate.room.label === roomLabel)
          : undefined;
      expect(target?.room.rewardControls.map((control) => control.offer)).not.toEqual(rewardBefore);
    });
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBeforeReward + 1,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => {
      const node = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
        (candidate) =>
          candidate.kind === 'ordinaryBatch' &&
          semanticAddressKey(candidate.owner) === semanticAddressKey(owner),
      );
      const target =
        node?.kind === 'ordinaryBatch'
          ? node.targets.find((candidate) => candidate.room.label === roomLabel)
          : undefined;
      expect(target?.room.rewardControls.map((control) => control.offer)).toEqual(rewardBefore);
    });
  });

  it('authors terminal Preboss through the empty decision Door 1 picker', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const withoutDecision = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const project = applyProjectCommand(withoutDecision, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const view = renderDecisionWorkbench(project, 'Underworld', 'F', subjectForOwner(owner));
    const before = view.application.store.getState().projectWorkspace.history.past.length;
    expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Check Preboss rooms' })).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const preboss = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-candidate-state') === 'forced');
    if (preboss === undefined) throw new Error('F terminal Door 1 has no forced Preboss choice');
    await view.user.click(preboss);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    const authored = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (node) => node.kind === 'takeoverBatch' && ownerMatches(node, owner),
    );
    expect(
      authored?.kind === 'takeoverBatch'
        ? authored.targets.map((target) => target.room.gameName)
        : [],
    ).toEqual(['F_PreBoss01', 'F_PreBoss01']);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(screen.getByRole('button', { name: 'Door 1 room' })).toBeTruthy());
    cleanup();

    const ordinaryOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    renderDecisionWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      subjectForOwner(ordinaryOwner),
    );
    expect(screen.queryByRole('button', { name: 'Check Preboss rooms' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Replace doors with Preboss' })).toBeNull();
  });

  it('keeps terminal Door 1 visible through an unresolved Fields roll and allows Preboss', async () => {
    const owner = createExitDecisionAddress(goldenHBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('golden-h-combat05'),
    });
    const withoutTakeover = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      decision: owner,
      kind: 'RemoveExitDecision',
    });
    const project = applyProjectCommand(withoutTakeover, catalog, {
      decision: owner,
      kind: 'CreateBatch',
    });
    const view = renderDecisionWorkbench(project, 'Underworld', 'H', subjectForOwner(owner));

    expect(screen.getByText('Fields door roll')).toBeTruthy();
    expect(screen.getAllByText('Choose the Fields door roll first.')).not.toHaveLength(0);
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const options = within(screen.getByRole('listbox')).getAllByRole('option');
    const preboss = options.find(
      (option) => option.getAttribute('data-candidate-state') === 'forced',
    );
    if (preboss === undefined) throw new Error('H terminal Door 1 has no forced Preboss choice');
    expect(preboss.getAttribute('aria-disabled')).not.toBe('true');

    await view.user.click(preboss);
    await waitFor(() =>
      expect(
        workspaceBiome(view.application, 'Underworld', 'H').nodes.some(
          (node) => node.kind === 'takeoverBatch' && ownerMatches(node, owner),
        ),
      ).toBe(true),
    );
  });

  it('groups the Fields rule and resolved facts in their dedicated batch section', () => {
    renderStaticDecisionWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      firstNodeOfKind('ordinaryBatch'),
    );

    const selector = screen.getByLabelText('Fields door roll');
    const fieldsEditor = selector.closest('.fields-batch-editor');
    expect(fieldsEditor).not.toBeNull();
    expect(selector.closest('.batch-controls')).toBeNull();
    expect(within(fieldsEditor as HTMLElement).getByText('Cages per combat room')).toBeTruthy();
    expect(within(fieldsEditor as HTMLElement).getByText('Prior Max outcomes')).toBeTruthy();
  });

  it('authors multi-door G and P Prebosses through their required Door 1 choices', async () => {
    const fixtures = [
      {
        biome: goldenGBiome,
        biomeKey: 'G',
        gameName: 'G_PreBoss01',
        project: createGoldenFGHIProject(),
        routeKey: 'Underworld',
      },
      {
        biome: pBiome,
        biomeKey: 'P',
        gameName: 'P_PreBoss01',
        project: createRepresentativeNOPQProject(),
        routeKey: 'Surface',
      },
    ] as const;

    for (const fixture of fixtures) {
      const takeover = requiredTakeoverOwner(
        fixture.project,
        fixture.routeKey,
        fixture.biome,
        fixture.gameName,
      );
      const withoutTakeover = applyProjectCommand(fixture.project, catalog, {
        decision: takeover.owner,
        kind: 'RemoveExitDecision',
      });
      const project = applyProjectCommand(withoutTakeover, catalog, {
        decision: takeover.owner,
        kind: 'CreateBatch',
      });
      const view = renderDecisionWorkbench(
        project,
        fixture.routeKey,
        fixture.biomeKey,
        subjectForOwner(takeover.owner),
      );

      await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
      const preboss = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.getAttribute('data-candidate-state') === 'forced');
      if (preboss === undefined) {
        throw new Error(`${fixture.biomeKey} terminal Door 1 has no forced Preboss choice`);
      }
      await view.user.click(preboss);
      await waitFor(() => {
        const node = workspaceBiome(
          view.application,
          fixture.routeKey,
          fixture.biomeKey,
        ).nodes.find(
          (candidate) =>
            candidate.kind === 'takeoverBatch' && ownerMatches(candidate, takeover.owner),
        );
        expect(node?.kind === 'takeoverBatch' ? node.targets : []).toHaveLength(
          takeover.targetCount,
        );
      });
      cleanup();
    }
  });

  it('omits an impossible unselected batch reward pool', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const view = renderDecisionWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      subjectForOwner(owner),
    );
    await view.user.click(screen.getByLabelText('Base reward pool'));
    const values = Array.from(
      (screen.getByLabelText('Base reward pool') as HTMLSelectElement).options,
    ).map((option) => option.value);
    expect(values).toContain('MetaProgress');
    expect(values).not.toContain('RunProgress');
  });

  it('distinguishes a forced effective reward pool from the authored base pool', () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(4, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      gameName: 'F_Combat01',
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(5, 2)),
    });
    renderStaticDecisionWorkbench(project, 'Underworld', 'F', subjectForOwner(owner));

    expect(screen.getByLabelText('Base reward pool')).toBeTruthy();
    const effectivePool = screen.getByRole('status');
    expect(within(effectivePool).getByText('Effective reward pool')).toBeTruthy();
    expect(within(effectivePool).getByText('Major Reward')).toBeTruthy();
    expect(
      within(effectivePool).getByText('A forced room in this decision overrides the base pool.'),
    ).toBeTruthy();
  });

  it('labels authored-selected retained rooms without claiming evaluated entry', () => {
    const base = createGoldenFGHIProject();
    const blocked = {
      ...base,
      routes: base.routes.map((route) =>
        route.routeKey !== 'Underworld'
          ? route
          : {
              ...route,
              biomes: route.biomes.map((plan) =>
                plan.biomeKey !== 'F' || plan.topology === null
                  ? plan
                  : {
                      ...plan,
                      topology: {
                        ...plan.topology,
                        decisions: plan.topology.decisions.map((decision) =>
                          decision.kind === 'exit' &&
                          decision.source.kind === 'occurrence' &&
                          decision.source.occurrenceId === goldenFOccurrenceId(1, 1)
                            ? { ...decision, selection: { kind: 'unresolved' as const } }
                            : decision,
                        ),
                      },
                    },
              ),
            },
      ),
    };
    const selector = (biome: WorkspaceBiome): DecisionWorkbenchSubject | undefined => {
      const node = biome.nodes.find(
        (candidate): candidate is DecisionWorkbenchNode =>
          (candidate.kind === 'ordinaryBatch' ||
            candidate.kind === 'mixedBatch' ||
            candidate.kind === 'takeoverBatch') &&
          candidate.targets.some((target) => target.selected && !target.room.entered),
      );
      return node === undefined ? undefined : { kind: 'node', node };
    };
    renderStaticDecisionWorkbench(blocked, 'Underworld', 'F', selector);
    const selectedControl = screen
      .getAllByRole('radio')
      .find((radio) => (radio as HTMLInputElement).checked);
    const offer = selectedControl?.closest<HTMLElement>('article');
    if (offer === undefined || offer === null)
      throw new Error('selected retained offer is missing');
    expect(within(offer).getByText('Room selected')).toBeTruthy();
    expect(within(offer).queryByText('Door taken')).toBeNull();
  });

  it('executes fixed width-one O and reordered-Q takeovers through Door 1', async () => {
    const cases: Array<{
      readonly biomeKey: 'O' | 'Q';
      readonly owner: ReturnType<typeof createExitDecisionAddress>;
      readonly project: ProjectDocument;
      readonly routeKey: 'Surface';
    }> = [];
    const oOwner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    cases.push({
      biomeKey: 'O',
      owner: oOwner,
      project: applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
        kind: 'RemoveExitDecision',
        decision: oOwner,
      }),
      routeKey: 'Surface',
    });

    const qOwner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    const withoutQ = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: qOwner,
    });
    const encoded = JSON.parse(encodeProjectDocument(withoutQ)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const qTopology = encoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    if (qTopology === undefined || qTopology === null) throw new Error('Q topology is missing');
    qTopology.decisions.reverse();
    cases.push({
      biomeKey: 'Q',
      owner: qOwner,
      project: decodeProjectDocument(encoded, catalog),
      routeKey: 'Surface',
    });

    for (const fixture of cases) {
      const work: ApplicationEvaluationEvent[] = [];
      const directProject = applyProjectCommand(fixture.project, catalog, {
        decision: fixture.owner,
        kind: 'CreateBatch',
      });
      const view = renderDecisionWorkbench(
        directProject,
        fixture.routeKey,
        fixture.biomeKey,
        subjectForOwner(fixture.owner),
        createApplication({ observeEvaluationWork: (event) => work.push(event) }),
      );
      work.length = 0;
      await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
      const preboss = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.getAttribute('data-candidate-state') === 'forced');
      if (preboss === undefined)
        throw new Error(`${fixture.biomeKey} has no forced Preboss choice`);
      await view.user.click(preboss);
      expect(work.filter((event) => event.kind === 'queryBatch')).toHaveLength(2);
      expect(
        workspaceBiome(view.application, fixture.routeKey, fixture.biomeKey).nodes.some(
          (node) => node.kind === 'takeoverBatch' && ownerMatches(node, fixture.owner),
        ),
      ).toBe(true);
      cleanup();
    }
  });

  it('keeps an unavailable direct Preboss choice disabled without committing', async () => {
    const qOwner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    let project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: createExitDecisionAddress(oBiome, {
        kind: 'occurrence',
        occurrenceId: oOccurrenceIds.combat02,
      }),
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'RemoveExitDecision',
      decision: qOwner,
    });
    project = applyProjectCommand(project, catalog, { decision: qOwner, kind: 'CreateBatch' });
    const work: ApplicationEvaluationEvent[] = [];
    const view = renderDecisionWorkbench(
      project,
      'Surface',
      'Q',
      subjectForOwner(qOwner),
      createApplication({ observeEvaluationWork: (event) => work.push(event) }),
    );
    work.length = 0;
    const before = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(screen.getByRole('button', { name: 'Door 1 room' }));
    const unavailable = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find(
        (option) =>
          option.getAttribute('data-candidate-state') === 'unassessed' &&
          option.textContent?.includes('Preboss'),
      );
    if (unavailable === undefined) throw new Error('Q unavailable Door 1 choice is missing');
    expect(unavailable.getAttribute('aria-disabled')).toBe('true');
    expect(work.filter((event) => event.kind === 'queryBatch')).toHaveLength(2);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
  });

  it('dispatches immediate decision, linked-stage, and biome removals without confirmation', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const decision = renderDecisionWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      subjectForOwner(owner),
    );
    const confirmation = vi.spyOn(globalThis, 'confirm');
    const removal = screen.getByRole('button', { name: 'Remove these doors' });
    expect(removal.classList.contains('danger-action')).toBe(true);
    expect(removal.closest('.workbench-action-row')).not.toBeNull();
    await decision.user.click(removal);
    expect(confirmation).not.toHaveBeenCalled();
    await waitFor(() =>
      expect(
        workspaceBiome(decision.application, 'Underworld', 'F').nodes.some(
          (node) =>
            (node.kind === 'linkedExit' ||
              node.kind === 'ordinaryBatch' ||
              node.kind === 'mixedBatch' ||
              node.kind === 'takeoverBatch') &&
            ownerMatches(node, owner),
        ),
      ).toBe(false),
    );
    cleanup();

    const linkedOwner = createExitDecisionAddress(nBiome, {
      kind: 'occurrence',
      occurrenceId: nOccurrenceIds.opening,
    });
    const linked = renderDecisionWorkbench(
      nOpeningPreHubProject(),
      'Surface',
      'N',
      subjectForOwner(linkedOwner),
    );
    await linked.user.click(screen.getByRole('button', { name: 'Remove these doors' }));
    await waitFor(() =>
      expect(
        linked.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
          ?.biomes.find((biome) => biome.biomeKey === 'N')?.topology?.decisions,
      ).toHaveLength(0),
    );
    cleanup();

    const clearing = renderBiomeClearAction(createGoldenFGHIProject(), 'Underworld', 'F');
    await clearing.user.click(screen.getByRole('button', { name: 'Clear Erebus' }));
    await waitFor(() =>
      expect(
        clearing.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')?.topology,
      ).toBeNull(),
    );
  });

  it('reconciles retained, expanded, ordinary, and blocked-suffix repair controls', async () => {
    const complete = createGoldenFGHIProject();
    const takeover = takeoverDecision(complete);
    let retainedProject = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeover.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    retainedProject = applyProjectCommand(retainedProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const retainedOwner = createExitDecisionAddress(goldenGBiome, takeover.decision.source);
    const retained = renderDecisionWorkbench(
      retainedProject,
      'Underworld',
      'G',
      subjectForOwner(retainedOwner),
    );
    await retained.user.click(screen.getByRole('button', { name: 'Fix Preboss doors' }));
    expect(
      workspaceBiome(retained.application, 'Underworld', 'G').nodes.find(
        (node) => node.kind === 'takeoverBatch' && ownerMatches(node, retainedOwner),
      ),
    ).toMatchObject({ targets: [{ exitKey: 'exit1', physicalState: 'available' }] });
    cleanup();

    const expandedProject = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeover.occurrenceId),
      gameName: 'G_Combat02',
    });
    const expanded = renderDecisionWorkbench(
      expandedProject,
      'Underworld',
      'G',
      subjectForOwner(retainedOwner),
    );
    expect(screen.getByText('Fix Preboss doors to restore the missing doors.')).toBeTruthy();
    await expanded.user.click(screen.getByRole('button', { name: 'Fix Preboss doors' }));
    expect(
      workspaceBiome(expanded.application, 'Underworld', 'G').nodes.find(
        (node) => node.kind === 'takeoverBatch' && ownerMatches(node, retainedOwner),
      ),
    ).toMatchObject({
      missingTargets: [],
      targets: [{ exitKey: 'exit1' }, { exitKey: 'exit2' }, { exitKey: 'exit3' }],
    });
    cleanup();

    const ordinaryOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let ordinaryProject = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    ordinaryProject = applyProjectCommand(ordinaryProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const ordinary = renderDecisionWorkbench(
      ordinaryProject,
      'Underworld',
      'F',
      subjectForOwner(ordinaryOwner),
    );
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    const repair = screen.getByRole('button', { name: 'Remove unavailable doors' });
    expect(repair.classList.contains('danger-action')).toBe(true);
    await ordinary.user.click(repair);
    expect(
      workspaceBiome(ordinary.application, 'Underworld', 'F').nodes.find(
        (node) => node.kind === 'ordinaryBatch' && ownerMatches(node, ordinaryOwner),
      ),
    ).toMatchObject({ targets: [{ exitKey: 'exit1' }] });
  });

  it('renders mixed Preboss decisions through the shared batch workbench', () => {
    renderStaticDecisionWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'I',
      firstNodeOfKind('mixedBatch'),
    );
    expect(document.querySelector('[data-batch-kind="mixedBatch"]')).not.toBeNull();
    expect(
      screen.getByRole('heading', { level: 3, name: 'Choose a room and reward' }),
    ).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Door 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Door 2 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
  });
});
