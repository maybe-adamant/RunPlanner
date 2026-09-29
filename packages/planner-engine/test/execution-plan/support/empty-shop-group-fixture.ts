import { catalog } from '@run-planner/hades2-catalog';
import {
  catalogWithEmptyShopGroup,
  replaceTestShopOfferActions,
} from '@run-planner/test-fixtures/shared';
import { loadUnderworldFGHICheckpoint } from '@run-planner/test-fixtures/checkpoints/underworld';
import type { Catalog } from '../../../src/catalog-schema';
import {
  applyProjectCommand,
  createBiomeAddress,
  createOccurrenceAddress,
  createOccurrenceId,
  createShopOfferAddress,
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

/** Empties one slot of the I Preboss Shop through the authored command. */
export function clearEmptyShopGroupOffer(
  project: ProjectDocument,
  slotKey: string,
): ProjectDocument {
  return applyProjectCommand(project, catalog, {
    kind: 'ClearShopOffer',
    offer: createShopOfferAddress(
      createBiomeAddress('Underworld', 'I'),
      emptyShopGroupOccurrence.occurrenceId,
      slotKey,
    ),
  });
}

/** The mature FGHI plan with the empty Survival slot unset and the later Premium item bought. */
export function emptyShopGroupProject(): ProjectDocument {
  return replaceTestShopOfferActions(
    clearEmptyShopGroupOffer(loadUnderworldFGHICheckpoint(), 'Survival'),
    emptyShopGroupCatalog(),
    emptyShopGroupOccurrence,
    ['PremiumProgress'],
  );
}
