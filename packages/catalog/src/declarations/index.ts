import { encounterProfiles } from './encounters';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { rewardPayloadDomains } from './rewards/payloadDomains';
import { rewardPrimitives } from './rewards/primitives';
import { shopOptionSets, shopProfiles } from './rewards/shops';
import { rewardStores } from './rewards/stores';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.1.0-fg-slice-4',
  routes,
  rewardPayloadDomains,
  rewardPrimitives,
  rewardStores,
  shopOptionSets,
  shopProfiles,
  encounterProfiles,
  rooms: fRooms,
  biomeLayouts,
} as const satisfies RawCatalogInput;

export type {
  RawCatalogInput,
  RawCountedRewardBinding,
  RawEncounterProfileDeclaration,
  RawFixedRewardBinding,
  RawForkedPrebossEntryPolicy,
  RawLinearBiomeLayoutDeclaration,
  RawPayloadDomainDeclaration,
  RawRewardProducerBinding,
  RawRewardPrimitiveDeclaration,
  RawRewardStoreDeclaration,
  RawRoomDeclaration,
  RawShopOptionSetDeclaration,
  RawShopProfileDeclaration,
  RawShopRewardBinding,
  RawShopSlotDeclaration,
} from './types';
