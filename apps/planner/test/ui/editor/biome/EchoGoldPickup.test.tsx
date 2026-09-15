// @vitest-environment jsdom

import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
  createRoomActionAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { authorLegalTraitOffers } from '@run-planner/test-fixtures/shared';
import { act, cleanup, screen, within } from '@testing-library/react';
import { afterEach, expect, it } from 'vitest';
import { createEchoGoldHPrebossProject } from '@planner-test/fixtures/echoGoldShop';
import {
  renderOccurrenceWorkbench,
  workspaceProjection,
} from '@planner-test/support/biome-workbench';
import { occurrenceById, openRoomTab } from '@planner-test/support/occurrence-workbench';
import {
  authoredProjectCommandDispatched,
  authoredProjectUndoRequested,
} from '@planner/state/projectWorkspaceSlice';

afterEach(cleanup);

const biome = { kind: 'biome' as const, routeKey: 'Underworld', biomeKey: 'H' };
const shopId = createOccurrenceId('golden-h-preboss-shop');
const site = createAcquisitionSiteAddress(createOccurrenceAddress(biome, shopId), 'roomExit');
const gold = createAcquisitionEntryAddress(site, 'echoDoubleShopReward');
const shopOffer = createShopOfferAddress(biome, shopId, 'Boon');

function goldRow() {
  const row = screen.getByText(/^Interact Gold Gold Gold/).closest('li');
  if (row === null) throw new Error('Gold pickup row missing');
  return within(row);
}

it('keeps a stale Gold pickup removable after its triggering purchase is cleared', async () => {
  const minor = createShopOfferAddress(biome, shopId, 'Minor');
  let project = applyProjectCommand(createEchoGoldHPrebossProject(), catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: minor,
    purchased: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'PlaceEchoGoldPickup',
    site,
    entryKey: 'echoDoubleShopReward',
    sourceOfferKey: 'Minor',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: minor,
    purchased: false,
  });
  const view = renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(shopId));
  expect(
    workspaceProjection(view.application).focusByOwner.get(semanticAddressKey(gold)),
  ).toMatchObject({ focusAddress: { kind: 'roomAction' } });
  openRoomTab('Room Timeline');
  await view.user.click(goldRow().getByRole('button', { name: /Remove .* from timeline/ }));
  expect(screen.queryByText(/^Interact Gold Gold Gold/)).toBeNull();
  expect(
    view.application.store
      .getState()
      .projectWorkspace.assembly!.evaluation.findings.some((finding) =>
        semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
      ),
  ).toBe(false);
});

it('requires placement of a duplicated Boon and exposes its fresh trait editor on the Timeline', async () => {
  const project = authorLegalTraitOffers(
    applyProjectCommand(createEchoGoldHPrebossProject(), catalog, {
      kind: 'ReplaceShopPurchaseParticipation',
      offer: shopOffer,
      purchased: true,
    }),
  );
  const view = renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(shopId));
  const findings = () =>
    view.application.store.getState().projectWorkspace.assembly!.evaluation.findings;
  expect(findings()).toContainEqual(
    expect.objectContaining({ code: 'echoGoldPickupPlacementRequired', origin: gold }),
  );
  const workspace = workspaceProjection(view.application);
  expect(workspace.focusByOwner.get(semanticAddressKey(gold))).toMatchObject({
    focusAddress: { kind: 'roomAction' },
  });
  expect(
    workspace.interactions.traitOffers.has(
      semanticAddressKey(createTraitOfferAddress(gold, 'source')),
    ),
  ).toBe(false);
  expect(screen.queryByText(/^Gold Gold Gold duplicate of/)).toBeNull();
  openRoomTab('Room Timeline');
  expect(goldRow().queryByRole('button', { name: 'Reward' })).toBeNull();
  await view.user.click(goldRow().getByRole('button', { name: 'Place required pickup' }));
  expect(findings().some((finding) => finding.code === 'echoGoldPickupPlacementRequired')).toBe(
    false,
  );
  const trait = workspaceProjection(view.application).interactions.traitOffers.get(
    semanticAddressKey(createTraitOfferAddress(gold, 'source')),
  );
  const draft = trait?.traitOfferStartingOutcome?.();
  if (trait === undefined || draft === undefined)
    throw new Error('placed Gold Boon has no supported starting draft');
  act(() =>
    view.application.store.dispatch(
      authoredProjectCommandDispatched(trait.intentFor(draft).command),
    ),
  );
  expect(
    findings().some((finding) =>
      semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
    ),
  ).toBe(false);
  act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
  expect(
    workspaceProjection(view.application).interactions.traitOffers.has(
      semanticAddressKey(createTraitOfferAddress(gold, 'source')),
    ),
  ).toBe(true);
});

