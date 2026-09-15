import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createAcquisitionEntryAddress,
  createAcquisitionSiteAddress,
  createExitDecisionAddress,
  createOccurrenceAddress,
  createRoomActionAddress,
  createShopOfferAddress,
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
    expect.objectContaining({ code: 'continuationMissing', origin: decision }),
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
    .find((item) => item.value.optionKey === 'BlindBoxLoot');
  expect(mystery).toMatchObject({
    disabled: false,
    value: { offer: { rewardType: 'BlindBoxLoot' } },
  });
  if (mystery === undefined) throw new Error('Mystery Boon refill is missing');
  project = applyProjectCommand(project, catalog, interaction.intentFor(mystery.value).command);
  const authored = projectStructuredWorkspaceFixture(project);
  expect(authored.evaluation.findings).toEqual([
    expect.objectContaining({ code: 'continuationMissing', origin: decision }),
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
    expect.objectContaining({ code: 'continuationMissing', origin: decision }),
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
