// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBatchRewardStoreAddress,
  createBiomeAddress,
  createExitDecisionAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createProjectDocument,
  createShopOfferAddress,
  createShopPurchaseAddress,
  createTargetAddress,
  decodeProjectDocument,
  encodeProjectDocument,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { afterEach, describe, expect, it } from 'vitest';
import { Provider } from 'react-redux';

import {
  createApplication,
  type ApplicationEvaluationEvent,
  type PlannerApplication,
} from '../../../composition/createApplication';
import { semanticFindingKey } from '../../../projections/evaluationProjection';
import type { WorkspaceNode } from '../../../projections/structuredWorkspace';
import { findingSelected, semanticOwnerFocused } from '../../../state/editorSessionSlice';
import { authoredProjectReplaced } from '../../../state/projectWorkspaceSlice';
import { useAppSelector } from '../../../state/store';
import {
  createRepresentativeNOPQProject,
  oBiome,
  oOccurrenceIds,
  pBiome,
  pOccurrenceId,
  pOccurrenceIds,
  qBiome,
  qOccurrenceIds,
} from '../../../../test/fixtures/surfaceProject';
import {
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenGBiome,
  goldenHBiome,
} from '../../../../test/fixtures/underworldProject';
import { BiomeWorkspace } from './BiomeWorkspace';
import { BiomeWorkspaceContractError } from './workspaceContract';

afterEach(cleanup);

interface WorkspaceHarnessProps {
  readonly application: PlannerApplication;
  readonly biomeKey: string;
  readonly routeKey: string;
}

function WorkspaceHarness({ application, biomeKey, routeKey }: WorkspaceHarnessProps) {
  const state = useAppSelector((value) => value.projectWorkspace);
  const workspace = application.structuredWorkspace.project(
    state.history.present,
    state.evaluation,
  );
  const route = workspace.routes.find((candidate) => candidate.routeKey === routeKey);
  const biome = route?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined) throw new Error(`${routeKey}/${biomeKey} has no workspace biome`);
  return (
    <BiomeWorkspace
      biome={biome}
      focusByOwner={workspace.focusByOwner}
      interactions={workspace.interactions}
    />
  );
}

function renderWorkspace(
  project: ProjectDocument,
  routeKey: string,
  biomeKey: string,
  application: PlannerApplication = createApplication(),
) {
  application.store.dispatch(authoredProjectReplaced(project));
  const user = userEvent.setup();
  const view = render(
    <Provider store={application.store}>
      <WorkspaceHarness application={application} biomeKey={biomeKey} routeKey={routeKey} />
    </Provider>,
  );
  return { application, user, ...view };
}

function workspaceBiome(application: PlannerApplication, routeKey: string, biomeKey: string) {
  const state = application.store.getState().projectWorkspace;
  const biome = application.structuredWorkspace
    .project(state.history.present, state.evaluation)
    .routes.find((route) => route.routeKey === routeKey)
    ?.biomes.find((candidate) => candidate.biomeKey === biomeKey);
  if (biome === undefined)
    throw new Error(`${routeKey}/${biomeKey} has no projected workspace biome`);
  return biome;
}

function railMarkerKeys(container: HTMLElement): readonly string[] {
  return Array.from(container.querySelectorAll<HTMLElement>('[data-workspace-node]')).map(
    (element) => element.dataset.workspaceNode ?? '',
  );
}

function emptyProject(routeKey: 'Surface' | 'Underworld', count: number): ProjectDocument {
  return createProjectDocument(catalog, {
    projectId: `empty-${routeKey}-${count}`,
    name: `Empty ${routeKey}`,
    configuredBiomeCounts: { [routeKey]: count },
  });
}

