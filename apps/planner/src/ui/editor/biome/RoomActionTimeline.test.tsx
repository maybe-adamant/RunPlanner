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
  createShopOfferAddress,
  createSteadyGrowthOutcomeAddress,
  decodeProjectDocument,
  semanticAddressKey,
  roomActionKey,
} from '@run-planner/engine/authored-project';

import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it, vi } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import type { WorkspaceInteractionCatalog } from '@planner/projections/structured-workspace';
import {
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
import {
  loadSurfaceNOPQProject,
  nBiome,
  nOccurrenceIds,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
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

describe('OccurrenceRoomActions', () => {
  it('reopens the shared Steady Growth target picker on exact finding navigation', async () => {
    const application = createApplication();
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
    const workspace = application.selectStructuredWorkspace(application.store.getState());
    const interactions = {
      ...workspace.interactions,
      steadyGrowth: new Map([[semanticAddressKey(outcome), interaction]]),
    } as unknown as WorkspaceInteractionCatalog;
    render(
      <Provider store={application.store}>
        <SteadyGrowthEffectRow control={control} interactions={interactions} />
      </Provider>,
    );
    const picker = await screen.findByLabelText('Steady Growth target');
    await waitFor(() => expect(picker.getAttribute('aria-expanded')).toBe('true'));
    expect(picker.id).toBe(semanticOwnerControlElementId(outcome));
    application.dispose();
  });

  it('keeps a stale Steady Growth target visible and exposes its exact clear command', async () => {
    const application = createApplication();
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
    const workspace = application.selectStructuredWorkspace(application.store.getState());
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
    expect(screen.queryByText('No eligible trait (no-op)')).toBeNull();
    await screen.findByRole('button', { name: 'Clear recorded target' }).then((button) =>
      act(() => {
        button.click();
      }),
    );
    expect(clearIntent).toHaveBeenCalledWith(null);
    application.dispose();
  });

  it('renders Fields setup before its one Room Timeline board', () => {
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );
    const fieldsSetup = screen.getByLabelText('Fields setup');
    expect(fieldsSetup).toBeTruthy();
    expect(within(fieldsSetup).getByLabelText('Optional 1')).toBeTruthy();
    openRoomTab('Room Timeline');
    const fieldsActions = screen.getByRole('region', { name: 'Room Timeline' });
    const fieldsEntered = within(fieldsActions).getByLabelText('Room entered');
    const passiveEncounter = within(fieldsActions).getByLabelText('Passive encounter phase');
    expectBefore(fieldsEntered, passiveEncounter);
    expect(
      fieldsActions.querySelector('[data-lifecycle-boundary="encounterStart:Passive"]'),
    ).toBeNull();
    const fieldsEncounter = screen.queryByLabelText('Encounter encounter phase');
    if (fieldsEncounter !== null) expectBefore(fieldsEncounter, fieldsActions);
    const timeline = within(fieldsActions).getByRole('list', { name: 'Room timeline' });
    const optionalPool = within(fieldsActions).getByRole('region', { name: 'Optional actions' });
    expect(within(timeline).queryByText(/^Interact with Optional 1 pickup · .+/)).toBeNull();
    const optionalAction = within(optionalPool)
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest('li');
    if (optionalAction === null) throw new Error('Optional reward action is missing');
    expect(within(optionalAction).queryByLabelText('Optional 1')).toBeNull();
    expect(within(optionalAction).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(fieldsActions).toBeTruthy();
  });

  it('projects three fixed Fields cycles with cage selectors and movable pickups', async () => {
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
    expect(
      [1, 2, 3].map(
        (ordinal) =>
          (
            within(starts[ordinal - 1]!).getByRole('combobox', {
              name: `Cage for encounter ${ordinal}`,
            }) as HTMLSelectElement
          ).value,
      ),
    ).toEqual(['Cage01', 'Cage02', 'Cage03']);
    for (const [index, start] of starts.entries()) {
      const selector = within(start).getByRole('combobox', {
        name: `Cage for encounter ${index + 1}`,
      });
      const options = within(selector).getAllByRole('option') as HTMLOptionElement[];
      expect(options.find((option) => option.value === `Cage0${index + 1}`)?.disabled).toBe(true);
      expect(
        options
          .filter((option) => option.value !== `Cage0${index + 1}`)
          .every((option) => !option.disabled),
      ).toBe(true);
    }
    expect(within(timeline).queryByText(/^Complete Cage/)).toBeNull();
    for (const row of timeline.querySelectorAll('[data-in-order="true"]')) {
      expect(row.querySelectorAll('.hub-rank-action')).toHaveLength(2);
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
      .getByText(/^Interact with Cage 1 pickup · /)
      .closest<HTMLElement>('[data-room-action-key]');
    if (cagePickup === null) throw new Error('Cage 1 pickup row is missing');
    expectBefore(ends[0]!, cagePickup);
    expect(cagePickup.querySelector('[data-room-action-drag-handle]')).not.toBeNull();
    const movePickupEarlier = within(cagePickup).getByRole('button', {
      name: /^Move Interact with Cage 1 pickup · .* earlier$/,
    }) as HTMLButtonElement;
    expect(movePickupEarlier.disabled).toBe(false);
    await view.user.click(movePickupEarlier);
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
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
    expect(starts[0]?.getAttribute('id')).toBe(semanticOwnerControlElementId(cageOneAction));
  });

  it('moves a selected Fields cage into its fixed cycle as one undoable history step', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      threeCageFieldsProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Cage for encounter 1' }),
      'Cage01',
    );
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore,
    );
    await view.user.selectOptions(
      screen.getByRole('combobox', { name: 'Cage for encounter 1' }),
      'Cage03',
    );

    const cagePermutation = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'H',
        occurrenceId,
      )?.flatMap((reference) =>
        reference.kind === 'completeFieldsCage' ? [reference.phaseKey] : [],
      );
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage03', 'Cage01', 'Cage02']));
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );
    expect(
      [1, 2, 3].map(
        (ordinal) =>
          (
            screen.getByRole('combobox', {
              name: `Cage for encounter ${ordinal}`,
            }) as HTMLSelectElement
          ).value,
      ),
    ).toEqual(['Cage03', 'Cage01', 'Cage02']);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage01', 'Cage02', 'Cage03']));
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Cage for encounter 1',
        }) as HTMLSelectElement
      ).value,
    ).toBe('Cage01');
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
    const selector = screen.getByRole('combobox', {
      name: 'Cage for encounter 1',
    }) as HTMLSelectElement;
    const cageTwoOption = within(selector).getByRole('option', {
      name: 'Cage02',
    }) as HTMLOptionElement;
    expect(cageTwoOption.disabled).toBe(false);

    const projected = workspaceProjection(view.application)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (projected?.kind !== 'occurrenceWorkbench') {
      throw new Error('Fields Gorgon occurrence workbench is missing');
    }
    const roomActions = projected.room.roomActions;
    const slot = roomActions?.timeline.entries.find(
      (entry) => entry.kind === 'boundary' && entry.fieldsCageSlot?.slotOrdinal === 1,
    );
    const cageTwoChoice =
      slot?.kind === 'boundary'
        ? slot.fieldsCageSlot?.choices.find((choice) => choice.value === 'Cage02')
        : undefined;
    const genericProposal = roomActions?.proposals.find(
      (proposal) => proposal.key === cageTwoChoice?.proposalKey,
    );
    expect(genericProposal).toMatchObject({ kind: 'move', structurallyAuthorable: false });

    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.selectOptions(selector, 'Cage02');
    await waitFor(() => {
      const order = occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
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
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 1,
    );

    const edited = workspaceProjection(view.application)
      .routes.find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'H')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      );
    if (edited?.kind !== 'occurrenceWorkbench') {
      throw new Error('Edited Fields Gorgon occurrence workbench is missing');
    }
    const gorgon = edited.room.roomActions?.rows.find(
      (row) => row.reference.kind === 'interactGorgon' && row.reference.phaseKey === 'Cage01',
    );
    expect(gorgon).toMatchObject({ executable: true, issues: [], stale: false });
  });

  it('keeps a missing active Fields cage anchor in Timeline repairs', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const authored = threeCageFieldsProject();
    const malformed = decodeProjectDocument(
      {
        ...authored,
        routes: authored.routes.map((route) => ({
          ...route,
          biomes: route.biomes.map((biome) =>
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
        })),
      },
      catalog,
    );
    renderOccurrenceWorkbench(malformed, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    const repairs = within(actions).getByRole('region', { name: 'Timeline repairs' });
    expect(within(timeline).queryByText('Complete Cage03')).toBeNull();
    expect(within(repairs).getByText('Complete Cage03')).toBeTruthy();
    expect(within(repairs).getByText('This required action has not been placed.')).toBeTruthy();
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
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (initialOptional === null) throw new Error('Optional 1 action is missing');
    const insertion = within(initialOptional).getByRole('combobox', {
      name: /^Insert Interact with Optional 1 pickup/,
    }) as HTMLSelectElement;
    expect(insertion.closest('label')?.classList.contains('field-control-inline')).toBe(true);
    const lastAvailable = Array.from(insertion.options).findLast(
      (option) => option.value !== '' && !option.disabled,
    );
    if (lastAvailable === undefined) throw new Error('Optional 1 has no insertion proposal');
    await view.user.selectOptions(insertion, lastAvailable.value);

    expect(within(optionalPool).queryByText(/^Interact with Optional 1 pickup · .+/)).toBeNull();
    const orderedOptional = within(actions)
      .getByText(/^Interact with Optional 1 pickup · .+/)
      .closest<HTMLElement>('[data-room-action-key]');
    const roomEntered = within(actions).getByLabelText('Room entered');
    const board = within(actions).getByRole('list', { name: 'Room timeline' });
    const handle = orderedOptional?.querySelector<HTMLElement>('[data-room-action-drag-handle]');
    if (orderedOptional === null || handle === null || handle === undefined)
      throw new Error('Ordered Optional 1 drag handle is missing');
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
          view.application.store.getState().projectWorkspace.history.present,
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
    const postbossId = createOccurrenceId('completion:F:postboss');
    const view = renderOccurrenceWorkbench(
      authorLegalTraitOffers(loadUnderworldFGProject()),
      'Underworld',
      'F',
      completionOccurrenceById(postbossId),
    );
    expect(screen.queryByRole('button', { name: 'Pool of Purging Left slot' })).toBeNull();
    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Pool of Purging' }));
    const left = screen.getByRole('button', { name: 'Pool of Purging Left slot' });
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
      const slot = screen.getByRole('button', { name: `Pool of Purging ${label}` });
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
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
          ?.traitKeyBySlot.left,
      ).not.toBeNull(),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Sell Left slot' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );

    await view.user.click(screen.getByRole('checkbox', { name: 'Sell Middle slot' }));
    await waitFor(() =>
      expect(
        view.application.store
          .getState()
          .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
          ?.biomes.find((biome) => biome.biomeKey === 'F')
          ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions
          .order,
      ).toEqual([
        { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
        { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
        { kind: 'useFountain' },
      ]),
    );

    openRoomTab('Room Timeline');
    await view.user.click(
      screen.getByRole('button', { name: `Move Sell ${leftTraitLabel} earlier` }),
    );
    const poolActionOrder = () =>
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.roomActions.order;
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
    await view.user.click(screen.getByRole('button', { name: 'Pool of Purging Left slot' }));
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
      expect(screen.queryByRole('button', { name: 'Pool of Purging Middle slot' })).toBeNull(),
    );
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Underworld')
        ?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.completionOccurrences.find((room) => room.occurrenceId === postbossId)?.purgingPool
        ?.traitKeyBySlot.middle,
    ).not.toBeNull();
  });

  it('keeps Nectar trait editing on its pickup line and hides it after Artificer conversion', async () => {
    const view = renderOccurrenceWorkbench(
      createFConversionFrontierProject('GiftDrop').project,
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Timeline');
    const disposition = screen.getByRole('combobox', {
      name: /^Pickup outcome for /,
    });
    const outcomeControl = disposition.closest('label');
    if (outcomeControl === null) throw new Error('Pickup outcome control is missing');
    expect(outcomeControl.classList.contains('pickup-outcome-control')).toBe(true);
    expect(within(outcomeControl).getByText('Pickup outcome')).toBeTruthy();
    expect(within(disposition).getByRole('option', { name: 'Pick up reward' })).toBeTruthy();
    expect(
      (
        within(disposition).getByRole('option', {
          name: 'Artificer · replace reward',
        }) as HTMLOptionElement
      ).disabled,
    ).toBe(false);
    expect(
      within(outcomeControl).queryByRole('button', {
        name: 'Edit Pom: No eligible traits',
      }),
    ).toBeNull();
    const pomLauncher = screen.getByRole('button', {
      name: /Edit Pom: No eligible traits/,
    });
    expect(pomLauncher.getAttribute('data-trait-status')).toBe('valid');
    const pickupRow = pomLauncher.closest<HTMLElement>('[data-room-action-key]');
    if (pickupRow === null) throw new Error('Nectar pickup row is missing');
    expect(
      pickupRow
        .querySelector(':scope > .room-action-controls > .room-action-inline-editors')
        ?.contains(pomLauncher),
    ).toBe(true);

    await view.user.selectOptions(disposition, 'artificer');
    await waitFor(() => {
      const sourceAction = screen
        .getByText(/^Interact with Reward pickup · /)
        .closest<HTMLElement>('[data-room-action-key]');
      if (sourceAction === null) throw new Error('Artificer source action is missing');
      expect(
        within(sourceAction).queryByRole('button', {
          name: 'Edit Pom: No eligible traits',
        }),
      ).toBeNull();
      expect(within(sourceAction).getByRole('button', { name: 'Artificer item' })).toBeTruthy();
    });
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
      .getByText(/^Interact with Reward pickup · /)
      .closest<HTMLElement>('[data-room-action-key]');
    const replacementAction = within(actions)
      .getByText(/^Interact with Artificer pickup/)
      .closest<HTMLElement>('[data-room-action-key]');
    if (sourceAction === null || replacementAction === null)
      throw new Error('Artificer source/replacement actions are missing');
    expectBefore(sourceAction, replacementAction);
    expect(
      within(sourceAction).getByRole('combobox', { name: /^Pickup outcome for / }),
    ).toBeTruthy();
    expect(within(sourceAction).getByRole('button', { name: 'Artificer item' })).toBeTruthy();
    expect(
      within(replacementAction).queryByRole('combobox', { name: /^Pickup outcome for / }),
    ).toBeNull();
    expect(within(replacementAction).queryByRole('button', { name: 'Artificer item' })).toBeNull();

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
        routes: authored.routes.map((route) => ({
          ...route,
          biomes: route.biomes.map((biome) =>
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
        })),
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
    expect(within(actions).getByText('This required action has not been placed.')).toBeTruthy();
    expect(within(actions).getByRole('region', { name: 'Timeline repairs' })).toBeTruthy();
    expect(actions.querySelector('[data-room-action-drag-handle]')).toBeNull();
    const repairRow = within(actions)
      .getByText('This required action has not been placed.')
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

    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(
      within(repairRow).getByRole('button', { name: 'Restore required action' }),
    );
    await waitFor(() =>
      expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
        historyBefore + 1,
      ),
    );
    await waitFor(() => {
      const restored = screen
        .getByText(/^Interact with Reward pickup/)
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
    const stale = within(repairs).getByText('Interact with Combat').closest('li');
    if (stale === null) throw new Error('Stale Standard encounter action is missing');
    expect(within(stale).getByText('This action no longer belongs to the room.')).toBeTruthy();
    expect(document.getElementById(semanticOwnerControlElementId(action))).toBe(stale);
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toEqual(action);

    const remove = within(stale).getByRole('button', {
      name: 'Remove Interact with Combat from timeline',
    });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect(remove.classList.contains('danger-action')).toBe(true);
    await view.user.click(remove);
    await waitFor(() => expect(screen.queryByText('Interact with Combat')).toBeNull());
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        occurrenceId,
      )?.some((candidate) => roomActionKey(candidate) === roomActionKey(reference)),
    ).toBe(false);
  });

  it('keeps Ship arrow, pointer, fixed-window, and Undo behavior on one global action order', async () => {
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
    openRoomTab('Combat 1 Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    const actionOrder = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Surface',
        'O',
        occurrenceId,
      );
    const rowFor = (label: string) => {
      const row = within(combatOne)
        .getByText((text) => text === label || text.startsWith(`${label} ·`))
        .closest<HTMLElement>('li');
      if (row === null) throw new Error(`${label} action row is missing`);
      return row;
    };

    const icarus = rowFor('Interact with Icarus combat');
    const legalArrow = within(icarus)
      .getAllByRole('button', { name: /Move Interact with Icarus combat (earlier|later)/ })
      .find((button) => !(button as HTMLButtonElement).disabled);
    if (legalArrow === undefined) throw new Error('Icarus has no legal same-window arrow move');
    const wheelTwoChoice = rowFor('Choose Combat 2 reward');
    expect(
      within(wheelTwoChoice)
        .getAllByRole('button', { name: /Move Choose Combat 2 reward (earlier|later)/ })
        .some((button) => (button as HTMLButtonElement).disabled),
    ).toBe(true);

    const initialOrder = actionOrder();
    await view.user.click(legalArrow);
    expect(actionOrder()).not.toEqual(initialOrder);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);

    const restoredIcarus = rowFor('Interact with Icarus combat');
    const wheelPick = rowFor('Interact with Combat 1 reward pickup');
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
    const historyBefore = view.application.store.getState().projectWorkspace.history.past.length;
    await view.user.click(heal);
    await view.user.click(mana);
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        occurrenceId,
      ),
    ).toEqual([
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      { kind: 'interactShopOffer', offerKey: 'Minor' },
    ]);
    expect(view.application.store.getState().projectWorkspace.history.past).toHaveLength(
      historyBefore + 2,
    );

    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).getByText('Cleanup · Doors open')).toBeTruthy();
    expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    expect(within(actions).queryByText('Exit usable')).toBeNull();
    expect(within(actions).queryByText('Buy Boon · Zeus')).toBeNull();

    const minor = within(actions).getByText('Buy Max Magick').closest('li');
    if (minor === null) throw new Error('Minor Shop action is missing');
    await view.user.click(
      within(minor).getByRole('button', { name: 'Move Buy Max Magick earlier' }),
    );
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
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
    const major = within(actions).getByText('Buy Heal').closest<HTMLElement>('li');
    const minor = within(actions).getByText('Buy Max Magick').closest<HTMLElement>('li');
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
    expect(document.querySelector('.hub-roster-drag-preview')).not.toBeNull();
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
          view.application.store.getState().projectWorkspace.history.present,
          'Underworld',
          'F',
          occurrenceId,
        ),
      ).toEqual([
        { kind: 'interactShopOffer', offerKey: 'Minor' },
        { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
      ]),
    );
    expect(document.querySelector('.hub-roster-drag-preview')).toBeNull();
  });

  it('repairs a retained Shop purchase after its occurrence is no longer a Shop', async () => {
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
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(entered.shopId),
    );
    openRoomTab('Room Timeline');
    const repairs = screen.getByRole('region', { name: 'Timeline repairs' });
    expect(within(repairs).getByText('Buy MajorNonBoon')).toBeTruthy();
    const remove = within(repairs).getByRole('button', {
      name: 'Remove Buy MajorNonBoon from timeline',
    });
    expect((remove as HTMLButtonElement).disabled).toBe(false);
    expect(remove.classList.contains('danger-action')).toBe(true);
    await view.user.click(remove);
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history.present,
        'Underworld',
        'F',
        entered.shopId,
      ),
    ).toEqual([]);
  });
});
