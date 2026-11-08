// @vitest-environment jsdom

import { act, cleanup, fireEvent, screen, waitFor, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createAdditionalExitAddress,
  createBiomeAddress,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';

import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';
import { roomMapAssetFor } from '@planner/ui/room-maps/roomMapAssets';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

import {
  createGoldenFGHIProject,
  goldenFOccurrenceId,
  goldenFStartId,
  goldenHBiome,
  replaceNemesisRandomEventInteraction,
} from '@run-planner/test-fixtures/underworld';
import {
  loadSurfaceNProject,
  loadSurfaceNOPQProject,
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

beforeAll(function prepareImmutableRepresentativeProjects() {
  createGoldenFGHIProject();
  loadSurfaceNOPQProject();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

describe('OccurrenceWorkbench', () => {
  it('shows its room map beside the Timeline and marks the row the map reflects', async () => {
    const occurrenceId = goldenFOccurrenceId(1, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
      undefined,
      { initialTab: 'actions' },
    );
    const node = workspaceBiome(view.application, 'Underworld', 'F').nodes.find(
      (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
        candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
    );
    if (node === undefined) throw new Error('ordinary entered occurrence is missing');
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;

    expect(screen.getByRole('region', { name: `${node.room.label} map` })).toBeTruthy();
    expect(screen.queryByRole('button', { name: `View map of ${node.room.label}` })).toBeNull();
    const rows = [...screen.getByRole('list', { name: 'Room timeline' }).children];
    expect(rows.some((row) => row.hasAttribute('data-map-shown'))).toBe(false);

    await view.user.click(rows[0]!);
    expect(rows.filter((row) => row.hasAttribute('data-map-shown'))).toEqual([rows[0]]);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
  });

  it('shows every Chaos point while the gate position is picked, previewing the highlighted one', async () => {
    const occurrenceId = goldenFOccurrenceId(4, 1);
    const occurrence = createOccurrenceAddress(createBiomeAddress('Underworld', 'F'), occurrenceId);
    const withRoom = applyProjectCommand(createGoldenFGHIProject(), catalog, {
      kind: 'ReplaceOccurrenceRoom',
      occurrence,
      gameName: 'F_Combat17',
    });
    const project = applyProjectCommand(withRoom, catalog, {
      kind: 'AddChaos',
      additional: createAdditionalExitAddress(
        createBiomeAddress('Underworld', 'F'),
        occurrenceId,
        'chaos',
      ),
      occurrenceId: createOccurrenceId('map-preview-chaos'),
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    const map = screen
      .getAllByRole('region')
      .find((region) => region.getAttribute('aria-label')?.endsWith(' map'))!;
    const points = () => within(map).queryAllByRole('img', { name: /^Chaos gate position/ });
    const previewed = () =>
      points()
        .filter((point) => point.hasAttribute('data-preview'))
        .map((point) => point.getAttribute('aria-label'));
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;
    expect(points()).toEqual([]);

    await view.user.click(screen.getByRole('button', { name: 'Chaos Gate position' }));
    expect(points().length).toBeGreaterThan(1);
    expect(previewed()).toEqual([]);
    await view.user.keyboard('{ArrowDown}');
    expect(previewed()).toEqual(['Chaos gate position 1']);
    await view.user.keyboard('{Escape}');
    expect(points()).toEqual([]);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );
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
    // The Overview reads in game order: the entry, what stands, what it holds, where it stands.
    expect(
      within(standardFeatures)
        .getAllByRole('heading', { level: 5 })
        .map((heading) => heading.textContent),
    ).toEqual(
      ['Encounter', 'Spawns', 'Offers', 'Layout'].filter((name) =>
        within(standardFeatures).queryByRole('region', { name }),
      ),
    );
    const present = within(standardFeatures).getByRole('region', { name: 'Spawns' });
    for (const line of ['Exits', 'Objects', 'Resources'])
      expect(within(present).getByRole('group', { name: line })).toBeTruthy();
    expect(within(standardFeatures).getByRole('region', { name: 'Layout' })).toBeTruthy();
    expect(document.querySelector('.room-overview-workbench')).not.toBeNull();
    expect(screen.queryByRole('tab', { name: 'Room Doors' })).toBeNull();
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
    const standardStart = within(standardActions).getByLabelText('Encounter started');
    // A phase without events shows only its banner; identity stays in Overview.
    expect(within(standardActions).queryByRole('group', { name: / (start|end)$/ })).toBeNull();
    const standardEncounter = within(standardStart).getByRole('button', {
      name: `Encounter started: ${overviewEncounterLabel}`,
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
    // The doors open on the Timeline, after the encounter.
    expectBefore(standardEnd, within(standardActions).getByLabelText('Doors open'));
  });

  it('gives each H Fields slot its own point row on the Overview, with no Layout tab', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'H',
      occurrenceById(createOccurrenceId('golden-h-combat02')),
    );

    // Tabs show short names; their accessible names stay the full ones.
    expect(
      screen.getAllByRole('tab').map((tab) => tab.getAttribute('aria-label') ?? tab.textContent),
    ).toEqual(['Room Overview', 'Room Timeline']);
    openRoomTab('Room Overview');
    const positions = screen.getByRole('region', { name: 'Layout' });
    expect(within(positions).getAllByRole('button', { name: /^Cage \d, point / })).not.toHaveLength(
      0,
    );
    expect(
      within(positions).getAllByRole('button', { name: /^Optional \d, point / }),
    ).not.toHaveLength(0);
    expect(positions.textContent).not.toMatch(/\b\d{5,}\b/);
  });

  it('offers a cage only the points no other slot holds, as one edit', async () => {
    const occurrenceId = createOccurrenceId('golden-h-combat02');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    let project = createGoldenFGHIProject();
    for (const [index, pointId] of [621502, 622508].entries())
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(occurrence, {
          kind: 'cage',
          slotKey: `cage${index + 1}`,
        }),
        pointId,
      });
    const view = renderOccurrenceWorkbench(
      project,
      'Underworld',
      'H',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');
    const room = occurrenceById(occurrenceId)(
      workspaceBiome(view.application, 'Underworld', 'H'),
    )!.room;
    if (room.roomLocal.kind !== 'fields') throw new Error('H Fields room is missing');
    const choices = room.roomLocal.spatial.find(
      (control) => control.target.kind === 'cage',
    )!.pointChoices;
    const labelOf = (pointId: number) => choices.find((choice) => choice.value === pointId)!.label;
    const free = choices.find(
      (choice) => choice.value !== null && choice.value !== 621502 && choice.value !== 622508,
    )!;
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;

    await view.user.click(screen.getByRole('button', { name: /^Cage 1, point / }));
    const listbox = await screen.findByRole('listbox');
    await waitFor(() =>
      expect(within(listbox).queryByRole('option', { name: labelOf(622508) })).toBeNull(),
    );
    await view.user.click(within(listbox).getByRole('option', { name: free.label }));

    const spatial = () => {
      const present = view.application.store.getState().projectWorkspace.history!.present;
      const edited = present.route.biomes
        .find((biome) => biome.biomeKey === 'H')!
        .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!;
      if (!('spatial' in edited.state)) throw new Error('H Fields state is missing');
      return edited.state.spatial;
    };
    expect(spatial().cagePointIdBySlot.cage1).toBe(free.value);
    expect(spatial().cagePointIdBySlot.cage2).toBe(622508);
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
  });

  it('marks a duplicate placement on the slot row', () => {
    const occurrenceId = createOccurrenceId('golden-h-combat05');
    const occurrence = createOccurrenceAddress(goldenHBiome, occurrenceId);
    let project = createGoldenFGHIProject();
    for (const slotKey of ['cage1', 'cage2'])
      project = applyProjectCommand(project, catalog, {
        kind: 'ReplaceFieldsSpatialPoint',
        spatial: createFieldsSpatialAddress(occurrence, { kind: 'cage', slotKey }),
        pointId: 573087,
      });
    renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(occurrenceId));
    openRoomTab('Room Overview');

    expect(
      screen
        .getByRole('button', { name: /^Cage 2, point / })
        .closest('[data-has-findings]')
        ?.getAttribute('data-has-findings'),
    ).toBe('true');
  });

  it('keeps the Nemesis off a pickup point its source excludes', async () => {
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
    openRoomTab('Room Overview');

    await view.user.click(screen.getByRole('button', { name: /^Nemesis, point / }));
    await view.user.click(await screen.findByRole('button', { name: /^Unavailable/ }));

    expect(screen.getByRole('option', { name: /^4/ }).getAttribute('aria-disabled')).toBe('true');
  });

  it('chooses an entry in a room whose flip rolls, authoring the flip it needs', async () => {
    const occurrenceId = goldenFOccurrenceId(7, 1);
    const view = renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(occurrenceId),
    );
    openRoomTab('Room Overview');

    await view.user.click(screen.getByRole('button', { name: /^Entry/ }));
    await view.user.click(screen.getByRole('option', { name: /Flipped/ }));

    const present = view.application.store.getState().projectWorkspace.history!.present;
    const edited = present.route.biomes
      .find((biome) => biome.biomeKey === 'F')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === occurrenceId)!;
    expect(edited.layout).toMatchObject({ flipped: true });
    expect(edited.layout?.entryStartPointId).toBeDefined();
    expect(screen.getByRole('button', { name: /^Entry/ }).textContent).toContain('⇋');
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
      const start = within(actions).getByLabelText('Encounter started');
      const end = within(actions).getByLabelText('Encounter ended');
      expectBefore(pickup, start);
      expectBefore(start, end);
      expect(within(actions).queryByText('Outgoing generation')).toBeNull();
    },
  );

  it('supports roving keyboard activation across the room workbench tabs', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const overview = screen.getByRole('tab', { name: 'Room Overview' });
    const actions = screen.getByRole('tab', { name: 'Room Timeline' });
    const panelId = overview.getAttribute('aria-controls');
    expect(panelId).not.toBeNull();
    const panel = panelId === null ? null : document.getElementById(panelId);
    expect(panel).not.toBeNull();
    for (const tab of [overview, actions]) {
      expect(tab.getAttribute('aria-controls')).toBe(panelId);
    }
    expect(overview.getAttribute('tabindex')).toBe('0');
    fireEvent.keyDown(overview, { key: 'ArrowRight' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(actions, { key: 'Home' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(overview);
    fireEvent.keyDown(overview, { key: 'End' });
    expect(actions.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(actions);
    expect(document.getElementById(panelId!)).toBe(panel);
    fireEvent.keyDown(actions, { key: 'ArrowLeft' });
    expect(overview.getAttribute('aria-selected')).toBe('true');
    expect(document.activeElement).toBe(overview);
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

  it('edits N side doors among its Overview spawns and shows their state on its map', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    expect(screen.queryByRole('tab', { name: 'Side Rooms' })).toBeNull();
    const spawns = screen.getByRole('region', { name: 'Spawns' });
    const sideDoors = within(spawns).getByRole('region', { name: 'Side doors' });
    // Its hidden return door sits with its doors on the Timeline, not here.
    expect(within(sideDoors).queryByRole('article', { name: 'Hidden return door' })).toBeNull();
    let generation = within(sideDoors).getByRole('checkbox', { name: 'Open Side Room 03' });
    expect((generation as HTMLInputElement).checked).toBe(true);
    const historyBefore = view.application.store.getState().projectWorkspace.history!.past.length;

    // The main room's map shows each side door's state at its map door.
    await view.user.click(within(sideDoors).getByRole('button', { name: 'View map of Combat 05' }));
    const dialog = await screen.findByRole('dialog');
    expect(within(dialog).getByRole('img', { name: 'Map of Combat 05' }).getAttribute('src')).toBe(
      roomMapAssetFor('N_Combat05')?.src,
    );
    const mapPoints = within(dialog).getByRole('group', { name: 'Combat 05 map points' });
    expect(within(mapPoints).getByRole('img', { name: 'Side Room 03 · Not visited' })).toBeTruthy();
    expect(within(mapPoints).queryByRole('button')).toBeNull();
    fireEvent.keyDown(dialog, { key: 'Escape' });
    await waitFor(() => expect(screen.queryByRole('dialog')).toBeNull());
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore,
    );

    generation = screen.getByRole('checkbox', { name: 'Open Side Room 03' });
    await view.user.click(generation);
    await waitFor(() =>
      expect((screen.getByLabelText('Open Side Room 03') as HTMLInputElement).checked).toBe(false),
    );
    const sideRow = screen.getByRole('article', { name: 'Side Room 03 door' });
    // A closed door has no reward editor.
    expect(within(sideRow).getByText('Door closed')).toBeTruthy();
    expect(within(sideRow).queryByRole('button', { name: /^Reward(: |$)/ })).toBeNull();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 1,
    );
    act(() => screen.getByRole('checkbox', { name: 'Open Side Room 03' }).focus());
    await view.user.keyboard(' ');
    await waitFor(() =>
      expect((screen.getByLabelText('Open Side Room 03') as HTMLInputElement).checked).toBe(true),
    );
    expect(
      within(screen.getByRole('article', { name: 'Side Room 03 door' })).getByRole('button', {
        name: /^Reward(: |$)/,
      }),
    ).toBeTruthy();
    expect(view.application.store.getState().projectWorkspace.history!.past).toHaveLength(
      historyBefore + 2,
    );
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect((screen.getByLabelText('Open Side Room 03') as HTMLInputElement).checked).toBe(true),
    );
  });

  it('shows an N main room with its side doors on its map, each previewed from its row', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const map = screen.getByRole('region', { name: 'Combat 05 map' });
    const points = within(map).getByRole('group', { name: 'Combat 05 map points' });
    expect(within(points).getByRole('img', { name: 'Side Room 07 · Visit 1' })).toBeTruthy();
    expect(within(points).getByRole('img', { name: 'Door 1' })).toBeTruthy();
    const door = within(points).getByRole('img', { name: 'Side Room 03 · Not visited' });
    expect(door.dataset.preview).toBeUndefined();
    fireEvent.pointerEnter(screen.getByRole('article', { name: 'Side Room 03 door' }));
    expect(door.dataset.preview).toBe('true');
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
      const control = screen.getByRole('checkbox', { name: `Open ${side.label}` });
      expect((control as HTMLInputElement).disabled).toBe(false);
      await view.user.click(control);
      expect((control as HTMLInputElement).checked).toBe(false);
    }
    const checkbox = screen.getByRole('checkbox', { name: `Open ${slot.label}` });
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

  it('keeps a visited side door open and explained until its visit is removed', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const checkbox = screen.getByRole('checkbox', { name: 'Open Side Room 02' });
    const before = view.application.store.getState().projectWorkspace.history!.present;
    expect((checkbox as HTMLInputElement).disabled).toBe(true);
    expect(hintOf(checkbox)).toBe('Remove its visit first.');
    expect(checkbox.getAttribute('aria-description')).toBe('Remove its visit first.');
    await view.user.click(checkbox);
    expect(view.application.store.getState().projectWorkspace.history!.present).toBe(before);
    const localVisit = occurrenceById(nOccurrenceId('combat05'))(
      workspaceBiome(view.application, 'Surface', 'N'),
    )?.localVisit;
    const visited = localVisit?.slots.find((slot) => slot.label === 'Side Room 02');
    if (localVisit === undefined || visited === undefined)
      throw new Error('Combat 05 Side Room 02 is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched({
          kind: 'ReplaceLocalVisitOrder',
          order: localVisit.order,
          occurrenceIds: localVisit.visitOrder.filter((id) => id !== visited.occurrenceId),
        }),
      ),
    );
    const repaired = screen.getByRole('checkbox', { name: 'Open Side Room 02' });
    expect((repaired as HTMLInputElement).disabled).toBe(false);
    expect(hintOf(repaired)).toBeNull();
    expect(repaired.getAttribute('aria-description')).toBeNull();
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
