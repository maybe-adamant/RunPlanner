import { biomes } from './biomes';
import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { hRooms } from './rooms/h';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.8.0-o-dormant',
  biomes,
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms: [...fRooms, ...gRooms, ...pRooms, ...qRooms, ...hRooms, ...oRooms],
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
  RawLocalChildDescriptor,
  RawNoneRewardBinding,
  RawRewardProducerBinding,
  RawRoomDeclaration,
  RawShopRewardBinding,
} from './types';
