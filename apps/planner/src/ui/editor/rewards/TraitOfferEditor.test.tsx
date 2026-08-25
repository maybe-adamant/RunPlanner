// @vitest-environment jsdom

import { cleanup, render, screen, waitFor } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';
import {
  applyProjectCommand,
  createIncomingRewardAddress,
  createExitSelectionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createTraitOfferAddress,
  semanticAddressKey,
  type AuthoredTraitOfferTraits,
} from '@run-planner/engine/authored-project';

import {
  createApplication,
  type ApplicationEvaluationEvent,
} from '@planner/composition/createApplication';
import {
  authoredProjectUndoRequested,
  authoredProjectReplaced,
} from '@planner/state/projectWorkspaceSlice';
import { TraitOfferDialog, TraitOfferEditor } from './TraitOfferEditor';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

describe('trait offer editor entry and dialog', () => {
  it('edits the real reached SpellDrop once, without new project evaluation, and supports Undo', async () => {
    const events: ApplicationEvaluationEvent[] = [];
    const application = createApplication({ observeEvaluationWork: (event) => events.push(event) });
    const occurrenceId = goldenFOccurrenceId(10, 2);
    const project = applyProjectCommand(createGoldenFGHProject(), application.catalog, {
      kind: 'SetExitSelection',
      selection: createExitSelectionAddress(goldenFBiome, {
        kind: 'occurrence',
        occurrenceId: goldenFOccurrenceId(9, 1),
      }),
      value: { kind: 'normal', exitKey: 'exit2' },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const address = createTraitOfferAddress(
      createIncomingRewardAddress(goldenFBiome, occurrenceId),
      'self',
    );
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    expect(workspace.interactions.traitOffers.has(semanticAddressKey(address))).toBe(true);
    events.length = 0;
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={address} />
      </Provider>,
    );
    expect(events).toEqual([]);
    expect(screen.getByText('Spell 1')).toBeTruthy();
    expect(screen.getByText('Spell 2')).toBeTruthy();
    expect(screen.getByText('Spell 3')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rarify' })).toBeNull();
    expect(screen.queryByText(/^Rarity:/)).toBeNull();
    expect(screen.queryByRole('status', { name: 'Offer feedback' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add option' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Fallback Gold' })).toBeNull();

    const historyDepth = application.store.getState().projectWorkspace.history.past.length;
    const option2 = screen.getAllByRole('radio', { name: 'Selected' })[1];
    if (option2 === undefined) throw new Error('Spell option 2 selector is missing');
    await userEvent.setup().click(option2);
    await userEvent.setup().click(screen.getByRole('button', { name: 'Save trait offer' }));
    expect(application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyDepth + 1,
    );
    const changedOccurrence = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    const changed =
      changedOccurrence?.state.kind === 'counted' && changedOccurrence.state.reward !== null
        ? changedOccurrence.state.reward.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(changed).toMatchObject({ selectedOptionKey: 'option2' });
    application.store.dispatch(authoredProjectUndoRequested());
    const restoredOccurrence = application.store
      .getState()
      .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === occurrenceId);
    const restored =
      restoredOccurrence?.state.kind === 'counted' && restoredOccurrence.state.reward !== null
        ? restoredOccurrence.state.reward.traitOffersByAcquisitionRole?.self
        : undefined;
    expect(restored).toMatchObject({ selectedOptionKey: 'option1' });
    application.dispose();
  });

  it('uses the Calling Card candidate to append ordered row actions through Heroic without mutating base rarity', async () => {
    const application = createApplication();
    const reward = createIncomingRewardAddress(goldenFBiome, goldenFStartId);
    const address = createTraitOfferAddress(reward, 'source');
    let project = applyProjectCommand(createGoldenFGHIProject(), application.catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'RarifyKeepsake',
    });
    project = applyProjectCommand(project, application.catalog, {
      kind: 'ReplaceIncomingReward',
      reward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    });
    application.store.dispatch(authoredProjectReplaced(project));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interaction = workspace.interactions.traitOffers.get(semanticAddressKey(address));
    if (interaction === undefined || interaction.value?.kind !== 'traits')
      throw new Error('Calling Card Apollo interaction is missing');
    const commit = vi.fn();
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferEditor
          address={address}
          interactions={workspace.interactions}
          onCommit={commit}
        />
      </Provider>,
    );

    await waitFor(() =>
      expect(screen.getAllByRole('button', { name: 'Rarify' })[0]).toHaveProperty(
        'disabled',
        false,
      ),
    );
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    const save = screen.getByRole('button', { name: 'Save trait offer' });
    expect(save).toHaveProperty('disabled', false);
    await user.click(save);

    const saved = commit.mock.calls[0]?.[0] as AuthoredTraitOfferTraits;
    expect(saved.options[0]?.rarity).toBe('Common');
    expect(saved.rarificationActions).toEqual(['option1']);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    await user.click(screen.getAllByRole('button', { name: 'Rarify' })[0]!);
    expect(screen.getByText('Effective rarity: Heroic')).toBeTruthy();
    expect(screen.getAllByRole('button', { name: 'Rarify' })[0]).toHaveProperty('disabled', true);
    application.dispose();
  });
});
