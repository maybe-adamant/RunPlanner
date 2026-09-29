import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import { simulateProject } from '@run-planner/engine/simulation';
import {
  createFreshFileRouteProject,
  freshFileIBiome,
  freshFileIShopId,
} from '@run-planner/test-fixtures/fresh-file';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

const fifthSlot = createShopOfferAddress(freshFileIBiome, freshFileIShopId, 'MetaProgress');

it('clears the Fresh I_WorldShop fifth slot from its invalid current selection', async () => {
  // A mature-save item retained in the slot a fresh profile leaves empty.
  const retained = applyProjectCommand(createFreshFileRouteProject(), catalog, {
    kind: 'ReplaceShopOfferOption',
    offer: fifthSlot,
    value: { optionKey: 'CardUpgradePointsDrop', offer: { rewardType: 'CardUpgradePointsDrop' } },
  });
  expect(simulateProject(catalog, retained).status).toBe('invalid');
  const { workspace } = projectStructuredWorkspaceFixture(retained);
  const interaction = workspace.interactions.shopOffers.get(semanticAddressKey(fifthSlot));
  if (interaction === undefined) throw new Error('Fresh I Shop fifth slot has no item picker');
  const picker = await interaction.load();
  const current = picker.sections.find((section) => section.kind === 'selectedInvalid');
  expect(current?.items.map((item) => [item.label, item.value])).toEqual([
    [
      expect.any(String),
      { optionKey: 'CardUpgradePointsDrop', offer: { rewardType: 'CardUpgradePointsDrop' } },
    ],
    ['Clear item', null],
  ]);
  const clear = current!.items.find((item) => item.value === null)!;
  expect(clear.disabled).toBe(false);
  const intent = interaction.intentFor(clear.value);
  expect(intent.command).toEqual({ kind: 'ClearShopOffer', offer: fifthSlot });
  const cleared = applyProjectCommand(retained, catalog, intent.command);
  const evaluation = simulateProject(catalog, cleared);
  expect(evaluation.status).toBe('valid');
  expect(evaluation.findings).toEqual([]);
});

it('offers no clear item while the current Shop item remains possible', async () => {
  const project = createFreshFileRouteProject();
  const { workspace } = projectStructuredWorkspaceFixture(project);
  const interaction = workspace.interactions.shopOffers.get(
    semanticAddressKey(createShopOfferAddress(freshFileIBiome, freshFileIShopId, 'BoostedBoon')),
  );
  if (interaction === undefined) throw new Error('Fresh I Shop has no Boosted Boon picker');
  const picker = await interaction.load();
  expect(
    picker.sections.flatMap((section) => section.items).some((item) => item.value === null),
  ).toBe(false);
});
