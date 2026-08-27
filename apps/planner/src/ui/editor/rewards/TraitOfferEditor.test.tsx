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
  type AuthoredTraitOffer,
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
import type {
  StructuredWorkspaceProjection,
  WorkspaceInteractionCatalog,
  WorkspaceTraitOfferControl,
} from '@planner/projections/structured-workspace';
import { TraitOfferDialog, TraitOfferEditor, TraitOfferLauncher } from './TraitOfferEditor';
import {
  createGoldenFGHProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenFStartId,
} from '@run-planner/test-fixtures/underworld';

afterEach(cleanup);

function findTraitOfferControl(
  workspace: StructuredWorkspaceProjection,
  address: import('@run-planner/engine/authored-project').TraitOfferAddress,
): WorkspaceTraitOfferControl {
  const key = semanticAddressKey(address);
  for (const route of workspace.routes)
    for (const biome of route.biomes)
      for (const node of biome.nodes) {
        const rooms =
          node.kind === 'occurrenceWorkbench'
            ? [node.room]
            : node.kind === 'ordinaryBatch' ||
                node.kind === 'mixedBatch' ||
                node.kind === 'takeoverBatch'
              ? node.targets.map((target) => target.room)
              : [];
        for (const room of rooms)
          for (const reward of room.rewardControls)
            for (const control of reward.traitOffers ?? [])
              if (semanticAddressKey(control.address) === key) return control;
      }
  throw new Error('Trait offer control is not projected');
}

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
    const initialInteraction = workspace.interactions.traitOffers.get(semanticAddressKey(address));
    if (initialInteraction === undefined) throw new Error('SpellDrop interaction is missing');
    const initialControl = findTraitOfferControl(workspace, address);
    if (initialControl.offer?.kind !== 'traits') throw new Error('SpellDrop offer is missing');
    const initialSelected = initialControl.offer.options[0];
    if (initialSelected === undefined) throw new Error('SpellDrop first option is missing');
    render(
      <Provider store={application.store}>
        <TraitOfferLauncher control={initialControl} interactions={workspace.interactions} />
      </Provider>,
    );
    const initialLauncher = screen.getByRole('button', { name: /Edit spell/ });
    expect(initialLauncher.textContent).toContain(
      initialInteraction.traitLabel(initialSelected.traitKey),
    );
    expect(initialLauncher.textContent).toContain('Crescent Moonglow · +0 Path of Stars');
    cleanup();
    events.length = 0;
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={workspace.interactions} target={address} />
      </Provider>,
    );
    expect(events).toEqual([]);
    expect(screen.getByText('Spell 1 · Crescent Moonglow · +0 Path of Stars')).toBeTruthy();
    expect(screen.getByText('Spell 2 · Half Moonglow · +1 Path of Stars')).toBeTruthy();
    expect(screen.getByText('Spell 3 · Full Moonglow · +2 Path of Stars')).toBeTruthy();
    expect(screen.queryByRole('button', { name: 'Rarify' })).toBeNull();
    expect(screen.queryByText(/^Rarity:/)).toBeNull();
    expect(screen.queryByRole('status', { name: 'Offer feedback' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Add option' })).toBeNull();
    expect(screen.queryByRole('button', { name: 'Select Fallback Gold' })).toBeNull();

    const historyDepth = application.store.getState().projectWorkspace.history.past.length;
    const option2 = screen.getAllByRole('radio', { name: 'Selected' })[1];
    if (option2 === undefined) throw new Error('Spell option 2 selector is missing');
    const user = userEvent.setup();
    await user.click(option2);
    await user.click(screen.getByRole('button', { name: 'Hex talent layout' }));
    await user.click(screen.getByRole('option', { name: 'Maze' }));
    await user.click(screen.getByRole('button', { name: 'Rare Hex node 1' }));
    await user.click(screen.getByRole('option', { name: 'Splendor' }));
    await user.click(screen.getByRole('button', { name: 'Save trait offer' }));
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
    expect(changed).toMatchObject({
      selectedOptionKey: 'option2',
      hexTree: {
        layoutKey: 'Maze',
        rareTalentKeys: expect.arrayContaining(['TransformSpecialTalent']),
      },
    });
    cleanup();
    const changedWorkspace = application.selectStructuredWorkspace(application.store.getState());
    const changedInteraction = changedWorkspace.interactions.traitOffers.get(
      semanticAddressKey(address),
    );
    if (changedInteraction === undefined)
      throw new Error('changed SpellDrop interaction is missing');
    const changedControl = findTraitOfferControl(changedWorkspace, address);
    if (changedControl.offer?.kind !== 'traits')
      throw new Error('changed SpellDrop offer is missing');
    const changedSelected = changedControl.offer.options[1];
    if (changedSelected === undefined) throw new Error('SpellDrop second option is missing');
    render(
      <Provider store={application.store}>
        <TraitOfferLauncher control={changedControl} interactions={changedWorkspace.interactions} />
      </Provider>,
    );
    const changedLauncher = screen.getByRole('button', { name: /Edit spell/ });
    expect(changedLauncher.textContent).toContain(
      changedInteraction.traitLabel(changedSelected.traitKey),
    );
    expect(changedLauncher.textContent).toContain('Half Moonglow · +1 Path of Stars · Maze');
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
    const rarify = screen.getAllByRole('button', { name: 'Rarify' })[0]!;
    expect(rarify.classList.contains('secondary-action')).toBe(true);
    await user.click(rarify);
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

  it('repairs a required Rejected row, keeps that row unavailable, and saves one undoable offer edit', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits' && candidate.value.options.length === 3,
    );
    if (base === undefined || base.value?.kind !== 'traits')
      throw new Error('three-row trait interaction is missing');
    const { rejectedOptionKey: _rejectedOptionKey, ...withoutRejected } = base.value;
    void _rejectedOptionKey;
    const value = Object.freeze({
      ...withoutRejected,
      selectedOptionKey: 'option1' as const,
      rarificationActions: Object.freeze([]),
    });
    const interaction = Object.freeze({
      ...base,
      value,
      rejectedBlockDomain: () =>
        Object.freeze({
          required: true,
          canClear: false,
          needsRepair: true,
          optionKeys: Object.freeze(['option2', 'option3'] as const),
        }),
      load: (draft: AuthoredTraitOffer = value) => {
        const supported = draft.kind === 'traits' && draft.rejectedOptionKey === 'option2';
        return Object.freeze([
          Object.freeze({
            value: draft,
            evaluation: Object.freeze({
              kind: 'traitOffer' as const,
              result: Object.freeze({
                assessments: Object.freeze([]),
                branches: Object.freeze([]),
                callingCard: Object.freeze([
                  Object.freeze({
                    effectiveRarities: Object.freeze([]),
                    invalidActionIndexes: Object.freeze([]),
                    rarifiableOptionKeys: Object.freeze(['option1', 'option2', 'option3'] as const),
                  }),
                ]),
                chaosOfferRules: Object.freeze([
                  Object.freeze({
                    ordinaryRequiresCommon: false,
                    rejectedBlockRequired: true,
                    rejectedBlockableOptionKeys: Object.freeze(['option2', 'option3'] as const),
                    rejectedBlockNeedsRepair: !supported,
                  }),
                ]),
                effectiveLevels: Object.freeze([]),
                findings: Object.freeze([]),
                persephoneLevelBonusMaximums: Object.freeze([]),
                supported,
              }),
            }),
          }),
        ]);
      },
    });
    const interactions = Object.freeze({
      ...workspace.interactions,
      traitOffers: new Map([[interaction.key, interaction]]),
    });
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <TraitOfferDialog interactions={interactions} target={interaction.owner} />
      </Provider>,
    );

    expect(screen.getByRole('group', { name: 'Rejected blocked row' })).toBeTruthy();
    const save = screen.getByRole('button', { name: 'Save trait offer' });
    expect(save).toHaveProperty('disabled', true);
    await user.click(screen.getByRole('radio', { name: 'Block Option 2' }));
    expect(screen.getAllByRole('button', { name: 'Rarify' })[1]).toHaveProperty('disabled', true);
    expect(screen.getAllByRole('radio', { name: 'Blocked by Rejected' })[0]).toHaveProperty(
      'disabled',
      true,
    );
    expect(save).toHaveProperty('disabled', false);
    await user.click(save);
    const saved = findTraitOfferControl(
      application.selectStructuredWorkspace(application.store.getState()),
      interaction.owner,
    );
    expect(saved.offer).toMatchObject({ rejectedOptionKey: 'option2' });
    application.store.dispatch(authoredProjectUndoRequested());
    const restored = findTraitOfferControl(
      application.selectStructuredWorkspace(application.store.getState()),
      interaction.owner,
    );
    expect(restored.offer).not.toMatchObject({ rejectedOptionKey: 'option2' });
    application.dispose();
  });

  it('refreshes an open editor when an external persisted Persephone result changes', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(createGoldenFGHIProject()));
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const base = [...workspace.interactions.traitOffers.values()].find(
      (candidate) => candidate.value?.kind === 'traits',
    );
    if (base === undefined || base.value?.kind !== 'traits') {
      throw new Error('traits interaction is missing');
    }
    const initialValue = Object.freeze({
      ...base.value,
      options: Object.freeze([
        Object.freeze({ ...base.value.options[0], persephoneLevelBonus: 1 }),
        base.value.options[1],
        base.value.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const updatedValue = Object.freeze({
      ...initialValue,
      options: Object.freeze([
        Object.freeze({ ...initialValue.options[0], persephoneLevelBonus: 5 }),
        initialValue.options[1],
        initialValue.options[2],
      ]) as AuthoredTraitOfferTraits['options'],
    });
    const interactionFor = (value: AuthoredTraitOfferTraits) =>
      Object.freeze({
        ...base,
        value,
        load: (draft: AuthoredTraitOffer = value) =>
          Object.freeze([
            Object.freeze({
              value: draft,
              evaluation: Object.freeze({
                kind: 'traitOffer' as const,
                result: Object.freeze({
                  assessments: Object.freeze([]),
                  branches: Object.freeze([]),
                  effectiveLevels: Object.freeze([6, 4, 2]),
                  findings: Object.freeze([]),
                  persephoneLevelBonusMaximums: Object.freeze([5, undefined, undefined]),
                  supported: true,
                }),
              }),
            }),
          ]),
      });
    const interactionsFor = (value: AuthoredTraitOfferTraits): WorkspaceInteractionCatalog =>
      Object.freeze({
        ...workspace.interactions,
        traitOffers: new Map([[base.key, interactionFor(value)]]),
      }) as unknown as WorkspaceInteractionCatalog;
    const user = userEvent.setup();
    const initialInteractions = interactionsFor(initialValue);
    const view = render(
      <Provider store={application.store}>
        <TraitOfferEditor address={base.owner} interactions={initialInteractions} />
      </Provider>,
    );

    const bonus = screen.getByRole('combobox', { name: 'option1 Persephone level bonus' });
    expect((bonus as HTMLSelectElement).value).toBe('1');
    await user.selectOptions(bonus, '2');
    expect((bonus as HTMLSelectElement).value).toBe('2');

    view.rerender(
      <Provider store={application.store}>
        <TraitOfferEditor address={base.owner} interactions={interactionsFor(updatedValue)} />
      </Provider>,
    );
    expect(
      (
        screen.getByRole('combobox', {
          name: 'option1 Persephone level bonus',
        }) as HTMLSelectElement
      ).value,
    ).toBe('5');
    application.dispose();
  });
});
