// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBiomeAddress,
  createRewardWheelOfferAddress,
  decodeProjectDocument,
  encodeProjectDocument,
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
import { projectRouteHermesShrineIndex } from '@planner/projections/routeRoomFeatureIndex';
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
  createSurfaceNShrineSideRoomDeliveryCheckpoint,
  nBiome,
  nLocalOccurrenceId,
  nOccurrenceId,
  oBiome,
  oOccurrenceIds,
} from '@run-planner/test-fixtures/surface';
import { supportedTraitOffer } from '@run-planner/test-fixtures/shared';
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
    expect(deliveryRow?.label).toBe('Receive Big Heal');
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
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'N')
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

    const deliveryRow = screen.getByText('Receive Mystery Boon').closest('li');
    if (deliveryRow === null) throw new Error('rushed Mystery Boon delivery row is missing');
    await view.user.click(within(deliveryRow).getByRole('button', { name: 'Reward' }));
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

    const resolvedDeliveryRow = screen.getByText(/^Receive Mystery Boon/).closest('li');
    if (resolvedDeliveryRow === null)
      throw new Error('resolved rushed Mystery Boon delivery row is missing');
    expect(resolvedDeliveryRow.getAttribute('data-inline-layout')).toBe('mystery-boon');
    expect(within(resolvedDeliveryRow).queryByText('Receive Mystery Boon · Apollo')).toBeNull();
    const inlineEditors = resolvedDeliveryRow.querySelector<HTMLElement>(
      ':scope > .room-action-controls > .room-action-inline-editors',
    );
    if (inlineEditors === null) throw new Error('Mystery Boon inline editors are missing');
    const sourcePicker = within(inlineEditors).getByRole('button', { name: 'Reward' });
    expect(sourcePicker.textContent).toContain('Apollo');
    expect(sourcePicker.textContent).not.toContain('Mystery Boon');
    expect(within(inlineEditors).getByRole('button', { name: /Trait/ })).toBeTruthy();
    expect(
      resolvedDeliveryRow
        .querySelector(':scope > .acquisition-entry-resolution')
        ?.getAttribute('data-empty'),
    ).toBe('true');
    await view.user.click(within(resolvedDeliveryRow).getByRole('button', { name: 'Reward' }));
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
    await waitFor(() =>
      expect(within(inlineEditors).getByRole('button', { name: /Edit Trait/ })).toBeTruthy(),
    );
    expect(() => workspaceProjection(application)).not.toThrow();
  });

  it('keeps an unplaced delayed Mystery delivery placement-only until its host action exists', async () => {
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const host = createOccurrenceAddress(oBiome, oOccurrenceIds.devotion);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondRight');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    let project = completeOrdinaryShrine();
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'BlindBoxLoot' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondRight',
      purchase: { delay: 2, rushed: false },
    });
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrence(oOccurrenceIds.devotion),
    );
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const delivery = screen.getByText('Receive Mystery Boon').closest('li');
    if (delivery === null) throw new Error('unplaced Mystery delivery row is missing');
    expect(within(delivery).queryByRole('button', { name: 'Reward' })).toBeNull();
    await view.user.click(
      within(delivery).getByRole('button', { name: 'Place required delivery' }),
    );
    const placedDelivery = await screen.findByText('Receive Mystery Boon');
    const placedDeliveryRow = placedDelivery.closest('li');
    if (placedDeliveryRow === null) throw new Error('placed Mystery delivery row is missing');

    const sourceInteraction = workspaceProjection(view.application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (sourceInteraction === undefined)
      throw new Error('placed delayed Mystery Boon source editor is missing');
    const sourceDomain = await sourceInteraction.load();
    const sourceModel = sourceInteraction.model(sourceDomain, 'source', {
      rewardType: 'BlindBoxLoot',
    });
    expect(
      sourceModel.sections
        .flatMap((section) => section.items)
        .find((item) => item.label === 'Apollo'),
    ).toMatchObject({ state: 'possible', disabled: false });

    await view.user.click(within(placedDeliveryRow).getByRole('button', { name: 'Reward' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Apollo'));
    const hiddenSource = workspaceProjection(view.application).interactions.traitOffers.get(
      semanticAddressKey(createTraitOfferAddress(entry, 'hiddenSource')),
    );
    const hiddenSourceDraft = hiddenSource?.traitsStartingDraft?.();
    if (hiddenSource === undefined || hiddenSourceDraft === undefined)
      throw new Error('placed delayed Mystery Boon trait editor is missing');
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(hiddenSource.intentFor(hiddenSourceDraft).command),
      ),
    );
    expect(() => workspaceProjection(view.application)).not.toThrow();
  });

  it('keeps a reloaded Mystery delivery repairable after its earlier God leaves the pool', async () => {
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    const hostId = oOccurrenceIds.devotion;
    const host = createOccurrenceAddress(oBiome, hostId);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondRight');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    let project = completeOrdinaryShrine();
    const fourthGodReward = createRewardWheelOfferAddress(
      oBiome,
      oOccurrenceIds.combat04,
      'wheel1',
      'offer1',
    );
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: fourthGodReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' } },
    });
    const fourthGodTrait = createTraitOfferAddress(fourthGodReward, 'source');
    const fourthGodOffer = supportedTraitOffer(project, fourthGodTrait, 'Aphrodite');
    if (fourthGodOffer === undefined) throw new Error('fourth God reward has no Aphrodite offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: fourthGodTrait,
      value: fourthGodOffer,
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceHermesShrineOffer',
      occurrence: source,
      slotKey: 'secondRight',
      value: { rewardType: 'BlindBoxLoot' },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:secondRight',
      purchase: { delay: 2, rushed: false },
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'PlaceHermesShrineDelivery',
      entry,
      encounterPhaseKey: 'Encounter',
    });
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceAcquisitionEntryOffer',
      entry,
      value: {
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
      },
    });
    const mysteryTrait = createTraitOfferAddress(entry, 'hiddenSource');
    const aphroditeMysteryOffer = supportedTraitOffer(project, mysteryTrait, 'Aphrodite');
    if (aphroditeMysteryOffer === undefined)
      throw new Error('delayed Mystery Boon has no Aphrodite trait offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: mysteryTrait,
      value: aphroditeMysteryOffer,
    });

    project = decodeProjectDocument(JSON.parse(encodeProjectDocument(project)), catalog);
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceRewardWheelOffer',
      offer: fourthGodReward,
      value: { rewardType: 'Boon', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
    });
    const earlierTrait = createTraitOfferAddress(fourthGodReward, 'source');
    const zeusOffer = supportedTraitOffer(project, earlierTrait, 'Zeus');
    if (zeusOffer === undefined) throw new Error('replacement wheel has no Zeus trait offer');
    project = applyProjectCommand(project, catalog, {
      kind: 'ReplaceTraitOffer',
      trait: earlierTrait,
      value: zeusOffer,
    });

    const application = createApplication();
    application.store.dispatch(authoredProjectReplaced(project));
    const interaction = workspaceProjection(application).interactions.rewards.get(
      semanticAddressKey(entry),
    );
    if (interaction === undefined) throw new Error('reloaded Mystery delivery editor is missing');
    const domain = await interaction.load();
    const model = interaction.model(domain, 'source', {
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'AphroditeUpgrade' },
    });
    expect(
      model.sections.flatMap((section) => section.items).find((item) => item.label === 'Aphrodite'),
    ).toMatchObject({ state: 'impossible', disabled: true });
    expect(
      model.sections.flatMap((section) => section.items).find((item) => item.label === 'Zeus'),
    ).toMatchObject({ state: 'possible', disabled: false });

    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrence(hostId),
      application,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const delivery = screen.getByText(/^Receive Mystery Boon/).closest('li');
    if (delivery === null) throw new Error('reloaded Mystery delivery row is missing');
    await view.user.click(within(delivery).getByRole('button', { name: 'Reward' }));
    await view.user.click(within(await screen.findByRole('listbox')).getByText('Zeus'));
    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'O')
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === hostId)
          ?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]?.offer,
      ).toMatchObject({
        rewardType: 'BlindBoxLoot',
        payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
      }),
    );
  });

  it('places a matured delayed delivery from its required host timeline row', async () => {
    const source = createOccurrenceAddress(oBiome, oOccurrenceIds.combat07);
    let project = completeOrdinaryShrine();
    project = applyProjectCommand(project, catalog, {
      kind: 'SetHermesShrinePurchase',
      occurrence: source,
      generationKey: 'initial:first',
      purchase: { delay: 2, rushed: false },
    });
    const application = createApplication();
    const hostId = oOccurrenceIds.devotion;
    const view = renderOccurrenceWorkbench(
      project,
      'Surface',
      'O',
      occurrence(hostId),
      application,
    );

    await view.user.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const deliveryRow = screen.getByText('Receive Big Heal').closest('li');
    if (deliveryRow === null) throw new Error('delayed delivery row is missing');
    expect(within(deliveryRow).queryByRole('button', { name: 'Remove action' })).toBeNull();
    await view.user.click(
      within(deliveryRow).getByRole('button', { name: 'Place required delivery' }),
    );

    await waitFor(() =>
      expect(screen.queryByRole('button', { name: 'Place required delivery' })).toBeNull(),
    );
    const host = application.store
      .getState()
      .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'O')
      ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === hostId);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:first');
    expect(host?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey]).toMatchObject({
      offer: { rewardType: 'HealBigDrop' },
    });
    expect(host?.roomActions.order).toContainEqual({
      kind: 'interactAcquisitionEntry',
      siteKey: 'hermesShrineDelivery',
      entryKey,
      encounterPhaseKey: 'Encounter',
    });
  });

  it('keeps a visited N side-room Shrine source and its empty later delivery host distinct', async () => {
    const sourceId = nLocalOccurrenceId('combat11', 'sideDoor1');
    const hostId = nOccurrenceId('combat09');
    const source = createOccurrenceAddress(nBiome, sourceId);
    const host = createOccurrenceAddress(nBiome, hostId);
    const entryKey = hermesShrineDeliveryEntryKey(source, 'initial:secondLeft');
    const entry = createAcquisitionEntryAddress(
      createAcquisitionSiteAddress(host, 'hermesShrineDelivery'),
      entryKey,
    );
    const application = createApplication();
    const view = renderOccurrenceWorkbench(
      createSurfaceNShrineSideRoomDeliveryCheckpoint(),
      'Surface',
      'N',
      occurrence(hostId),
      application,
    );
    fireEvent.click(screen.getByRole('tab', { name: /Timeline$/ }));
    const delivery = screen.getByText('Receive Max Health').closest('li');
    if (delivery === null) throw new Error('N side-room delivery row is missing');
    expect(within(delivery).getByRole('button', { name: 'Place required delivery' })).toBeTruthy();
    expect(
      application.store
        .getState()
        .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'N')
        ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === hostId)
        ?.acquisitionSites?.hermesShrineDelivery,
    ).toBeUndefined();

    const before = workspaceProjection(application);
    const sourceDestination = before.focusByOwner.get(semanticAddressKey(source));
    if (sourceDestination === undefined)
      throw new Error('side-room Shrine source destination is missing');
    const sourceNode = before.route.biomes
      .find((biome) => biome.biomeKey === 'N')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === sourceId,
      );
    if (sourceNode === undefined) throw new Error('side-room Shrine source node is missing');
    expect(sourceDestination).toMatchObject({
      ownerAddress: source,
      nodeKey: sourceNode.key,
      inspectorSubject: { kind: 'node', nodeKey: sourceNode.key },
    });
    await view.user.click(
      within(delivery).getByRole('button', { name: 'Place required delivery' }),
    );
    await waitFor(() =>
      expect(
        application.store
          .getState()
          .projectWorkspace.history!.present.route?.biomes.find((biome) => biome.biomeKey === 'N')
          ?.topology?.occurrences.find((candidate) => candidate.occurrenceId === hostId)
          ?.acquisitionSites?.hermesShrineDelivery?.pickupEntries?.[entryKey],
      ).toBeDefined(),
    );

    const hostDestination = workspaceProjection(application).focusByOwner.get(
      semanticAddressKey(entry),
    );
    const hostNode = workspaceProjection(application)
      .route?.biomes.find((biome) => biome.biomeKey === 'N')
      ?.nodes.find(
        (node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === hostId,
      );
    if (hostNode === undefined) throw new Error('Shrine delivery host node is missing');
    expect(sourceDestination.nodeKey).not.toBe(hostDestination?.nodeKey);
    expect(hostDestination).toMatchObject({
      ownerAddress: entry,
      nodeKey: hostNode.key,
      inspectorSubject: { kind: 'node', nodeKey: hostNode.key },
    });
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
    const route = workspaceProjection(application).route;
    if (route === undefined) throw new Error('Surface route is missing');
    const user = userEvent.setup();
    render(
      <Provider store={application.store}>
        <RouteShrinesPanel rows={projectRouteHermesShrineIndex(route)} />
      </Provider>,
    );

    const inspect = screen.getAllByRole('button', { name: 'Inspect Shrine' });
    expect(inspect).toHaveLength(3);
    expect(screen.queryByText('HealBigDrop')).toBeNull();
    await user.click(inspect[1]!);
    expect(application.store.getState().editorSession.activePanel).toEqual({
      kind: 'biome',
      biomeKey: 'O',
    });
    expect(application.store.getState().editorSession.focusedSemanticOwner).toMatchObject({
      kind: 'occurrence',
      occurrenceId: oOccurrenceIds.combat07,
    });
  });
});
