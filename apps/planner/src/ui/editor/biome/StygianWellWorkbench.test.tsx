// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { cleanup, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { createApplication } from '@planner/composition/createApplication';
import { workspaceProjection } from '@planner-test/support/biome-workbench';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { RouteWellsPanel } from '@planner/ui/shell/RouteWellsPanel';
import { goldenFBiome, loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const postbossId = createOccurrenceId('completion:F:postboss');

function occurrence(biome: WorkspaceBiome): WorkspaceOccurrenceWorkbenchNode | undefined {
  return biome.nodes.find(
    (node): node is WorkspaceOccurrenceWorkbenchNode =>
      node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === postbossId,
  );
}

function authoredWell(): ProjectDocument {
  const owner = createOccurrenceAddress(goldenFBiome, postbossId);
  let project = applyProjectCommand(loadUnderworldFGProject(), catalog, {
    kind: 'SetStygianWellInteraction',
    occurrence: owner,
    interacted: true,
  });
  for (const [slotKey, itemKey] of [
    ['healing', 'ArmorBoostStore'],
    ['secondLeft', 'RandomStoreItem'],
    ['secondRight', 'TemporaryBoonRarityTrait'],
  ] as const) {
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: owner,
      slotKey,
      itemKey,
    });
  }
  return project;
}

describe('Stygian Well workbench', () => {
  it('authors ordinary presence separately from interaction', async () => {
    const project = loadUnderworldFGProject();
    const occurrenceId = project.routes
      .find((route) => route.routeKey === 'Underworld')
      ?.biomes.find((biome) => biome.biomeKey === 'F')
      ?.topology?.occurrences.find((room) => {
        const host = catalog.rooms.byKey[room.gameName]?.roomShop;
        return host !== undefined && host.forced !== true;
      })?.occurrenceId;
    if (occurrenceId === undefined) throw new Error('ordinary F Well host is missing');
    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', (biome) =>
      biome.nodes.find(
        (node): node is WorkspaceOccurrenceWorkbenchNode =>
          node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
      ),
    );
    const presence = screen.getByRole('checkbox', { name: 'Stygian Well present' });
    expect((presence as HTMLInputElement).checked).toBe(false);
    expect((presence as HTMLInputElement).disabled).toBe(false);

    await view.user.click(presence);
    expect(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' })).toBeTruthy();
    expect(screen.queryAllByRole('combobox', { name: /^Stygian Well / })).toHaveLength(0);
  });

  it('keeps forced presence fixed and gates exact inventory behind Interact', async () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldFGProject(),
      'Underworld',
      'F',
      occurrence,
    );
    expect(screen.queryByRole('checkbox', { name: 'Stygian Well present' })).toBeNull();
    expect(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' })).toBeTruthy();
    expect(screen.queryAllByRole('combobox', { name: /^Stygian Well / })).toHaveLength(0);

    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' }));
    expect(screen.getAllByRole('combobox', { name: /^Stygian Well / })).toHaveLength(3);
  });

  it('shows Twist only for a purchased Twist generation and clears purchase intent on exit', async () => {
    const view = renderOccurrenceWorkbench(authoredWell(), 'Underworld', 'F', occurrence);
    expect(
      screen.queryByRole('combobox', { name: 'Stygian Well Second Left Twist result' }),
    ).toBeNull();

    await view.user.click(
      screen.getByRole('checkbox', { name: 'Purchase Stygian Well Second Left' }),
    );
    expect(
      screen.getByRole('combobox', { name: 'Stygian Well Second Left Twist result' }),
    ).toBeTruthy();

    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' }));
    expect(screen.queryAllByRole('combobox', { name: /^Stygian Well / })).toHaveLength(0);
  });

  it('repairs a retained purchased generation without discarding its dormant Twist result', async () => {
    const owner = createOccurrenceAddress(goldenFBiome, postbossId);
    let project = applyProjectCommand(authoredWell(), catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: owner,
      generationKey: 'initial:secondLeft',
      purchased: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTwistResult',
      occurrence: owner,
      generationKey: 'initial:secondLeft',
      itemKey: 'HealDropRange',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellOffer',
      occurrence: owner,
      slotKey: 'secondLeft',
      itemKey: null,
    });

    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrence);
    const purchase = screen.getByRole('checkbox', {
      name: 'Purchase Stygian Well Second Left',
    });
    const offer = screen.getByRole('combobox', { name: 'Stygian Well Second Left' });
    expect((purchase as HTMLInputElement).checked).toBe(true);
    expect((offer as HTMLSelectElement).value).toBe('');
    expect(
      screen.queryByRole('combobox', { name: 'Stygian Well Second Left Twist result' }),
    ).toBeNull();

    await view.user.selectOptions(offer, 'RandomStoreItem');
    const twist = screen.getByRole('combobox', {
      name: 'Stygian Well Second Left Twist result',
    });
    expect((twist as HTMLSelectElement).value).toBe('HealDropRange');
  });

  it('indexes present Wells and navigates to the owning room', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(authoredWell()));
    const route = workspaceProjection(application).routes.find(
      (candidate) => candidate.routeKey === 'Underworld',
    );
    if (route === undefined) throw new Error('Underworld route is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <RouteWellsPanel route={route} />
      </Provider>,
    );

    const inspect = screen.getAllByRole('button', { name: 'Inspect Well' });
    expect(inspect).toHaveLength(2);
    expect(screen.getByText(/RandomStoreItem/)).toBeTruthy();
    await user.click(inspect[0]!);
    expect(application.store.getState().editorSession.activePanelByRoute.Underworld).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      kind: 'occurrence',
      occurrenceId: postbossId,
    });
  });
});
