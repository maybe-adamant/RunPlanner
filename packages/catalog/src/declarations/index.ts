import { encounterProfiles } from './encounters';
import { biomeLayouts } from './layouts';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { rewardKernelDeclarations } from '../rewardKernel/declarations';
import { routes } from './routes';
import type { RawCatalogInput } from './types';

export const declarations = {
  version: '0.2.0-fg-reward-v2',
  routes,
  rewardKernel: rewardKernelDeclarations,
  encounterProfiles,
  rooms: [...fRooms, ...gRooms],
  biomeLayouts,
} as const satisfies RawCatalogInput;

export type {
  RawCatalogInput,
  RawCountedRewardBinding,
  RawEncounterProfileDeclaration,
  RawFixedRewardBinding,
  RawForkedPrebossEntryPolicy,
  RawLinearBiomeLayoutDeclaration,
  RawNoneRewardBinding,
  RawRewardProducerBinding,
  RawRoomDeclaration,
  RawShopRewardBinding,
} from './types';
