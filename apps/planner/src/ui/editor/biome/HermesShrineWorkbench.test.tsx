// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import {
  authoredProjectReplaced,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import { loadSurfaceNOProject, oBiome, oOccurrenceIds } from '@run-planner/test-fixtures/surface';
import {
  renderOccurrenceWorkbench,
  workspaceBiome,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { RouteShrinesPanel } from '@planner/ui/shell/RouteShrinesPanel';

afterEach(cleanup);

function occurrence(
  occurrenceId: string,
): (biome: WorkspaceBiome) => WorkspaceOccurrenceWorkbenchNode | undefined {
  return (biome) =>
    biome.nodes.find(
      (node): node is WorkspaceOccurrenceWorkbenchNode =>
        node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId,
    );
}

function completeOrdinaryShrine(project = loadSurfaceNOProject()): ProjectDocument {
  const owner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
  let next = applyProjectCommand(project, catalog, {
    kind: 'SetHermesShrinePresence',
    occurrence: owner,
    present: true,
  });
  for (const [slotKey, rewardType] of [
    ['first', 'HealBigDrop'],
    ['secondLeft', 'ShopHermesUpgrade'],
    ['secondRight', 'TalentDrop'],
  ] as const) {
    next = applyProjectCommand(next, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: owner,
      slotKey,
      value: { rewardType },
    });
  }
  return next;
}

function openOverview(): void {
  fireEvent.click(screen.getByRole('tab', { name: 'Room Overview' }));
}

