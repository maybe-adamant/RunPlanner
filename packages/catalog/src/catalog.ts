import type { Catalog } from '@run-planner/core';

import type { RawCatalogInput } from './declarations';
import { requireNonEmpty } from './normalization/common';
import { normalizeEncounterProfiles } from './normalization/encounters';
import { normalizeBiomeLayouts } from './normalization/layouts';
import { normalizeRewardGraph, normalizeStores } from './normalization/rewards';
import { normalizeRooms } from './normalization/rooms';
import { normalizeRoutes } from './normalization/routes';
import { normalizeShopOptionSets, normalizeShopProfiles } from './normalization/shops';

export { CatalogContractError } from './normalization/errors';

export function createCatalog(input: RawCatalogInput): Catalog {
  requireNonEmpty(input.version, 'version');

  const routes = normalizeRoutes(input.routes);
  const rewardGraph = normalizeRewardGraph({
    payloadDomains: input.rewardPayloadDomains,
    primitives: input.rewardPrimitives,
  });
  const rewardStores = normalizeStores(input.rewardStores, rewardGraph.primitives);
  const shopOptionSets = normalizeShopOptionSets(input.shopOptionSets, rewardGraph.primitives);
  const shopProfiles = normalizeShopProfiles(
    input.shopProfiles,
    shopOptionSets,
    rewardGraph.primitives,
  );
  const encounterProfiles = normalizeEncounterProfiles(input.encounterProfiles);
  const routeSteps = new Set(
    routes.values.flatMap((route) => route.biomeSteps.map((step) => step.key)),
  );
  const rooms = normalizeRooms(
    input.rooms,
    routeSteps,
    rewardStores,
    rewardGraph.primitives,
    shopProfiles,
    encounterProfiles,
  );
  const biomeLayouts = normalizeBiomeLayouts(input.biomeLayouts, routeSteps, rooms);

  return Object.freeze({
    version: input.version,
    routes,
    rewardPayloadDomains: rewardGraph.payloadDomains,
    rewardPrimitives: rewardGraph.primitives,
    rewardStores,
    shopOptionSets,
    shopProfiles,
    encounterProfiles,
    rooms,
    biomeLayouts,
  });
}
