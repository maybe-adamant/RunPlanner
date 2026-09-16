// @vitest-environment jsdom

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import {
  applyProjectCommand,
  createEncounterPhaseAddress,
  createFieldsSpatialAddress,
  createNemesisRandomEventAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { catalog } from '@run-planner/hades2-catalog';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';

import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';

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
  nOccurrenceId,
  nOccurrenceIds,
  oOccurrenceIds,
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

let immutableRepresentativeNOPQProject: ProjectDocument;

beforeAll(function prepareImmutableRepresentativeProjects() {
  createGoldenFGHIProject();
  immutableRepresentativeNOPQProject = loadSurfaceNOPQProject();
});

afterEach(() => {
  cleanup();
  vi.restoreAllMocks();
  delete (document as unknown as { elementFromPoint?: Document['elementFromPoint'] })
    .elementFromPoint;
});

describe('OccurrenceWorkbench', () => {
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
        name: new RegExp(`^Entering ${node.room.label}`),
      }),
    ).toBeTruthy();
    expect(document.querySelector('.room-card-heading .room-kind')).toBeNull();
    expect(screen.queryByLabelText('Room')).toBeNull();
  });

  it('renders Standard room contents in Overview and encounter actions in Timeline', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    const standardFeatures = screen.getByLabelText('Room features');
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
    openRoomTab('Room Timeline');
    const standardActions = screen.getByRole('region', { name: 'Room Timeline' });
    const standardStart = within(standardActions).getByLabelText('Start encounter');
    const standardEncounter = within(standardActions).getByLabelText('Encounter encounter phase');
    const standardEnd = within(standardActions).getByLabelText('End encounter');
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

    expect(screen.getAllByRole('tab').map((tab) => tab.textContent)).toEqual([
      'Room Overview',
      'Room Layout',
      'Room Timeline',
      'Room Doors',
    ]);
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
      within(screen.getByLabelText('Encounter structure')).getByText('Nemesis Event'),
    ).toBeTruthy();
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
    'renders the %s Opening pickup before Start encounter and End encounter',
    (_name, project, routeKey, biomeKey, occurrenceId) => {
      renderStaticOccurrenceWorkbench(project(), routeKey, biomeKey, occurrenceById(occurrenceId));
      openRoomTab('Room Timeline');
      const actions = screen.getByRole('region', { name: 'Room Timeline' });
      const pickup = within(actions).getByText(/^Interact /);
      const start = within(actions).getByLabelText('Start encounter');
      const end = within(actions).getByLabelText('End encounter');
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

  it('keeps N side-room generation in Overview and encounter actions in Timeline', () => {
    renderStaticOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const sideRooms = screen.getByLabelText('Ephyra side rooms');
    expect(sideRooms).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Side Rooms' })).toBeNull();
    openRoomTab('Room Timeline');
    const nActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(nActions).toBeTruthy();
    expect(within(nActions).getByLabelText('Encounter encounter phase')).toBeTruthy();
  });

  it('composes Shop inventory and Features in Overview while keeping actions in Timeline', () => {
    const shop = enteredShopProject();
    renderStaticOccurrenceWorkbench(shop.project, 'Underworld', 'F', occurrenceById(shop.shopId));
    const inventory = screen.getByLabelText('Shop inventory and conditions');
    expect(inventory).toBeTruthy();
    const shopFeatures = screen.getByLabelText('Room features');
    expect(shopFeatures).toBeTruthy();
    expect(screen.queryByRole('tab', { name: 'Features' })).toBeNull();
    openRoomTab('Room Timeline');
    const shopActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(shopActions).toBeTruthy();
    expect(screen.queryByLabelText('Shop inventory and conditions')).toBeNull();
    expect(screen.queryByLabelText('Room features')).toBeNull();
  });
});
