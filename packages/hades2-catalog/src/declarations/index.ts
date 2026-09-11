import { biomes } from './biomes';
import { encounterDefinitions, encounterEnvelopes, encounterSets } from './encounters';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { roomLifecycleProfiles } from './lifecycles';
import { anomalyRooms } from './rooms/anomaly';
import { cRooms } from './rooms/c';
import { chaosRooms } from './rooms/chaos';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { hRooms } from './rooms/h';
import { iRooms } from './rooms/i';
import { nRooms } from './rooms/n/index';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from './rewards/declarations';
import { routes } from './routes';
import { traitCatalogInput } from './traits/index';
import { arcanaCards, fearVows } from './arcana-fear';
import { keepsakes } from './keepsakes';
import type { RawCatalogInput } from './input';
import type { RawRoomDeclaration } from './rooms/types';

const rooms: readonly RawRoomDeclaration[] = [
  ...anomalyRooms,
  ...cRooms,
  ...chaosRooms,
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
  version: '0.55.0-anvil-of-fates',
  biomes,
  routes,
  arcanaCards,
  fearVows,
  keepsakes,
  rewardKernel: rewardKernelDeclarations,
  encounterEnvelopes,
  encounterDefinitions,
  encounterSets,
  roomLifecycleProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms,
  biomeLayouts,
  traitCatalog: traitCatalogInput,
} as const satisfies RawCatalogInput;

export type { RawCatalogInput } from './input';
export type { RawArcanaCardDeclaration, RawFearVowDeclaration } from './arcana-fear-types';
export type {
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterEnvelopeSlotDeclaration,
  RawEncounterSetDeclaration,
  RawEncounterSlotBinding,
} from './encounters/types';
export type { RawExitTypeDeclaration } from './exits-types';
export type { RawKeepsakeDeclaration } from './keepsakes-types';
export type { RawBiomeLayoutDeclaration, RawProgressionDeclaration } from './layouts/types';
export type { RawRoomLifecycleProfileDeclaration } from './lifecycles/types';
export type {
  RawAdditionalExitDeclaration,
  RawLocalChildDescriptor,
  RawPrebossBatchPolicy,
  RawRoomDeclaration,
  RawRoomOfferRewardBinding,
  RawZagreusContractAdditionalExitDeclaration,
} from './rooms/types';
export type {
  RawCountedRewardBinding,
  RawFixedRewardBinding,
  RawNoneRewardBinding,
  RawRewardProducerBinding,
  RawShopRewardBinding,
} from './rewards/types';
export type { RawTraitCatalogInput } from './traits/types';
export type { RawHexDeclaration } from './traits/types';
