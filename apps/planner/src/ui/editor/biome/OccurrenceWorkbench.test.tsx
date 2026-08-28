// @vitest-environment jsdom

import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import type { ProjectDocument } from '@run-planner/engine/authored-project';
import { Provider } from 'react-redux';
import { afterEach, beforeAll, describe, expect, it, vi } from 'vitest';

import type { WorkspaceOccurrenceWorkbenchNode } from '@planner/projections/structured-workspace';

import { OccurrenceWorkbench } from '@planner/ui/editor/biome/OccurrenceWorkbench';

import {
  createGoldenFGHIProject,
  goldenFOccurrenceId,
  goldenFStartId,
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

  it('renders Standard workbench tabs and places encounter/actions in the Actions tab', () => {
    renderStaticOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    const standardFeatures = screen.getByLabelText('Room features');
    expect(standardFeatures).toBeTruthy();
    expect(screen.getByRole('tab', { name: 'Room Overview' }).getAttribute('aria-selected')).toBe(
      'true',
    );
    expect(screen.getByRole('tab', { name: 'Room Doors' })).toBeTruthy();
    const overviewRunState = screen.getByRole('button', { name: 'Run State' });
    const entryOwner = overviewRunState.getAttribute('data-run-state-launcher');
    expect(overviewRunState.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Room Timeline');
    const standardActions = screen.getByRole('region', { name: 'Room Timeline' });
    const standardStart = within(standardActions).getByLabelText('Start encounter');
    const standardEncounter = within(standardActions).getByLabelText('Encounter encounter phase');
    const standardEnd = within(standardActions).getByLabelText('End encounter');
    const roomEntered = within(standardActions).getByLabelText('Room entered');
    const entryRunState = screen.getByRole('button', { name: 'Run State' });
    expect(entryRunState.getAttribute('data-run-state-launcher')).toBe(entryOwner);
    expect(entryRunState.closest('.room-tab-utility-bar')).not.toBeNull();
    expectBefore(entryRunState, roomEntered);
    expectBefore(standardStart, standardEncounter);
    expectBefore(standardEncounter, standardEnd);
    openRoomTab('Room Doors');
    expect(
      within(screen.getByRole('tabpanel', { name: 'Room Doors' })).getByRole('button', {
        name: 'Run State',
      }),
    ).toBeTruthy();
    expect(
      screen.getByRole('button', { name: 'Run State' }).closest('.room-tab-utility-bar'),
    ).not.toBeNull();
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
      const pickup = within(actions).getByText(/^Interact with .* pickup/);
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
    expect(overview.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Intro Timeline');
    const intro = screen.getByRole('button', { name: 'Run State' });
    expect(intro.getAttribute('data-run-state-launcher')).toBe(introOwner);
    expect(intro.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Combat 1 Timeline');
    const combat1 = screen.getByRole('button', { name: 'Run State' });
    expect(combat1.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(combat1.closest('.room-tab-utility-bar')).not.toBeNull();
    openRoomTab('Room Doors');
    const doors = screen.getByRole('button', { name: 'Run State' });
    expect(doors.getAttribute('data-run-state-launcher')).not.toBe(introOwner);
    expect(doors.closest('.room-tab-utility-bar')).not.toBeNull();
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
    const biome = workspace.routes
      .find((route) => route.routeKey === 'Surface')
      ?.biomes.find((candidate) => candidate.biomeKey === 'O');
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

  it('keeps N side-room generation in Overview and Room Timeline in its own tab', () => {
    renderStaticOccurrenceWorkbench(
      loadSurfaceNOPQProject(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceId('combat05')),
    );
    const sideRooms = screen.getByLabelText('Ephyra side rooms');
    expect(sideRooms).toBeTruthy();
    openRoomTab('Room Timeline');
    const nActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(nActions).toBeTruthy();
    expect(within(nActions).getByLabelText('Encounter encounter phase')).toBeTruthy();
  });

  it('renders Shop inventory before Room features and Room Timeline', () => {
    const shop = enteredShopProject();
    renderStaticOccurrenceWorkbench(shop.project, 'Underworld', 'F', occurrenceById(shop.shopId));
    const inventory = screen.getByLabelText('Shop inventory and conditions');
    const shopFeatures = screen.getByLabelText('Room features');
    expectBefore(inventory, shopFeatures);
    openRoomTab('Room Timeline');
    const shopActions = screen.getByRole('region', { name: 'Room Timeline' });
    expect(shopActions).toBeTruthy();
  });
});
