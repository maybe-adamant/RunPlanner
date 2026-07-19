import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { pRooms } from './rooms/p';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.4.0-p-dormant',
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms: [...fRooms, ...gRooms, ...pRooms],
  biomeLayouts,
} as const satisfies RawCatalogInput;

export type {
  RawCatalogInput,
  RawCountedRewardBinding,
  RawEncounterProfileDeclaration,
  RawFixedRewardBinding,
  RawForkedPrebossEntryPolicy,
  RawBiomeLayoutDeclaration,
  RawHubBiomeLayoutDeclaration,
  RawLinearBiomeLayoutDeclaration,
  RawNoneRewardBinding,
  RawRewardProducerBinding,
  RawRoomDeclaration,
  RawShopRewardBinding,
} from './types';
