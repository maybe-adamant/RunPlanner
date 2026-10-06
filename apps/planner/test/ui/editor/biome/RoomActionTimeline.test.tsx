// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  artificerAcquisitionSite,
  artificerReplacementEntryKey,
  createAcquisitionEntryAddress,
  createAcquisitionRoleAddress,
  createEncounterPhaseAddress,
  createIncomingRewardAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomActionAddress,
  createRouteStartKeepsakeSelectionAddress,
  createShopOfferAddress,
  createStartingRewardAddress,
  createSteadyGrowthOutcomeAddress,
  decodeProjectDocument,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createOpenTestApplication } from '@planner-test/fixtures/renderPlanner';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import { semanticOwnerControlElementId } from '@planner/ui/feedback/semanticOwner';

import { SteadyGrowthEffectRow } from '@planner/ui/editor/biome/SteadyGrowthEffectRow';
import {
  createCompleteFGProject,
  createFConversionFrontierProject,
  createGoldenFGHIProject,
  goldenFBiome,
  goldenFOccurrenceId,
  goldenHBiome,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import { createReachableNaturalChaosProject } from '@planner-test/support/structured-workspace/interaction-binding.test-support';
import {
  loadSurfaceNOPQProject,
  surfaceShrineTravelDealProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import {
  authorLegalTraitOffers,
  replaceTestRoomActionOrder,
} from '@run-planner/test-fixtures/shared';
import {
  renderOccurrenceWorkbench,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import {
  completionOccurrenceById,
  enteredShopProject,
  expectBefore,
  fieldsGorgonBarrierProject,
  insertRoomAction,
  occurrenceById,
  occurrenceRoomActionOrder,
  openRoomTab,
  threeCageFieldsProject,
} from '@planner-test/support/occurrence-workbench';

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

describe('Ship timeline tab recovery', () => {
  it('restores an imported phase-local required delivery without entering inactive repairs', async () => {
    const complete = surfaceShrineTravelDealProject();
    const host = complete.route.biomes
      .find((biome) => biome.biomeKey === 'O')!
      .topology!.occurrences.find((room) => room.occurrenceId === oOccurrenceIds.combat04)!;
    const delivery = host.roomActions.order.find(
      (reference) =>
        reference.kind === 'interactAcquisitionEntry' &&
        reference.siteKey === 'hermesShrineDelivery',
    )!;
    const project = applyProjectCommand(complete, catalog, {
      kind: 'UnplaceGeneratedDelivery',
      action: createRoomActionAddress(oBiome, host.occurrenceId, roomActionKey(delivery)),
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
      undefined,
      { initialTab: 'shipCombat1Actions' },
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(0);
    const required = screen.getByRole('region', { name: 'Required actions' });
    await view.user.click(within(required).getByRole('button', { name: 'Restore delivery' }));
    expect(screen.queryByRole('region', { name: 'Required actions' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(1);
    expect(
      screen.getByRole('tab', { name: 'Combat 1 Timeline' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.queryByRole('region', { name: 'Intro ship phase' })).toBeNull();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(screen.getByRole('region', { name: 'Required actions' })).not.toBeNull();
    expect(
      screen.getByRole('tab', { name: 'Combat 1 Timeline' }).getAttribute('aria-selected'),
    ).toBe('true');
  });

  it('recovers a removed phase tab and restores only that phase on Undo', async () => {
    const occurrence = createOccurrenceAddress(oBiome, oOccurrenceIds.combat04);
    const project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    await view.user.click(screen.getByRole('tab', { name: 'Combat 2 Timeline' }));
    expect(screen.getByRole('region', { name: 'Combat 2 ship phase' })).not.toBeNull();
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceShipEncounterCount',
          occurrence,
          encounterCount: 2,
        }),
      ),
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.queryByRole('region', { name: 'Combat 2 ship phase' })).toBeNull();
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      screen.getByRole('tab', { name: 'Combat 2 Timeline' }).getAttribute('aria-selected'),
    ).toBe('true');
    expect(screen.getByRole('region', { name: 'Combat 2 ship phase' })).not.toBeNull();
    expect(screen.queryByRole('region', { name: 'Intro ship phase' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Combat 1 ship phase' })).toBeNull();
  });

  it.each(['actions', 'shipCombat2Actions', 'shipInactiveRepair'] as const)(
    'recovers unavailable %s without showing a combined timeline',
    async (initialTab) => {
      const { user } = renderOccurrenceWorkbench(
        loadSurfaceNOPQProject(),
        'Surface',
        'O',
        occurrenceById(oOccurrenceIds.combat04),
        undefined,
        { initialTab },
      );
      expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
        'true',
      );
      await user.click(screen.getByRole('tab', { name: 'Combat 1 Timeline' }));
      expect(screen.getByRole('region', { name: 'Combat 1 ship phase' })).not.toBeNull();
      expect(screen.queryByRole('region', { name: 'Intro ship phase' })).toBeNull();
    },
  );
});

describe('OccurrenceRoomActions', () => {
  it('offers Time Piece on the reached Chaos reward pickup', async () => {
    const chaosOccurrenceId = createOccurrenceId('fixture-chaos-room');
    const project = applyProjectCommand(createReachableNaturalChaosProject(), catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(chaosOccurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const outcome = within(actions).getByRole('button', {
      name: /^Pickup outcome for /,
    });
    // Without the Sea Star keepsake the engine supports no proc, so no checkbox renders.
    expect(within(actions).queryByRole('checkbox', { name: /^Sea Star procced for / })).toBeNull();
    await view.user.click(outcome);
    // Only engine-supported outcomes are listed.
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.getAttribute('aria-label') ?? option.textContent?.replace('✓', '')),
    ).toEqual(['Pickup', 'Timepiece']);
    const timePiece = screen.getByRole('option', {
      name: 'Timepiece',
    });

    expect(timePiece.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(timePiece);
    const authoredChaos = view.application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((occurrence) => occurrence.occurrenceId === chaosOccurrenceId);
    expect(
      authoredChaos?.state.kind === 'fixed' && authoredChaos.state.reward !== null
        ? authoredChaos.state.reward.dispositionByAcquisitionRole.self
        : undefined,
    ).toEqual({ kind: 'timePiece' });
  });

  it('reopens the shared Steady Growth target picker on exact finding navigation', async () => {
    const application = createOpenTestApplication('Underworld');
    const outcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
      'Encounter',
    );
    const control = {
      address: outcome,
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 1,
        focusKey: 'test-steady-growth-row',
      }),
      phaseKey: 'Encounter',
    };
    const interaction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: () => ({
        command: {
          kind: 'ReplaceSteadyGrowthTarget' as const,
          outcome,
          targetTraitKey: 'ApolloWeaponBoon',
        },
      }),
      forTarget: () => ({
        load: () => ({
          emptyNoOp: false,
          picker: {
            sections: [
              {
                key: 'eligible',
                kind: 'category' as const,
                label: 'Eligible traits',
                collapsible: false,
                items: [
                  {
                    key: 'ApolloWeaponBoon',
                    label: 'Apollo Attack',
                    value: 'ApolloWeaponBoon',
                    state: 'possible' as const,
                    selected: false,
                    disabled: false,
                  },
                ],
              },
            ],
          },
          selectedPossible: true,
        }),
      }),
      traitLabel: (traitKey: string) => traitKey,
    };
    application.store.dispatch(semanticOwnerNavigated(outcome));
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interactions = {
      ...workspace.interactions,
      steadyGrowth: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    const view = render(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    const picker = await screen.findByLabelText('Steady Growth target');
    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('true'));
    expect(picker.id).toBe(semanticOwnerControlElementId(outcome));
    const emptyInteraction = {
      ...interaction,
      forTarget: () => ({
        load: () => ({
          emptyNoOp: true,
          selectedPossible: true,
          picker: { sections: [] },
        }),
      }),
    };
    view.rerender(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow
          control={control}
          interactions={{
            ...interactions,
            steadyGrowth: new Map([[semanticAddressKey(outcome), emptyInteraction]]),
          }}
        />
      </Provider>,
    );
    await waitFor(() => expect(picker).toHaveProperty('disabled', true));
    expect(screen.getByLabelText('Steady Growth target')).toBe(picker);
    expect(picker.textContent).toContain('No eligible trait');
    expect(picker.getAttribute('aria-expanded')).toBe('false');
    application.dispose();
  });

  it('keeps a stale Steady Growth target visible and exposes its exact clear command', async () => {
    const application = createOpenTestApplication('Surface');
    vi.spyOn(application.store, 'dispatch').mockImplementation(() => undefined as never);
    const outcome = createSteadyGrowthOutcomeAddress(
      createOccurrenceAddress(nBiome, nOccurrenceIds.opening),
      'Encounter',
    );
    const clearIntent = vi.fn(() => ({
      command: {
        kind: 'ReplaceSteadyGrowthTarget' as const,
        outcome,
        targetTraitKey: null,
      },
    }));
    const control = {
      address: outcome,
      marker: Object.freeze({
        address: outcome,
        assessment: 'assessed' as const,
        findingCount: 1,
        focusKey: 'test-steady-growth-retained-row',
      }),
      phaseKey: 'Encounter',
      targetTraitKey: 'HestiaWeaponBoon',
    };
    const interaction = {
      key: semanticAddressKey(outcome),
      owner: outcome,
      intentFor: clearIntent,
      forTarget: () => ({
        load: () => ({
          emptyNoOp: true,
          picker: {
            selected: {
              key: 'HestiaWeaponBoon',
              label: 'Hestia Attack',
              value: 'HestiaWeaponBoon',
              state: 'impossible' as const,
              selected: true,
              disabled: true,
            },
            sections: [
              {
                key: 'selected-invalid',
                kind: 'selectedInvalid' as const,
                label: 'Current target',
                collapsible: false,
                items: [
                  {
                    key: 'HestiaWeaponBoon',
                    label: 'Hestia Attack',
                    value: 'HestiaWeaponBoon',
                    state: 'impossible' as const,
                    selected: true,
                    disabled: true,
                  },
                ],
              },
            ],
          },
          selectedPossible: false,
        }),
      }),
      traitLabel: (traitKey: string) => traitKey,
    };
    const workspace = application.selectStructuredWorkspace(application.store.getState())!;
    const interactions = {
      ...workspace.interactions,
      steadyGrowth: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    expect(await screen.findByLabelText('Steady Growth target')).toBeTruthy();
    expect(screen.getByLabelText('Steady Growth').getAttribute('data-action-accent')).toBe(
      'automatic',
    );
    expect(screen.queryByText('No eligible trait')).toBeNull();
    expect(screen.queryByText('Needs repair')).toBeNull();
    await screen.findByRole('button', { name: 'Clear recorded target' }).then((button) =>
      act(() => {
        button.click();
      }),
    );
    expect(clearIntent).toHaveBeenCalledWith(null);
    application.dispose();
  });

  it('renders Optional Rewards before its one Room Timeline board', () => {
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    openRoomTab('Room Overview');
    expect(screen.queryByRole('list', { name: 'Timeline legend' })).toBeNull();
    const fieldsSetup = screen.getByLabelText('Optional Rewards');
    const passiveEncounter = screen.getByLabelText('Passive encounter phase');
    expectBefore(passiveEncounter, fieldsSetup);
    expect(
      within(passiveEncounter).getByRole('button', { name: 'Customize encounter' }),
    ).toBeTruthy();
    expect(fieldsSetup).toBeTruthy();
    expect(within(fieldsSetup).queryByText('Cage reward identities')).toBeNull();
    expect(within(fieldsSetup).queryByLabelText('Cage 1')).toBeNull();
    expect(within(fieldsSetup).getByRole('radiogroup', { name: 'Optional pickups' })).toBeTruthy();
    expect(within(fieldsSetup).getByLabelText('Optional 1')).toBeTruthy();
    openRoomTab('Room Timeline');
    const fieldsActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(screen.getByRole('list', { name: 'Timeline legend' }).textContent).toBe(
      'OptionalRequired nowBefore leavingAutomatic',
    );
    expect(within(fieldsActions).queryByRole('heading', { name: 'Room Timeline' })).toBeNull();
    expect(within(fieldsActions).getByLabelText('Room entered')).toBeTruthy();
    expect(within(fieldsActions).queryByLabelText('Passive encounter phase')).toBeNull();
    expect(
      fieldsActions.querySelector('[data-lifecycle-boundary="encounterStart:Passive"]'),
    ).toBeNull();
    const fieldsEncounter = screen.queryByLabelText('Encounter phase');
    if (fieldsEncounter !== null) expectBefore(fieldsEncounter, fieldsActions);
    const timeline = within(fieldsActions).getByRole('list', { name: 'Room timeline' });
    const optionalPool = within(fieldsActions).getByRole('region', { name: 'Optional actions' });
    expect(within(timeline).queryByText(/^Collect .+ · Optional 1/)).toBeNull();
    const optionalAction = within(optionalPool)
      .getByText(/^Collect .+ · Optional 1/)
      .closest('li');
    if (optionalAction === null) throw new Error('Optional reward action is missing');
    expect(optionalAction.getAttribute('data-action-accent')).toBe('optional');
    expect(
      within(timeline)
        .getByText(/^Collect .+ · Cage 1/)
        .closest('li')
        ?.getAttribute('data-action-accent'),
    ).toBe('room');
    expect(within(optionalAction).queryByLabelText('Optional 1')).toBeNull();
    expect(within(optionalAction).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(fieldsActions).toBeTruthy();
  });

  it('projects three fixed Fields cycles with read-only cage labels and movable pickups', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    const starts = [1, 2, 3].map((ordinal) =>
      within(timeline).getByLabelText(`Start encounter ${ordinal}`),
    );
    const ends = Array.from(
      timeline.querySelectorAll<HTMLElement>('[data-lifecycle-boundary^="encounterEnd:"]'),
    );
    expect(ends).toHaveLength(3);
    for (const [index, start] of starts.entries())
      expect(start.querySelector('.fields-cage-label')?.textContent).toMatch(
        new RegExp(`^Cage ${index + 1} \\(`),
      );
    const cageOrder = within(actions).getByRole('button', { name: 'Combat Order' });
    expectBefore(cageOrder, within(timeline).getByLabelText('Room entered'));
    expect(within(timeline).queryByText(/^Clear Cage\d+/)).toBeNull();
    for (const row of timeline.querySelectorAll('[data-in-order="true"]')) {
      expect(within(row as HTMLElement).getByRole('button', { name: /^Move / })).toBeTruthy();
    }

    const dropTargetSelector =
      '[data-room-action-drop-index], [data-room-action-key][data-in-order="true"]';
    const timelineChildren = Array.from(timeline.children);
    for (const [index, start] of starts.entries()) {
      const end = ends[index]!;
      expectBefore(start, end);
      const startIndex = timelineChildren.indexOf(start);
      const endIndex = timelineChildren.indexOf(end);
      expect(startIndex).toBeGreaterThanOrEqual(0);
      expect(endIndex).toBeGreaterThan(startIndex);
      const insertionTargets = timelineChildren
        .slice(startIndex + 1, endIndex)
        .flatMap((candidate) => [
          ...(candidate.matches(dropTargetSelector) ? [candidate] : []),
          ...candidate.querySelectorAll(dropTargetSelector),
        ]);
      expect(insertionTargets).toEqual([]);
    }

    const cagePickup = within(timeline)
      .getByText(/^Collect .+ · Cage 1/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (cagePickup === null) throw new Error('Cage 1 pickup row is missing');
    expectBefore(ends[0]!, cagePickup);
    expect(cagePickup.querySelector('[data-room-action-drag-handle]')).not.toBeNull();
    const movePickupEarlier = within(cagePickup).getByRole('button', {
      name: /^Move Collect .* · Cage 1$/,
    }) as HTMLButtonElement;
    expect(movePickupEarlier.disabled).toBe(false);
    await view.user.click(movePickupEarlier);
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: 'Before Clear Cage 3' }),
    );
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(
        order?.flatMap((reference) =>
          reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
        ),
      ).toEqual(['Cage01', 'Cage02', 'Cage03']);
      expect(order?.[2]).toEqual({
        groupKey: 'cages',
        kind: 'interactLocalReward',
        slotKey: 'cage1',
      });
    });
    expect(within(actions).getByRole('region', { name: 'Optional actions' })).toBeTruthy();

    const cageOneAction = createRoomActionAddress(
      goldenHBiome,
      occurrenceId,
      roomActionKey({ kind: 'completeFieldsCage', phaseKey: 'Cage01' }),
    );
    expect(starts[0]?.querySelector('.fields-cage-label')?.getAttribute('id')).toBe(
      semanticOwnerControlElementId(cageOneAction),
    );
  });

  it('authors every cage encounter in Overview and keeps cage order and read-only cages in Timeline', () => {
    renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const structure = screen.getByRole('region', { name: 'Encounter structure' });
    for (const cage of ['Cage 1', 'Cage 2', 'Cage 3']) {
      const phase = within(structure).getByLabelText(`${cage} encounter phase`);
      expect(within(phase).getByRole('button', { name: `${cage} encounter` })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: 'Combat Order' })).toBeNull();
    openRoomTab('Room Timeline');
    expect(screen.getByRole('button', { name: 'Combat Order' })).toBeTruthy();
    // Each cage start banner names its encounter read-only; identity stays in Overview.
    for (const ordinal of [1, 2, 3]) {
      const start = screen.getByLabelText(`Start encounter ${ordinal}`);
      expect(start.querySelector('.fields-cage-label')).not.toBeNull();
      expect(start.querySelector('.timeline-banner-identity')?.textContent).not.toMatch(/Cage/);
    }
    for (const cage of ['Cage 1', 'Cage 2', 'Cage 3'])
      expect(screen.queryByRole('button', { name: `${cage} encounter` })).toBeNull();
    expect(screen.queryByLabelText('Cage 1 encounter phase')).toBeNull();
  });

  it('stages the complete cage order, cancels without editing, and commits two moves in one undo step', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const initial = view.application.store.getState().projectWorkspace.history!.present;
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const choose = async (number: number) =>
      view.user.click(
        within(screen.getByRole('listbox')).getByRole('option', {
          name: new RegExp(`^Cage ${number} \\(`),
        }),
      );
    await view.user.click(screen.getByRole('button', { name: 'Combat Order' }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
    await choose(3);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(initial);
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(initial);

    await view.user.click(screen.getByRole('button', { name: 'Combat Order' }));
    for (const number of [1, 2, 3]) await choose(number);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    await view.user.click(screen.getByRole('button', { name: 'Combat Order' }));
    await choose(3);
    await choose(2);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(initial);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(1);
    await choose(1);

    const cagePermutation = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'H',
        occurrenceId,
      )?.flatMap((reference) =>
        reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
      );
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage03', 'Cage02', 'Cage01']));
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    for (const [index, number] of [3, 2, 1].entries())
      expect(screen.getByLabelText(`Start encounter ${index + 1}`).textContent).toContain(
        `Cage ${number} (`,
      );
    expect(screen.getByRole('button', { name: 'Combat Order' }).textContent).toMatch(
      /Cage 3 \(.+\) \/ Cage 2 \(.+\) \/ Cage 1 \(.+\)/,
    );

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage01', 'Cage02', 'Cage03']));
    expect(screen.getByLabelText('Start encounter 1').textContent).toContain('Cage 1 (');
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage03', 'Cage02', 'Cage01']));
  });

  it('keeps a cage selectable across a retained cage-local Gorgon barrier', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      fieldsGorgonBarrierProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    await view.user.click(screen.getByRole('button', { name: 'Combat Order' }));
    const cageTwoOption = within(screen.getByRole('listbox')).getByRole('option', {
      name: /^Cage 2 \(/,
    });
    expect(cageTwoOption.getAttribute('aria-disabled')).not.toBe('true');
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));

    const projected = workspaceProjection(view.application)
      .route?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') {
      throw new Error('Fields Gorgon occurrence workbench is missing');
    }
    const roomActions = projected.room.roomActions;
    const firstCage = roomActions?.rows.find(
      (row) => row.reference.kind === 'completeFieldsCage' && row.reference.phaseKey === 'Cage01',
    );
    const genericProposal = roomActions?.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.reference.kind === 'completeFieldsCage' &&
        proposal.reference.phaseKey === 'Cage02' &&
        proposal.toIndex === firstCage!.rank! - 1,
    );
    expect(genericProposal).toMatchObject({ kind: 'move', structurallyAuthorable: false });
    expect(genericProposal?.explanations).toEqual(['Talk to Athena before clearing Cage02.']);

    const athena = roomActions?.rows.find((row) => row.reference.kind === 'interactGorgon');
    const blockedMove = roomActions?.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.toIndex === 0 &&
        athena?.proposalKeys.includes(proposal.key),
    );
    expect(blockedMove?.explanations).toEqual(['Clear Cage 1 to make Athena available.']);
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
    const handle = within(actions)
      .getByText('Talk to Athena', { selector: 'strong' })
      .closest<HTMLElement>('[data-room-action-key]')
      ?.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (!handle) throw new Error('Athena drag handle missing');
    const titled = [...actions.querySelectorAll<HTMLElement>('.timeline-row[title]')].map(
      (element) => ({ element, title: element.title }),
    );
    expect(titled.length).toBeGreaterThan(0);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => within(actions).getByLabelText('Room entered'),
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 92,
    });
    fireEvent.pointerMove(board, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 92 });
    expect(screen.getByText(`Unavailable: ${blockedMove!.explanations.join(' ')}`)).toBeTruthy();
    expect(actions.querySelectorAll('.timeline-row[title]')).toHaveLength(0);
    const preview = actions.querySelector('.room-action-drag-preview');
    expect(preview?.querySelector('.room-action-drag-header strong')?.textContent).toBe(
      'Talk to Athena',
    );
    expect(preview?.querySelector(':scope > .room-action-drag-feedback')).toBeTruthy();
    expect(preview?.classList.contains('hub-roster-drag-preview')).toBe(false);
    fireEvent.pointerUp(board, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 92 });
    expect(
      screen.getByText(`Action not moved. ${blockedMove!.explanations.join(' ')}`),
    ).toBeTruthy();
    for (const { element, title } of titled) expect(element.title).toBe(title);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(screen.getByRole('button', { name: 'Combat Order' }));
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /^Cage 2 \(/ }),
    );
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /^Cage 1 \(/ }),
    );
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'H',
        occurrenceId,
      );
      expect(
        order?.flatMap((reference) =>
          reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
        ),
      ).toEqual(['Cage02', 'Cage01']);
      expect(order).toContainEqual({ kind: 'interactGorgon', phaseKey: 'Cage01' });
    });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );

    const edited = workspaceProjection(view.application)
      .route?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (edited?.kind !== 'occurrenceWorkbench') {
      throw new Error('Edited Fields Gorgon occurrence workbench is missing');
    }
    const gorgon = edited.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactGorgon' && row.reference.phaseKey === 'Cage01',
    );
    expect(gorgon).toMatchObject({ executable: true, stale: false });
  });

  it('distinguishes a retained blocker from new placement dependencies', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const initial = fieldsGorgonBarrierProject();
    const order = [...occurrenceRoomActionOrder(initial, 'Underworld', 'H', occurrenceId)!];
    const athenaIndex = order.findIndex((reference) => reference.kind === 'interactGorgon');
    const [athena] = order.splice(athenaIndex, 1);
    order.unshift(athena!);
    const project = replaceTestRoomActionOrder(initial, catalog, goldenHBiome, occurrenceId, order);
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    const projected = workspaceProjection(view.application)
      .route?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') throw new Error('Fields workbench missing');
    const actions = projected.room.roomActions!;
    const unrelated = actions.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.toIndex === order.length - 1 &&
        proposal.reference.kind === 'interactLocalReward' &&
        proposal.reference.slotKey === 'optional1',
    );
    expect(unrelated?.explanations).toEqual([
      'Existing timeline issue: Clear Cage 1 to make Athena available.',
    ]);
    const newConflict = actions.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.toIndex === 0 &&
        proposal.reference.kind === 'completeFieldsCage' &&
        proposal.reference.phaseKey === 'Cage02',
    );
    expect(newConflict?.explanations).toEqual(['Talk to Athena before clearing Cage02.']);
    const cageReward = actions.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.toIndex === 0 &&
        proposal.reference.kind === 'interactLocalReward' &&
        proposal.reference.slotKey === 'cage1',
    );
    expect(cageReward?.explanations).toEqual(['Clear Cage 1 to unlock this reward.']);
  });

  // This three-cage route is repairable-invalid under the run-scoped ledger,
  // and the missing anchor is exactly the repair leaf it publishes, so the
  // product under test stays observable on it.
  it('keeps a missing active Fields cage anchor in Timeline repairs', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const authored = threeCageFieldsProject();
    const malformed = decodeProjectDocument(
      {
        ...authored,
        route: {
          ...authored.route,
          biomes: authored.route.biomes.map((biome) =>
            biome.biomeKey !== 'H' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId !== occurrenceId
                        ? occurrence
                        : {
                            ...occurrence,
                            roomActions: {
                              order: occurrence.roomActions.order.filter(
                                (reference) =>
                                  reference.kind !== 'completeFieldsCage' ||
                                  reference.phaseKey !== 'Cage03',
                              ),
                            },
                          },
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    renderOccurrenceWorkbench(malformed, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    const repairs = within(actions).getByRole('region', { name: 'Timeline repairs' });
    expect(within(timeline).queryByText('Clear Cage 3')).toBeNull();
    expect(within(repairs).getByText('Clear Cage 3')).toBeTruthy();
    expect(within(repairs).queryByText('This required action has not been placed.')).toBeNull();
    const cageOrder = within(actions).getByRole('button', {
      name: 'Combat Order',
    }) as HTMLButtonElement;
    expect(cageOrder.disabled).toBe(true);
    expect(cageOrder.title).toBe('Restore missing cage actions before changing their order.');
    expect(cageOrder.textContent).toMatch(/^Cage \d \(.+\) \/ Cage \d \(.+\)/);
  });

  it('accepts a Fields optional reward directly on the Room entered checkpoint', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const optionalPool = within(actions).getByRole('region', { name: 'Optional actions' });
    const initialOptional = within(optionalPool)
      .getByText(/^Collect .+ · Optional 1/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (initialOptional === null) throw new Error('Optional 1 action is missing');
    expect(within(actions).queryByRole('button', { name: / here:/ })).toBeNull();
    const add = within(initialOptional).getByRole('button', { name: /^Add Collect / });
    const historyLength = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(add);
    expect(initialOptional.getAttribute('data-placing')).toBe('true');
    const insertionLabels = within(actions)
      .getAllByRole('button', { name: / here:/ })
      .map((button) => button.getAttribute('aria-label'));
    expect(new Set(insertionLabels).size).toBe(insertionLabels.length);
    await view.user.click(within(actions).getAllByRole('button', { name: /^Move / })[0]!);
    expect(screen.getByRole('listbox')).toBeTruthy();
    await view.user.keyboard('{Escape}');
    expect(screen.queryByRole('listbox')).toBeNull();
    expect(initialOptional.getAttribute('data-placing')).toBe('true');
    await view.user.keyboard('{Escape}');
    expect(within(actions).queryByRole('button', { name: / here:/ })).toBeNull();
    expect(document.activeElement).toBe(add);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyLength,
    );
    await view.user.click(add);
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(within(actions).queryByRole('button', { name: / here:/ })).toBeNull();
    await view.user.click(add);
    const addHere = within(actions)
      .getAllByRole('button', { name: /^Add Collect .+ · Optional 1 here:/ })
      .filter((button) => button.getAttribute('aria-disabled') !== 'true')
      .at(-1);
    if (addHere === undefined) throw new Error('Timeline has no insertion point');
    expectBefore(within(actions).getByLabelText('Doors open'), addHere);
    await view.user.click(addHere);
    expect(within(actions).queryByRole('button', { name: / here:/ })).toBeNull();

    expect(within(optionalPool).queryByText(/^Collect .+ · Optional 1/)).toBeNull();
    const orderedOptional = within(actions)
      .getByText(/^Collect .+ · Optional 1/, { selector: 'strong' })
      .closest<HTMLElement>('[data-room-action-key]');
    expect(orderedOptional?.getAttribute('data-action-accent')).toBe('optional');
    const roomEntered = within(actions).getByLabelText('Room entered');
    expect(document.activeElement).toBe(orderedOptional);
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
    const handle = orderedOptional?.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (orderedOptional === null || handle === null || handle === undefined)
      throw new Error('Ordered Optional 1 drag handle is missing');
    const historyBeforeNoOp =
      view.application.store.getState().projectWorkspace.history!.past.length;
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => orderedOptional,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 90,
    });
    fireEvent.pointerMove(board, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 90 });
    expect(screen.queryByText('Unavailable: required action order or timing')).toBeNull();
    expect(orderedOptional.dataset.dropAfter).toBeUndefined();
    fireEvent.pointerUp(board, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 90 });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBeforeNoOp,
    );
    expect(screen.queryByText(/^Action not moved/)).toBeNull();
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => roomEntered,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 80,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    expect(roomEntered.dataset.dropPosition).toBe('available');
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: 80,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(
        occurrenceRoomActionOrder(
          view.application.store.getState().projectWorkspace.history!.present,
          'Underworld',
          'H',
          occurrenceId,
        )?.[0],
      ).toEqual({
        groupKey: 'optionalRewards',
        kind: 'interactLocalReward',
        slotKey: 'optional1',
      }),
    );
  });

  it('edits, reorders, repairs, and focuses fixed Pool sales through the shared timeline', async () => {
    const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');
    const view = renderOccurrenceWorkbench(
      authorLegalTraitOffers(loadUnderworldFGProject()),
      'Underworld',
      'F',
      completionOccurrenceById(postbossId),
    );
    openRoomTab('Room Overview');
    expect(screen.queryByRole('button', { name: 'Pool of Purging Offer 1 Item' })).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' }));
    const left = screen.getByRole('button', { name: 'Pool of Purging Offer 1 Item' });
    await view.user.click(left);
    const firstTrait = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.textContent?.trim() !== 'Unresolved');
    if (firstTrait === undefined) throw new Error('F Pool has no eligible trait candidate');
    const leftTraitLabel =
      firstTrait.querySelector('.contextual-picker-item-label')?.textContent ??
      firstTrait.textContent;
    await view.user.click(firstTrait);
    for (const label of ['Middle slot', 'Right slot'] as const) {
      const slotNumber = label === 'Middle slot' ? 2 : 3;
      const slot = screen.getByRole('button', {
        name: `Pool of Purging Offer ${slotNumber} Item`,
      });
      await view.user.click(slot);
      const trait = within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.textContent?.trim() !== 'Unresolved');
      if (trait === undefined) throw new Error(`F Pool ${label} has no eligible trait candidate`);
      await view.user.click(trait);
    }
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
          ?.traitKeyBySlot.left,
      ).not.toBeNull(),
    );

    openRoomTab('Room Timeline');
    expect(screen.queryByText(`Sell ${leftTraitLabel}`)).toBeNull();
    openRoomTab('Room Overview');

    await view.user.click(screen.getByRole('checkbox', { name: 'Sold Offer 1' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Sold Offer 2' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'useFountain' },
      ]),
    );

    openRoomTab('Room Timeline');
    const soldRow = screen.getByText(`Sell ${leftTraitLabel}`).closest('li');
    expect(soldRow?.getAttribute('data-action-accent')).toBe('room');
    await view.user.click(screen.getByRole('button', { name: `Move Sell ${leftTraitLabel}` }));
    await view.user.click(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.getAttribute('aria-disabled') !== 'true')!,
    );
    const poolActionOrder = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.roomActions.order;
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'useFountain' },
      ]),
    );

    view.application.store.dispatch(authoredProjectUndoRequested());
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'useFountain' },
      ]),
    );
    view.application.store.dispatch(authoredProjectRedoRequested());
    await waitFor(() =>
      expect(poolActionOrder()).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'useFountain' },
      ]),
    );

    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('button', { name: 'Pool of Purging Offer 1 Item' }));
    await view.user.click(screen.getByRole('option', { name: 'Unresolved' }));
    await waitFor(() =>
      expect(poolActionOrder()).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );

    const leftSale = createRoomActionAddress(
      goldenFBiome,
      postbossId,
      roomActionKey({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );
    act(() => view.application.store.dispatch(semanticOwnerNavigated(leftSale)));
    openRoomTab('Room Timeline');
    const repairs = await screen.findByRole('region', { name: 'Timeline repairs' });
    const stale = within(repairs).getByText('Sell left Pool trait').closest('li');
    if (stale === null) throw new Error('Retained Pool sale is missing');
    expect(document.getElementById(semanticOwnerControlElementId(leftSale))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(leftSale);
    await view.user.click(
      within(stale).getByRole('button', { name: 'Remove Sell left Pool trait from timeline' }),
    );
    await waitFor(() =>
      expect(poolActionOrder()).not.toContainEqual({
        kind: 'sellPurgingPoolTrait',
        slotKey: 'left',
      }),
    );
    openRoomTab('Room Overview');
    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' }));
    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Pool of Purging Offer 2 Item' })).toBeNull(),
    );
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
        ?.traitKeyBySlot.middle,
    ).not.toBeNull();
  });

  it('orders the pickup outcome before the editing it enables on one pickup line', async () => {
    const view = renderOccurrenceWorkbench(
      createFConversionFrontierProject('GiftDrop').project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Timeline');
    const disposition = screen.getByRole('button', {
      name: /^Pickup outcome for /,
    });
    const outcomeControl = disposition.closest<HTMLElement>('.pickup-outcome-control');
    if (outcomeControl === null) throw new Error('Pickup outcome control is missing');
    expect(within(outcomeControl).getByText('Outcome')).toBeTruthy();
    expect(disposition.textContent).toContain('Pickup');
    const pomLauncher = screen.getByRole('button', {
      name: /Edit Pom: No eligible traits/,
    });
    expect(pomLauncher.getAttribute('data-trait-status')).toBe('valid');
    const pickupRow = pomLauncher.closest<HTMLElement>('[data-room-action-key]');
    if (pickupRow === null) throw new Error('Nectar pickup row is missing');
    const column = pickupRow.querySelector<HTMLElement>(':scope > [data-timeline-cell="editors"]');
    if (column === null) throw new Error('Nectar inline editor column is missing');
    expect(column.contains(disposition)).toBe(true);
    expect(column.contains(pomLauncher)).toBe(true);
    expectBefore(disposition, pomLauncher);

    await view.user.click(disposition);
    await view.user.click(screen.getByRole('option', { name: 'Artificer' }));
    await waitFor(() => {
      const sourceAction = screen
        .getByText(/^(Collect Nectar|Use Artificer on Nectar)$/)
        .closest<HTMLElement>('[data-room-action-key]');
      if (sourceAction === null) throw new Error('Artificer source action is missing');
      expect(
        within(sourceAction).queryByRole('button', {
          name: 'Edit Pom: No eligible traits',
        }),
      ).toBeNull();
      const outcome = within(sourceAction).getByRole('button', { name: /^Pickup outcome for / });
      const output = within(sourceAction).getByRole('button', { name: 'Item' });
      const sourceColumn = sourceAction.querySelector<HTMLElement>(
        ':scope > [data-timeline-cell="editors"]',
      );
      expect(sourceColumn?.contains(outcome)).toBe(true);
      expect(sourceColumn?.contains(output)).toBe(true);
      expectBefore(outcome, output);
    });
  });

  it('shows a forfeited incoming reward as its realized pickup without forfeit text on the row', () => {
    // A Timepiece-capable loadout keeps the pickup outcome editable on the realized Red Onion.
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'ReplaceFearVowRank',
      route: { kind: 'route', routeKey: 'Underworld' },
      vowKey: 'BoonSkipShrineUpgrade',
      rank: 1,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingReward',
      reward: createStartingRewardAddress('Underworld'),
      value: { rewardType: 'WeaponUpgrade' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStartingKeepsake',
      selection: createRouteStartKeepsakeSelectionAddress('Underworld'),
      keepsakeKey: 'GoldifyKeepsake',
    });
    project = authorLegalTraitOffers(project);
    renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(2, 1)),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const row = within(actions)
      .getByText('Collect Red Onion')
      .closest<HTMLElement>('[data-room-action-key]');
    if (row === null) throw new Error('Forfeited pickup row is missing');
    expect(row.textContent).not.toMatch(/Forfeit|Zeus|boon|\(Red Onion\)/);
    const outcome = within(row).getByRole('button', { name: /^Pickup outcome for / });
    expect(outcome.textContent).toContain('Pickup');
    expect(row.querySelector(':scope > [data-timeline-cell="editors"]')?.contains(outcome)).toBe(
      true,
    );
    expect(within(row).queryByRole('button', { name: /Edit Trait/ })).toBeNull();
    expect(within(actions).queryByTitle('Vow of Forfeit')).toBeNull();
  });

  it('authors an Artificer replacement through its exact Room Action acquisition site', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const source = createIncomingRewardAddress(goldenFBiome, occurrenceId);
    const acquisition = createAcquisitionRoleAddress(source, 'self');
    const project = applyProjectCommand(
      createFConversionFrontierProject('MetaCurrencyDrop').project,
      catalog,
      {
        kind: 'ReplaceAcquisitionDisposition',
        acquisition,
        value: { kind: 'artificer' },
      },
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const sourceAction = within(actions)
      .getByText('Use Artificer on Bones')
      .closest<HTMLElement>('[data-room-action-key]');
    const replacementAction = within(actions)
      .getByText(/^Collect (.+ · )?Artificer/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (sourceAction === null || replacementAction === null)
      throw new Error('Artificer source/replacement actions are missing');
    expectBefore(sourceAction, replacementAction);
    const projected = workspaceProjection(view.application)
      .route?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') throw new Error('Artificer workbench missing');
    const roomActions = projected.room.roomActions!;
    const replacementRow = roomActions.rows.find(
      (row) => row.key === replacementAction.dataset.roomActionKey,
    )!;
    const blocked = roomActions.proposals.find(
      (proposal) =>
        proposal.kind === 'move' &&
        proposal.toIndex === 0 &&
        replacementRow.proposalKeys.includes(proposal.key),
    );
    expect(blocked?.explanations).toEqual(['Use Artificer on Bones first to create this reward.']);
    expect(within(sourceAction).getByRole('button', { name: /^Pickup outcome for / })).toBeTruthy();
    expect(within(sourceAction).getByRole('button', { name: 'Item' })).toBeTruthy();
    expect(
      within(replacementAction).queryByRole('button', { name: /^Pickup outcome for / }),
    ).toBeNull();
    expect(within(replacementAction).queryByRole('button', { name: 'Item' })).toBeNull();

    const occurrence = createOccurrenceAddress(goldenFBiome, occurrenceId);
    const site = artificerAcquisitionSite(occurrence, source);
    const entry = createAcquisitionEntryAddress(site, artificerReplacementEntryKey(source, 'self'));
    const interaction = workspaceProjection(view.application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (interaction === undefined) throw new Error('Artificer replacement interaction is missing');
    const outputEditor = document.getElementById(semanticOwnerControlElementId(entry));
    if (outputEditor === null) throw new Error('Artificer output editor is missing');
    expect(sourceAction.contains(outputEditor)).toBe(true);
    expect(replacementAction.contains(outputEditor)).toBe(false);
    expect(interaction.owner).toEqual(entry);
    expect(interaction.authoredRewardTypes).toContain('MaxHealthDrop');
    expect(interaction.intentFor({ rewardType: 'MaxHealthDrop' })).toEqual({
      command: {
        kind: 'ReplaceAcquisitionEntryOffer',
        entry,
        value: { rewardType: 'MaxHealthDrop' },
      },
    });
  });

  it('restores an unranked required action once without exposing remove or free insertion UI', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const authored = createFConversionFrontierProject('MetaCurrencyDrop').project;
    const reference = occurrenceRoomActionOrder(authored, 'Underworld', 'F', occurrenceId)?.[0];
    if (reference === undefined) throw new Error('Required incoming action is missing');
    const project = decodeProjectDocument(
      {
        ...authored,
        route: {
          ...authored.route,
          biomes: authored.route.biomes.map((biome) =>
            biome.biomeKey !== 'F' || biome.topology === null
              ? biome
              : {
                  ...biome,
                  topology: {
                    ...biome.topology,
                    occurrences: biome.topology.occurrences.map((occurrence) =>
                      occurrence.occurrenceId === occurrenceId
                        ? { ...occurrence, roomActions: { order: [] } }
                        : occurrence,
                    ),
                  },
                },
          ),
        },
      },
      catalog,
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );

    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).queryByText('This required action has not been placed.')).toBeNull();
    expect(within(actions).getByRole('region', { name: 'Timeline repairs' })).toBeTruthy();
    expect(actions.querySelector('[data-room-action-drag-handle]')).toBeNull();
    const repairRow = within(actions)
      .getByRole('button', { name: 'Restore required action' })
      .closest<HTMLElement>('[data-room-action-key]');
    if (repairRow === null) throw new Error('Required repair row is missing');
    expect(within(repairRow).queryByText('Position')).toBeNull();
    const missingRequiredDelete = within(repairRow).getByRole('button', {
      name: /Remove .* from timeline/,
    });
    expect((missingRequiredDelete as HTMLButtonElement).disabled).toBe(true);
    expect(missingRequiredDelete.classList.contains('quiet-action')).toBe(true);
    expect(
      within(repairRow)
        .getByRole('button', { name: 'Restore required action' })
        .classList.contains('secondary-action'),
    ).toBe(true);

    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(
      within(repairRow).getByRole('button', { name: 'Restore required action' }),
    );
    await waitFor(() =>
      expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
        historyBefore + 1,
      ),
    );
    await waitFor(() => {
      const restored = screen
        .getByText('Collect Bones')
        .closest<HTMLElement>('[data-room-action-key]');
      if (restored === null) throw new Error('Restored required row is missing');
      expect(within(restored).queryByText('Position')).toBeNull();
      const requiredDelete = within(restored).getByRole('button', {
        name: /Remove .* from timeline/,
      });
      expect((requiredDelete as HTMLButtonElement).disabled).toBe(true);
      expect(requiredDelete.classList.contains('quiet-action')).toBe(true);
    });

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(screen.getByRole('button', { name: 'Restore required action' })).toBeTruthy(),
    );
  });

  it('focuses and removes a stale Standard encounter action after encounter replacement', async () => {
    const occurrenceId = goldenFOccurrenceId(5, 1);
    const phase = createEncounterPhaseAddress(
      goldenFBiome,
      { kind: 'occurrence', occurrenceId },
      'Encounter',
    );
    const reference = { kind: 'interactEncounter' as const, phaseKey: 'Encounter' };
    let project = applyProjectCommand(createCompleteFGProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'ArtemisCombatF',
    });
    project = authorLegalTraitOffers(project);
    project = insertRoomAction(project, goldenFBiome, occurrenceId, reference, 0);
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'GeneratedF',
    });
    const action = createRoomActionAddress(goldenFBiome, occurrenceId, roomActionKey(reference));
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    act(() => view.application.store.dispatch(semanticOwnerNavigated(action)));
    openRoomTab('Room Timeline');
    const repairs = await screen.findByRole('region', { name: 'Timeline repairs' });
    const stale = within(repairs).getByText('Clear Combat').closest('li');
    if (stale === null) throw new Error('Stale Standard encounter action is missing');
    expect(within(stale).queryByText('This action no longer belongs to the room.')).toBeNull();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    const remove = within(stale).getByRole('button', {
      name: 'Remove Clear Combat from timeline',
    });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect(remove.classList.contains('danger-action')).toBe(true);
    await view.user.click(remove);
    await waitFor(() => expect(screen.queryByText('Clear Combat')).toBeNull());
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'F',
        occurrenceId,
      )?.some((candidate) => roomActionKey(candidate) === roomActionKey(reference)),
    ).toBe(false);
  });

  it('keeps Ship menu, pointer, fixed-window, and Undo behavior on one global action order', async () => {
    const occurrenceId = oOccurrenceIds.combat01;
    const occurrence = createOccurrenceAddress(oBiome, occurrenceId);
    let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
      kind: 'ReplaceShipEncounterCount',
      occurrence,
      encounterCount: 3,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SelectEncounter',
      phase: createEncounterPhaseAddress(oBiome, occurrence, 'Combat1'),
      encounterKey: 'IcarusCombatO',
    });
    project = authorLegalTraitOffers(project);

    const view = renderOccurrenceWorkbench(project, 'Surface', 'O', occurrenceById(occurrenceId));
    const projected = workspaceProjection(view.application)
      .route?.biomes.find((biome) => biome.biomeKey === 'O')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') throw new Error('Ship workbench missing');
    const reasons = projected.room.roomActions!.proposals.flatMap(
      (proposal) => proposal.explanations,
    );
    expect(reasons).toContain(
      'Choose Combat 2 wheel must come after Combat 1 is ready to advance.',
    );
    expect(reasons).toContain('Choose Combat 1 wheel before collecting its reward.');
    expect(reasons.some((reason) => reason.includes('wheel1 next phase usable'))).toBe(false);
    const timingProposals = projected.room.roomActions!.proposals.filter((proposal) =>
      proposal.explanations[0]?.includes(' belongs '),
    );
    expect(timingProposals.length).toBeGreaterThan(0);
    for (const proposal of timingProposals) {
      const row = projected.room.roomActions!.rows.find(
        (candidate) => roomActionKey(candidate.reference) === roomActionKey(proposal.reference),
      )!;
      expect(proposal.explanations).toHaveLength(1);
      expect(proposal.explanations[0]).toMatch(
        new RegExp(`^${row.label} belongs (before|after) Combat [123]\\.$`),
      );
    }
    openRoomTab('Combat 1 Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    const actionOrder = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Surface',
        'O',
        occurrenceId,
      );
    const rowFor = (label: string) => {
      const row = within(combatOne)
        .getByText(
          (text) => text === label || text.startsWith(`${label} ·`) || text.endsWith(` · ${label}`),
        )
        .closest<HTMLElement>('li');
      if (row === null) throw new Error(`${label} action row is missing`);
      return row;
    };

    const icarus = rowFor('Talk to Icarus');
    const moveIcarus = within(icarus).getByRole('button', { name: 'Move Talk to Icarus' });
    expect(within(combatOne).queryByText('Choose Combat 2 wheel')).toBeNull();
    await view.user.click(moveIcarus);
    await view.user.click(screen.getByRole('button', { name: /Unavailable/ }));
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .some((option) => option.getAttribute('aria-disabled') === 'true'),
    ).toBe(true);
    await view.user.keyboard('{Escape}');

    const initialOrder = actionOrder();
    await view.user.click(moveIcarus);
    await view.user.click(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.getAttribute('aria-disabled') !== 'true')!,
    );
    expect(actionOrder()).not.toEqual(initialOrder);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);

    const restoredIcarus = rowFor('Talk to Icarus');
    const wheelPick = rowFor('Combat 1 reward');
    const handle = restoredIcarus.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    const board = actions.querySelector<HTMLElement>('.ship-phase-list');
    if (handle === null || board === null) throw new Error('Ship pointer board is missing');
    const initialKeys = initialOrder?.map(roomActionKey) ?? [];
    const icarusKey = restoredIcarus.dataset.roomActionKey;
    const wheelPickKey = wheelPick.dataset.roomActionKey;
    const dragAfter =
      icarusKey !== undefined &&
      wheelPickKey !== undefined &&
      initialKeys.indexOf(icarusKey) < initialKeys.indexOf(wheelPickKey);
    vi.spyOn(wheelPick, 'getBoundingClientRect').mockReturnValue({
      bottom: 180,
      height: 120,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 60,
      width: 360,
      x: 0,
      y: 60,
    } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => wheelPick,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: dragAfter ? 150 : 70,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: dragAfter ? 150 : 70,
      isPrimary: true,
      pointerId: 73,
      pointerType: 'mouse',
    });
    await waitFor(() => expect(actionOrder()).not.toEqual(initialOrder));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);
  });

  it('marks Shop purchases in Overview, reorders them in Actions, and restores membership through undo', async () => {
    const { project, shopId: occurrenceId } = enteredShopProject();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const heal = screen.getByRole('checkbox', { name: 'Purchased Offer 2' });
    const mana = screen.getByRole('checkbox', { name: 'Purchased Offer 3' });
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 1' }) as HTMLInputElement).checked,
    ).toBe(false);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(heal);
    await view.user.click(mana);
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'F',
        occurrenceId,
      ),
    ).toEqual([
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 2,
    );

    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).getByText('Doors open')).toBeTruthy();
    expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    expect(within(actions).queryByText('Exit usable')).toBeNull();
    expect(within(actions).queryByText('Buy Zeus boon · Slot 1')).toBeNull();

    const minor = within(actions).getByText('Buy Max Magick · Slot 3').closest('li');
    if (minor === null) throw new Error('Minor Shop action is missing');
    expect(minor.getAttribute('data-action-accent')).toBe('room');
    expect(minor.getAttribute('title')).toBe('Required before leaving the room.');
    const minorRemoval = within(minor).getByRole('button', {
      name: 'Remove Buy Max Magick · Slot 3 from timeline',
    });
    expect(minorRemoval).toHaveProperty('disabled', true);
    expect(minorRemoval.title).toBe('Purchased membership is edited in Room Overview.');
    await view.user.click(
      within(minor).getByRole('button', {
        name: 'Move Buy Max Magick · Slot 3',
      }),
    );
    await view.user.click(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .find((option) => option.getAttribute('aria-disabled') !== 'true')!,
    );
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'F',
        occurrenceId,
      ),
    ).toEqual([
      { kind: 'interactShopOffer', offerKey: 'Minor' },
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
    ]);
    openRoomTab('Room Overview');
    const reorderedHeal = screen.getByRole('checkbox', { name: 'Purchased Offer 2' });
    await view.user.click(reorderedHeal);
    expect((reorderedHeal as HTMLInputElement).checked).toBe(false);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 2' }) as HTMLInputElement).checked,
    ).toBe(true);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(
      (screen.getByRole('checkbox', { name: 'Purchased Offer 2' }) as HTMLInputElement).checked,
    ).toBe(false);
  });

  it('reuses the ranked pointer language for Room Action peers and keeps unranked actions below a boundary', async () => {
    const { project, shopId: occurrenceId } = enteredShopProject();
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 2' }));
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Offer 3' }));
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
    const major = within(actions).getByText('Buy Heal · Slot 2').closest<HTMLElement>('li');
    const minor = within(actions).getByText('Buy Max Magick · Slot 3').closest<HTMLElement>('li');
    if (major === null || minor === null) throw new Error('Ranked Shop action rows are missing');
    const handle = major.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (handle === null) throw new Error('Ranked Room Action drag handle is missing');
    vi.spyOn(minor, 'getBoundingClientRect').mockReturnValue({
      bottom: 180,
      height: 120,
      left: 0,
      right: 360,
      toJSON: () => ({}),
      top: 60,
      width: 360,
      x: 0,
      y: 60,
    } as DOMRect);
    Object.defineProperty(document, 'elementFromPoint', {
      configurable: true,
      value: () => minor,
    });
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    expect(major.dataset.dragging).toBe('true');
    expect(document.querySelector('.room-action-drag-preview')).not.toBeNull();
    fireEvent.pointerUp(board, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });

    await waitFor(() =>
      expect(
        occurrenceRoomActionOrder(
          view.application.store.getState().projectWorkspace.history!.present,
          'Underworld',
          'F',
          occurrenceId,
        ),
      ).toEqual([
        { kind: 'interactShopOffer', offerKey: 'Minor' },
        { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      ]),
    );
    expect(document.querySelector('.room-action-drag-preview')).toBeNull();
  });

  it('removes a Shop purchase atomically when its occurrence is no longer a Shop', () => {
    const entered = enteredShopProject();
    const offer = createShopOfferAddress(goldenFBiome, entered.shopId, 'MajorNonBoon');
    let project = applyProjectCommand(entered.project, catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer,
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence: createOccurrenceAddress(goldenFBiome, entered.shopId),
      gameName: 'F_Combat04',
    });
    expect(occurrenceRoomActionOrder(project, 'Underworld', 'F', entered.shopId)).toEqual([]);
    renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(entered.shopId));
    openRoomTab('Room Timeline');
    expect(screen.queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
  });
});
