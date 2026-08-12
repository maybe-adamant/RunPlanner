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
import { nRooms } from './rooms/n';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from './rewards/declarations';
import { routes } from './routes';
import { traitCatalogInput } from './traits/index';
import type { RawCatalogInput, RawRoomDeclaration } from './types';

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
  version: '0.26.0-narcissus-pickups',
  biomes,
  routes,
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

export type {
  RawCatalogInput,
  RawAdditionalExitDeclaration,
  RawCountedRewardBinding,
  RawEncounterDefinitionDeclaration,
  RawEncounterEnvelopeDeclaration,
  RawEncounterEnvelopeSlotDeclaration,
  RawEncounterSetDeclaration,
  RawEncounterSlotBinding,
  RawFixedRewardBinding,
  RawExitTypeDeclaration,
  RawBiomeLayoutDeclaration,
  RawLocalChildDescriptor,
  RawNoneRewardBinding,
  RawPrebossBatchPolicy,
  RawProgressionDeclaration,
  RawRewardProducerBinding,
  RawRoomDeclaration,
  RawRoomLifecycleProfileDeclaration,
  RawShopRewardBinding,
  RawZagreusContractAdditionalExitDeclaration,
  RawTraitCatalogInput,
} from './types';
