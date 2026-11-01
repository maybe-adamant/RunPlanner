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
  createTraitOfferAddress,
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
  underworldWorldShopTravelDealProject,
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
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import {
  loadUnderworldFStygianWellCheckpoint,
  underworldCheckpointArtifacts,
} from '@run-planner/test-fixtures/checkpoints/underworld';
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
  pickRoomObjectAction,
  threeCageFieldsProject,
} from '@planner-test/support/occurrence-workbench';

import { hintOf, queryByHint } from '@planner-test/support/hints';

/** An element's text as read aloud: icons by their names, tags after a separator. */
function spokenText(element: Element): string {
  const parts: string[] = [];
  const walk = (node: Node): void => {
    if (node.nodeType === Node.TEXT_NODE) {
      parts.push(node.textContent ?? '');
      return;
    }
    if (!(node instanceof Element) || node.getAttribute('aria-hidden') === 'true') return;
    if (node.getAttribute('role') === 'img') {
      parts.push(` ${node.getAttribute('aria-label') ?? ''} `);
      return;
    }
    if (node.classList.contains('timeline-row-tag')) {
      parts.push(` · ${node.textContent ?? ''}`);
      return;
    }
    parts.push(' ');
    node.childNodes.forEach(walk);
    parts.push(' ');
  };
  walk(element);
  return parts.join('').replace(/\s+/g, ' ').trim();
}

/** The Room Timeline action row whose spoken label matches. */
function actionRow(container: HTMLElement, label: string | RegExp): HTMLElement {
  const rows = [...container.querySelectorAll<HTMLElement>('li[data-room-action-key]')];
  const matches = rows.filter((row) => {
    const text = spokenText(row.querySelector('[data-timeline-cell="label"]') ?? row);
    return typeof label === 'string' ? text === label : label.test(text);
  });
  if (matches.length !== 1)
    throw new Error(
      `${matches.length} rows match ${String(label)}: ${rows
        .map((row) => spokenText(row.querySelector('[data-timeline-cell="label"]') ?? row))
        .join(' | ')}`,
    );
  return matches[0]!;
}

/** The paid purchase rows of a timeline, by their Buy or Rush verb. */
function purchaseRows(container: HTMLElement): HTMLElement[] {
  return [...container.querySelectorAll<HTMLElement>('li[data-room-action-key]')].filter((row) =>
    /^(Buy|Rush) /.test(spokenText(row.querySelector('[data-timeline-cell="label"]') ?? row)),
  );
}

function queryActionRow(container: HTMLElement, label: string | RegExp): HTMLElement | null {
  try {
    return actionRow(container, label);
  } catch {
    return null;
  }
}

/** The handle's list announcements, read from its live regions. */
function reorderAnnouncement(handle: HTMLElement): string {
  const scope = handle.closest('.room-actions-workbench') ?? document.body;
  return [...scope.querySelectorAll('[aria-live="polite"]')]
    .map((region) => region.textContent ?? '')
    .join(' ')
    .replace(/\u00a0/g, '');
}

/**
 * Picks a row up by keyboard, steps from the first legal position to the
 * `nth` one whose announcement matches, and drops it there. Returns the
 * positions announced on the way.
 */
