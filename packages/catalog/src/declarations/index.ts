import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.3.0-fg-structure-v2',
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms: [...fRooms, ...gRooms],
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
