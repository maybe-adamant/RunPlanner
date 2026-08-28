// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, render, screen, waitFor, within } from '@testing-library/react';
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
    const presence = screen.getByRole('checkbox', { name: 'Hermes Shrine present' });
    expect((presence as HTMLInputElement).disabled).toBe(false);
    expect(screen.queryByRole('checkbox', { name: /Interact.*Hermes Shrine/i })).toBeNull();

    await view.user.click(presence);
    expect(screen.getAllByRole('button', { name: /^Hermes Shrine (First|Second)/ })).toHaveLength(
      3,
    );
    expect(
      occurrence(oOccurrenceIds.combat07)(
        workspaceBiome(application, 'Surface', 'O'),
      )?.room.workbench.features.find((feature) => feature.kind === 'hermesShrine'),
    ).toMatchObject({ present: true });

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
    expect(screen.getAllByRole('button', { name: /^Hermes Shrine (First|Second)/ })).toHaveLength(
      3,
    );
    expect(screen.queryByText(/^HealBigDrop$/)).toBeNull();
    expect(
      screen.queryByRole('combobox', { name: 'Hermes Shrine First delivery delay' }),
    ).toBeNull();
    expect(screen.queryByRole('checkbox', { name: 'Rush Hermes Shrine First' })).toBeNull();

    await view.user.click(screen.getByRole('checkbox', { name: 'Purchase Hermes Shrine First' }));
    expect(
      (
        screen.getByRole('combobox', {
          name: 'Hermes Shrine First delivery delay',
        }) as HTMLSelectElement
      ).value,
    ).toBe('2');
    await view.user.click(screen.getByRole('checkbox', { name: 'Rush Hermes Shrine First' }));

    const room = occurrence(oOccurrenceIds.combat07)(
      workspaceBiome(application, 'Surface', 'O'),
    )?.room;
    const purchaseRow = room?.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'purchaseHermesShrineOffer' &&
        row.reference.generationKey === 'initial:first',
    );
    expect(purchaseRow?.rewardPayload?.control.offer).toMatchObject({ rewardType: 'HealBigDrop' });
  });

  it('keeps forced Shrine inventory visible and non-removable', () => {
    const postbossId = `surface-o-preboss:postboss`;
    renderOccurrenceWorkbench(loadSurfaceNOProject(), 'Surface', 'O', occurrence(postbossId));
    expect(screen.queryByRole('checkbox', { name: 'Hermes Shrine present' })).toBeNull();
    expect(screen.getAllByRole('button', { name: /^Hermes Shrine (First|Second)/ })).toHaveLength(
      3,
    );
  });

  it('disables Add at an ineligible absent ordinary host', () => {
    renderOccurrenceWorkbench(
      loadSurfaceNOProject(),
      'Surface',
      'O',
      occurrence(oOccurrenceIds.combat01),
    );
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

    const delay = screen.getByRole('combobox', {
      name: 'Hermes Shrine Travel Deal refill delivery delay',
    });
    expect((delay as HTMLSelectElement).disabled).toBe(false);
    expect((delay as HTMLSelectElement).value).toBe('4');
    expect(
      screen.queryByRole('checkbox', { name: 'Rush Hermes Shrine Travel Deal refill' }),
    ).toBeNull();
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