function reorderByKeyboard(handle: HTMLElement, target: RegExp, nth = 0): string[] {
  const visited: string[] = [];
  act(() => {
    fireEvent.click(handle, { detail: 0 });
  });
  act(() => {
    fireEvent.keyDown(handle, { key: 'Home' });
  });
  let seen = 0;
  for (let step = 0; step < 40; step += 1) {
    const announced = reorderAnnouncement(handle).trim();
    visited.push(announced);
    if (target.test(announced) && seen++ === nth) {
      act(() => {
        fireEvent.click(handle, { detail: 0 });
      });
      return visited;
    }
    act(() => {
      fireEvent.keyDown(handle, { key: 'ArrowDown' });
    });
  }
  throw new Error(`No legal position matches ${String(target)}: ${visited.join(' | ')}`);
}

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
    // Where the engine allows a conversion, the row's verb is the pickup-outcome picker.
    const outcome = within(actions).getByRole('button', {
      name: /^How to take .+: Collect$/,
    });
    // Without the Sea Star keepsake the engine supports no proc, so no checkbox renders.
    expect(within(actions).queryByRole('checkbox', { name: /^Double Up for / })).toBeNull();
    await view.user.click(outcome);
    // Only engine-supported outcomes are listed.
    expect(
      within(screen.getByRole('listbox'))
        .getAllByRole('option')
        .map((option) => option.getAttribute('aria-label') ?? option.textContent?.replace('✓', '')),
    ).toEqual(['Collect', expect.stringMatching(/^Goldify · Time Piece/)]);
    const timePiece = screen.getByRole('option', {
      name: /^Goldify · Time Piece/,
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
    // The verb now reads as the chosen conversion.
    expect(
      within(actions).getByRole('button', { name: /^How to take .+: Goldify$/ }),
    ).not.toBeNull();
  });

  it('reopens the shared Steady Growth target picker on exact finding navigation', async () => {
    const application = createOpenTestApplication('Underworld');
    const outcome = createSteadyGrowthOutcomeAddress(
      createTraitOfferAddress(
        createIncomingRewardAddress(goldenFBiome, goldenFOccurrenceId(1, 1)),
        'source',
      ),
      1,
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
      createTraitOfferAddress(
        createIncomingRewardAddress(nBiome, nOccurrenceIds.opening),
        'source',
      ),
      1,
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
    expect(screen.queryByRole('button', { name: 'Legend' })).toBeNull();
    const fieldsSetup = screen.getByLabelText('Optional Rewards');
    const passiveEncounter = screen.getByLabelText('Passive encounter phase');
    expectBefore(passiveEncounter, fieldsSetup);
    expect(
      within(passiveEncounter).getByRole('button', { name: 'Customize passive encounter' }),
    ).toBeTruthy();
    expect(fieldsSetup).toBeTruthy();
    expect(within(fieldsSetup).queryByText('Cage reward identities')).toBeNull();
    expect(within(fieldsSetup).queryByLabelText('Cage 1')).toBeNull();
    expect(within(fieldsSetup).getByRole('radiogroup', { name: 'Optional pickups' })).toBeTruthy();
    expect(within(fieldsSetup).getByRole('button', { name: 'Optional 1 reward' })).toBe(
      within(fieldsSetup).getByLabelText('Reward 1'),
    );
    openRoomTab('Room Timeline');
    const fieldsActions = screen.getByRole('region', { name: 'Room Timeline' });
    // The legend opens from its button on the timeline's tab row.
    fireEvent.click(screen.getByRole('button', { name: 'Legend' }));
    const colours = screen.getByRole('list', { name: 'Row colours' });
    expect(
      within(colours)
        .getAllByRole('listitem')
        .map((item) => item.textContent),
    ).toEqual([
      'Optional actions',
      'Required before this phase ends',
      'Required before leaving this room',
      'Actions that trigger automatically',
    ]);
    const chances = screen.getByRole('list', { name: 'Chance to afford' });
    expect(
      [...chances.querySelectorAll('[data-tone]')].map((tone) => tone.getAttribute('data-tone')),
    ).toEqual(['high', 'medium', 'low']);
    fireEvent.keyDown(document.activeElement ?? document.body, { key: 'Escape' });
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
    expect(queryActionRow(timeline, /^Collect .+ · Optional 1$/)).toBeNull();
    // The unplaced optional reward is offered from the Add area's Optional rewards group.
    fireEvent.click(within(optionalPool).getByRole('button', { name: 'Optional rewards' }));
    const menu = screen.getByRole('dialog', { name: 'Add from Optional rewards' });
    const optionalAction = within(menu).getByRole('button', { name: /^Collect .+ · Optional 1$/ });
    expect(optionalAction.getAttribute('aria-disabled')).toBeNull();
    expect(within(menu).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(actionRow(timeline, /^Collect .+ · Cage 1$/).getAttribute('data-action-accent')).toBe(
      'room',
    );
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
      within(timeline).getByLabelText(`Encounter ${ordinal}`),
    );
    const ends = Array.from(
      timeline.querySelectorAll<HTMLElement>('[data-lifecycle-boundary^="encounterEnd:"]'),
    );
    expect(ends).toHaveLength(3);
    // Each cage's end banner carries its cycle's number, as its start banner does.
    expect(ends.map((end) => end.getAttribute('aria-label'))).toEqual([
      'Encounter 1 ended',
      'Encounter 2 ended',
      'Encounter 3 ended',
    ]);
    for (const [index, start] of starts.entries()) {
      // The cage tag shows the cage; its full name with its reward is its accessible name.
      const cage = start.querySelector('.fields-cage-label');
      expect(cage?.textContent).toBe(`Cage ${index + 1}`);
      expect(cage?.getAttribute('aria-label')).toMatch(new RegExp(`^Cage ${index + 1} \\(`));
    }
    const cageOrder = within(actions).getByRole('button', { name: /^Combat order: / });
    expectBefore(cageOrder, within(timeline).getByLabelText('Room entered'));
    expect(within(timeline).queryByText(/^Clear Cage\d+/)).toBeNull();
    for (const row of timeline.querySelectorAll('[data-in-order="true"]')) {
      expect(within(row as HTMLElement).getByRole('button', { name: /^Reorder / })).toBeTruthy();
    }

    // No movable row stands inside a cage's own encounter.
    const dropTargetSelector = '[data-room-action-key][data-in-order="true"]';
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

    const cagePickup = actionRow(timeline, /^Collect .+ · Cage 1$/);
    expectBefore(ends[0]!, cagePickup);
    const movePickupEarlier = within(cagePickup).getByRole('button', {
      name: /^Reorder Collect .* · Cage 1$/,
    });
    expect(movePickupEarlier.getAttribute('aria-disabled')).toBeNull();
    // After the second cage's end, which is before Cage 3.
    expect(reorderByKeyboard(movePickupEarlier, /^After Encounter 2 ended$/)).toEqual([
      'After Encounter 1 ended',
      'After Encounter 2 ended',
    ]);
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
      expect(within(phase).getByRole('button', { name: cage })).toBeTruthy();
    }
    expect(screen.queryByRole('button', { name: /^Combat order/ })).toBeNull();
    openRoomTab('Room Timeline');
    expect(screen.getByRole('button', { name: /^Combat order/ })).toBeTruthy();
    // Each cage start banner names its encounter read-only; identity stays in Overview.
    for (const ordinal of [1, 2, 3]) {
      const start = screen.getByLabelText(`Encounter ${ordinal}`);
      expect(start.querySelector('.fields-cage-label')).not.toBeNull();
      expect(start.querySelector('.timeline-banner-identity')?.textContent).not.toMatch(/Cage/);
    }
    for (const cage of ['Cage 1', 'Cage 2', 'Cage 3'])
      expect(screen.queryByRole('button', { name: cage })).toBeNull();
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
          name: new RegExp(`^Cage ${number}$`),
        }),
      );
    await view.user.click(screen.getByRole('button', { name: /^Combat order/ }));
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(3);
    await choose(3);
    expect(within(screen.getByRole('listbox')).getAllByRole('option')).toHaveLength(2);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(initial);
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(initial);

    await view.user.click(screen.getByRole('button', { name: /^Combat order/ }));
    for (const number of [1, 2, 3]) await choose(number);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    await view.user.click(screen.getByRole('button', { name: /^Combat order/ }));
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
      expect(
        screen
          .getByLabelText(`Encounter ${index + 1}`)
          .querySelector('.fields-cage-label')
          ?.getAttribute('aria-label'),
      ).toMatch(new RegExp(`^Cage ${number} \\(`));
    // The order shows the cages in order; its accessible name adds each cage's reward.
    const order = screen.getByRole('button', {
      name: /^Combat order: Cage 3 \(.+\) \/ Cage 2 \(.+\) \/ Cage 1 \(.+\)$/,
    });
    expect(order.textContent).toBe('Cage 3 / Cage 2 / Cage 1');

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(cagePermutation()).toEqual(['Cage01', 'Cage02', 'Cage03']));
    expect(
      screen
        .getByLabelText('Encounter 1')
        .querySelector('.fields-cage-label')
        ?.getAttribute('aria-label'),
    ).toMatch(/^Cage 1 \(/);
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
    await view.user.click(screen.getByRole('button', { name: /^Combat order/ }));
    const cageTwoOption = within(screen.getByRole('listbox')).getByRole('option', {
      name: /^Cage 2$/,
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
    const handle = within(actions).getByRole('button', { name: 'Reorder Talk to Athena' });
    const orderBefore = occurrenceRoomActionOrder(
      view.application.store.getState().projectWorkspace.history!.present,
      'Underworld',
      'H',
      occurrenceId,
    );
    // jsdom lays nothing out, so the pointer is nearest the first place: the blocked start.
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 92,
    });
    fireEvent.pointerMove(handle, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 92 });
    const preview = actions.querySelector('.room-action-drag-preview');
    expect(preview?.querySelector('.room-action-drag-header strong')?.textContent).toBe(
      'Talk to Athena',
    );
    // A disallowed place names why, from the proposal's explanation.
    expect(preview?.querySelector('.room-action-drag-feedback')?.textContent).toBe(
      `Unavailable: ${blockedMove!.explanations.join(' ')}`,
    );
    fireEvent.pointerUp(handle, { clientX: 24, clientY: 80, isPrimary: true, pointerId: 92 });
    expect(reorderAnnouncement(handle)).toContain(
      `Not moved. ${blockedMove!.explanations.join(' ')}`,
    );
    expect(actions.querySelector('.room-action-drag-preview')).toBeNull();
    expect(
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'H',
        occurrenceId,
      ),
    ).toEqual(orderBefore);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    await view.user.click(screen.getByRole('button', { name: /^Combat order/ }));
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /^Cage 2$/ }),
    );
    await view.user.click(
      within(screen.getByRole('listbox')).getByRole('option', { name: /^Cage 1$/ }),
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
      name: /^Combat order: Cage \d \(.+\) \/ Cage \d \(.+\)/,
    }) as HTMLButtonElement;
    expect(cageOrder.disabled).toBe(true);
    expect(hintOf(cageOrder)).toBe('Restore missing cage actions before changing their order.');
    expect(cageOrder.textContent).toMatch(/^Cage \d \/ Cage \d/);
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
    const timeline = within(actions).getByRole('list', { name: 'Room timeline' });
    expect(queryActionRow(timeline, /^Collect .+ · Optional 1$/)).toBeNull();
    const historyLength = view.application.store.getState().projectWorkspace.history!.past.length;
    // One pick adds the optional reward at its last legal place; nothing asks where.
    await view.user.click(within(optionalPool).getByRole('button', { name: 'Optional rewards' }));
    await view.user.click(
      within(screen.getByRole('dialog', { name: 'Add from Optional rewards' })).getByRole(
        'button',
        { name: /^Collect .+ · Optional 1$/ },
      ),
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyLength + 1,
    );
    expect(within(actions).getByText(/ added to the timeline\.$/)).toBeTruthy();
    const orderedOptional = actionRow(timeline, /^Collect .+ · Optional 1$/);
    expect(orderedOptional.getAttribute('data-action-accent')).toBe('optional');
    expectBefore(within(actions).getByLabelText('Doors open'), orderedOptional);
    const handle = within(orderedOptional).getByRole('button', {
      name: /^Reorder Collect .+ · Optional 1$/,
    });
    // Picking up and dropping in place edits nothing.
    const historyBeforeNoOp =
      view.application.store.getState().projectWorkspace.history!.past.length;
    act(() => {
      fireEvent.click(handle, { detail: 0 });
    });
    expect(reorderAnnouncement(handle)).toContain('Current position');
    act(() => {
      fireEvent.click(handle, { detail: 0 });
    });
    expect(reorderAnnouncement(handle)).toContain('stays in place.');
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBeforeNoOp,
    );
    // jsdom lays nothing out, so a pointer drag lands on the first legal place: Room entered.
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(handle, {
      clientX: 24,
      clientY: 80,
      isPrimary: true,
      pointerId: 91,
      pointerType: 'mouse',
    });
    expect(
      actions.querySelector('.room-action-drag-preview .room-action-drag-feedback')?.textContent,
    ).toBe('After Room entered');
    fireEvent.pointerUp(handle, {
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
    const left = screen.getByRole('button', { name: 'Pool of Purging Offer 1 Item' });
    await view.user.click(left);
    // Blank slots are native: the selected option is Unresolved.
    const firstTrait = within(screen.getByRole('listbox'))
      .getAllByRole('option')
      .find((option) => option.getAttribute('aria-selected') !== 'true');
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
        .find((option) => option.getAttribute('aria-selected') !== 'true');
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

    // Each sale is appended from the Pool's Timeline entry at the end of the room's actions.
    openRoomTab('Room Timeline');
    const sell = async (name: RegExp) => {
      await view.user.click(screen.getByRole('button', { name: 'Pool of Purging' }));
      const [option] = await within(await screen.findByRole('listbox')).findAllByRole('option', {
        name,
      });
      await view.user.click(option!);
    };
    const poolActionOrder = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'F')
        ?.topology?.occurrences.find((room) => room.occurrenceId === postbossId)?.roomActions.order;
    await sell(new RegExp(`^Sell ${leftTraitLabel}`));
    await waitFor(() =>
      expect(poolActionOrder()).toContainEqual({ kind: 'sellPurgingPoolTrait', slotKey: 'left' }),
    );
    await sell(/^Sell /);
    const sold = [
      { kind: 'useFountain' },
      { kind: 'interactKeepsakeRack' },
      { kind: 'sellPurgingPoolTrait', slotKey: 'left' },
      { kind: 'sellPurgingPoolTrait', slotKey: 'middle' },
    ];
    await waitFor(() => expect(poolActionOrder()).toEqual(sold));

    openRoomTab('Room Timeline');
    const soldRow = screen.getByText(`Sell ${leftTraitLabel}`).closest('li');
    expect(soldRow?.getAttribute('data-action-accent')).toBe('optional');
    reorderByKeyboard(
      screen.getByRole('button', { name: `Reorder Sell ${leftTraitLabel}` }),
      /^(?!Current position)/,
    );
    await waitFor(() => expect(poolActionOrder()).not.toEqual(sold));
    const moved = poolActionOrder();

    view.application.store.dispatch(authoredProjectUndoRequested());
    await waitFor(() => expect(poolActionOrder()).toEqual(sold));
    view.application.store.dispatch(authoredProjectRedoRequested());
    await waitFor(() => expect(poolActionOrder()).toEqual(moved));

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
    // A sale whose slot lost its pin stays on the timeline with its finding.
    const stale = (await screen.findByText('Sell left Pool trait')).closest('li');
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
    // The pickup outcome is the row's verb, so it precedes every decision it enables.
    const disposition = screen.getByRole('button', { name: /^How to take .+: Collect$/ });
    expect(disposition.textContent).toBe('Collect');
    const pomLauncher = screen.getByRole('button', { name: 'Edit Pom · No eligible traits' });
    const pickupRow = pomLauncher.closest<HTMLElement>('[data-room-action-key]');
    if (pickupRow === null) throw new Error('Nectar pickup row is missing');
    expect(
      pickupRow.querySelector(':scope > [data-timeline-cell="label"]')?.contains(disposition),
    ).toBe(true);
    expect(
      pickupRow.querySelector(':scope > [data-timeline-cell="editors"]')?.contains(pomLauncher),
    ).toBe(true);
    expectBefore(disposition, pomLauncher);

    await view.user.click(disposition);
    await view.user.click(screen.getByRole('option', { name: 'Transform · Artificer' }));
    await waitFor(() => {
      const outcome = screen.getByRole('button', { name: /^How to take .+: Transform$/ });
      const sourceAction = outcome.closest<HTMLElement>('[data-room-action-key]');
      if (sourceAction === null) throw new Error('Artificer source action is missing');
      expect(
        within(sourceAction).queryByRole('button', {
          name: 'Edit Pom · No eligible traits',
        }),
      ).toBeNull();
      // The transformed pickup's decision is the Artificer's result.
      const output = within(sourceAction).getByRole('button', { name: /^Artificer item/ });
      expect(
        sourceAction.querySelector(':scope > [data-timeline-cell="editors"]')?.contains(output),
      ).toBe(true);
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
    const row = actionRow(actions, 'Collect Red Onion');
    expect(spokenText(row)).not.toMatch(/Forfeit|Zeus|boon|\(Red Onion\)/);
    // The realized pickup keeps its editable outcome as the row's verb.
    const outcome = within(row).getByRole('button', { name: /^How to take .+: Collect$/ });
    expect(outcome.textContent).toBe('Collect');
    expect(row.querySelector(':scope > [data-timeline-cell="label"]')?.contains(outcome)).toBe(
      true,
    );
    expect(within(row).queryByRole('button', { name: /Edit Trait/ })).toBeNull();
    expect(queryByHint(actions, 'Converted by the Vow of Forfeit.')).toBeNull();
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
      .getByRole('button', { name: /^How to take Bones: Transform$/ })
      .closest<HTMLElement>('[data-room-action-key]');
    if (sourceAction === null) throw new Error('Artificer source action is missing');
    const replacementAction = actionRow(actions, /^Collect .*Artificer/);
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
    // The reason names the source action as its row reads.
    expect(blocked?.explanations).toEqual([
      `${spokenText(sourceAction.querySelector('[data-timeline-cell="label"]')!)} first to create this reward.`,
    ]);
    expect(within(sourceAction).getByRole('button', { name: /^Artificer item/ })).toBeTruthy();
    expect(within(replacementAction).queryByRole('button', { name: /^How to take / })).toBeNull();
    expect(within(replacementAction).queryByRole('button', { name: /^Artificer item/ })).toBeNull();

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
    expect(actions.querySelector('[data-reorder-handle]')).toBeNull();
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
      const restored = actionRow(actions, 'Collect Bones');
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
      expect(proposal.explanations.length).toBeLessThanOrEqual(2);
      expect(new Set(proposal.explanations).size).toBe(proposal.explanations.length);
      expect(proposal.explanations[0]).toMatch(
        new RegExp(`^${row.label} belongs (before|after) Combat [123]\\.$`),
      );
    }
    openRoomTab('Combat 1 Timeline');
    expect(screen.getByRole('region', { name: 'Room Timeline' })).toBeTruthy();
    const combatOne = screen.getByLabelText('Combat 1 ship phase');
    const actionOrder = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Surface',
        'O',
        occurrenceId,
      );
    const rowFor = (label: string) =>
      actionRow(
        combatOne,
        new RegExp(`(^| )${label.replace(/[.*+?^${}()|[\]\\]/g, '\\$&')}( ·|$)`),
      );

    const icarus = rowFor('Talk to Icarus');
    const moveIcarus = within(icarus).getByRole('button', { name: 'Reorder Talk to Icarus' });
    expect(within(combatOne).queryByText('Choose Combat 2 wheel')).toBeNull();
    const icarusRow = projected.room.roomActions!.rows.find(
      (row) => row.key === icarus.dataset.roomActionKey,
    )!;
    const icarusMoves = projected.room.roomActions!.proposals.filter(
      (proposal) => proposal.kind === 'move' && icarusRow.proposalKeys.includes(proposal.key),
    );
    expect(icarusMoves.some((proposal) => !proposal.structurallyAuthorable)).toBe(true);
    // The keyboard steps through the legal places only, its own place included.
    act(() => {
      fireEvent.click(moveIcarus, { detail: 0 });
    });
    expect(reorderAnnouncement(moveIcarus)).toContain('Picked up Talk to Icarus.');
    act(() => {
      fireEvent.keyDown(moveIcarus, { key: 'Home' });
    });
    const stepped = [reorderAnnouncement(moveIcarus).trim()];
    for (let step = 0; step < icarusMoves.length + 1; step += 1) {
      act(() => {
        fireEvent.keyDown(moveIcarus, { key: 'ArrowDown' });
      });
      stepped.push(reorderAnnouncement(moveIcarus).trim());
    }
    expect(stepped.some((text) => /unavailable/i.test(text))).toBe(false);
    expect(new Set(stepped).size).toBeLessThanOrEqual(
      icarusMoves.filter((proposal) => proposal.structurallyAuthorable).length + 1,
    );
    // Escape cancels and says so.
    act(() => {
      fireEvent.keyDown(moveIcarus, { key: 'Escape' });
    });
    expect(reorderAnnouncement(moveIcarus)).toContain('Cancelled. Talk to Icarus stays in place.');
    expect(moveIcarus.getAttribute('aria-pressed')).toBeNull();

    const initialOrder = actionOrder();
    reorderByKeyboard(moveIcarus, /^(?!Current position)/);
    expect(actionOrder()).not.toEqual(initialOrder);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(actionOrder()).toEqual(initialOrder);

    const restoredIcarus = rowFor('Talk to Icarus');
    const goldPickup = rowFor('Collect Gold');
    const handle = within(restoredIcarus).getByRole('button', { name: 'Reorder Talk to Icarus' });
    const board = handle;
    const initialKeys = initialOrder?.map(roomActionKey) ?? [];
    const icarusKey = restoredIcarus.dataset.roomActionKey;
    const goldPickupKey = goldPickup.dataset.roomActionKey;
    const dragAfter =
      icarusKey !== undefined &&
      goldPickupKey !== undefined &&
      initialKeys.indexOf(icarusKey) < initialKeys.indexOf(goldPickupKey);
    vi.spyOn(goldPickup, 'getBoundingClientRect').mockReturnValue({
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

  it('waits on an earlier choice before buying, then reorders Shop purchases and removes one on its row through undo', async () => {
    const entered = enteredShopProject();
    const occurrenceId = entered.shopId;
    let project = entered.project;
    for (const offerKey of ['MajorNonBoon', 'Minor'])
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(goldenFBiome, occurrenceId, offerKey),
        purchased: true,
      });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    // The Overview authors stock only.
    expect(screen.queryByRole('checkbox', { name: /^Purchased/ })).toBeNull();
    openRoomTab('Room Timeline');
    // This room's actions are not reached yet, so nothing can be bought.
    const entry = screen.getByRole('button', { name: 'World Shop' });
    expect(entry).toHaveProperty('disabled', true);
    expect(hintOf(entry)).toBe('Waits on an earlier choice.');

    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).getByText('Doors open')).toBeTruthy();
    expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    expect(within(actions).queryByText('Exit usable')).toBeNull();
    expect(queryActionRow(actions, /^Buy Zeus boon/)).toBeNull();

    // The slot bought from is a badge on the row icon and part of the row's spoken label.
    const minor = actionRow(actions, 'Buy Max Magick · slot 3');
    expect(minor.querySelector('.timeline-slot-badge')?.textContent).toBe('3');
    expect(minor.getAttribute('data-action-accent')).toBe('optional');
    reorderByKeyboard(
      within(minor).getByRole('button', { name: 'Reorder Buy Max Magick' }),
      /^(?!Current position)/,
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
    const order = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'F',
        occurrenceId,
      );
    await view.user.click(screen.getByRole('button', { name: 'Remove Buy Heal from timeline' }));
    expect(order()).toEqual([{ kind: 'interactShopOffer', offerKey: 'Minor' }]);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect(order()).toEqual([
      { kind: 'interactShopOffer', offerKey: 'Minor' },
      { kind: 'interactShopOffer', offerKey: 'MajorNonBoon' },
    ]);
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    expect(order()).toEqual([{ kind: 'interactShopOffer', offerKey: 'Minor' }]);
  });

  it('reuses the ranked pointer language for Room Action peers and keeps unranked actions below a boundary', async () => {
    const entered = enteredShopProject();
    const occurrenceId = entered.shopId;
    let project = entered.project;
    for (const offerKey of ['MajorNonBoon', 'Minor'])
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceShopPurchaseParticipation',
        offer: createShopOfferAddress(goldenFBiome, occurrenceId, offerKey),
        purchased: true,
      });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(within(actions).queryByRole('region', { name: 'Timeline repairs' })).toBeNull();
    const major = actionRow(actions, 'Buy Heal · slot 2');
    const minor = actionRow(actions, 'Buy Max Magick · slot 3');
    const handle = within(major).getByRole('button', { name: 'Reorder Buy Heal' });
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
    fireEvent.pointerDown(handle, {
      button: 0,
      clientX: 12,
      clientY: 12,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    fireEvent.pointerMove(handle, {
      clientX: 24,
      clientY: 150,
      isPrimary: true,
      pointerId: 47,
      pointerType: 'mouse',
    });
    // The lifted row and its target are marked while the preview follows the pointer.
    expect(major.dataset.reorderLifted).toBe('pointer');
    expect(minor.dataset.reorderIndicator).toBe('after');
    expect(document.querySelector('.room-action-drag-preview')).not.toBeNull();
    fireEvent.pointerUp(handle, {
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

  it('buys a stocked item and the live Travel Deal item from the World Shop entry, each appended', async () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    const reference = {
      kind: 'interactAcquisitionEntry' as const,
      siteKey: 'roomExit' as const,
      entryKey: 'travelDealRefill',
    };
    const project = applyProjectCommand(underworldWorldShopTravelDealProject(), catalog, {
      kind: 'RemoveRoomAction',
      action: createRoomActionAddress(goldenFBiome, shopId, roomActionKey(reference)),
    });
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));
    openRoomTab('Room Timeline');
    const order = () =>
      occurrenceRoomActionOrder(
        view.application.store.getState().projectWorkspace.history!.present,
        'Underworld',
        'F',
        shopId,
      );
    await view.user.click(screen.getByRole('button', { name: 'World Shop' }));
    const options = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(options).toContain('Buy Travel Deal item');
    // Each unbought item is offered by the row it appends; the bought Slot 2 item is not.
    expect(options).toEqual(['Buy Apollo', 'Buy Max Magick', 'Buy Travel Deal item']);
    expect(options).not.toContain('Buy Heal');
    await view.user.click(screen.getByRole('option', { name: 'Buy Travel Deal item' }));
    expect(order()?.at(-1)).toEqual(reference);
    const stocked = order()?.length ?? 0;
    await pickRoomObjectAction(view.user, 'World Shop', 'Buy Max Magick');
    expect(order()).toHaveLength(stocked + 1);
    expect(order()?.at(-1)).toEqual({ kind: 'interactShopOffer', offerKey: 'Minor' });
  });

  it('stocks and buys a blank Travel Deal item in one pick from the World Shop entry', async () => {
    const shopId = createOccurrenceId('golden-f-preboss-shop');
    // A Travel Deal purchase whose refilled item was never stocked.
    const project = authorLegalTraitOffers(
      replaceTestShopOfferActions(
        applyProjectCommand(loadUnderworldFStygianWellCheckpoint(), catalog, {
          kind: 'ReplaceShopOffer',
          offer: createShopOfferAddress(goldenFBiome, shopId, 'MajorNonBoon'),
          value: { rewardType: 'MaxHealthDrop' },
        }),
        catalog,
        createOccurrenceAddress(goldenFBiome, shopId),
        ['MajorNonBoon'],
      ),
    );
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrenceById(shopId));
    openRoomTab('Room Timeline');
    const room = () =>
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'F')!
        .topology!.occurrences.find((candidate) => candidate.occurrenceId === shopId)!;
    const before = room().roomActions.order.length;
    await pickRoomObjectAction(view.user, 'World Shop', 'Buy Travel Deal item…');
    await view.user.click(screen.getByRole('button', { name: 'Pick item for Travel Deal' }));
    const choices = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .map((option) => option.textContent);
    expect(choices.length).toBeGreaterThan(1);
    expect(room().roomActions.order).toHaveLength(before);
    await view.user.click(screen.getAllByRole('option')[0]!);
    expect(room().roomActions.order).toHaveLength(before + 1);
    expect(room().roomActions.order.at(-1)).toEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    });
    const state = room().state;
    expect(state.kind === 'shop' && state.shop?.travelDealRefill?.optionKey).toEqual(
      expect.any(String),
    );
  });

  it('prices each Well purchase in its money cell and shows the gold held on its Doors open banner', () => {
    renderOccurrenceWorkbench(
      authorLegalTraitOffers(loadUnderworldFStygianWellCheckpoint()),
      'Underworld',
      'F',
      occurrenceById('golden-f-preboss-shop:postboss'),
    );
    openRoomTab('Room Timeline');
    const actions = screen.getByRole('region', { name: 'Room Timeline' });
    const purchases = purchaseRows(actions);
    expect(purchases.length).toBeGreaterThan(0);
    for (const row of purchases) {
      // The price sits in the money cell, never in the label.
      const money = row.querySelector("[data-timeline-cell='money']")!;
      expect(money.querySelector('.purchase-cost-price')?.textContent).toMatch(
        /^~?\d+(–\d+)? gold$/,
      );
      expect(row.querySelector("[data-timeline-cell='label']")?.textContent).not.toMatch(/gold/);
    }
    expect(within(actions).getByLabelText('Doors open').textContent).toMatch(
      /Current\s*\u2212?\d+(?: ±\d+)? gold$/,
    );
    expect(within(actions).getByLabelText('Doors open').textContent).not.toMatch(/Spent/);
    expect(within(actions).getByLabelText('Room entered').textContent).not.toMatch(/Current/);
  });

  it('marks each purchase with its chance to afford as a toned pill beside its price', () => {
    renderOccurrenceWorkbench(
      underworldCheckpointArtifacts['underworld-world-shop-travel-deal'].load(),
      'Underworld',
      'F',
      occurrenceById('golden-f-preboss-shop:postboss'),
    );
    openRoomTab('Room Timeline');
    const purchases = purchaseRows(screen.getByRole('region', { name: 'Room Timeline' }));
    expect(purchases.length).toBeGreaterThan(0);
    for (const row of purchases) {
      const cost = row.querySelector("[data-timeline-cell='money'] > .purchase-cost")!;
      const pill = cost.querySelector('.purchase-affordability')!;
      expectBefore(cost.querySelector('.purchase-cost-price')!, pill);
      const shown = /^(>99%|<1%|(\d+)%) chance to afford$/.exec(pill.textContent ?? '');
      expect(shown).not.toBeNull();
      expect(pill.querySelector('.visually-hidden')?.textContent).toBe(' chance to afford');
      // The tone follows the percent the pill shows.
      const percent = shown![1] === '>99%' ? 100 : shown![1] === '<1%' ? 0 : Number(shown![2]);
      expect(pill.getAttribute('data-tone')).toBe(
        percent >= 90 ? 'high' : percent >= 50 ? 'medium' : 'low',
      );
    }
  });

  it('keeps only Current on the Doors open banner of a room that buys nothing', () => {
    renderOccurrenceWorkbench(
      underworldCheckpointArtifacts['underworld-f-pool'].load(),
      'Underworld',
      'G',
      occurrenceById('golden-g-intro'),
    );
    openRoomTab('Room Timeline');
    const doorsOpen = within(screen.getByRole('region', { name: 'Room Timeline' })).getByLabelText(
      'Doors open',
    );
    expect(doorsOpen.textContent).toMatch(/Current\s*\d+ ±\d+ gold/);
    expect(doorsOpen.textContent).not.toMatch(/Spent/);
    expect(doorsOpen.querySelector('[data-placeholder]')).toBeNull();
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