function fTwoDoorBatchProject(): {
  readonly owner: ReturnType<typeof createExitDecisionAddress>;
  readonly project: ProjectDocument;
} {
  const biome = createBiomeAddress('Underworld', 'F');
  const start = createOccurrenceId('biome-workspace-f-start');
  const combat = createOccurrenceId('biome-workspace-f-combat');
  const source = { kind: 'occurrence' as const, occurrenceId: start };
  let project = emptyProject('Underworld', 1);
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateStart',
    biome,
    occurrenceId: start,
    gameName: 'F_Opening01',
  });
  const first = createExitDecisionAddress(biome, source);
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: first });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, source),
    storeKey: 'RunProgress',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'CreateTarget',
    target: createTargetAddress(biome, source, 'exit1'),
    occurrenceId: combat,
    gameName: 'F_Combat03',
  });
  const owner = createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: combat });
  project = applyProjectCommand(project, catalog, { kind: 'CreateBatch', decision: owner });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceBatchRewardStore',
    rewardStore: createBatchRewardStoreAddress(biome, owner.source),
    storeKey: 'RunProgress',
  });
  return { owner, project };
}

describe('BiomeWorkspace', () => {
  it('fails loudly until the Hub-specific workbench owns a projected Hub decision', () => {
    expect(() => renderWorkspace(createRepresentativeNOPQProject(), 'Surface', 'N')).toThrow(
      BiomeWorkspaceContractError,
    );
  });

  it('preserves each non-Hub projected rail in semantic order', () => {
    const underworld = createGoldenFGHIProject(catalog);
    const surface = createRepresentativeNOPQProject();
    const cases = [
      [underworld, 'Underworld', 'F'],
      [underworld, 'Underworld', 'G'],
      [underworld, 'Underworld', 'H'],
      [underworld, 'Underworld', 'I'],
      [surface, 'Surface', 'O'],
      [surface, 'Surface', 'P'],
      [surface, 'Surface', 'Q'],
    ] as const;

    for (const [project, routeKey, biomeKey] of cases) {
      const view = renderWorkspace(project, routeKey, biomeKey);
      const projected = workspaceBiome(view.application, routeKey, biomeKey);
      expect(view.container.querySelector('.biome-workspace')).not.toBeNull();
      expect(screen.getByRole('region', { name: /structure$/ })).toBeTruthy();
      expect(railMarkerKeys(view.container)).toEqual(
        projected.rail.map((entry) => entry.marker.focusKey),
      );
      cleanup();
    }
  });

  it('renders the fixed N Opening and linked PreHub without a room selector or Hub action', async () => {
    const view = renderWorkspace(emptyProject('Surface', 1), 'Surface', 'N');
    expect(screen.getByText('Start with Opening')).toBeTruthy();
    expect(screen.queryByText('N_Opening01')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Starting room' })).toBeNull();

    await view.user.click(screen.getByRole('button', { name: 'Start biome' }));
    const nPlanAfterStart = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'N');
    const openingId = nPlanAfterStart?.topology?.startOccurrenceId;
    if (openingId === undefined) throw new Error('N Opening was not authored');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(createBiomeAddress('Surface', 'N'), openingId),
    );
    const structure = screen.getByRole('region', { name: /structure$/ });
    await view.user.click(
      within(structure).getByRole('button', { name: /Continue authoring here/ }),
    );
    expect(screen.queryByText('Create Preboss batch')).toBeNull();
    expect(screen.queryByRole('button', { name: 'Evaluate Preboss batches' })).toBeNull();
    expect(screen.getByRole('button', { name: 'Create linked exit' })).toBeTruthy();
  });

  it('fails loudly at the N Hub frontier after authoring its fixed PreHub exit', () => {
    const biome = createBiomeAddress('Surface', 'N');
    const openingId = createOccurrenceId('workspace-n-opening');
    let project = emptyProject('Surface', 1);
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateStart',
      biome,
      occurrenceId: openingId,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'CreateLinkedExit',
      decision: createExitDecisionAddress(biome, { kind: 'occurrence', occurrenceId: openingId }),
      occurrenceId: createOccurrenceId('workspace-n-prehub'),
    });

    expect(() => renderWorkspace(project, 'Surface', 'N')).toThrow(BiomeWorkspaceContractError);
  });

  it('authors only the projected next physical exit and focuses its created occurrence', async () => {
    const { owner, project } = fTwoDoorBatchProject();
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));

    expect(screen.getByRole('button', { name: 'Exit 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    const later = screen.getByLabelText('Exit 2 room') as HTMLSelectElement;
    expect(later.disabled).toBe(true);
    expect(later.textContent).toContain('Choose Exit 1 first.');

    await view.user.click(screen.getByRole('button', { name: 'Exit 1 room' }));
    const possible = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('data-candidate-state') !== 'impossible');
    if (possible === undefined) throw new Error('F Exit 1 has no selectable projected room');
    await view.user.click(possible);

    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    expect(focused).toMatchObject({ kind: 'occurrence', biomeKey: 'F', routeKey: 'Underworld' });
    const structure = screen.getByRole('region', { name: /structure$/ });
    const decisionRail = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(owner));
    if (decisionRail === undefined) throw new Error('F authored decision rail stop is missing');
    await view.user.click(decisionRail);
    expect(screen.getByRole('button', { name: 'Exit 2 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
  });

  it('creates a takeover batch through one projected atomic action', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));
    await view.user.selectOptions(screen.getByLabelText('Preboss declaration'), 'F_PreBoss01');
    await view.user.click(screen.getByRole('button', { name: 'Create Preboss batch' }));

    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F');
    const topology = plan?.topology;
    if (topology === undefined || topology === null) {
      throw new Error('F topology was not authored');
    }
    const decision = topology.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === goldenFOccurrenceId(10, 1),
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('F takeover decision was not authored');
    }
    const gameNames = decision.normal.targets.map(
      (target) =>
        topology.occurrences.find((occurrence) => occurrence.occurrenceId === target.occurrenceId)
          ?.gameName,
    );
    expect(gameNames).toEqual(['F_PreBoss01', 'F_PreBoss01']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(owner);
  });

  it('does not expose or dispatch an impossible unselected Preboss batch', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const view = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));

    const selector = screen.getByLabelText('Preboss declaration') as HTMLSelectElement;
    expect(Array.from(selector.options).map((option) => option.value)).not.toContain('F_PreBoss01');
    const action = screen.getByRole('button', { name: 'Replace with Preboss batch' });
    expect((action as HTMLButtonElement).disabled).toBe(true);
    await view.user.click(action);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
  });

  it('keeps a tentative takeover declaration scoped to its focused ordinary batch', async () => {
    const first = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(10, 1),
    });
    const second = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'RemoveExitDecision',
      decision: first,
    });
    const view = renderWorkspace(project, 'Underworld', 'F');

    act(() => view.application.store.dispatch(semanticOwnerFocused(first)));
    await view.user.click(screen.getByRole('button', { name: 'Evaluate Preboss batches' }));
    await view.user.selectOptions(screen.getByLabelText('Preboss declaration'), 'F_PreBoss01');
    expect((screen.getByLabelText('Preboss declaration') as HTMLSelectElement).value).toBe(
      'F_PreBoss01',
    );

    act(() => view.application.store.dispatch(semanticOwnerFocused(second)));
    expect((screen.getByLabelText('Preboss declaration') as HTMLSelectElement).value).toBe('');
  });

  it('omits an impossible unselected batch reward pool', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFStartId,
    });
    const view = renderWorkspace(createGoldenFGHIProject(catalog), 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));

    await view.user.click(screen.getByLabelText('Reward pool'));

    const selector = screen.getByLabelText('Reward pool') as HTMLSelectElement;
    const values = Array.from(selector.options).map((option) => option.value);
    expect(values).toContain('MetaProgress');
    expect(values).not.toContain('RunProgress');
  });

  it('keeps a target-owned finding on its compact room rail leaf', async () => {
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
      'exit1',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const structure = screen.getByRole('region', { name: /Olympus structure/ });
    const railLeaf = Array.from(
      structure.querySelectorAll<HTMLButtonElement>('[data-workspace-node]'),
    ).find((button) => button.dataset.workspaceNode === semanticAddressKey(target));
    if (railLeaf === undefined) throw new Error('P invalid target rail leaf is missing');

    expect(railLeaf.dataset.findings).toBe('true');
    expect(railLeaf.textContent).toContain('1 finding');
    expect(railLeaf.textContent).toContain('Combat 02');
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBeNull();

    await view.user.click(railLeaf);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(within(inspector).getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
    expect(inspector.querySelector('.biome-occurrence-workbench')).not.toBeNull();
  });

  it('renders O’s fixed direct Preboss action without a selector and creates its entered Shop lazily', async () => {
    const owner = createExitDecisionAddress(oBiome, {
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat02,
    });
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const application = createApplication({
      observeEvaluationWork: (event) => evaluationWork.push(event),
    });
    const view = renderWorkspace(project, 'Surface', 'O', application);
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    evaluationWork.length = 0;
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    expect(screen.queryByLabelText('Preboss declaration')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toBeTruthy();
    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(0);

    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'O');
    const decision = plan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === oOccurrenceIds.combat02,
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('O direct Preboss action did not create one atomic batch');
    }
    expect(decision.selection).toEqual({ kind: 'derived' });
    const prebossId = decision.normal.targets[0]?.occurrenceId;
    const preboss = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === prebossId,
    );
    if (preboss?.state.kind !== 'shop' || preboss.state.shop === undefined) {
      throw new Error('O direct Preboss must materialize its entered World Shop');
    }
    expect(preboss.gameName).toBe('O_PreBoss01');
    const projected = workspaceBiome(view.application, 'Surface', 'O');
    const target = projected.nodes
      .find(
        (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
          node.kind === 'takeoverBatch',
      )
      ?.targets.find((candidate) => candidate.room.occurrenceId === prebossId);
    expect(target).toMatchObject({ selected: true, room: { entered: true } });

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, preboss.occurrenceId)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
  });

  it('keeps Q’s staged direct Preboss action on the selected spine after decision serialization is reordered', async () => {
    const owner = createExitDecisionAddress(qBiome, {
      kind: 'occurrence',
      occurrenceId: qOccurrenceIds.secondMiniboss1,
    });
    const withoutPreboss = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'RemoveExitDecision',
      decision: owner,
    });
    const encoded = JSON.parse(encodeProjectDocument(withoutPreboss)) as {
      routes: Array<{
        routeKey: string;
        biomes: Array<{ biomeKey: string; topology: { decisions: unknown[] } | null }>;
      }>;
    };
    const topology = encoded.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q')?.topology;
    if (topology === null || topology === undefined) {
      throw new Error('Q staged project must retain its authored topology');
    }
    topology.decisions.reverse();
    const reordered = decodeProjectDocument(encoded, catalog);
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const view = renderWorkspace(
      reordered,
      'Surface',
      'Q',
      createApplication({ observeEvaluationWork: (event) => evaluationWork.push(event) }),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    evaluationWork.length = 0;

    expect(screen.queryByLabelText('Preboss declaration')).toBeNull();
    expect(screen.getByRole('button', { name: 'Go to Preboss' })).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    const plan = view.application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
      ?.biomes.find((biome) => biome.biomeKey === 'Q');
    const decision = plan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.source.kind === 'occurrence' &&
        candidate.source.occurrenceId === qOccurrenceIds.secondMiniboss1,
    );
    if (decision?.kind !== 'exit' || decision.normal.kind !== 'batch') {
      throw new Error('Q direct Preboss action did not create one atomic batch');
    }
    const prebossId = decision.normal.targets[0]?.occurrenceId;
    const preboss = plan?.topology?.occurrences.find(
      (occurrence) => occurrence.occurrenceId === prebossId,
    );
    expect(preboss).toMatchObject({
      gameName: 'Q_PreBoss01',
      state: { kind: 'shop', shop: expect.any(Object) },
    });
    if (preboss === undefined) throw new Error('Q direct Preboss occurrence is missing');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(qBiome, preboss.occurrenceId)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
  });

  it('keeps an unavailable direct Preboss action explanatory and non-destructive', async () => {
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
    const evaluationWork: ApplicationEvaluationEvent[] = [];
    const view = renderWorkspace(
      project,
      'Surface',
      'Q',
      createApplication({ observeEvaluationWork: (event) => evaluationWork.push(event) }),
    );
    act(() => view.application.store.dispatch(semanticOwnerFocused(qOwner)));
    evaluationWork.length = 0;
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Go to Preboss' }));

    expect(evaluationWork.filter((event) => event.kind === 'queryBatch')).toHaveLength(1);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
    expect(screen.getByText(/before editing this biome contextually\./)).toBeTruthy();
    expect(screen.queryByText(/upstreamIncomplete|coverageNotReached/)).toBeNull();
  });

  it('renders an unpicked Shop as a dormant leaf without inventory controls', () => {
    const { owner, project } = fTwoDoorBatchProject();
    if (owner.source.kind !== 'occurrence') {
      throw new Error('F ordinary batch must be occurrence-owned');
    }
    const shop = createOccurrenceId('biome-workspace-dormant-shop');
    const withDormantShop = applyProjectCommand(project, catalog, {
      kind: 'CreateTarget',
      target: createTargetAddress(goldenFBiome, owner.source, 'exit2'),
      occurrenceId: shop,
      gameName: 'F_Shop01',
    });
    const view = renderWorkspace(withDormantShop, 'Underworld', 'F');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(goldenFBiome, shop)),
      ),
    );

    expect(screen.getByText('Shop inventory materializes when this room is picked.')).toBeTruthy();
    expect(screen.queryByText('Purchased')).toBeNull();
  });

  it('keeps an impossible Shop purchase non-actionable while allowing its selected repair', async () => {
    const offer = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    const purchase = createShopPurchaseAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
    const unsupportedOffer = {
      rewardType: 'BlindBoxLoot' as const,
      payload: { kind: 'BoonSource' as const, source: 'DemeterUpgrade' as const },
    };
    const invalidOfferProject = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceShopOffer',
      offer,
      value: unsupportedOffer,
    });
    const view = renderWorkspace(invalidOfferProject, 'Surface', 'P');
    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
    );
    const before = view.application.store.getState().projectWorkspace.history.past.length;
    const checkbox = document.getElementById(
      `shop-${semanticAddressKey(purchase)}-purchased`,
    ) as HTMLInputElement | null;
    if (checkbox === null) throw new Error('Boon Shop purchase control is missing');

    await view.user.click(checkbox);

    expect(checkbox.checked).toBe(false);
    expect(checkbox.disabled).toBe(true);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(before);
    cleanup();

    const selectedInvalidProject = applyProjectCommand(invalidOfferProject, catalog, {
      kind: 'SetShopPurchase',
      purchase,
      purchased: true,
    });
    const repair = renderWorkspace(selectedInvalidProject, 'Surface', 'P');
    act(() =>
      repair.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
    );
    const repairBefore = repair.application.store.getState().projectWorkspace.history.past.length;
    const repairCheckbox = document.getElementById(
      `shop-${semanticAddressKey(purchase)}-purchased`,
    ) as HTMLInputElement | null;
    if (repairCheckbox === null) throw new Error('selected Boon Shop purchase control is missing');
    await repair.user.click(repairCheckbox);
    if (repairCheckbox.checked) {
      await repair.user.click(repairCheckbox);
    }
    expect(repairCheckbox.checked).toBe(false);
    expect(repair.application.store.getState().projectWorkspace.history.past).toHaveLength(
      repairBefore + 1,
    );
  });

  it('reconciles a retained takeover through its projected repair scope', async () => {
    const complete = createGoldenFGHIProject(catalog);
    const gPlan = complete.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const takeoverDecision = gPlan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeoverDecision?.kind !== 'exit' || takeoverDecision.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const project = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeoverDecision.source.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    const view = renderWorkspace(project, 'Underworld', 'G');
    const takeover = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('retained G takeover workbench is missing');
    act(() => view.application.store.dispatch(semanticOwnerFocused(takeover.owner)));
    expect(document.querySelector('[data-command="ReconcileTakeoverBatch"]')).not.toBeNull();
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (repaired === undefined) throw new Error('repaired G takeover workbench is missing');
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
    expect(repaired.targets.map((target) => [target.exitKey, target.physicalState])).toEqual([
      ['exit1', 'available'],
    ]);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      takeover.owner,
    );
  });

  it('reconciles an expanded takeover by allocating its newly declared exit', async () => {
    const complete = createGoldenFGHIProject(catalog);
    const gPlan = complete.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const takeoverDecision = gPlan?.topology?.decisions.find(
      (candidate) =>
        candidate.kind === 'exit' &&
        candidate.normal.kind === 'batch' &&
        candidate.normal.targets.every(
          (target) =>
            gPlan.topology?.occurrences.find(
              (occurrence) => occurrence.occurrenceId === target.occurrenceId,
            )?.gameName === 'G_PreBoss01',
        ),
    );
    if (takeoverDecision?.kind !== 'exit' || takeoverDecision.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    const project = applyProjectCommand(complete, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, takeoverDecision.source.occurrenceId),
      gameName: 'G_Combat02',
    });
    const view = renderWorkspace(project, 'Underworld', 'G');
    const takeover = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (takeover === undefined) throw new Error('expanded G takeover workbench is missing');
    expect(takeover.missingTargets.map((target) => target.exitKey)).toEqual(['exit3']);
    act(() => view.application.store.dispatch(semanticOwnerFocused(takeover.owner)));

    expect(screen.getByText(/Missing Preboss exits are repaired atomically/)).toBeTruthy();
    await view.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'G').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'takeoverBatch' }> =>
        node.kind === 'takeoverBatch',
    );
    if (repaired === undefined)
      throw new Error('repaired expanded G takeover workbench is missing');
    expect(repaired.targets.map((target) => target.exitKey)).toEqual(['exit1', 'exit2', 'exit3']);
    expect(repaired.missingTargets).toHaveLength(0);
  });

  it('renders and applies an ordinary retained-exit repair from its projected scope', async () => {
    const owner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    const project = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    const view = renderWorkspace(project, 'Underworld', 'F');
    act(() => view.application.store.dispatch(semanticOwnerFocused(owner)));
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    expect(screen.getByText('Repair removes 1 room occurrence.')).toBeTruthy();
    expect(
      Array.from(document.querySelectorAll('.biome-target-row .card-kicker')).map(
        (element) => element.textContent,
      ),
    ).toContain('Exit 2');
    expect(screen.queryByText('Exit 9007199254740991')).toBeNull();
    const before = view.application.store.getState().projectWorkspace.history.past.length;

    await view.user.click(screen.getByRole('button', { name: 'Reconcile unavailable exits' }));

    const repaired = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'ordinaryBatch' }> =>
        node.kind === 'ordinaryBatch' &&
        semanticAddressKey(node.owner) === semanticAddressKey(owner),
    );
    if (repaired === undefined) throw new Error('repaired F ordinary batch is missing');
    expect(repaired.targets.map((target) => target.exitKey)).toEqual(['exit1']);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      before + 1,
    );
  });

  it('keeps retained ordinary and takeover repairs actionable in a blocked suffix', async () => {
    const fOwner = createExitDecisionAddress(goldenFBiome, {
      kind: 'occurrence',
      occurrenceId: goldenFOccurrenceId(1, 1),
    });
    let fProject = applyProjectCommand(createGoldenFGHIProject(catalog), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      gameName: 'F_Combat01',
    });
    fProject = applyProjectCommand(fProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const fView = renderWorkspace(fProject, 'Underworld', 'F');
    act(() => fView.application.store.dispatch(semanticOwnerFocused(fOwner)));
    const fBefore = fView.application.store.getState().projectWorkspace.history.past.length;
    expect(document.querySelector('[data-command="ReconcileBatchExitCapacity"]')).not.toBeNull();
    await fView.user.click(screen.getByRole('button', { name: 'Reconcile unavailable exits' }));
    expect(fView.application.store.getState().projectWorkspace.history.past).toHaveLength(
      fBefore + 1,
    );
    cleanup();

    const base = createGoldenFGHIProject(catalog);
    const gPlan = base.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'G');
    const gTakeover = gPlan?.topology?.decisions.find(
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
    if (gTakeover?.kind !== 'exit' || gTakeover.source.kind !== 'occurrence') {
      throw new Error('G takeover source is missing');
    }
    let gProject = applyProjectCommand(base, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenGBiome, gTakeover.source.occurrenceId),
      gameName: 'G_MiniBoss02',
    });
    gProject = applyProjectCommand(gProject, catalog, {
      kind: 'ReplaceBatchRewardStore',
      rewardStore: createBatchRewardStoreAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFStartId,
      }),
      storeKey: 'RunProgress',
    });
    const gOwner = createExitDecisionAddress(goldenGBiome, gTakeover.source);
    const gView = renderWorkspace(gProject, 'Underworld', 'G');
    act(() => gView.application.store.dispatch(semanticOwnerFocused(gOwner)));
    const gBefore = gView.application.store.getState().projectWorkspace.history.past.length;
    expect(document.querySelector('[data-command="ReconcileTakeoverBatch"]')).not.toBeNull();
    await gView.user.click(screen.getByRole('button', { name: 'Repair Preboss batch' }));
    expect(gView.application.store.getState().projectWorkspace.history.past).toHaveLength(
      gBefore + 1,
    );
  });

  it('renders Fields, Ship, Shop, mixed Preboss, and completion workbenches from room-local descriptors', async () => {
    const underworld = createGoldenFGHIProject(catalog);
    const h = renderWorkspace(underworld, 'Underworld', 'H');
    act(() =>
      h.application.store.dispatch(
        semanticOwnerFocused(
          createOccurrenceAddress(goldenHBiome, createOccurrenceId('golden-h-combat02')),
        ),
      ),
    );
    expect(screen.getByLabelText('Fields cage rewards')).toBeTruthy();
    expect(screen.getByText('Cage 1')).toBeTruthy();
    cleanup();

    const i = renderWorkspace(underworld, 'Underworld', 'I');
    const mixed = workspaceBiome(i.application, 'Underworld', 'I').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'mixedBatch' }> =>
        node.kind === 'mixedBatch',
    );
    if (mixed === undefined) throw new Error('I mixed Preboss workbench is missing');
    act(() => i.application.store.dispatch(semanticOwnerFocused(mixed.owner)));
    expect(document.querySelector('[data-batch-kind="mixedBatch"]')).not.toBeNull();
    expect(screen.getByText('Mixed normal batch')).toBeTruthy();
    expect(screen.getByRole('button', { name: 'Exit 1 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    expect(screen.getByRole('button', { name: 'Exit 2 room' })).not.toHaveProperty(
      'disabled',
      true,
    );
    cleanup();

    const surface = createRepresentativeNOPQProject();
    const o = renderWorkspace(surface, 'Surface', 'O');
    act(() =>
      o.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(oBiome, oOccurrenceIds.combat04)),
      ),
    );
    expect(screen.getByLabelText('Ship combat encounters')).toBeTruthy();
    expect(screen.getByText('Reward wheel 1')).toBeTruthy();
    cleanup();

    const p = renderWorkspace(surface, 'Surface', 'P');
    act(() =>
      p.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.prebossShop)),
      ),
    );
    expect(screen.getAllByText('Purchased')).not.toHaveLength(0);
    const structure = screen.getByRole('region', { name: /Olympus structure/ });
    const completion = Array.from(
      structure.querySelectorAll<HTMLElement>('[data-kind="completion"]'),
    ).at(-1);
    if (completion === undefined) throw new Error('P completion rail node is missing');
    await p.user.click(within(completion).getByRole('button'));
    expect(screen.getByText(/derived from the biome layout/i)).toBeTruthy();
  });

  it('focuses a fixed Story reward at its owning occurrence workbench', () => {
    const project = createRepresentativeNOPQProject();
    const view = renderWorkspace(project, 'Surface', 'P');
    const storyOccurrenceId = pOccurrenceId('P_Story01', 7, 1);
    const story = workspaceBiome(view.application, 'Surface', 'P').nodes.find(
      (node): node is Extract<WorkspaceNode, { readonly kind: 'occurrenceWorkbench' }> =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === storyOccurrenceId,
    );
    if (story === undefined) throw new Error('P Story occurrence workbench is missing');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createIncomingRewardAddress(pBiome, storyOccurrenceId)),
      ),
    );

    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-occurrence-workbench');
    if (workbench === null) throw new Error('P Story occurrence inspector is missing');
    expect(
      within(workbench).getByRole('heading', { level: 3, name: story.room.label }),
    ).toBeTruthy();
    expect(within(workbench).getByText(/^Fixed reward:/)).toBeTruthy();
  });

  it('moves keyboard focus through semantic owners without authoring a change', async () => {
    const project = createGoldenFGHIProject(catalog);
    const view = renderWorkspace(project, 'Underworld', 'F');
    const structure = screen.getByRole('region', { name: /structure$/ });
    const railButtons = within(structure).getAllByRole('button');
    const target = railButtons.find((button) => button.textContent?.includes('Normal exits'));
    if (target === undefined) throw new Error('F normal batch rail node is missing');
    target.focus();
    await view.user.keyboard('{Enter}');
    const focused = view.application.store.getState().editorSession.focusedSemanticOwner;
    expect(focused?.kind).toBe('exitDecision');
  });

  it('navigates a guaranteed target finding to its owning occurrence workbench', () => {
    const target = createTargetAddress(
      pBiome,
      { kind: 'occurrence', occurrenceId: pOccurrenceIds.intro },
      'exit1',
    );
    const project = applyProjectCommand(createRepresentativeNOPQProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(pBiome, pOccurrenceId('P_Combat03', 1, 1)),
      gameName: 'P_Combat02',
    });
    const view = renderWorkspace(project, 'Surface', 'P');
    const finding = view.application.store
      .getState()
      .projectWorkspace.evaluation.findings.find(
        (candidate) =>
          candidate.code === 'targetRoomUnavailable' &&
          semanticAddressKey(candidate.origin) === semanticAddressKey(target),
      );
    if (finding === undefined) throw new Error('P invalid target finding is missing');

    act(() =>
      view.application.store.dispatch(
        semanticOwnerFocused(createOccurrenceAddress(pBiome, pOccurrenceIds.intro)),
      ),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(
      createOccurrenceAddress(pBiome, pOccurrenceIds.intro),
    );
    const beforeInspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    expect(
      within(beforeInspector).getByRole('heading', { level: 3, name: 'Entrance' }),
    ).toBeTruthy();

    act(() =>
      view.application.store.dispatch(
        findingSelected({ key: semanticFindingKey(finding), origin: finding.origin }),
      ),
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(target);
    const inspector = screen.getByRole('complementary', { name: 'Focused inspector' });
    const workbench = inspector.querySelector<HTMLElement>('.biome-occurrence-workbench');
    if (workbench === null) throw new Error('P target finding inspector is missing');
    expect(within(workbench).getByRole('heading', { level: 3, name: 'Combat 02' })).toBeTruthy();
  });
});
