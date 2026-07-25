import type { ResolvedRewardOffer, RewardPayload } from '../reward-kernel/model';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 9 as const;

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
  | { readonly kind: 'authoredBaseStore'; readonly baseRewardStoreKey: string | null }
  | { readonly kind: 'sourceOfferPoint' }
  | { readonly kind: 'none' };

export interface FieldsCageBatchState {
  readonly cageOutcome: 'min' | 'max';
}

export type AuthoredBatchState = FieldsCageBatchState | null;

export type AuthoredFieldValue = boolean | number | string;

export type AuthoredBiomeState = Readonly<Record<string, AuthoredFieldValue | null>>;

export interface RoomOccurrence {
  readonly occurrenceId: OccurrenceId;
  readonly gameName: string;
  readonly state: AuthoredRoomState;
}

export interface ExitTargetReference {
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
}

export type ExitDecisionSource =
  | { readonly kind: 'occurrence'; readonly occurrenceId: OccurrenceId }
  | { readonly kind: 'hubDecision'; readonly decisionKey: string };

export type ExitSelection =
  | { readonly kind: 'derived' }
  | { readonly kind: 'unresolved' }
  | { readonly kind: 'normal'; readonly exitKey: string };

export interface LinkedNormalExit {
  readonly kind: 'linked';
  readonly exitKey: string;
  readonly occurrenceId: OccurrenceId;
}

export interface NormalDoorBatch {
  readonly kind: 'batch';
  readonly rewardStore: BatchRewardStoreState;
  readonly batchState: AuthoredBatchState;
  readonly targets: readonly ExitTargetReference[];
}

export interface ExitDecision {
  readonly kind: 'exit';
  readonly source: ExitDecisionSource;
  readonly normal: LinkedNormalExit | NormalDoorBatch;
  readonly selection: ExitSelection;
}

export interface HubTargetReference {
  readonly hubSlotKey: string;
  readonly occurrenceId: OccurrenceId;
}

export interface HubDecision {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly openTargets: readonly HubTargetReference[];
  readonly visitOrder: readonly string[];
}

export type NextRoomDecision = ExitDecision | HubDecision;

export interface BiomeTopology {
  readonly startOccurrenceId: OccurrenceId;
  readonly occurrences: readonly RoomOccurrence[];
  readonly decisions: readonly NextRoomDecision[];
}

export interface AuthoredBiomePlan {
  readonly biomeKey: string;
  readonly state: AuthoredBiomeState;
  readonly topology: BiomeTopology | null;
}

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
