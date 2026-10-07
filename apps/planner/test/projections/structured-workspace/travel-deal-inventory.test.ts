import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionRoleAddress,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createBatchRewardStoreAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createShopOfferAddress,
  createTraitOfferAddress,
  roomActionKey,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { derivedAcquisitionEntriesForProjectEvaluationAssembly } from '@run-planner/engine/simulation';
import {
  createUnderworldFWellCheckpoint,
  goldenGBiome,
  goldenGOccurrenceId,
} from '@run-planner/test-fixtures/underworld';
import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';
import {
  qBiome,
  qOccurrenceIds,
  surfaceTravelDealRefillAnvilProject,
  surfaceTravelDealRefillAnvilResult,
} from '@run-planner/test-fixtures/surface';

it('keeps a purchased Travel Deal boon editable while its trait offer is incomplete', () => {
  const shopId = goldenGOccurrenceId(5, 1);
  const room = createOccurrenceAddress(goldenGBiome, shopId);
  const inventory = createShopOfferAddress(goldenGBiome, shopId, 'travelDealRefill');
  const trait = createTraitOfferAddress(inventory, 'source');
  const site = createAcquisitionSiteAddress(room, 'roomExit');
  let project = applyProjectCommand(createUnderworldFWellCheckpoint(false), catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenGBiome, { kind: 'occurrence', occurrenceId: shopId }),
  });
  project = replaceTestShopOfferActions(project, catalog, room, []);
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: createShopOfferAddress(goldenGBiome, shopId, 'Boon'),
    purchased: true,
  });
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOffer',
    offer: inventory,
    value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ZeusUpgrade' } },
  });
  const reference = {
    kind: 'interactAcquisitionEntry',
    siteKey: 'roomExit',
    entryKey: 'travelDealRefill',
  } as const;
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action: createRoomActionAddress(goldenGBiome, shopId, roomActionKey(reference)),
    reference,
    index: 1,
  });
  const missing = projectStructuredWorkspaceFixture(project);
  expect(missing.evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'traitOfferMissing', origin: trait }),
  );
  expect(
    derivedAcquisitionEntriesForProjectEvaluationAssembly(missing.assembly, site),
  ).toContainEqual(expect.objectContaining({ kind: 'travelDealRefill' }));
  expect(missing.workspace.interactions.shopOffers.has(semanticAddressKey(inventory))).toBe(true);
  expect(missing.workspace.interactions.traitOffers.has(semanticAddressKey(trait))).toBe(true);
  expect(missing.workspace.focusByOwner.get(semanticAddressKey(trait))).toMatchObject({
    roomTab: 'actions',
  });
  const node = missing.workspace.route.biomes
    .flatMap((biome) => biome.nodes)
    .find((node) => node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === shopId);
  if (node?.kind !== 'occurrenceWorkbench') throw new Error('Travel Deal room is missing');
  expect(
    node.room.roomActions?.rows.find((row) => row.key === roomActionKey(reference))?.rewardPayload
      ?.inlineTraitOffers,
  ).toEqual([expect.objectContaining({ address: trait })]);
  project = authorLegalTraitOffers(project);
  const settled = projectStructuredWorkspaceFixture(project);
  expect(settled.evaluation.findings).toEqual([
    expect.objectContaining({
      code: 'batchRewardStoreMissing',
      origin: createBatchRewardStoreAddress(goldenGBiome, {
        kind: 'occurrence',
        occurrenceId: shopId,
      }),
    }),
  ]);
});

