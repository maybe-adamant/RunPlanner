import type { ResolvedRewardOffer, RewardPayload } from '../rewardKernel/model';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 3 as const;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface ShopOfferState {
  readonly offer: ResolvedRewardOffer;
  readonly purchased: boolean;
}

export interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
}

export interface FieldsCombatState {
  readonly kind: 'fieldsCombat';
  readonly cages: Readonly<Record<string, ResolvedRewardOffer>>;
}

export interface RewardWheelState {
  readonly storeKey: string;
  readonly offerCount: number;
  readonly offers: Readonly<Record<string, ResolvedRewardOffer>>;
  readonly pickedOfferIndex: number;
}

export interface ShipCombatState {
  readonly kind: 'shipCombat';
  readonly encounterCount: 2 | 3;
  readonly wheels: Readonly<Record<string, RewardWheelState>>;
}

export type SideRoomGeneration = 'generated' | 'notGenerated';

export interface EphyraSideRoomState {
  readonly generation: SideRoomGeneration;
  readonly enteredOrdinal: number | null;
  readonly offer: ResolvedRewardOffer;
}

export interface EphyraCombatState {
  readonly kind: 'ephyraCombat';
  readonly offer: ResolvedRewardOffer;
  readonly sideRooms: Readonly<Record<string, EphyraSideRoomState>>;
}

export type AuthoredRoomState =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly payload?: RewardPayload }
  | { readonly kind: 'counted'; readonly offer: ResolvedRewardOffer }
  | EphyraCombatState
  | FieldsCombatState
  | ShipCombatState
  | { readonly kind: 'shop'; readonly shop?: ShopState }
  | { readonly kind: 'freeReward'; readonly offer: ResolvedRewardOffer };

export type BatchRewardStoreState =
  | { readonly kind: 'authoredBaseStore'; readonly baseRewardStoreKey: string }
  | { readonly kind: 'sourceOfferPoint' }
  | { readonly kind: 'none' };

export interface FieldsCageBatchState {
  readonly cageOutcome: 'min' | 'max';
}

export type AuthoredBatchState = FieldsCageBatchState | null;

export interface RoomOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: AuthoredRoomState;
}

export interface LinearTargetReference {
  readonly exitIndex: number;
  readonly occurrenceId: OccurrenceId;
}

export interface LinearBatchContinuation {
  readonly kind: 'batch';
  readonly parentOccurrenceId: OccurrenceId;
  readonly rewardStore: BatchRewardStoreState;
  readonly batchState: AuthoredBatchState;
  readonly targets: readonly LinearTargetReference[];
  readonly pickedExitIndex: number | null;
}

export interface LinearTerminalContinuation {
  readonly kind: 'terminal';
  readonly parentOccurrenceId: OccurrenceId;
  readonly targets: readonly LinearTargetReference[];
  readonly pickedExitIndex: number | null;
}

export type LinearContinuation = LinearBatchContinuation | LinearTerminalContinuation;

export interface LinearBiomeTopology {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly RoomOccurrence[];
  readonly continuations: readonly LinearContinuation[];
}

export interface LinearBiomePlan {
  readonly kind: 'LinearBiome';
  readonly biomeKey: string;
  readonly topology: LinearBiomeTopology | null;
}

export type AuthoredBiomePlan = LinearBiomePlan;

export interface AuthoredRoutePlan {
  readonly routeKey: string;
  readonly biomes: readonly AuthoredBiomePlan[];
}

export interface ProjectDocument {
  readonly schemaVersion: typeof PROJECT_DOCUMENT_SCHEMA_VERSION;
  readonly projectId: string;
  readonly name: string;
  readonly catalogVersion: string;
  readonly routes: readonly AuthoredRoutePlan[];
}
