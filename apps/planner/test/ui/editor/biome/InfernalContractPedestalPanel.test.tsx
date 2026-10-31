// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createExitSelectionAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, screen, within } from '@testing-library/react';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { loadUnderworldZagreusContractCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import { goldenGBiome } from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';
import { hintOf } from '@planner-test/support/hints';
import { pickRoomObjectAction } from '@planner-test/support/occurrence-workbench';
import { queryTimelineRow, timelineRow } from '@planner-test/support/timeline-rows';

afterEach(cleanup);

const shopId = createOccurrenceId('zagreus-contract-preboss-shop');
const peerId = createOccurrenceId('zagreus-contract-preboss-peer');

function select(occurrenceId: string) {
  return (biome: WorkspaceBiome) =>
    biome.nodes.find(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
    );
}

/** The checkpoint with its boon-form Preboss door entered instead of the Shop form. */
function boonForm(): ProjectDocument {
  return applyProjectCommand(loadUnderworldZagreusContractCheckpoint(), catalog, {
    kind: 'SetExitSelection',
    selection: createExitSelectionAddress(goldenGBiome, {
      kind: 'occurrence',
      occurrenceId: createOccurrenceId('zagreus-contract-return'),
    }),
    value: { kind: 'normal', exitKey: 'exit2' },
  });
}

function pedestal(): HTMLElement {
  fireEvent.click(screen.getByRole('tab', { name: 'Room Overview' }));
  return screen.getByRole('group', { name: 'Pedestal configuration' });
}

describe('Pedestal panel', () => {
  it('picks the boon-form pedestal item, then collects it from its Timeline entry', async () => {
    const view = renderOccurrenceWorkbench(boonForm(), 'Underworld', 'G', select(peerId));
    const panel = pedestal();
    // The Overview authors the item only.
    expect(within(panel).queryByRole('checkbox')).toBeNull();
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const entry = screen.getByRole('button', { name: 'Pedestal' });
    expect(entry).toHaveProperty('disabled', true);
    expect(hintOf(entry)).toBe('Choose the Pedestal item first.');

    await view.user.click(within(pedestal()).getByRole('button', { name: /^Pedestal/ }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Big Pom of Power'));
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    await pickRoomObjectAction(view.user, 'Pedestal', 'Collect Double Pom');
    const row = timelineRow('Collect Double Pom');
    // Collected: nothing more to do, and the row deletes the collect.
    expect(screen.getByRole('button', { name: 'Pedestal' })).toHaveProperty('disabled', true);
    expect(hintOf(screen.getByRole('button', { name: 'Pedestal' }))).toBe('Already collected.');
    await view.user.click(within(row).getByRole('button', { name: /^Remove .* from timeline$/ }));
    expect(queryTimelineRow('Collect Double Pom')).toBeNull();
  });

  it('shows the Shop-form pedestal as a room object outside the Shop inventory', () => {
    renderOccurrenceWorkbench(
      loadUnderworldZagreusContractCheckpoint(),
      'Underworld',
      'G',
      select(shopId),
    );
    const panel = pedestal();
    expect(
      within(screen.getByRole('region', { name: 'Shop inventory' })).queryByText(/Contract/),
    ).toBeNull();
    const picker = within(panel).getByRole('button', { name: /^Pedestal/ });
    // The Overview names the pedestal by its Champion of Elysium icon and label.
    const label = panel.querySelector(`label[for="${picker.id}"]`);
    expect(label?.textContent).toBe('Pedestal');
    expect(label?.querySelector('img')).not.toBeNull();
    expect(within(panel).queryByRole('checkbox')).toBeNull();
  });

  it('resolves a Mystery item’s source on its Timeline row', async () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldZagreusContractCheckpoint(),
      'Underworld',
      'G',
      select(shopId),
    );
    await view.user.click(within(pedestal()).getByRole('button', { name: /^Pedestal/ }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Mystery Boon'));
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const row = timelineRow(/^Collect Mystery Boon/);
    await view.user.click(within(row).getByRole('button', { name: 'Reward' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Zeus'));
    const resolved = timelineRow(/^Collect Mystery Boon/);
    expect(within(resolved).getByText(/Zeus/)).toBeTruthy();
  });
});
