// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createIncomingRewardAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';

import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import {
  authoredProjectCommandDispatched,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

import {
  createGoldenFGHIProject,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
  loadNemesisFieldsCheckpoint,
  replaceNemesisRandomEventInteraction,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNProject,
  loadSurfaceNOPQProject,
  nLocalOccurrenceId,
  nOccurrenceId,
  nOccurrenceIds,
  oOccurrenceIds,
  withoutNFirstVisitSideRooms,
} from '@run-planner/test-fixtures/surface';
import {
  renderOccurrenceWorkbench,
  renderStaticOccurrenceWorkbench,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';

import {
  enteredShopProject,
  expectBefore,
  occurrenceById,
  openRoomTab,
} from '@planner-test/support/occurrence-workbench';
import { hintOf } from '@planner-test/support/hints';

let immutableRepresentativeNOPQProject: ProjectDocument;

beforeAll(function prepareImmutableRepresentativeProjects() {
  createGoldenFGHIProject();
  immutableRepresentativeNOPQProject = loadSurfaceNOPQProject();
});

/** Lays the visited side rooms out 20px apart, in list order, for pointer placement. */
function mockVisitRowBounds(list: () => HTMLElement): void {
  vi.spyOn(HTMLElement.prototype, 'getBoundingClientRect').mockImplementation(function (
    this: HTMLElement,
  ) {
    const index = [...list().querySelectorAll('li')].indexOf(this as HTMLLIElement);
    const top = Math.max(index, 0) * 20;
    return DOMRect.fromRect({ x: 0, y: top, width: 100, height: index < 0 ? 0 : 20 });
  });
}

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

describe('OccurrenceWorkbench', () => {
  it('opens its static room map without changing authored history or navigation', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
    if (node === undefined) throw new Error('ordinary entered occurrence is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const focusBefore = view.application.store.getState().editorSession.focusedSemanticOwner;

    await view.user.click(screen.getByRole('button', { name: `View map for ${node.room.label}` }));

    expect(screen.getByRole('heading', { name: `${node.room.label} map` })).toBeTruthy();
    expect(screen.getByText(node.room.gameName)).toBeTruthy();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    expect(view.application.store.getState().editorSession.focusedSemanticOwner).toBe(focusBefore);
  });

  it('presents an incoming ordinary room identity read-only under its target-owned door control', () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
    if (node === undefined) throw new Error('ordinary entered occurrence is missing');

    expect(node.inspectorPresentation).toBe('doorTarget');
    expect(node.room.roomPicker).toMatchObject({
      address: expect.objectContaining({ kind: 'target' }),
      kind: 'targetRoomPicker',
    });
    expect(
      screen.getByRole('heading', {
        level: 3,
        name: new RegExp(`^${node.room.label}`),
      }),
    ).toBeTruthy();
    expect(document.querySelector('.room-card-heading .room-kind')).toBeNull();
    expect(screen.queryByLabelText('Room')).toBeNull();
  });

  it('renders Standard room contents and its encounter in Overview and names it in the Timeline banner', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const standardFeatures = screen.getByRole('tabpanel', { name: 'Room Overview' });
    expect(standardFeatures).toBeTruthy();
    expect(within(standardFeatures).queryByRole('heading', { name: 'Features' })).toBeNull();
    expect(within(standardFeatures).getByRole('heading', { name: /^Resources/ })).toBeTruthy();
    expect(
      within(standardFeatures).getByRole('heading', { name: 'Additional Exits' }),
    ).toBeTruthy();
    expect(within(standardFeatures).getByRole('heading', { name: 'Objects' })).toBeTruthy();
    expect(document.querySelector('.room-overview-workbench')).not.toBeNull();
    expect(screen.getByRole('tab', { name: 'Room Doors' })).toBeTruthy();
    const overviewRunState = screen.getByRole('button', { name: 'Run State' });
    const entryOwner = overviewRunState.getAttribute('data-run-state-launcher');
    expect(overviewRunState.closest('.room-workbench-tab-row')).not.toBeNull();
    expect(overviewRunState.closest('[role="tabpanel"]')).toBeNull();
    const overviewEncounter = within(
      screen.getByRole('region', { name: 'Encounter structure' }),
    ).getByLabelText('Encounter phase');
    const overviewEncounterLabel = within(overviewEncounter)
      .getByRole('button', { name: 'Encounter' })
      .querySelector('span')!.textContent!;
    openRoomTab('Room Timeline');
    const standardActions = screen.getByRole('region', { name: 'Room Timeline' });
    const standardStart = within(standardActions).getByLabelText('Encounter');
    // A phase without events shows only its banner; identity stays in Overview.
    expect(within(standardActions).queryByRole('group', { name: / (start|end)$/ })).toBeNull();
    const standardEncounter = within(standardStart).getByRole('button', {
      name: overviewEncounterLabel,
    });
    expect(within(standardActions).queryByRole('button', { name: 'Encounter' })).toBeNull();
    const standardEnd = within(standardActions).getByLabelText('Encounter ended');
    const roomEntered = within(standardActions).getByLabelText('Room entered');
    const entryRunState = screen.getByRole('button', { name: 'Run State' });
    expect(entryRunState.getAttribute('data-run-state-launcher')).toBe(entryOwner);
    expect(entryRunState.closest('.room-workbench-tab-row')).not.toBeNull();
    expectBefore(entryRunState, roomEntered);
    expectBefore(standardStart, standardEncounter);
    expectBefore(standardEncounter, standardEnd);
    openRoomTab('Room Doors');
    expect(
      within(screen.getByRole('tabpanel', { name: 'Room Doors' })).queryByRole('button', {
        name: 'Run State',
      }),
    ).toBeNull();
    expect(
      screen.getByRole('button', { name: 'Run State' }).closest('.room-workbench-tab-row'),
    ).not.toBeNull();
  });

  it('gives H Fields a dedicated Layout tab without changing the Timeline surface', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );

    // Tabs show short names; their accessible names stay the full ones.
    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label') ?? tab.textContent),
    ).toEqual(['Room Overview', 'Room Layout', 'Room Timeline', 'Room Doors']);
    openRoomTab('Room Layout');
    const layout = screen.getByRole('region', { name: 'Fields Layout' });
    expect(within(layout).getByRole('heading', { name: 'Position' })).toBeTruthy();
    expect(within(layout).getByText('Entry')).toBeTruthy();
    expect(within(layout).getByRole('heading', { name: 'Cage placements' })).toBeTruthy();
    expect(within(layout).getByRole('heading', { name: 'Optional pickups' })).toBeTruthy();
    expect(within(layout).queryByRole('heading', { name: 'Nemesis' })).toBeNull();
    expect(within(layout).getByRole('radio', { name: 'Entry 1' })).toBeTruthy();
    expect(within(layout).getAllByRole('radio', { name: 'Cage Point 1' })).not.toHaveLength(0);
    expect(within(layout).getAllByRole('radio', { name: 'Optional Point 1' })).not.toHaveLength(0);
    expect(layout.textContent).not.toMatch(/\b\d{5,}\b/);

    openRoomTab('Room Timeline');
    expect(screen.getByRole('region', { name: 'Room Timeline' })).toBeTruthy();
    expect(screen.queryByRole('region', { name: 'Fields Layout' })).toBeNull();
  });

  it('does not add the H Fields Layout tab to ordinary rooms', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );

    expect(screen.queryByRole('tab', { name: 'Room Layout' })).toBeNull();
    expect(screen.queryByRole('region', { name: 'Fields Layout' })).toBeNull();
  });

  it('edits an entry point through its candidate-backed Layout control', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Layout');
    const point = screen.getByRole('radiogroup', { name: 'Entry position' });
    const alternate = within(point).getByRole('radio', { name: 'Entry 2' });

    await view.user.click(alternate);

    expect((alternate as HTMLInputElement).checked).toBe(true);
  });

  it('keeps the H Fields reference open across position edits and resets it for room replacement', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Layout');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const reference = screen.getByRole('complementary', { name: 'Combat 02 map reference' });
    const point = screen.getByRole('radiogroup', { name: 'Entry position' });
    const alternate = within(point).getByRole('radio', { name: 'Entry 2' });

    expect(within(reference).getByText('100%')).toBeTruthy();
    await view.user.click(within(reference).getByRole('button', { name: 'Zoom in' }));
    await view.user.click(alternate);

    expect((alternate as HTMLInputElement).checked).toBe(true);
    expect(screen.getByRole('complementary', { name: 'Combat 02 map reference' })).toBeTruthy();
    expect(within(screen.getByRole('complementary')).getByText('125%')).toBeTruthy();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );

    await act(async () => {
      view.application.store.dispatch(authoredProjectUndoRequested());
    });
    expect((screen.getByRole('radio', { name: 'Entry 1' }) as HTMLInputElement).checked).toBe(true);
    expect(within(screen.getByRole('complementary')).getByText('125%')).toBeTruthy();

    await act(async () => {
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceOccurrenceRoom',
          occurrence: createOccurrenceAddress(goldenHBiome, occurrenceId),
          gameName: 'H_Combat03',
        }),
      );
    });
    expect(screen.getByRole('complementary', { name: 'Combat 03 map reference' })).toBeTruthy();
    expect(within(screen.getByRole('complementary')).getByText('100%')).toBeTruthy();
  });

  it('shows a missing active placement finding on its exact Layout row', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceFieldsSpatialPoint',
      spatial: createFieldsSpatialAddress(createOccurrenceAddress(goldenHBiome, occurrenceId), {
        kind: 'cage',
        slotKey: 'cage1',
      }),
      pointId: null,
    });
    renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Layout');
    const row = screen.getByText('Cage 1').closest('.fields-layout-row');
    if (!(row instanceof HTMLElement)) throw new Error('Cage 1 Layout row is missing');

    expect(
      within(row)
        .getByRole('radiogroup', { name: 'Cage 1 position' })
        .getAttribute('data-has-findings'),
    ).toBe('true');
  });

  it.each([
    ['cage', 'Cage', [621502, 622508]],
    ['optional', 'Optional', [572849, 622840]],
  ] as const)(
    'reverses two %s placements through a repairable conflict',
    async (kind, label, points) => {
      const occurrenceId = createOccurrenceId('golden-h-combat02');
      const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
      let project = createGoldenFGHIProject();
      for (const [index, pointId] of points.entries())
        project = applyProjectCommand(project, catalog, {
          kind: 'ReplaceFieldsSpatialPoint',
          spatial: createFieldsSpatialAddress(occurrence, { kind, slotKey: `${kind}${index + 1}` }),
          pointId,
        });
      const view = renderOccurrenceWorkbench(
        project,
        'Underworld',
        'H',
        occurrenceById(occurrenceId),
      );
      openRoomTab('Room Layout');
      const group = (index: number) =>
        screen.getByRole('radiogroup', { name: `${label} ${index} position` });
      const point = (row: number, index: number) =>
        within(group(row)).getByRole('radio', {
          name: `${label} Point ${index}`,
        }) as HTMLInputElement;

      await view.user.click(point(1, 2));

      expect(point(1, 2).checked).toBe(true);
      expect(point(2, 2).checked).toBe(true);
      expect(group(1).getAttribute('data-has-findings')).toBe('true');
      expect(group(2).getAttribute('data-has-findings')).toBe('true');

      await view.user.click(point(2, 1));

      expect(point(1, 2).checked).toBe(true);
      expect(point(2, 1).checked).toBe(true);
      expect(group(1).getAttribute('data-has-findings')).toBe('false');
      expect(group(2).getAttribute('data-has-findings')).toBe('false');
    },
  );

  it('keeps the Nemesis source-excluded position disabled', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat04');
    const phase = createEncounterPhaseAddress(
      goldenHBiome,
      { kind: 'occurrence', occurrenceId },
      'Passive',
    );
    let project = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'SelectEncounter',
      phase,
      encounterKey: 'NemesisRandomEvent',
    });
    project = replaceNemesisRandomEventInteraction(
      project,
      createNemesisRandomEventAddress(phase),
      { kind: 'freeItem' },
      { rewardType: 'ArmorBoost' },
    );
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Layout');
    const group = screen.getByRole('radiogroup', { name: 'Nemesis position' });
    const excluded = within(group).getByRole('radio', {
      name: 'Optional Point 4',
    }) as HTMLInputElement;

    await view.user.click(excluded);

    expect(excluded.disabled).toBe(true);
    expect(excluded.checked).toBe(false);
    expect(within(group).getAllByRole('radio')).toHaveLength(7);
  });

  it('adds the active Nemesis placement to Layout without moving its Overview authoring', () => {
    renderStaticOccurrenceWorkbench(
      loadNemesisFieldsCheckpoint(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat05')),
    );

    const overview = screen.getByRole('tab', { name: 'Room Overview' });
    openRoomTab('Room Overview');
    expect(
      within(screen.getByLabelText('Encounter structure')).getByRole('button', { name: 'Passive' })
        .textContent,
    ).toContain('Nemesis event');
    openRoomTab('Room Layout');
    const layout = screen.getByRole('region', { name: 'Fields Layout' });
    expect(within(layout).getByRole('heading', { name: 'Nemesis' })).toBeTruthy();
    expect(within(layout).getAllByRole('radio', { name: 'Optional Point 1' })).not.toHaveLength(0);
    expect(overview.getAttribute('aria-selected')).toBe('false');
  });

  it.each([
    ['F', () => createGoldenFGHIProject(), 'Underworld', 'F', goldenFStartId],
    ['N', () => loadSurfaceNProject(), 'Surface', 'N', nOccurrenceIds.opening],
  ] as const)(
    'renders the %s Opening pickup before its Encounter and Encounter ended banners',
    (_name, project, routeKey, biomeKey, occurrenceId) => {
      renderStaticOccurrenceWorkbench(project(), routeKey, biomeKey, occurrenceById(occurrenceId));
      openRoomTab('Room Timeline');
      const actions = screen.getByRole('region', { name: 'Room Timeline' });
      const pickup = within(actions).getByRole('button', { name: /^Reorder Collect / });
      const start = within(actions).getByLabelText('Encounter');
      const end = within(actions).getByLabelText('Encounter ended');
      expectBefore(pickup, start);
      expectBefore(start, end);
      expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    },
  );

  it('places Ship Run State in one consistent tab utility slot', () => {
    renderStaticOccurrenceWorkbench(
      immutableRepresentativeNOPQProject,
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat04),
    );
    const overview = screen.getByRole('button', { name: 'Run State' });
    const introOwner = overview.getAttribute('data-run-state-launcher');
    expect(overview.closest('.room-workbench-tab-row')).not.toBeNull();
    openRoomTab('Intro Timeline');
    const intro = screen.getByRole('button', { name: 'Run State' });
    expect(intro.getAttribute('data-run-state-launcher')).toBe(introOwner);
    expect(intro.closest('.room-workbench-tab-row')).not.toBeNull();
    openRoomTab('Combat 1 Timeline');
    const combat1 = screen.getByRole('button', { name: 'Run State' });
    expect(combat1.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(combat1.closest('.room-workbench-tab-row')).not.toBeNull();
    openRoomTab('Room Doors');
    const doors = screen.getByRole('button', { name: 'Run State' });
    expect(doors.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(doors.closest('.room-workbench-tab-row')).not.toBeNull();
  });

  it('supports roving keyboard activation across the room workbench tabs', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const overview = screen.getByRole('tab', { name: 'Room Overview' });
    const actions = screen.getByRole('tab', { name: 'Room Timeline' });
    const doors = screen.getByRole('tab', { name: 'Room Doors' });
    const panelId = overview.getAttribute('aria-controls');
    expect(panelId).not.toBeNull();
    const panel = panelId === null ? null : document.getElementById(panelId);
    expect(panel).not.toBeNull();
    for (const tab of [overview, actions, doors]) {
      expect(tab.getAttribute('aria-controls')).toBe(panelId);
    }
    expect(overview.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(actions, { key: 'End' });
    expect(doors.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(doors);
    expect(doors.getAttribute('aria-controls')).toBe(panelId);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(doors, { key: 'ArrowLeft' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
  });

  it('resets the active room tab when the occurrence identity changes', () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    openRoomTab('Combat 1 Timeline');
    const workspace = workspaceProjection(view.application);
    const biome = workspace.route.biomes.find((candidate) => candidate.biomeKey === 'O');
    if (biome === undefined) throw new Error('O workspace is missing');
    const nextNode = occurrenceById(oOccurrenceIds.combat04)(biome);
    if (nextNode === undefined) throw new Error('second O occurrence is missing');
    view.rerender(
      <Provider store={view.application.store}>
        <OccurrenceWorkbench room={nextNode.room} interactions={workspace.interactions} />
      </Provider>,
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
  });

  it('edits N side-room generation and visits in one Side Rooms workbench without authoring from its parent map', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    expect(screen.getByRole('tab', { name: 'Side Rooms' })).toBeTruthy();
    expect(screen.queryByRole('checkbox', { name: 'Side Room 03 generation' })).toBeNull();
    openRoomTab('Side Rooms');
    const sideRooms = screen.getByRole('region', { name: 'Side Rooms' });
    expect(within(sideRooms).queryByRole('tab', { name: 'Doors' })).toBeNull();
    const parentMap = screen.getByRole('img', { name: 'Map of Combat 05' });
    expect(parentMap.getAttribute('src')).toBe(roomMapAssetFor('N_Combat05')?.src);
    expect(within(sideRooms).queryByText('Parent room map')).toBeNull();
    expect(within(sideRooms).queryByRole('button', { name: 'Fit' })).toBeNull();
    await view.user.click(within(sideRooms).getByRole('button', { name: 'Map controls' }));
    expect(within(sideRooms).getByRole('button', { name: 'Fit' })).toBeTruthy();
    await view.user.click(within(sideRooms).getByRole('button', { name: 'Zoom in' }));
    expect(within(sideRooms).getByText('125%')).toBeTruthy();
    let generation = screen.getByRole('checkbox', { name: 'Side Room 03 generation' });
    expect((generation as HTMLInputElement).checked).toBe(true);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    const mapStatus = screen.getByLabelText('Side-room map status');
    expect(within(mapStatus).getByLabelText('Side Room 03: Generated, not visited')).toBeTruthy();
    expect(within(mapStatus).queryByRole('button')).toBeNull();
    await view.user.click(parentMap);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
    generation = screen.getByRole('checkbox', { name: 'Side Room 03 generation' });

    await view.user.click(generation);
    await waitFor(() =>
      expect((screen.getByLabelText('Side Room 03 generation') as HTMLInputElement).checked).toBe(
        false,
      ),
    );
    const sideRow = generation.closest('li');
    if (sideRow === null) throw new Error('Side Room 03 row is missing');
    const placeholder = within(sideRow).getByText('Generate this door to set its reward.');
    expect(placeholder.closest('.control-placeholder')).not.toBeNull();
    expect(within(sideRow).queryByRole('button', { name: 'Reward' })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    act(() => screen.getByRole('checkbox', { name: 'Side Room 03 generation' }).focus());
    await view.user.keyboard(' ');
    await waitFor(() =>
      expect((screen.getByLabelText('Side Room 03 generation') as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    expect(
      within(
        screen.getByRole('checkbox', { name: 'Side Room 03 generation' }).closest('li')!,
      ).getByRole('button', { name: 'Reward' }),
    ).toBeTruthy();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 2,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect((screen.getByLabelText('Side Room 03 generation') as HTMLInputElement).checked).toBe(
        true,
      ),
    );
    openRoomTab('Room Timeline');
    const nActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(nActions).toBeTruthy();
    expect(
      within(nActions).getByLabelText('Encounter').querySelector('.timeline-banner-identity'),
    ).not.toBeNull();
  });

  it('allows invalid generation edits, reports checkbox findings, and repairs them without changing visit order', async () => {
    const view = renderOccurrenceWorkbench(
      withoutNFirstVisitSideRooms(loadSurfaceNOPQProject()),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const node = occurrenceById(nOccurrenceId('combat02'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    );
    const localVisit = node?.localVisit;
    const slot = localVisit?.slots[0];
    if (localVisit === undefined || slot === undefined)
      throw new Error('Combat 02 side-room slot is missing');
    openRoomTab('Side Rooms');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceLocalVisitOrder',
          order: localVisit.order,
          occurrenceIds: [],
        }),
      ),
    );
    for (const side of localVisit.slots) {
      const control = screen.getByRole('checkbox', { name: `${side.label} generation` });
      expect((control as HTMLInputElement).disabled).toBe(false);
      await view.user.click(control);
      expect((control as HTMLInputElement).checked).toBe(false);
    }
    const checkbox = screen.getByRole('checkbox', { name: `${slot.label} generation` });
    expect(checkbox.getAttribute('data-has-findings')).toBe('true');
    expect(checkbox.getAttribute('aria-description')).toContain('Side room');
    const currentVisit = () =>
      occurrenceById(nOccurrenceId('combat02'))(workspaceBiome(view.application, 'Surface', 'N'))
        ?.localVisit;
    expect(currentVisit()?.visitOrder).toEqual([]);
    const interaction = workspaceProjection(
      view.application,
    ).interactions.localVisitGenerations.get(semanticAddressKey(slot.address));
    if (interaction === undefined) throw new Error('Side-room generation interaction is missing');
    expect(
      (await interaction.load()).find((option) => option.value === 'notGenerated')?.evaluation,
    ).toMatchObject({
      kind: 'sideRoomGeneration',
      result: { selectedPossible: false },
    });
    await view.user.click(checkbox);
    await waitFor(() => expect(checkbox.getAttribute('data-has-findings')).toBe('false'));
    expect((checkbox as HTMLInputElement).checked).toBe(true);
    expect(currentVisit()?.visitOrder).toEqual([]);
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    expect((checkbox as HTMLInputElement).checked).toBe(false);
    expect(checkbox.getAttribute('data-has-findings')).toBe('true');
  });

  it('edits side-room visits through existing checkbox, drag, and arrow proposals', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    openRoomTab('Side Rooms');
    const visited = () => screen.getByRole('list', { name: 'Visited side rooms' });
    const labels = () =>
      [...visited().querySelectorAll('li')].map((row) => row.querySelector('strong')?.textContent);
    const rowFor = (list: HTMLElement, label: string) => {
      const row = [...list.querySelectorAll('li')].find((candidate) =>
        within(candidate).queryByText(label),
      );
      if (row === undefined) throw new Error(`${label} row is missing`);
      return row;
    };
    const handleFor = (label: string) =>
      within(rowFor(visited(), label)).getByRole('button', { name: `Reorder ${label}` });
    const history = () => view.application.store.getState().projectWorkspace.history!.past.length;
    // Keyboard: pick up, step through the legal visit positions, drop.
    const keyboardMove = async (
      label: string,
      direction: 'up' | 'down',
      expected: readonly string[],
      changes = true,
    ) => {
      const handle = handleFor(label);
      act(() => handle.focus());
      const historyBefore = history();
      fireEvent.click(handle);
      fireEvent.keyDown(handle, { key: direction === 'up' ? 'ArrowUp' : 'ArrowDown' });
      fireEvent.click(handle);
      await waitFor(() => expect(labels()).toEqual(expected));
      expect(history()).toBe(historyBefore + (changes ? 1 : 0));
    };
    const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10 };
    // Each visited row is 20px tall in list order, so the pointer can name a place.
    mockVisitRowBounds(visited);
    const drag = (source: string, target: string) => {
      const order = labels();
      const handle = handleFor(source);
      const at =
        order.indexOf(target) * 20 + (order.indexOf(target) < order.indexOf(source) ? 2 : 18);
      fireEvent.pointerDown(handle, pointer);
      fireEvent.pointerMove(handle, { ...pointer, clientY: at });
      expect(document.querySelector('.room-action-drag-preview')).not.toBeNull();
      fireEvent.pointerUp(handle, { ...pointer, clientY: at });
      expect(document.querySelector('.room-action-drag-preview')).toBeNull();
    };

    expect(labels()).toEqual(['Side Room 07', 'Side Room 02']);
    // Visit order moves only through each room's reorder handle.
    expect(screen.queryByRole('button', { name: /^Move Side Room/ })).toBeNull();
    expect(handleFor('Side Room 07')).toBeTruthy();
    await view.user.click(screen.getByRole('checkbox', { name: 'Side Room 03 visit' }));
    await waitFor(() => expect(labels()).toEqual(['Side Room 07', 'Side Room 02', 'Side Room 03']));
    drag('Side Room 03', 'Side Room 07');
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 07', 'Side Room 02']));
    drag('Side Room 02', 'Side Room 07');
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 02', 'Side Room 07']));
    drag('Side Room 03', 'Side Room 07');
    await waitFor(() => expect(labels()).toEqual(['Side Room 02', 'Side Room 07', 'Side Room 03']));
    const noOpHistory = history();
    drag('Side Room 03', 'Side Room 03');
    expect(history()).toBe(noOpHistory);
    drag('Side Room 02', 'Side Room 07');
    await waitFor(() => expect(labels()).toEqual(['Side Room 07', 'Side Room 02', 'Side Room 03']));
    expect(history()).toBe(noOpHistory + 1);
    await keyboardMove('Side Room 03', 'up', ['Side Room 07', 'Side Room 03', 'Side Room 02']);
    await keyboardMove('Side Room 03', 'up', ['Side Room 03', 'Side Room 07', 'Side Room 02']);
    // The first and last rooms have no place further up or down; the move is a no-op.
    await keyboardMove(
      'Side Room 03',
      'up',
      ['Side Room 03', 'Side Room 07', 'Side Room 02'],
      false,
    );
    await keyboardMove(
      'Side Room 02',
      'down',
      ['Side Room 03', 'Side Room 07', 'Side Room 02'],
      false,
    );

    const preserved = occurrenceById(nOccurrenceId('combat05'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    )?.localVisit?.slots.find((slot) => slot.label === 'Side Room 07');
    if (preserved?.generation !== 'generated') throw new Error('Side Room 07 is not generated');
    const retainedOccurrenceId = preserved.occurrenceId;
    const retainedReward = preserved.door.offerRewardSurface.rewards.map(
      (reward) => reward.summary,
    );
    const retainedEncounterCount = preserved.room.encounterPhases.length;
    const retainedActionCount = preserved.room.roomActions?.rows.length ?? 0;

    const draggedHandle = handleFor('Side Room 07');
    fireEvent.pointerDown(draggedHandle, pointer);
    fireEvent.pointerMove(draggedHandle, { ...pointer, clientY: 30 });
    await view.user.click(screen.getByRole('checkbox', { name: 'Side Room 07 visit' }));
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 02']));
    const historyAfterRemoval =
      view.application.store.getState().projectWorkspace.history!.past.length;
    fireEvent.pointerUp(visited(), { ...pointer, clientY: 30 });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyAfterRemoval,
    );
    await view.user.click(screen.getByRole('checkbox', { name: 'Side Room 07 visit' }));
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 02', 'Side Room 07']));
    const restored = occurrenceById(nOccurrenceId('combat05'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    )?.localVisit?.slots.find((slot) => slot.label === 'Side Room 07');
    if (restored?.generation !== 'generated') throw new Error('Side Room 07 was not restored');
    expect(restored.occurrenceId).toBe(retainedOccurrenceId);
    expect(restored.door.offerRewardSurface.rewards.map((reward) => reward.summary)).toEqual(
      retainedReward,
    );
    expect(restored.room.encounterPhases).toHaveLength(retainedEncounterCount);
    expect(restored.room.roomActions?.rows.length ?? 0).toBe(retainedActionCount);

    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 02']));
    act(() => view.application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() => expect(labels()).toEqual(['Side Room 03', 'Side Room 02', 'Side Room 07']));
  });

  it('explains a rejected side-room Visit checkbox change from the engine candidate', async () => {
    const biome = createBiomeAddress('Surface', 'N');
    let project = loadSurfaceNProject();
    for (const slotKey of ['sideDoor1', 'sideDoor2'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceIncomingReward',
        reward: createIncomingRewardAddress(biome, nLocalOccurrenceId('combat05', slotKey)),
        value: { rewardType: 'AirBoost' },
      });
    }
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const localVisit = occurrenceById(nOccurrenceId('combat05'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    )?.localVisit;
    const firstDoor = localVisit?.slots.find((slot) => slot.key === 'sideDoor1');
    if (firstDoor === undefined) throw new Error('Combat 05 side door 1 is missing');

    openRoomTab('Side Rooms');
    const remove = screen.getByRole('checkbox', {
      name: `${firstDoor.label} visit`,
    }) as HTMLInputElement;
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    fireEvent.pointerDown(remove);
    await waitFor(() => expect(remove.disabled).toBe(true));
    expect(remove.getAttribute('aria-description')).toContain('Reward unavailable from pool');
    expect(hintOf(remove)).toContain('Reward unavailable from pool');
    expect(screen.queryByText(/Reward unavailable from pool/)).toBeNull();
    const visited = screen.getByRole('list', { name: 'Visited side rooms' });
    const rows = [...visited.querySelectorAll('li')];
    const source = rows.find((row) => within(row).queryByText(firstDoor.label));
    const target = rows.find((row) => row !== source);
    if (source === undefined || target === undefined) throw new Error('Rejected move rows missing');
    mockVisitRowBounds(() => visited);
    const pointer = { pointerId: 1, isPrimary: true, button: 0, clientX: 10, clientY: 10 };
    const handle = within(source).getByRole('button', { name: `Reorder ${firstDoor.label}` });
    const targetY =
      rows.indexOf(target) * 20 + (rows.indexOf(target) < rows.indexOf(source) ? 2 : 18);
    fireEvent.pointerDown(handle, pointer);
    fireEvent.pointerMove(handle, { ...pointer, clientY: targetY });
    // Dragging over a disallowed place names why, from the engine candidate.
    await waitFor(() =>
      expect(document.querySelector('.room-action-drag-preview')?.textContent).toContain(
        'Unavailable:',
      ),
    );
    expect(document.querySelector('.room-action-drag-preview')?.textContent).toContain(
      'Reward unavailable from pool',
    );
    fireEvent.pointerUp(handle, { ...pointer, clientY: targetY });
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
  });

  it('focuses an exact Side Rooms generation finding without inner-tab session state', async () => {
    const view = renderOccurrenceWorkbench(
      withoutNFirstVisitSideRooms(loadSurfaceNOPQProject()),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat02')),
    );
    const node = occurrenceById(nOccurrenceId('combat02'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    );
    const localVisit = node?.localVisit;
    const slot = localVisit?.slots[0];
    if (localVisit === undefined || slot === undefined)
      throw new Error('Combat 02 side-room slot is missing');

    openRoomTab('Side Rooms');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceLocalVisitOrder',
          order: localVisit.order,
          occurrenceIds: [],
        }),
      ),
    );
    for (const side of localVisit.slots) {
      await view.user.click(screen.getByRole('checkbox', { name: `${side.label} generation` }));
    }
    const generation = screen.getByRole('checkbox', { name: `${slot.label} generation` });
    // Focus styling on a flagged checkbox is CSS-only (finding-overrides.css); jsdom cannot observe it.
    expect(generation.getAttribute('data-has-findings')).toBe('true');

    view.rerenderOccurrence({
      findingNavigationRevision: 1,
      initialSideRoomSlotKey: slot.key,
      initialTab: 'sideRooms',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: `${slot.label} generation` }),
    );
    expect(screen.getByLabelText(`${slot.label}: Not generated`)).toBeTruthy();

    view.rerenderOccurrence({
      findingNavigationRevision: 2,
      initialSideRoomSlotKey: slot.key,
      initialTab: 'sideRooms',
    });
    expect(document.activeElement).toBe(
      screen.getByRole('checkbox', { name: `${slot.label} generation` }),
    );
  });

  it('keeps visited-room generation disabled and explained until Visited is unchecked', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    openRoomTab('Side Rooms');
    const checkbox = screen.getByRole('checkbox', { name: 'Side Room 02 generation' });
    const control = screen.getByRole('group', { name: 'Side Room 02 generation control' });
    const before = view.application.store.getState().projectWorkspace.history!.present;
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect(hintOf(checkbox)).toBe('Uncheck Visited first.');
    expect(checkbox.getAttribute('aria-description')).toBe('Uncheck Visited first.');
    expect(hintOf(checkbox.closest('label'))).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
    await view.user.hover(control);
    expect(screen.queryByRole('tooltip')).toBeNull();
    await view.user.click(checkbox);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);
    await view.user.click(screen.getByRole('checkbox', { name: 'Side Room 02 visit' }));
    const repairedCheckbox = screen.getByRole('checkbox', { name: 'Side Room 02 generation' });
    const repairedControl = screen.getByRole('group', { name: 'Side Room 02 generation control' });
    expect((repairedCheckbox as HTMLInputElement).disabled).toBe(false);
    expect(hintOf(repairedCheckbox)).toBeNull();
    expect(repairedCheckbox.getAttribute('aria-description')).toBeNull();
    expect(repairedControl.getAttribute('tabindex')).toBeNull();
    expect(repairedControl.getAttribute('aria-describedby')).toBeNull();
    expect(screen.queryByRole('tooltip')).toBeNull();
  });

  it('composes Shop inventory and Features in Overview while keeping actions in Timeline', () => {
    const shop = enteredShopProject();
    renderStaticOccurrenceWorkbench(shop.project, 'Underworld', 'F', occurrenceById(shop.shopId));
    const inventory = screen.getByLabelText('Shop inventory');
    expect(inventory).toBeTruthy();
    const shopFeatures = screen.getByRole('tabpanel', { name: 'Room Overview' });
    expect(shopFeatures).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Features' })).toBeNull();
    openRoomTab('Room Timeline');
    const shopActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(shopActions).toBeTruthy();
    expect(screen.queryByLabelText('Shop inventory')).toBeNull();
    expect(document.querySelector('[data-overview-section]')).toBeNull();
  });
});
