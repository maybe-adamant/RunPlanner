import { biomes } from './biomes';
import { encounterProfiles } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { roomLifecycleProfiles } from './lifecycles';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { hRooms } from './rooms/h';
import { iRooms } from './rooms/i';
import { nRooms } from './rooms/n';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from './rewards/declarations';
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
  version: '0.14.0-f-rewards',
  biomes,
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  roomLifecycleProfiles,
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
  RawRoomLifecycleProfileDeclaration,
  RawShopRewardBinding,
} from './types';
