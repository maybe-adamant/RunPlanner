// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { createApplication } from '@planner/composition/createApplication';
import { projectRouteStygianWellIndex } from '@planner/projections/routeRoomFeatureIndex';
import { renderWorkspace, workspaceProjection } from '@planner-test/support/biome-workbench';
import { semanticOwnerFocused } from '@planner/state/editorSessionSlice';
import { authoredProjectReplaced } from '@planner/state/projectWorkspaceSlice';
import { RouteWellsPanel } from '@planner/ui/shell/RouteWellsPanel';
import {
  createUnderworldFWellCheckpoint,
  goldenFBiome,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
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

  it('keeps an inactive purchased refill repairable and hides it after clearing Purchased', async () => {
    const owner = createOccurrenceAddress(goldenFBiome, postbossId);
    let project = applyProjectCommand(authoredWell(), catalog, {
      kind: 'ReplaceStygianWellTravelDealRefill',
      occurrence: owner,
      itemKey: 'ArmorBoostStore',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetStygianWellPurchase',
      occurrence: owner,
      generationKey: 'travelDealRefill',
      purchased: true,
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
    await view.user.keyboard('{Escape}');
    await view.user.click(
      screen.getByRole('checkbox', { name: 'Purchased Stygian Well Travel Deal' }),
    );
    expect(screen.queryByRole('button', { name: 'Stygian Well Travel Deal Item' })).toBeNull();
  });

  it('hides a dormant refill when the last initial purchase is cleared and restores it on purchase', async () => {
    const owner = createOccurrenceAddress(goldenFBiome, postbossId);
    let project = createUnderworldFWellCheckpoint();
    for (const generationKey of ['initial:secondRight', 'travelDealRefill'] as const) {
      project = applyProjectCommand(project, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: owner,
        generationKey,
        purchased: false,
      });
    }
    const view = renderOccurrenceWorkbench(
      authorLegalTraitOffers(project),
      'Underworld',
      'F',
      occurrence,
    );
    openOverview();
    const refillLabel = screen.getByRole('button', {
      name: 'Stygian Well Travel Deal Item',
    }).textContent;
    const purchase = screen.getByRole('checkbox', { name: 'Purchased Stygian Well Offer 2' });
    await view.user.click(purchase);
    expect(screen.queryByRole('button', { name: 'Stygian Well Travel Deal Item' })).toBeNull();
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
          (room) => room.occurrenceId === postbossId,
        )?.stygianWell?.travelDealRefillKey,
    ).toBe('ExtendedShopTrait');
    await view.user.click(purchase);
    expect(screen.getByRole('button', { name: 'Stygian Well Travel Deal Item' }).textContent).toBe(
      refillLabel,
    );
  });

  it.each([
    ['initial:secondLeft', 'Purchase Slot 2 Offer'],
    ['travelDealRefill', 'Purchase Travel Deal Offer'],
  ] as const)(
    'shows and retains the %s Twist result on its Timeline action',
    async (generationKey, label) => {
      const owner = createOccurrenceAddress(goldenFBiome, postbossId);
      const inventory =
        generationKey === 'initial:secondLeft'
          ? authoredWell()
          : applyProjectCommand(createUnderworldFWellCheckpoint(false), catalog, {
              kind: 'ReplaceStygianWellTravelDealRefill',
              occurrence: owner,
              itemKey: 'RandomStoreItem',
            });
      const purchased = applyProjectCommand(inventory, catalog, {
        kind: 'SetStygianWellPurchase',
        occurrence: owner,
        generationKey,
        purchased: true,
      });
      const view = renderWorkspace(purchased, 'Underworld', 'F');
      act(() =>
        view.application.store.dispatch(
          semanticOwnerFocused(
            createRoomFeatureAddress(owner, {
              kind: 'stygianWellTwist',
              generationKey,
            }),
          ),
        ),
      );
      expect(
        screen.queryByRole('button', { name: 'Stygian Well Offer 2 Twist result' }),
      ).toBeNull();
      const picker = screen.getByRole('button', {
        name: `${label} · Fateful Twist Twist result`,
      });
      await view.user.click(picker);
      const result = screen
        .getAllByRole('option')
        .find((option) => option.getAttribute('data-selected-value') === 'false');
      if (result === undefined || result.textContent === null)
        throw new Error('Twist result missing');
      const resultLabel = result.textContent;
      await view.user.click(result);
      expect(picker.textContent).toContain(resultLabel);
      await view.user.click(picker);
      expect(
        screen.getByRole('option', { name: resultLabel }).getAttribute('data-selected-value'),
      ).toBe('true');
    },
  );

  it('clears an incompatible retained Twist result when its parent item is replaced', async () => {
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
    expect(screen.queryByRole('button', { name: /Twist result$/ })).toBeNull();

    await view.user.click(offer);
    await view.user.click(screen.getByRole('option', { name: 'Fateful Twist' }));
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
          (room) => room.occurrenceId === postbossId,
        )?.stygianWell?.twistResultKeyBySlot?.secondLeft,
    ).toBeUndefined();
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
