import { biomes } from './biomes';
import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.6.0-q-dormant',
  biomes,
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms: [...fRooms, ...gRooms, ...pRooms, ...qRooms],
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
