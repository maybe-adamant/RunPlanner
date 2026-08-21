// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createBiomeAddress,
  createIncomingRewardAddress,
  createShopOfferAddress,
  encodeProjectDocument,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import type { ResolvedRewardOffer } from '@run-planner/engine/reward-kernel';
import { simulateProjectAssembly } from '@run-planner/engine/simulation';
import { act, cleanup, render, screen, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { renderToStaticMarkup } from 'react-dom/server';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import type {
  CandidateSessionFactoryOptions,
  RewardCandidateOwner,
} from '@planner/projections/candidateProjection';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import type { StructuredWorkspaceProjectionService } from '@planner/projections/structured-workspace';
import { createStructuredWorkspaceTestServices } from '@planner-test/fixtures/structuredWorkspace';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import { createGoldenFGHIProject, targetOccurrenceId } from '@run-planner/test-fixtures/underworld';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import { profileLoadSucceeded } from '@planner/state/profileSessionSlice';
import { createPlannerStore, useAppSelector, type PlannerStore } from '@planner/state/store';
import { CountedRewardEditor, RewardValueEditor } from './RewardEditors';

const biome = createBiomeAddress('Underworld', 'F');
const firstReward = createIncomingRewardAddress(biome, targetOccurrenceId('F', 2, 1));
const secondReward = createIncomingRewardAddress(biome, targetOccurrenceId('F', 2, 2));
const firstOwner: RewardCandidateOwner = { kind: 'incomingReward', address: firstReward };
const devotionOwner: RewardCandidateOwner = {
  kind: 'incomingReward',
  address: createIncomingRewardAddress(oBiome, oOccurrenceIds.devotion),
};
const blindBoxOwner: RewardCandidateOwner = {
  kind: 'shopOffer',
  address: createShopOfferAddress(
    createBiomeAddress('Underworld', 'G'),
    targetOccurrenceId('G', 5, 1),
    'Boon',
  ),
};

afterEach(cleanup);

function interactionsFor(
  project: ProjectDocument,
  options: CandidateSessionFactoryOptions = { yieldToHost: () => Promise.resolve() },
): WorkspaceInteractionCatalog {
  const { structuredWorkspace } = createStructuredWorkspaceTestServices(options);
  return structuredWorkspace.project(simulateProjectAssembly(catalog, project)).interactions;
}

function renderReward({
  interactions,
  offer,
  onReplace = () => undefined,
  owner = firstOwner,
}: {
  readonly interactions: WorkspaceInteractionCatalog;
  readonly offer: ResolvedRewardOffer;
  readonly onReplace?: (offer: ResolvedRewardOffer) => void;
  readonly owner?: RewardCandidateOwner;
}) {
  return render(
    <RewardValueEditor
      candidateOwner={owner}
      idPrefix="reward-editor"
      interactions={interactions}
      offer={offer}
      onReplace={onReplace}
    />,
  );
}

function deferredHostYield() {
  let resolve!: () => void;
  let reject!: (reason?: unknown) => void;
  const promise = new Promise<void>((resolvePromise, rejectPromise) => {
    resolve = resolvePromise;
    reject = rejectPromise;
  });
  return { promise, reject, resolve };
}

function projectRewardOffer(project: ProjectDocument): ResolvedRewardOffer {
  const occurrence = project.routes
    .flatMap((route) => route.biomes)
    .flatMap((plan) => plan.topology?.occurrences ?? [])
    .find((candidate) => candidate.occurrenceId === firstReward.occurrenceId);
  if (occurrence?.state.kind !== 'counted' || occurrence.state.reward === null) {
    throw new Error('Reward lifecycle harness has no counted occurrence');
  }
  return occurrence.state.reward.offer;
}

function StoreRewardHarness({
  structuredWorkspace,
}: {
  readonly structuredWorkspace: StructuredWorkspaceProjectionService;
}) {
  const workspace = useAppSelector((state) => state.projectWorkspace);
  return (
    <RewardValueEditor
      candidateOwner={firstOwner}
      idPrefix="lifecycle-stale"
      interactions={structuredWorkspace.project(workspace.assembly).interactions}
      offer={projectRewardOffer(workspace.history.present)}
      onReplace={() => undefined}
    />
  );
}

function renderStoreReward(
  store: PlannerStore,
  structuredWorkspace: StructuredWorkspaceProjectionService,
) {
  return render(
    <Provider store={store}>
      <StoreRewardHarness structuredWorkspace={structuredWorkspace} />
    </Provider>,
  );
}

describe('reward editor projections', () => {
  it('renders one compact summary without leaking game source names', () => {
    const project = createGoldenFGHIProject();
    const markup = renderToStaticMarkup(
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: firstReward }}
        idPrefix="trial"
        interactions={interactionsFor(project)}
        onReplace={() => undefined}
        offer={{
          rewardType: 'Devotion',
          payload: {
            kind: 'DevotionPair',
            chosenSource: 'ApolloUpgrade',
            spurnedSource: 'ZeusUpgrade',
          },
        }}
      />,
    );

    expect(markup).toContain('Trial · Apollo / Zeus');
    expect(markup).toContain('field-control contextual-picker field-control-inline');
    expect(markup).not.toContain('Chosen God');
    expect(markup).not.toContain('ApolloUpgrade');
    expect(markup).not.toContain('ZeusUpgrade');
  });

  it('renders the producer-resolved reward domain instead of the binding union', async () => {
    const project = createGoldenFGHIProject();
    const room = catalog.rooms.byKey.F_Combat03;
    if (room?.incomingReward.kind !== 'countedChoice') {
      throw new Error('F_Combat03 counted reward binding is missing');
    }
    const boon = projectRewardOffer(project);
    const user = userEvent.setup();
    render(
      <CountedRewardEditor
        candidateOwner={{ kind: 'incomingReward', address: firstReward }}
        idPrefix="combat-03"
        interactions={interactionsFor(project)}
        offer={boon}
        onReplace={() => undefined}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    const listbox = await screen.findByRole('listbox');
    expect(within(listbox).getByText('Boon')).toBeTruthy();
    expect(within(listbox).getByText('Max Health')).toBeTruthy();
    expect(within(listbox).queryByText('Ashes')).toBeNull();
  });

  it('renders the typed explanation for a selected-invalid reward', async () => {
    const maxHealth = { rewardType: 'MaxHealthDrop' } as const;
    let project = createGoldenFGHIProject();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: firstReward,
      value: maxHealth,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: secondReward,
      value: maxHealth,
    });
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project, { yieldToHost: () => Promise.resolve() }),
      offer: maxHealth,
      owner: { kind: 'incomingReward', address: secondReward },
    });

    await user.click(screen.getByLabelText('Reward'));

    expect(
      await screen.findAllByText('This reward conflicts with the offer on Door 1.'),
    ).toHaveLength(2);
  });

  it('keeps a pending interaction open and exposes an explicit cancel action', async () => {
    const project = createGoldenFGHIProject();
    const pending = deferredHostYield();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project, { yieldToHost: () => pending.promise }),
      offer: { rewardType: 'MaxHealthDrop' },
    });

    const control = screen.getByLabelText('Reward');
    await user.click(control);
    expect(control.getAttribute('aria-busy')).toBe('true');
    expect(screen.getByRole('status').textContent).toContain('Evaluating reward type choices');

    await user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(control.getAttribute('aria-expanded')).toBe('false');
  });

  it('commits a payload-free reward immediately after its type is chosen', async () => {
    const project = createGoldenFGHIProject();
    const maxHealth = { rewardType: 'MaxHealthDrop' } as const;
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project),
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      },
      onReplace,
    });

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(await screen.findByRole('listbox')).getByText('Max Health'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(maxHealth);
  });

  it('commits one complete Boon through keyboard-focused compound steps', async () => {
    const project = createGoldenFGHIProject();
    const apollo = {
      rewardType: 'Boon',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project),
      offer: {
        rewardType: 'Boon',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      },
      onReplace,
    });

    const trigger = screen.getByLabelText('Reward');
    trigger.focus();
    await user.keyboard('{Enter}');
    const rewardSearch = await screen.findByRole('combobox', {
      name: 'Reward type choices',
    });
    expect(document.activeElement).toBe(rewardSearch);
    await user.keyboard('Boon{Enter}');
    expect(onReplace).not.toHaveBeenCalled();
    const godSearch = await screen.findByRole('combobox', { name: 'God choices' });
    expect(document.activeElement).toBe(godSearch);
    await user.keyboard('Apollo{Enter}');

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(apollo);
  });

  it('ignores a stale projection failure after the project identity changes', async () => {
    const project = createGoldenFGHIProject();
    const pending = deferredHostYield();
    const selected = { rewardType: 'MaxHealthDrop' } as const;
    const renderEditor = (interactions: WorkspaceInteractionCatalog) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: firstReward }}
        idPrefix="stale-project"
        interactions={interactions}
        offer={selected}
        onReplace={() => undefined}
      />
    );
    const user = userEvent.setup();
    const view = render(
      renderEditor(interactionsFor(project, { yieldToHost: () => pending.promise })),
    );
    await user.click(screen.getByLabelText('Reward'));

    const replacement = applyProjectCommand(project, catalog, {
      kind: 'ReplaceIncomingReward',
      reward: firstReward,
      value: { rewardType: 'MaxManaDrop' },
    });
    view.rerender(renderEditor(interactionsFor(replacement)));
    await act(async () => {
      pending.reject(new Error('stale projection'));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
  });

  it('ignores a stale projection failure after the producer context changes', async () => {
    const project = createGoldenFGHIProject();
    const pending = deferredHostYield();
    const staleInteractions = interactionsFor(project, {
      yieldToHost: () => pending.promise,
    });
    const renderEditor = (owner: typeof firstReward) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: owner }}
        idPrefix="stale-context"
        interactions={owner === firstReward ? staleInteractions : interactionsFor(project)}
        offer={{ rewardType: 'MaxHealthDrop' }}
        onReplace={() => undefined}
      />
    );
    const user = userEvent.setup();
    const view = render(renderEditor(firstReward));
    await user.click(screen.getByLabelText('Reward'));

    view.rerender(renderEditor(secondReward));
    await act(async () => {
      pending.reject(new Error('stale projection'));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
  });

  it('does not resurrect a completed stale interaction when its context returns', async () => {
    const project = createGoldenFGHIProject();
    const pending = deferredHostYield();
    const selected = { rewardType: 'MaxHealthDrop' } as const;
    const staleInteractions = interactionsFor(project, {
      yieldToHost: () => pending.promise,
    });
    const renderEditor = (owner: typeof firstReward) => (
      <RewardValueEditor
        candidateOwner={{ kind: 'incomingReward', address: owner }}
        idPrefix="returning-context"
        interactions={owner === firstReward ? staleInteractions : interactionsFor(project)}
        offer={selected}
        onReplace={() => undefined}
      />
    );
    const user = userEvent.setup();
    const view = render(renderEditor(firstReward));
    await user.click(screen.getByLabelText('Reward'));

    view.rerender(renderEditor(secondReward));
    await act(async () => {
      pending.resolve();
      await Promise.resolve();
    });
    view.rerender(renderEditor(firstReward));

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Reward type')).toBeNull();
  });

  it('rejects stale reward work across edit, undo, redo, and profile replacement', async () => {
    const project = createGoldenFGHIProject();
    const pending = deferredHostYield();
    const { structuredWorkspace } = createStructuredWorkspaceTestServices({
      yieldToHost: () => pending.promise,
    });
    const store = createPlannerStore({
      assembleProjectEvaluation: (current) => simulateProjectAssembly(catalog, current),
      catalog,
      initialProject: project,
    });
    const user = userEvent.setup();
    renderStoreReward(store, structuredWorkspace);
    await user.click(screen.getByLabelText('Reward'));

    act(() => {
      store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceIncomingReward',
          reward: firstReward,
          value: { rewardType: 'MaxManaDrop' },
        }),
      );
    });
    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    act(() => {
      store.dispatch(authoredProjectUndoRequested());
    });
    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    act(() => {
      store.dispatch(authoredProjectRedoRequested());
    });
    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    const loadedProject = project;
    act(() => {
      store.dispatch(
        profileLoadSucceeded({
          baselineJson: encodeProjectDocument(loadedProject),
          fileName: 'loaded-profile.runplanner.json',
          project: loadedProject,
        }),
      );
    });
    await act(async () => {
      pending.reject(new Error('stale lifecycle projection'));
      await Promise.resolve();
    });

    expect(screen.getByLabelText('Reward').getAttribute('aria-expanded')).toBe('false');
    expect(screen.queryByText('Reward type')).toBeNull();
  });

  it('labels a Blind Box source without an extra eventual qualifier', async () => {
    const project = createGoldenFGHIProject();
    const blindBox = {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource' as const, source: 'ApolloUpgrade' },
    };
    const user = userEvent.setup();
    renderReward({ interactions: interactionsFor(project), offer: blindBox, owner: blindBoxOwner });

    const trigger = screen.getByLabelText('Reward');
    expect(trigger.textContent).toContain('Mystery Boon · Apollo');
    expect(trigger.textContent).not.toContain('(eventual)');
    await user.click(trigger);
    await screen.findByText('Reward type');
    await user.click(within(await screen.findByRole('listbox')).getByText('Mystery Boon'));

    expect(await screen.findByText('Eventual God')).toBeTruthy();
  });

  it('opens an unresolved declaration-fixed Blind Box directly at its total source picker', async () => {
    const project = createGoldenFGHIProject();
    const user = userEvent.setup();
    render(
      <RewardValueEditor
        candidateOwner={blindBoxOwner}
        idPrefix="unresolved-blind-box"
        initialStep="source"
        interactions={interactionsFor(project)}
        offer={null}
        onReplace={() => undefined}
        unresolvedSeed={{ rewardType: 'BlindBoxLoot' }}
      />,
    );

    await user.click(screen.getByLabelText('Reward'));
    expect(await screen.findByText('Eventual God')).toBeTruthy();
    expect((await screen.findByRole('listbox')).textContent).not.toBe('');
  });

  it('commits one complete Devotion offer only after both Gods are chosen', async () => {
    const project = loadSurfaceNOProject();
    const selected = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'AphroditeUpgrade',
        spurnedSource: 'AresUpgrade',
      },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project),
      offer: selected,
      onReplace,
      owner: devotionOwner,
    });

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(await screen.findByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(await screen.findByRole('listbox')).getByText('Apollo'));

    expect(onReplace).not.toHaveBeenCalled();
    await screen.findByText('Spurned God');
    await user.click(within(await screen.findByRole('listbox')).getByText('Hephaestus'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith({
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair',
        chosenSource: 'ApolloUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    });
  });

  it('allows the authored spurned God to become the new chosen God', async () => {
    const project = loadSurfaceNOProject();
    const supported = {
      rewardType: 'Devotion',
      payload: {
        kind: 'DevotionPair' as const,
        chosenSource: 'AresUpgrade',
        spurnedSource: 'HephaestusUpgrade',
      },
    };
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project),
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'AresUpgrade',
        },
      },
      onReplace,
      owner: devotionOwner,
    });

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(await screen.findByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(await screen.findByRole('listbox')).getByText('Ares'));
    await screen.findByText('Spurned God');
    await user.click(within(await screen.findByRole('listbox')).getByText('Hephaestus'));

    expect(onReplace).toHaveBeenCalledOnce();
    expect(onReplace).toHaveBeenCalledWith(supported);
  });

  it('cancels partial Devotion progress without authoring a replacement', async () => {
    const project = loadSurfaceNOProject();
    const onReplace = vi.fn();
    const user = userEvent.setup();
    renderReward({
      interactions: interactionsFor(project),
      offer: {
        rewardType: 'Devotion',
        payload: {
          kind: 'DevotionPair',
          chosenSource: 'AphroditeUpgrade',
          spurnedSource: 'AresUpgrade',
        },
      },
      onReplace,
      owner: devotionOwner,
    });

    await user.click(screen.getByLabelText('Reward'));
    await screen.findByText('Reward type');
    await user.click(within(await screen.findByRole('listbox')).getByText('Trial'));
    await screen.findByText('Chosen God');
    await user.click(within(await screen.findByRole('listbox')).getByText('Apollo'));
    await screen.findByText('Spurned God');
    await user.click(screen.getByRole('button', { name: 'Cancel' }));

    expect(onReplace).not.toHaveBeenCalled();
    expect(screen.getByLabelText('Reward').textContent).toContain('Trial · Aphrodite / Ares');
  });
});
