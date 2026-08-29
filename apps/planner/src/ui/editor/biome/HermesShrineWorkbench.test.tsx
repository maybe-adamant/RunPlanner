// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  hermesShrineDeliveryEntryKey,
  createOccurrenceAddress,
  createOccurrenceId,
  createTraitOfferAddress,
  semanticAddressKey,
  type ProjectDocument,
} from '@run-planner/engine/authored-project';
import { act, cleanup, fireEvent, render, screen, waitFor, within } from '@testing-library/react';
import userEvent from '@testing-library/user-event';
import { Provider } from 'react-redux';
import { afterEach, describe, expect, it } from 'vitest';

import { createApplication } from '@planner/composition/createApplication';
import { candidateSupport } from '@planner/projections/candidateProjection';
import {
  authoredProjectCommandDispatched,
  authoredProjectReplaced,
  authoredProjectRedoRequested,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';
import type {
  WorkspaceBiome,
  WorkspaceOccurrenceWorkbenchNode,
} from '@planner/projections/structured-workspace';
import {
  loadSurfaceNOProject,
  nBiome,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
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
    const deliveryRow = room?.roomActions?.rows.find(
      (row) =>
        row.reference.kind === 'interactAcquisitionEntry' &&
        row.reference.siteKey === 'hermesShrineDelivery' &&
        row.reference.entryKey ===
          hermesShrineDeliveryEntryKey(
            createOccurrenceAddress(createBiomeAddress('Surface', 'O'), oOccurrenceIds.combat07),
            'initial:first',
          ),
    );
    expect(deliveryRow?.label).toContain('Big Heal');
    expect(deliveryRow?.rewardPayload?.control.offer).toMatchObject({ rewardType: 'HealBigDrop' });
  });

  it('authors Mystery Boon identity in inventory and its god only at rushed acquisition', async () => {
    const application = createApplication();
    const postbossId = createOccurrenceId('surface-n-preboss:postboss');
    const view = renderOccurrenceWorkbench(
      loadSurfaceNOProject(),
      'Surface',
      'N',
      occurrence(postbossId),
      application,
    );
    const owner = createOccurrenceAddress(nBiome, postbossId);
    const currentOccurrence = () =>
      application.store
        .getState()
        .projectWorkspace.history.present.routes.find((route) => route.routeKey === 'Surface')
        ?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === postbossId);

    openOverview();
    await view.user.click(screen.getByRole('button', { name: 'Hermes Shrine Offer 3 Item' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Mystery Boon'));
    expect(currentOccurrence()?.hermesShrine?.offerBySlot.secondRight).toEqual({
      rewardType: 'BlindBoxLoot',
    });
    expect(currentOccurrence()?.acquisitionSites?.hermesShrineDelivery).toBeUndefined();
    expect(screen.queryByText('Eventual God')).toBeNull();

    await view.user.click(
      screen.getByRole('checkbox', { name: 'Purchased Hermes Shrine Offer 3' }),
    );
    await view.user.click(screen.getByRole('checkbox', { name: 'Rush Hermes Shrine Offer 3' }));
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const entryKey = hermesShrineDeliveryEntryKey(owner, 'initial:secondRight');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(owner, 'hermesShrineDelivery'),
      entryKey,
    );
    const sourceInteraction = workspaceProjection(application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (sourceInteraction === undefined)
      throw new Error('rushed Mystery Boon source editor is missing');
    const sourceDomain = await sourceInteraction.load();
    const sourceModel = sourceInteraction.model(sourceDomain, 'source', {
      rewardType: 'BlindBoxLoot',
    });
    expect(
      sourceModel.sections
        .flatMap((section) => section.items)
        .find((item) => item.label === 'Apollo'),
    ).toMatchObject({ state: 'possible', disabled: false });

    const purchaseRow = screen.getByText('Buy Mystery Boon').closest('li');
    if (purchaseRow === null) throw new Error('rushed Mystery Boon purchase row is missing');
    await view.user.click(within(purchaseRow).getByRole('button', { name: 'Reward' }));
    expect(await screen.findByText('Eventual God')).toBeTruthy();
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Apollo'));

    await waitFor(() =>
      expect(
        currentOccurrence()?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]
          ?.offer,
      ).toEqual({
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ApolloUpgrade' },
      }),
    );

    const resolvedPurchaseRow = screen.getByText('Buy Mystery Boon').closest('li');
    if (resolvedPurchaseRow === null)
      throw new Error('resolved rushed Mystery Boon purchase row is missing');
    await view.user.click(within(resolvedPurchaseRow).getByRole('button', { name: 'Reward' }));
    expect(await screen.findByText('Eventual God')).toBeTruthy();
    expect(screen.queryByText('Reward type')).toBeNull();
    await view.user.click(screen.getByRole('button', { name: 'Cancel' }));

    const hiddenSource = workspaceProjection(application).interactions.traitOffers.get(
      semanticAddressKey(createTraitOfferAddress(entry, 'hiddenSource')),
    );
    const hiddenSourceDraft = hiddenSource?.traitsStartingDraft?.();
    if (hiddenSource === undefined)
      throw new Error('rushed Mystery Boon hidden-source editor is missing');
    if (hiddenSourceDraft === undefined)
      throw new Error('rushed Mystery Boon hidden-source draft is missing');
    expect(candidateSupport(hiddenSource.load(hiddenSourceDraft)[0])).toBe('possible');
    act(() =>
      application.store.dispatch(
        authoredProjectCommandDispatched(hiddenSource.intentFor(hiddenSourceDraft).command),
      ),
    );
    expect(
      currentOccurrence()?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]
        ?.traitOffersByAcquisitionRole.hiddenSource,
    ).toEqual(hiddenSourceDraft);
    expect(() => workspaceProjection(application)).not.toThrow();
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
