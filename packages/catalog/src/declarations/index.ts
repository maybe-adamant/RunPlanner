import { biomes } from './biomes';
import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { hRooms } from './rooms/h';
import { iRooms } from './rooms/i';
import { nRooms } from './rooms/n';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput, RawRoomDeclaration } from './types';

const rooms: readonly RawRoomDeclaration[] = [
  ...fRooms,
  ...gRooms,
  ...pRooms,
  ...qRooms,
  ...hRooms,
  ...oRooms,
  ...iRooms,
  ...nRooms,
];

export const declarations = {
  version: '0.10.0-n-dormant',
  biomes,
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms,
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
