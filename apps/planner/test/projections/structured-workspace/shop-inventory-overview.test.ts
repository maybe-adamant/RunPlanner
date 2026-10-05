import { expect, it } from 'vitest';
import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createShopOfferAddress,
  semanticAddressKey,
} from '@run-planner/engine/authored-project';
import {
  pBiome,
  pOccurrenceIds,
  surfaceEncounterShowcaseProject,
} from '@run-planner/test-fixtures/surface';
import { projectStructuredWorkspaceFixture } from '@planner-test/fixtures/structuredWorkspace';

it('routes an invalid Shop inventory to the entered Shop Overview', () => {
  const boon = createShopOfferAddress(pBiome, pOccurrenceIds.prebossShop, 'Boon');
  const project = applyProjectCommand(surfaceEncounterShowcaseProject(), catalog, {
    kind: 'ReplaceShopOffer',
    offer: boon,
    value: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'HeraUpgrade' } },
  });
  const { evaluation, workspace } = projectStructuredWorkspaceFixture(project);
  expect(evaluation.route.issue).toMatchObject({ owner: boon });
  expect(workspace.focusByOwner.get(semanticAddressKey(boon))?.roomTab).toBe('overview');
  expect(workspace.interactions.shopOffers.has(semanticAddressKey(boon))).toBe(true);
  const room = (occurrenceId: string) => {
    for (const biome of workspace.route.biomes)
      for (const node of biome.nodes)
        if (node.kind === 'occurrenceWorkbench' && node.room.occurrenceId === occurrenceId)
          return node.room;
    return undefined;
  };
  // The source room has exited and the Shop is entered.
  expect(room('surface-p-8-1-p_combat12')?.runStateByTab.doors).toMatchObject({
    availability: 'available',
  });
  expect(room(pOccurrenceIds.prebossShop)?.runStateByTab.overview).toMatchObject({
    availability: 'available',
  });
});
