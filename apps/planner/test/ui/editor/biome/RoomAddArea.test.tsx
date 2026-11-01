// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import { applyProjectCommand, createOccurrenceAddress } from '@run-planner/engine/authored-project';
import { act, cleanup, screen, waitFor, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { semanticOwnerNavigated } from '@planner/state/editorSessionSlice';
import {
  loadSurfaceNOProject,
  oBiome,
  oOccurrenceIds,
  nOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { loadSurfaceNQuickBuckCheckpoint } from '@run-planner/test-fixtures/checkpoints/surface';
import {
  createGoldenFGHIProject,
  goldenFOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench, workspaceBiome } from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import { addGroupButton, openAddGroup, timelineRow } from '@planner-test/support/timeline-rows';

afterEach(cleanup);

function room(
  biome: WorkspaceBiome,
  occurrenceId: string,
): WorkspaceOccurrenceWorkbenchNode['room'] {
  const node = biome.nodes.find(
    (candidate): candidate is WorkspaceOccurrenceWorkbenchNode =>
      candidate.kind === 'occurrenceWorkbench' && candidate.room.occurrenceId === occurrenceId,
  );
  if (node === undefined) throw new Error(`${occurrenceId} is not projected`);
  return node.room;
}

function addArea(): HTMLElement {
  return screen.getByRole('region', { name: 'Optional actions' });
}

function lineList(label: string): HTMLElement {
  return within(addArea()).getByRole('list', { name: label });
}

function shrineProject() {
  const owner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  let project = applyProjectCommand(loadSurfaceNOProject(), catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence: owner,
    present: true,
  });
  for (const [slotKey, rewardType] of [
    ['first', 'HealBigDrop'],
    ['secondLeft', 'ShopHermesUpgrade'],
    ['secondRight', 'TalentDrop'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: owner,
      slotKey,
      value: { rewardType },
    });
  }
  return project;
}

describe('Room Add area', () => {
  it('lists room objects on its Objects line', () => {
    renderOccurrenceWorkbench(
      shrineProject(),
      'Surface',
      'O',
      occurrenceById(oOccurrenceIds.combat07),
    );
    openRoomTab('Combat 1 Timeline');
    expect(within(lineList('Objects')).getByRole('button', { name: 'Hermes Shrine' })).toBeTruthy();
  });

  it('groups optional pickups by source family and appends a pick at its last legal position', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNQuickBuckCheckpoint(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceIds.opening),
    );
    openRoomTab('Room Timeline');
    // The Actions line holds one button per source family.
    expect(within(lineList('Actions')).getByRole('button', { name: 'Quick Buck' })).toBe(
      addGroupButton('Quick Buck'),
    );
    const actions = room(
      workspaceBiome(view.application, 'Surface', 'N'),
      nOccurrenceIds.opening,
    ).roomActions!;
    const pickup = actions.rows.find(
      (row) => row.rank === null && row.sourceFamily?.kind === 'trait',
    );
    if (pickup === undefined) throw new Error('Quick Buck pickup is not offered');
    const lastLegal = Math.max(
      ...actions.proposals
        .filter(
          (proposal) =>
            pickup.proposalKeys.includes(proposal.key) &&
            proposal.kind === 'insert' &&
            proposal.structurallyAuthorable,
        )
        .map((proposal) => proposal.toIndex ?? -1),
    );
    const menu = await openAddGroup(view.user, 'Quick Buck');
    const action = within(menu).getByRole('button', { name: pickup.label });
    await view.user.click(action);
    const order = view.application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes.find((biome) => biome.biomeKey === 'N')!
      .topology!.occurrences.find((candidate) => candidate.occurrenceId === nOccurrenceIds.opening)!
      .roomActions.order;
    expect(
      order.findIndex(
        (reference) => JSON.stringify(reference) === JSON.stringify(pickup.reference),
      ),
    ).toBe(lastLegal);
    expect(timelineRow(pickup.label)).toBeTruthy();
  });

  it('opens the family list of an optional action that navigation focuses', async () => {
    const view = renderOccurrenceWorkbench(
      loadSurfaceNQuickBuckCheckpoint(),
      'Surface',
      'N',
      occurrenceById(nOccurrenceIds.opening),
    );
    openRoomTab('Room Timeline');
    const pickup = room(
      workspaceBiome(view.application, 'Surface', 'N'),
      nOccurrenceIds.opening,
    ).roomActions!.rows.find((row) => row.rank === null && row.sourceFamily?.kind === 'trait');
    if (pickup === undefined) throw new Error('Quick Buck pickup is not offered');
    expect(document.querySelector('[aria-label="Add from Quick Buck"]')).toBeNull();
    act(() => view.application.store.dispatch(semanticOwnerNavigated(pickup.address)));
    await waitFor(() =>
      expect(document.querySelector('[aria-label="Add from Quick Buck"]')).not.toBeNull(),
    );
    await waitFor(() =>
      expect(document.activeElement?.getAttribute('data-room-add-action')).toBe(pickup.key),
    );
  });

  it('says so when nothing optional can be added', () => {
    renderOccurrenceWorkbench(
      createGoldenFGHIProject(),
      'Underworld',
      'F',
      occurrenceById(goldenFOccurrenceId(1, 1)),
    );
    openRoomTab('Room Timeline');
    expect(within(addArea()).getByText('Nothing optional to add here')).toBeTruthy();
    expect(within(addArea()).queryByRole('list')).toBeNull();
  });
});