it('replaces the Travel Deal placeholder with editable inventory before outgoing doors are authored', async () => {
  const shopId = goldenGOccurrenceId(5, 1);
  const room = createOccurrenceAddress(goldenGBiome, shopId);
  const decision = createExitDecisionAddress(goldenGBiome, {
    kind: 'occurrence',
    occurrenceId: shopId,
  });
  const inventory = createShopOfferAddress(goldenGBiome, shopId, 'travelDealRefill');
  const site = createAcquisitionSiteAddress(room, 'roomExit');
  const entry = createAcquisitionEntryAddress(site, 'travelDealRefill');
  let project = applyProjectCommand(createUnderworldFWellCheckpoint(false), catalog, {
    kind: 'RemoveExitDecision',
    decision,
  });
  project = replaceTestShopOfferActions(project, catalog, room, []);
  project = authorLegalTraitOffers(project);
  const waiting = projectStructuredWorkspaceFixture(project);
  expect(waiting.evaluation.findings).toEqual([
    expect.objectContaining({
      code: 'batchRewardStoreMissing',
      origin: createBatchRewardStoreAddress(goldenGBiome, decision.source),
    }),
  ]);
  expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(waiting.assembly, site)).toEqual([
    expect.objectContaining({ address: entry, kind: 'travelDealPlaceholder' }),
  ]);

  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: createShopOfferAddress(goldenGBiome, shopId, 'Boon'),
    purchased: true,
  });
  project = authorLegalTraitOffers(project);
  const reached = projectStructuredWorkspaceFixture(project);
  expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(reached.assembly, site)).toEqual([
    expect.objectContaining({ address: entry, kind: 'travelDealRefill', sourceOfferKey: 'Boon' }),
  ]);
  const interaction = reached.workspace.interactions.shopOffers.get(semanticAddressKey(inventory));
  expect(interaction).toBeDefined();
  if (interaction === undefined) throw new Error('Travel Deal inventory editor is missing');
  const picker = await interaction.load();
  const mystery = picker.sections
    .flatMap((section) => section.items)
    .find((item) => item.value?.optionKey === 'BlindBoxLoot');
  expect(mystery).toMatchObject({
    disabled: false,
    value: { offer: { rewardType: 'BlindBoxLoot' } },
  });
  if (mystery === undefined) throw new Error('Mystery Boon refill is missing');
  project = applyProjectCommand(project, catalog, interaction.intentFor(mystery.value).command);
  const authored = projectStructuredWorkspaceFixture(project);
  expect(authored.evaluation.findings).toEqual([
    expect.objectContaining({
      code: 'batchRewardStoreMissing',
      origin: createBatchRewardStoreAddress(goldenGBiome, decision.source),
    }),
  ]);
  expect(
    authored.workspace.interactions.shopOffers.get(semanticAddressKey(inventory))?.selected,
  ).toEqual(mystery.value);

  const reference = {
    kind: 'interactAcquisitionEntry',
    siteKey: 'roomExit',
    entryKey: 'travelDealRefill',
  } as const;
  const action = createRoomActionAddress(goldenGBiome, shopId, roomActionKey(reference));
  project = applyProjectCommand(project, catalog, {
    kind: 'InsertRoomAction',
    action,
    reference,
    index: 1,
  });
  const purchased = projectStructuredWorkspaceFixture(project);
  const acquisition = purchased.workspace.interactions.rewards.get(semanticAddressKey(entry));
  expect(acquisition).toBeDefined();
  if (acquisition === undefined) throw new Error('Travel Deal Mystery source editor is missing');
  project = applyProjectCommand(
    project,
    catalog,
    acquisition.intentFor({
      rewardType: 'BlindBoxLoot',
      payload: { kind: 'BoonSource', source: 'ZeusUpgrade' },
    }).command,
  );
  project = authorLegalTraitOffers(project);
  const settled = projectStructuredWorkspaceFixture(project);
  expect(settled.evaluation.findings).toEqual([
    expect.objectContaining({
      code: 'batchRewardStoreMissing',
      origin: createBatchRewardStoreAddress(goldenGBiome, decision.source),
    }),
  ]);
  expect(
    settled.workspace.interactions.shopOffers.get(semanticAddressKey(inventory))?.selected,
  ).toEqual(mystery.value);
  expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(settled.assembly, site)).toEqual([
    expect.objectContaining({ address: entry, kind: 'travelDealRefill' }),
    expect.objectContaining({ address: entry, kind: 'acquisitionResolvedReward' }),
  ]);

  project = applyProjectCommand(project, catalog, { kind: 'RemoveRoomAction', action });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: createShopOfferAddress(goldenGBiome, shopId, 'Boon'),
    purchased: false,
  });
  const cleared = projectStructuredWorkspaceFixture(project);
  expect(derivedAcquisitionEntriesForProjectEvaluationAssembly(cleared.assembly, site)).toEqual([
    expect.objectContaining({ address: entry, kind: 'travelDealPlaceholder' }),
  ]);
  expect(cleared.workspace.interactions.shopOffers.has(semanticAddressKey(inventory))).toBe(false);
});

