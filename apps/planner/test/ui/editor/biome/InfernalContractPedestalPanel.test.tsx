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
  return screen.getByRole('group', { name: 'Champion Item configuration' });
}

describe('Champion Item panel', () => {
  it('picks and collects the boon-form pedestal item', async () => {
    const view = renderOccurrenceWorkbench(boonForm(), 'Underworld', 'G', select(peerId));
    const panel = pedestal();
    const collect = within(panel).getByRole('checkbox', { name: 'Collect Champion Item' });
    expect(collect).toHaveProperty('disabled', true);

    await view.user.click(within(panel).getByRole('button', { name: /^Champion Item/ }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Big Pom of Power'));
    const chosen = pedestal();
    const enabled = within(chosen).getByRole('checkbox', {
      name: 'Collect Champion Item',
    });
    expect(enabled).toHaveProperty('disabled', false);
    await view.user.click(enabled);
    expect(
      within(pedestal()).getByRole('checkbox', { name: 'Collect Champion Item' }),
    ).toHaveProperty('checked', true);

    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    expect(screen.getAllByText('Collect Double Pom · Champion Item').length).toBeGreaterThan(0);
  });

  it('shows the Shop-form pedestal as a room object outside the Shop inventory', async () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldZagreusContractCheckpoint(),
      'Underworld',
      'G',
      select(shopId),
    );
    const panel = pedestal();
    expect(
      within(screen.getByRole('region', { name: 'Shop inventory' })).queryByText(/Contract/),
    ).toBeNull();
    const collect = within(panel).getByRole('checkbox', { name: 'Collect Champion Item' });
    expect(collect).toHaveProperty('checked', true);
    await view.user.click(collect);
    expect(
      within(pedestal()).getByRole('checkbox', { name: 'Collect Champion Item' }),
    ).toHaveProperty('checked', false);
  });

  it('resolves a Mystery item’s source on its Timeline row', async () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldZagreusContractCheckpoint(),
      'Underworld',
      'G',
      select(shopId),
    );
    await view.user.click(within(pedestal()).getByRole('button', { name: /^Champion Item/ }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Mystery Boon'));
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const row = screen.getByText('Collect Mystery Boon · Champion Item').closest('li');
    if (row === null) throw new Error('Mystery collect row missing');
    await view.user.click(within(row).getByRole('button', { name: 'Reward' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Zeus'));
    const resolved = screen.getByText('Collect Mystery Boon · Champion Item').closest('li');
    expect(within(resolved!).getByText(/Zeus/)).toBeTruthy();
  });
});