it('leaves a Gold Mystery Boon optional and authors its hidden source only after placement', async () => {
  let project = applyProjectCommand(createEchoGoldHPrebossProject(), catalog, {
    kind: 'ReplaceShopOffer',
    offer: shopOffer,
    value: { rewardType: 'BlindBoxLoot' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: shopOffer,
    purchased: true,
  });
  const view = renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(shopId));
  const settleTrait = (entryKey: string) => {
    const trait = workspaceProjection(view.application).interactions.traitOffers.get(
      semanticAddressKey(
        createTraitOfferAddress(createAcquisitionEntryAddress(site, entryKey), 'hiddenSource'),
      ),
    );
    const draft = trait?.traitOfferStartingOutcome?.();
    if (trait === undefined || draft === undefined)
      throw new Error(`${entryKey} has no supported trait draft`);
    act(() =>
      view.application.store.dispatch(
        authoredProjectCommandDispatched(trait.intentFor(draft).command),
      ),
    );
  };
  const selectGod = async (row: ReturnType<typeof within>) => {
    await view.user.click(row.getByRole('button', { name: 'Reward' }));
    const option = within(await screen.findByRole('listbox'))
      .getAllByRole('option')
      .find((candidate) => candidate.getAttribute('aria-disabled') !== 'true');
    if (option === undefined) throw new Error('Mystery Boon has no eligible god');
    await view.user.click(option);
  };
  openRoomTab('Room Timeline');
  const purchase = screen.getByText('Purchase Slot 1 Offer · Mystery Boon').closest('li');
  if (purchase === null) throw new Error('Mystery purchase missing');
  await selectGod(within(purchase));
  settleTrait('Boon');
  const findings = () =>
    view.application.store.getState().projectWorkspace.assembly!.evaluation.findings;
  expect(
    findings().some((finding) =>
      semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
    ),
  ).toBe(false);
  expect(goldRow().queryByRole('button', { name: 'Reward' })).toBeNull();
  await view.user.click(goldRow().getByRole('button', { name: 'Take pickup' }));
  await selectGod(goldRow());
  settleTrait('echoDoubleShopReward');
  expect(
    findings().some((finding) =>
      semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
    ),
  ).toBe(false);
  await view.user.click(goldRow().getByRole('button', { name: /Remove .* from timeline/ }));
  expect(goldRow().queryByRole('button', { name: 'Reward' })).toBeNull();
  expect(
    workspaceProjection(view.application).interactions.traitOffers.has(
      semanticAddressKey(createTraitOfferAddress(gold, 'hiddenSource')),
    ),
  ).toBe(false);
  expect(
    findings().some((finding) =>
      semanticAddressKey(finding.origin).includes('echoDoubleShopReward'),
    ),
  ).toBe(false);
  act(() => view.application.store.dispatch(authoredProjectUndoRequested()));
  expect(
    workspaceProjection(view.application).interactions.traitOffers.has(
      semanticAddressKey(createTraitOfferAddress(gold, 'hiddenSource')),
    ),
  ).toBe(true);
});

it('repairs a retained consumable when its Gold source changes to a Mystery Boon', async () => {
  let project = createEchoGoldHPrebossProject();
  const shop = project.route.biomes
    .find((entry) => entry.biomeKey === 'H')!
    .topology!.occurrences.find((entry) => entry.occurrenceId === shopId)!;
  if (shop.state.kind !== 'shop') throw new Error('H preboss shop missing');
  const payload = shop.state.shop!.offers.Boon!.reward!.offer.payload;
  if (payload?.kind !== 'BoonSource') throw new Error('Shop boon source missing');
  const minor = createShopOfferAddress(biome, shopId, 'Minor');
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: minor,
    purchased: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'PlaceEchoGoldPickup',
    site,
    entryKey: 'echoDoubleShopReward',
    sourceOfferKey: 'Minor',
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: minor,
    purchased: false,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: shopOffer,
    value: { rewardType: 'BlindBoxLoot' },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: shopOffer,
    purchased: true,
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceAcquisitionEntryOffer',
    entry: createAcquisitionEntryAddress(site, 'Boon'),
    value: { rewardType: 'BlindBoxLoot', payload },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'MoveRoomAction',
    action: createRoomActionAddress(
      biome,
      shopId,
      roomActionKey({ kind: 'interactShopOffer', offerKey: 'Boon' }),
    ),
    toIndex: 0,
  });
  project = authorLegalTraitOffers(project);
  const view = renderOccurrenceWorkbench(project, 'Underworld', 'H', occurrenceById(shopId));
  expect(
    view.application.store.getState().projectWorkspace.assembly!.evaluation.findings,
  ).toContainEqual(expect.objectContaining({ code: 'rewardSourceUnavailable', origin: gold }));
  openRoomTab('Room Timeline');
  await view.user.click(goldRow().getByRole('button', { name: 'Reward' }));
  await view.user.click(
    within(await screen.findByRole('listbox')).getByRole('option', { name: 'Mystery Boon' }),
  );
  const god = within(await screen.findByRole('listbox'))
    .getAllByRole('option')
    .find((option) => option.getAttribute('aria-disabled') !== 'true');
  if (god === undefined) throw new Error('Retained Gold has no legal Mystery Boon source');
  await view.user.click(god);
  expect(
    workspaceProjection(view.application).interactions.traitOffers.has(
      semanticAddressKey(createTraitOfferAddress(gold, 'hiddenSource')),
    ),
  ).toBe(true);
});