it('repairs an invalid Travel Deal refill from its valid items without a clear choice', async () => {
  const shopId = goldenGOccurrenceId(5, 1);
  const room = createOccurrenceAddress(goldenGBiome, shopId);
  const inventory = createShopOfferAddress(goldenGBiome, shopId, 'travelDealRefill');
  let project = applyProjectCommand(createUnderworldFWellCheckpoint(false), catalog, {
    kind: 'RemoveExitDecision',
    decision: createExitDecisionAddress(goldenGBiome, { kind: 'occurrence', occurrenceId: shopId }),
  });
  project = replaceTestShopOfferActions(project, catalog, room, []);
  project = authorLegalTraitOffers(project);
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopPurchaseParticipation',
    offer: createShopOfferAddress(goldenGBiome, shopId, 'Boon'),
    purchased: true,
  });
  project = authorLegalTraitOffers(project);
  // The refill restocks the first purchase's Boon group, so a non-Boon item is invalid.
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOfferOption',
    offer: inventory,
    value: {
      optionKey: 'MetaCardPointsCommonDrop',
      offer: { rewardType: 'MetaCardPointsCommonDrop' },
    },
  });
  const { workspace } = projectStructuredWorkspaceFixture(project);
  const interaction = workspace.interactions.shopOffers.get(semanticAddressKey(inventory));
  if (interaction === undefined) throw new Error('Travel Deal refill has no item picker');
  const picker = await interaction.load();
  expect(picker.sections.some((section) => section.kind === 'selectedInvalid')).toBe(true);
  expect(
    picker.sections.some((section) =>
      section.items.some((item) => item.state === 'possible' && item.value !== null),
    ),
  ).toBe(true);
  expect(
    picker.sections.flatMap((section) => section.items).some((item) => item.value === null),
  ).toBe(false);
});

it('routes a failing Travel Deal refill Anvil to its launcher and the item to its line', () => {
  const refill = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'travelDealRefill');
  const role = createAcquisitionRoleAddress(refill, 'self');
  const project = applyProjectCommand(surfaceTravelDealRefillAnvilProject(), catalog, {
    kind: 'ReplaceAnvilResult',
    acquisition: role,
    value: { ...surfaceTravelDealRefillAnvilResult, removedTraitKey: 'StaffTripleShotTrait' },
  });
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(project);
  expect(evaluation.findings).toEqual(
    expect.arrayContaining([
      expect.objectContaining({ code: 'rewardAcquisitionUnavailable', origin: role }),
      expect.objectContaining({ code: 'rewardAcquisitionUnavailable', origin: refill }),
    ]),
  );
  expect(workspace.focusByOwner.get(semanticAddressKey(role))).toMatchObject({
    focusAddress: role,
    roomTab: 'actions',
  });
  expect(
    workspace.interactions.acquisitionConversions.get(semanticAddressKey(role))?.anvil,
  ).toMatchObject({
    contextReached: true,
  });
  expect(workspace.focusByOwner.get(semanticAddressKey(refill))).toMatchObject({
    focusAddress: refill,
    roomTab: 'actions',
  });
  expect(workspace.interactions.shopOffers.has(semanticAddressKey(refill))).toBe(true);
});

it('routes a purchased refill with an item outside its group to its line and purchase row', () => {
  const refill = createShopOfferAddress(qBiome, qOccurrenceIds.preboss, 'travelDealRefill');
  const entry = createAcquisitionEntryAddress(
    createAcquisitionSiteAddress(
      createOccurrenceAddress(qBiome, qOccurrenceIds.preboss),
      'roomExit',
    ),
    'travelDealRefill',
  );
  // The refill restocks the Premium Progress slot, so a Survival item is invalid.
  const project = applyProjectCommand(surfaceTravelDealRefillAnvilProject(), catalog, {
    kind: 'ReplaceShopOfferOption',
    offer: refill,
    value: { optionKey: 'HealBigDrop', offer: { rewardType: 'HealBigDrop' } },
  });
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(project);
  // The refill's inventory blocks at its triggering purchase; the refill pickup is never reached.
  expect(evaluation.findings).toContainEqual(
    expect.objectContaining({ code: 'shopPurchaseUnavailable', origin: refill }),
  );
  expect(evaluation.findings).not.toContainEqual(expect.objectContaining({ origin: entry }));
  const q = evaluation.route.biomes.find((biome) => biome.biomeKey === 'Q');
  expect(
    q?.coverage.kind === 'prefix' ? q.coverage.roomTimeline?.blockingRowKeys : undefined,
  ).toEqual([
    roomActionKey({
      kind: 'interactAcquisitionEntry',
      siteKey: 'roomExit',
      entryKey: 'travelDealRefill',
    }),
  ]);
  expect(workspace.focusByOwner.get(semanticAddressKey(refill))).toMatchObject({
    focusAddress: refill,
    roomTab: 'actions',
  });
  expect(workspace.focusByOwner.get(semanticAddressKey(entry))).toMatchObject({
    focusAddress: createRoomActionAddress(
      qBiome,
      qOccurrenceIds.preboss,
      roomActionKey({
        kind: 'interactAcquisitionEntry',
        siteKey: 'roomExit',
        entryKey: 'travelDealRefill',
      }),
    ),
    roomTab: 'actions',
  });
});
