// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createRoomFeatureAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, within } from '@testing-library/react';
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
  goldenFOccurrenceId,
  loadUnderworldFGProject,
} from '@run-planner/test-fixtures/underworld';
import { loadUnderworldFStygianWellCheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
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

function openTimeline(): void {
  fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
}

describe('Stygian Well workbench', () => {
  it('authors ordinary presence separately from interaction', async () => {
    const project = loadUnderworldFGProject();
    const occurrenceId = goldenFOccurrenceId(3, 1);
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

  it('removes a refill purchased without Travel Deal from its own timeline row', async () => {
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
    expect(screen.queryByRole('button', { name: 'Stygian Well Travel Deal Item' })).toBeNull();
    // The refill's finding lands on its purchase row while no line hosts the refill.
    const refillOffer = createRoomFeatureAddress(owner, {
      kind: 'stygianWellOffer',
      generationKey: 'travelDealRefill',
    });
    expect(
      workspaceProjection(view.application).focusByOwner.get(semanticAddressKey(refillOffer)),
    ).toMatchObject({ roomTab: 'actions', focusAddress: { kind: 'roomAction' } });

    openTimeline();
    expect(screen.queryByRole('listitem', { name: 'Travel Deal' })).toBeNull();
    const refillRow = screen.getByText(/· Travel Deal Offer$/).closest('li')!;
    const remove = within(refillRow).getByRole('button', { name: /^Remove .* from timeline$/ });
    expect(remove).toHaveProperty('disabled', false);
    await view.user.click(remove);
    const well = view.application.store
      .getState()
      .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
        (room) => room.occurrenceId === postbossId,
      )?.stygianWell;
    expect(well?.purchasedGenerationKeys ?? []).not.toContain('travelDealRefill');
    expect(well?.travelDealRefillKey).toBe('ArmorBoostStore');
  });

  it('authors the refill under the first purchase row and hides it when that purchase is cleared', async () => {
    const owner = createOccurrenceAddress(goldenFBiome, postbossId);
    let project = loadUnderworldFStygianWellCheckpoint();
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
    expect(screen.queryByRole('button', { name: 'Stygian Well Travel Deal Item' })).toBeNull();
    openTimeline();
    const line = screen.getByRole('listitem', { name: 'Travel Deal' });
    expect(line.previousElementSibling?.textContent).toContain('Slot 2');
    const refillLabel = within(line).getByRole('button', {
      name: 'Stygian Well Travel Deal Item',
    }).textContent;
    expect(
      within(line).getByRole('checkbox', { name: 'Purchased Stygian Well Travel Deal' }),
    ).toHaveProperty('checked', false);

    openOverview();
    const purchase = screen.getByRole('checkbox', { name: 'Purchased Stygian Well Offer 2' });
    await view.user.click(purchase);
    openTimeline();
    expect(screen.queryByRole('listitem', { name: 'Travel Deal' })).toBeNull();
    expect(
      view.application.store
        .getState()
        .projectWorkspace.history!.present.route.biomes[0]!.topology!.occurrences.find(
          (room) => room.occurrenceId === postbossId,
        )?.stygianWell?.travelDealRefillKey,
    ).toBe('ExtendedShopTrait');
    openOverview();
    await view.user.click(screen.getByRole('checkbox', { name: 'Purchased Stygian Well Offer 2' }));
    openTimeline();
    expect(
      within(screen.getByRole('listitem', { name: 'Travel Deal' })).getByRole('button', {
        name: 'Stygian Well Travel Deal Item',
      }).textContent,
    ).toBe(refillLabel);
  });

  it.each([
    ['initial:secondLeft', 'Slot 2'],
    ['travelDealRefill', 'Travel Deal Offer'],
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
        name: `Buy Fateful Twist · ${label} Twist result`,
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
