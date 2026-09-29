import { catalog } from '@run-planner/hades2-catalog';
import {
  catalogWithEmptyShopGroup,
  clearTestShopOffer,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import type { Catalog } from '../../../src/catalog-schema';
import {
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  type ProjectDocument,
} from '../../../src/authored-project';

/** I Preboss Shop whose middle Survival group has zero eligible options. */
export const emptyShopGroupOccurrence = createOccurrenceAddress(
  createBiomeAddress('Underworld', 'I'),
  createOccurrenceId('golden-i-preboss'),
);

let cachedCatalog: Catalog | undefined;
export function emptyShopGroupCatalog(): Catalog {
  cachedCatalog ??= catalogWithEmptyShopGroup(catalog, 'I_PreBoss02', 'Survival');
  return cachedCatalog;
}

/** The mature FGHI plan with the empty Survival slot unset and the later Premium item bought. */
export function emptyShopGroupProject(): ProjectDocument {
  return replaceTestShopOfferActions(
    clearTestShopOffer(loadUnderworldFGHICheckpoint(), emptyShopGroupOccurrence, 'Survival'),
    emptyShopGroupCatalog(),
    emptyShopGroupOccurrence,
    ['PremiumProgress'],
  );
}
