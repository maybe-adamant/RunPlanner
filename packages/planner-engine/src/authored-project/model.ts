import type { ResolvedRewardOffer, RewardPayload } from '../reward-kernel/model';

export const PROJECT_DOCUMENT_SCHEMA_VERSION = 14 as const;

declare const occurrenceIdBrand: unique symbol;

export type OccurrenceId = string & {
  readonly [occurrenceIdBrand]: 'OccurrenceId';
};

export interface ShopOfferState {
  readonly offer: ResolvedRewardOffer;
}

export interface ShopState {
  readonly profileKey: string;
  readonly offers: Readonly<Record<string, ShopOfferState>>;
  /**
   * The exact authored sequence in which Shop slots are purchased. Inventory
   * remains declaration ordered in `offers`; membership and ordinals derive
   * only from this occurrence-owned list.
   */
  readonly purchaseOrder: readonly string[];
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

/**
 * Concrete authored encounter selections belong to the room instance that
 * owns the envelope slots. Fixed and empty slots deliberately have no entry.
 */
export interface RoomEncounterState {
  readonly encounterKeyByPhase: Readonly<Record<string, string>>;
}

export interface EphyraSideRoomState {
  readonly generation: SideRoomGeneration;
  readonly enteredOrdinal: number | null;
  readonly offer: ResolvedRewardOffer;
  readonly encounters: RoomEncounterState;
}

export interface EphyraCombatState {
  readonly kind: 'ephyraCombat';
  readonly offer: ResolvedRewardOffer;
  readonly sideRooms: Readonly<Record<string, EphyraSideRoomState>>;
}

/**
 * An Anomaly retains the normal-door offer it displaced, even when that offer
 * is not presently admitted by the Anomaly declaration. Evaluation owns the
 * resulting finding; persistence must never silently reroll or discard it.
 */
export interface AnomalyRoomState {
  readonly kind: 'anomaly';
  readonly offer: ResolvedRewardOffer;
  readonly success: boolean;
}

export type AuthoredRoomState =
  | { readonly kind: 'none' }
  | { readonly kind: 'fixed'; readonly payload?: RewardPayload }
  | { readonly kind: 'counted'; readonly offer: ResolvedRewardOffer }
  | AnomalyRoomState
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
  /**
   * Present only on an Anomaly room occupying a normal G target. The owning
   * target remains the topology identity; this remembers the displaced G
   * declaration for semantic revert without creating a shadow occurrence.
   */
  readonly anomalyReplacement?: AnomalyReplacementProvenance;
  readonly state: AuthoredRoomState;
  readonly encounters: RoomEncounterState;
  /** Source-owned closed sibling continuations emitted by this occurrence. */
  readonly additionalExits: readonly AuthoredAdditionalExit[];
}

export interface AnomalyReplacementProvenance {
  readonly replacedRoomGameName: string;
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
  | { readonly kind: 'normal'; readonly exitKey: string }
  | { readonly kind: 'additional'; readonly additionalExitKey: string };

export interface NormalDoorBatch {
  readonly kind: 'batch';
  readonly rewardStore: BatchRewardStoreState;
  readonly batchState: AuthoredBatchState;
  readonly targets: readonly ExitTargetReference[];
}

/**
 * Persisted additional exits are source-occurrence owned. They are not normal
 * targets and an exit decision never duplicates their ownership.
 */
export interface ZagreusContractAdditionalExit {
  readonly kind: 'zagreusContract';
  readonly key: 'zagreusContract';
  readonly occurrenceId: OccurrenceId;
}

export interface NaturalChaosAdditionalExit {
  readonly kind: 'naturalChaos';
  readonly key: 'naturalChaos';
  readonly occurrenceId: OccurrenceId;
}

export type AuthoredAdditionalExit = ZagreusContractAdditionalExit | NaturalChaosAdditionalExit;

export interface ExitDecision {
  readonly kind: 'exit';
  readonly source: ExitDecisionSource;
  readonly normal: NormalDoorBatch;
  readonly selection: ExitSelection;
}

export interface HubTargetReference {
  readonly hubSlotKey: string;
  readonly occurrenceId: OccurrenceId;
}

export interface HubDecision {
  readonly kind: 'hub';
  readonly hubKey: string;
  readonly source: Extract<ExitDecisionSource, { readonly kind: 'occurrence' }>;
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