describe('Hermes Shrine workbench', () => {
  it('adds an eligible ordinary Shrine, exposes all inventory, and undoes the semantic edit', async () => {
    const application = createApplication();
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOProject(),
      'Surface',
      'O',
      occurrence(oOccurrenceIds.combat07),
      application,
    );
    openOverview();
    const presence = screen.getByRole('checkbox', { name: 'Hermes Shrine present' });
    expect((presence as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByRole('checkbox', { name: /Interact.*Hermes Shrine/i })).toBeNull();

    await view.user.click(presence);
    expect(
      screen.getAllByRole('button', { name: /^Hermes Shrine Offer [123] Item$/ }),
    ).toHaveLength(3);
    expect(
      occurrence(oOccurrenceIds.combat07)(
        workspaceBiome(application, 'Surface', 'O'),
      )?.room.workbench.features.find((feature) => feature.kind === 'hermesShrine'),
    ).toMatchObject({ presence: { kind: 'optionalPresent' } });

    act(() => application.store.dispatch(authoredProjectUndoRequested()));
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Hermes Shrine present' }) as HTMLInputElement)
          .checked,
      ).toBe(false),
    );
    act(() => application.store.dispatch(authoredProjectRedoRequested()));
    await waitFor(() =>
      expect(
        (screen.getByRole('checkbox', { name: 'Hermes Shrine present' }) as HTMLInputElement)
          .checked,
      ).toBe(true),
    );
  });

  it('projects purchase detail and attaches rushed pickup resolution to its one timeline row', async () => {
    const application = createApplication();
    const view = renderOccurrenceWorkbench(
      completeOrdinaryShrine(),
      'Surface',
      'O',
      occurrence(oOccurrenceIds.combat07),
      application,
    );
    openOverview();
    expect(
      screen.getAllByRole('button', { name: /^Hermes Shrine Offer [123] Item$/ }),
    ).toHaveLength(3);
    expect(screen.queryByText(/^HealBigDrop$/)).toBeNull();
    const inactiveDelay = screen.getByRole('combobox', {
      name: 'Hermes Shrine Offer 1 delivery delay',
    });
    const inactiveRush = screen.getByRole('checkbox', { name: 'Rush Hermes Shrine Offer 1' });
    expect(inactiveDelay).toHaveProperty('disabled', true);
    expect(inactiveDelay).toHaveProperty('value', '2');
    expect(inactiveRush).toHaveProperty('disabled', true);
    expect(inactiveRush).toHaveProperty('checked', false);

    const purchased = screen.getByRole('checkbox', { name: 'Purchased Hermes Shrine Offer 1' });
    await view.user.click(purchased);
    const offerRow = purchased.closest<HTMLElement>('.hermes-shrine-slot');
    if (offerRow === null) throw new Error('Hermes Shrine Offer 1 row is missing');
    expect(inactiveDelay).toHaveProperty('disabled', false);
    expect(inactiveRush).toHaveProperty('disabled', false);
    expect(
      (
        within(offerRow).getByRole('combobox', {
          name: 'Hermes Shrine Offer 1 delivery delay',
        }) as HTMLSelectElement
      ).value,
    ).toBe('2');
    await view.user.click(
      within(offerRow).getByRole('checkbox', { name: 'Rush Hermes Shrine Offer 1' }),
    );

    const room = occurrence(oOccurrenceIds.combat07)(
      workspaceBiome(application, 'Surface', 'O'),
    )?.room;
    const purchaseRow = room?.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'purchaseHermesShrineOffer' &&
        row.reference.generationKey === 'initial:first',
    );
    expect(purchaseRow?.label).toBe('Buy Big Heal');
    expect(purchaseRow?.rewardPayload?.control.offer).toMatchObject({ rewardType: 'HealBigDrop' });
  });

  it('keeps forced Shrine inventory visible and non-removable', () => {
    const postbossId = `surface-o-preboss:postboss`;
    renderOccurrenceWorkbench(loadSurfaceNOProject(), 'Surface', 'O', occurrence(postbossId));
    openOverview();
    const presence = screen.getByRole('checkbox', { name: 'Hermes Shrine present' });
    expect(presence).toHaveProperty('checked', true);
    expect(presence).toHaveProperty('disabled', true);
    expect(
      screen.getAllByRole('button', { name: /^Hermes Shrine Offer [123] Item$/ }),
    ).toHaveLength(3);
  });

  it('disables Add at an ineligible absent ordinary host', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOProject(),
      'Surface',
      'O',
      occurrence(oOccurrenceIds.combat01),
    );
    openOverview();
    const presence = screen.getByRole('checkbox', { name: 'Hermes Shrine present' });
    expect((presence as HTMLInputElement).checked).toBe(false);
    expect((presence as HTMLInputElement).disabled).toBe(true);
  });

  it('keeps refill delay editable without exposing Rush', () => {
    const owner = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = completeOrdinaryShrine();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineTravelDealRefill',
      occurrence: owner,
      value: { rewardType: 'ArmorBoost' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: owner,
      generationKey: 'travelDealRefill',
      purchase: { delay: 4, rushed: false },
    });
    renderOccurrenceWorkbench(project, 'Surface', 'O', occurrence(oOccurrenceIds.combat07));
    openOverview();

    const delay = screen.getByRole('combobox', {
      name: 'Hermes Shrine Travel Deal delivery delay',
    });
    expect((delay as HTMLSelectElement).disabled).toBe(false);
    expect((delay as HTMLSelectElement).value).toBe('4');
    expect(screen.queryByRole('checkbox', { name: 'Rush Hermes Shrine Travel Deal' })).toBeNull();
    expect(within(delay).getAllByRole('option')).toHaveLength(7);
  });

  it('indexes only present Shrines and navigates to their owning room', async () => {
    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(completeOrdinaryShrine()));
    const route = workspaceProjection(application).routes.find(
      (candidate) => candidate.routeKey === 'Surface',
    );
    if (route === undefined) throw new Error('Surface route is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <RouteShrinesPanel route={route} />
      </Provider>,
    );

    const inspect = screen.getAllByRole('button', { name: 'Inspect Shrine' });
    expect(inspect).toHaveLength(3);
    expect(screen.queryByText('HealBigDrop')).toBeNull();
    await user.click(inspect[1]!);
    expect(application.store.getState().editorSession.activePanelByRoute.Surface).toEqual({
      kind: 'biome',
      biomeKey: 'O',
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat07,
    });
  });
});
