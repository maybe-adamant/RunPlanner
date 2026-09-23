import { catalog } from '@run-planner/hades2-catalog';
import {
  applyProjectCommand,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
} from '../../../src/authored-project';
import {
  authorLegalTraitOffers,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { loadSurfaceNOPQProject, qBiome } from '@run-planner/test-fixtures/surface';

/** The real Q World Shop correlation scenario with normal and boosted Apollo offers. */
export function surfaceQShopCorrelationProject() {
  const shopId = createOccurrenceId('surface-q-preboss');
  const shop = createOccurrenceAddress(qBiome, shopId);
  const normal = createShopOfferAddress(qBiome, shopId, 'MixedProgress1');
  const boosted = createShopOfferAddress(qBiome, shopId, 'MixedProgress2');
  let project = applyProjectCommand(loadSurfaceNOPQProject(), catalog, {
    kind: 'ReplaceShopOfferOption',
    offer: normal,
    value: {
      optionKey: 'RandomLoot',
      offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    },
  });
  project = applyProjectCommand(project, catalog, {
    kind: 'ReplaceShopOfferOption',
    offer: boosted,
    value: {
      optionKey: 'BoostedRandomLoot',
      offer: { rewardType: 'RandomLoot', payload: { kind: 'BoonSource', source: 'ApolloUpgrade' } },
    },
  });
  project = replaceTestShopOfferActions(project, catalog, shop, [
    'MixedProgress1',
    'MixedProgress2',
  ]);
  return authorLegalTraitOffers(project);
}
