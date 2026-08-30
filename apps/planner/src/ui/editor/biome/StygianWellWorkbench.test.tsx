// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { createApplication } from '@planner/composition/createApplication';
import { projectRouteStygianWellIndex } from '@planner/projections/routeRoomFeatureIndex';
import { workspaceBiome, workspaceProjection } from '@planner-test/support/biome-workbench';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { RouteWellsPanel } from '@planner/ui/shell/RouteWellsPanel';
import { goldenFBiome, loadUnderworldFGProject } from '@run-planner/test-fixtures/underworld';
import { renderOccurrenceWorkbench } from '@planner-test/support/biome-workbench';

afterEach(cleanup);

const postbossId = createOccurrenceId('golden-f-preboss-shop:postboss');

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

function openOverview(): void {
  fireEvent.click(screen.getByRole('tab', { name: 'Room Overview' }));
}

describe('Stygian Well workbench', () => {
  it('authors ordinary presence separately from interaction', async () => {
    const project = loadUnderworldFGProject();
    const occurrenceId = project.route.biomes
      .find((biome) => biome.biomeKey === 'F')
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
    openOverview();
    const presence = screen.getByRole('checkbox', { name: 'Stygian Well present' });
    expect((presence as HTMLInputElement).checked).toBe(false);
    expect((presence as HTMLInputElement).disabled).toBe(false);

    await view.user.click(presence);
    expect(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /^Stygian Well / })).toHaveLength(0);
  });

  it('keeps forced presence fixed and gates exact inventory behind Interact', async () => {
    const view = renderOccurrenceWorkbench(
      loadUnderworldFGProject(),
      'Underworld',
      'F',
      occurrence,
    );
    openOverview();
    const presence = screen.getByRole('checkbox', { name: 'Stygian Well present' });
    expect(presence).toHaveProperty('checked', true);
    expect(presence).toHaveProperty('disabled', true);
    expect(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' })).toBeTruthy();
    expect(screen.queryAllByRole('button', { name: /^Stygian Well / })).toHaveLength(0);

    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' }));
    expect(screen.getAllByRole('button', { name: /^Stygian Well / })).toHaveLength(3);
  });

  it('retains an authored refill as selected-invalid when reached assessment has no refill capability', async () => {
    const owner = createOccurrenceAddress(goldenFBiome, postbossId);
    let project = applyProjectCommand(loadUnderworldFGProject(), catalog, {
      kind: 'SetStygianWellInteraction',
      occurrence: owner,
      interacted: true,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: owner,
      itemKey: 'ArmorBoostStore',
    });

    const view = renderOccurrenceWorkbench(project, 'Underworld', 'F', occurrence);
    openOverview();
    const picker = screen.getByRole('button', { name: 'Stygian Well Travel Deal Item' });
    await view.user.click(picker);
    const choice = await screen.findByRole('option', { name: /Splintered Shield/ });
    expect(picker.getAttribute('data-candidate-state')).toBe('impossible');
    expect(screen.getByText('Current selection')).toBeTruthy();
    expect(choice.getAttribute('data-candidate-state')).toBe('impossible');
    expect(choice.getAttribute('aria-disabled')).toBe('true');
  });

  it('shows Twist only for a purchased Twist generation and clears purchase intent on exit', async () => {
    const view = renderOccurrenceWorkbench(authoredWell(), 'Underworld', 'F', occurrence);
    openOverview();
    expect(screen.queryByRole('button', { name: 'Stygian Well Offer 2 Twist result' })).toBeNull();

    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Stygian Well Offer 2' }));
    expect(screen.getByRole('button', { name: 'Stygian Well Offer 2 Twist result' })).toBeTruthy();
    const purchaseRow = occurrence(
      workspaceBiome(view.application, 'Underworld', 'F'),
    )?.room.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'purchaseStygianWellOffer' &&
        row.reference.generationKey === 'initial:secondLeft',
    );
    expect(purchaseRow?.label).toBe('Buy Fateful Twist');

    await view.user.click(screen.getByRole('checkbox', { name: 'Interact with Stygian Well' }));
    expect(screen.queryAllByRole('button', { name: /^Stygian Well / })).toHaveLength(0);
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
    openOverview();
    const purchase = screen.getByRole('checkbox', {
      name: 'Purchased Stygian Well Offer 2',
    });
    const offer = screen.getByRole('button', { name: 'Stygian Well Offer 2 Item' });
    expect((purchase as HTMLInputElement).checked).toBe(true);
    expect(offer.textContent).toContain('Unresolved');
    expect(screen.queryByRole('button', { name: 'Stygian Well Offer 2 Twist result' })).toBeNull();

    await view.user.click(offer);
    await view.user.click(screen.getByRole('option', { name: 'Fateful Twist' }));
    const twist = screen.getByRole('button', {
      name: 'Stygian Well Offer 2 Twist result',
    });
    expect(twist.textContent).toContain('Life Essence');
  });

  it('indexes present Wells and navigates to the owning room', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(authoredWell()));
    const route = workspaceProjection(application).route;
    if (route === undefined) throw new Error('Underworld route is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <RouteWellsPanel rows={projectRouteStygianWellIndex(route)} />
      </Provider>,
    );

    const inspect = screen.getAllByRole('button', { name: 'Inspect Well' });
    expect(inspect).toHaveLength(2);
    expect(screen.getByText(/Fateful Twist/)).toBeTruthy();
    await user.click(inspect[0]!);
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'F',
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      kind: 'occurrence',
      occurrenceId: postbossId,
    });
  });
});
