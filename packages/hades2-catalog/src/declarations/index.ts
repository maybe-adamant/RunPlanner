import { biomes } from './biomes';
import {
  encounterDefinitions,
  encounterEnvelopes,
  encounterSets,
  fieldNpcEncounterKeys,
} from './encounters';
import { enemyGoldDrops } from './encounters/generated/enemy-gold-drops';
import { exitCompatibilityPolicies, exitTypes } from './exits';
import { biomeLayouts } from './layouts';
import { roomLifecycleProfiles } from './lifecycles';
import { anomalyRooms } from './rooms/anomaly';
import { cRooms } from './rooms/c';
import { chaosRooms } from './rooms/chaos';
import { dreamRooms } from './rooms/dream';
import { fRooms } from './rooms/f';
import { gRooms } from './rooms/g';
import { hRooms } from './rooms/h';
import { iRooms } from './rooms/i';
import { exitDoorSetupOrders } from './rooms/exit-door-setup-order';
import { swappableBreakables } from './rooms/swappable-breakables';
import { nRooms } from './rooms/n/index';
import { oRooms } from './rooms/o';
import { pRooms } from './rooms/p';
import { qRooms } from './rooms/q';
import { rewardKernelDeclarations } from './rewards/declarations';
import { routes } from './routes';
import { traitCatalogInput } from './traits/index';
import { arcanaCards, fearVows } from './arcana-fear';
import { defaultFamiliarKey, familiars } from './familiars';
import { heroMaxStats } from './hero';
import { gold } from './gold';
import { keepsakes } from './keepsakes';
import type { RawCatalogInput } from './input';
import type { RawRoomDeclaration } from './rooms/types';

const rooms: readonly RawRoomDeclaration[] = [
  ...anomalyRooms,
  ...cRooms,
  ...chaosRooms,
  ...dreamRooms,
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
  runStartReward: {
    kind: 'countedChoice',
    storeKeys: ['RunProgress'],
    eligibleRewardTypes: [],
    ineligibleRewardTypes: ['Devotion', 'RoomMoneyDrop', 'MaxHealthDrop', 'MaxManaDrop'],
    producerLifecycleKey: 'RoomReward',
  },
  arcanaCards,
  fearVows,
  keepsakes,
  familiars,
  defaultFamiliarKey,
  heroMaxStats,
  gold,
  rewardKernel: rewardKernelDeclarations,
  encounterEnvelopes,
  encounterDefinitions,
  encounterSets,
  enemyGoldDrops,
  fieldNpcEncounterKeys,
  roomLifecycleProfiles,
  exitCompatibilityPolicies,
  exitTypes,
  rooms,
  exitDoorSetupOrders,
  swappableBreakables,
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
  RawEnemyGoldDropDeclaration,
} from './encounters/types';
export type { RawExitTypeDeclaration } from './exits-types';
export type { RawFamiliarDeclaration } from './familiars-types';
export type { RawKeepsakeDeclaration } from './keepsakes-types';
export type { RawBiomeLayoutDeclaration, RawProgressionDeclaration } from './layouts/types';
export type { RawRoomLifecycleProfileDeclaration } from './lifecycles/types';
export type {
  RawAdditionalExitDeclaration,
  RawLocalChildDescriptor,
  RawPrebossBatchPolicy,
  RawRoomDeclaration,
  RawRoomOfferRewardBinding,
  RawEntryContextualEncounterRule,
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
